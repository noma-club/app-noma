import {
  db,
  hoursUntil,
  ENROLL_CANCEL_WINDOW_HOURS,
  MAX_MAKEUPS_PER_MONTH,
} from "./db";

/**
 * Regras da reunião de alinhamento:
 *  - Marcar ou cancelar: somente até 6h antes do início da aula.
 *  - Cancelou com >= 6h: ganha crédito de reposição (máx. 2/mês por cliente).
 *  - Cancelou com < 6h (feito pelo admin, aluno nem consegue): perde a reposição.
 *  - Aula lotada: entra na lista de espera; ao abrir vaga, promove o 1º da fila.
 */

export type ActionResult = { ok: boolean; message: string };

function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function countEnrolled(classId: string): Promise<number> {
  const { count } = await db()
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .in("status", ["inscrito", "presente", "falta"]);
  return count ?? 0;
}

/** Inscreve um cliente numa aula (ou lista de espera se lotada). */
export async function enrollClient(
  classId: string,
  clientId: string,
  opts: { byAdmin?: boolean; asMakeup?: boolean } = {}
): Promise<ActionResult> {
  const { data: klass } = await db()
    .from("classes")
    .select("id, starts_at, released_spots, capacity")
    .eq("id", classId)
    .single();
  if (!klass) return { ok: false, message: "Aula não encontrada." };

  const h = hoursUntil(klass.starts_at);
  if (h < 0) return { ok: false, message: "Essa aula já aconteceu." };
  if (!opts.byAdmin && h < ENROLL_CANCEL_WINDOW_HOURS) {
    return {
      ok: false,
      message: `Inscrições encerram ${ENROLL_CANCEL_WINDOW_HOURS}h antes da aula.`,
    };
  }

  // Já inscrito?
  const { data: existing } = await db()
    .from("enrollments")
    .select("id, status")
    .eq("class_id", classId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing && existing.status !== "cancelado") {
    return { ok: false, message: "Cliente já está inscrito nessa aula." };
  }

  // Se vai usar reposição, verificar crédito disponível
  if (opts.asMakeup) {
    const { data: credit } = await db()
      .from("makeup_credits")
      .select("id")
      .eq("client_id", clientId)
      .is("used_enrollment_id", null)
      .limit(1)
      .maybeSingle();
    if (!credit) return { ok: false, message: "Sem crédito de reposição disponível." };
  }

  // Lotada? → lista de espera (limite de vagas liberadas para inscrição)
  const enrolled = await countEnrolled(classId);
  const limit = opts.byAdmin ? klass.capacity : klass.released_spots;
  if (enrolled >= limit) {
    const { error: wlErr } = await db()
      .from("waitlist")
      .insert({ class_id: classId, client_id: clientId });
    if (wlErr && !wlErr.message.includes("duplicate")) {
      return { ok: false, message: "Erro ao entrar na lista de espera." };
    }
    return { ok: true, message: "Aula lotada — cliente entrou na lista de espera." };
  }

  // Inscrever (reativa se havia cancelamento anterior)
  const payload = {
    class_id: classId,
    client_id: clientId,
    status: "inscrito",
    is_makeup: !!opts.asMakeup,
    cancelled_at: null,
    cancelled_in_time: null,
  };
  const { data: enr, error } = existing
    ? await db().from("enrollments").update(payload).eq("id", existing.id).select("id").single()
    : await db().from("enrollments").insert(payload).select("id").single();
  if (error || !enr) return { ok: false, message: "Erro ao inscrever." };

  // Consome o crédito de reposição
  if (opts.asMakeup) {
    const { data: credit } = await db()
      .from("makeup_credits")
      .select("id")
      .eq("client_id", clientId)
      .is("used_enrollment_id", null)
      .order("created_at")
      .limit(1)
      .single();
    if (credit) {
      await db()
        .from("makeup_credits")
        .update({ used_enrollment_id: enr.id })
        .eq("id", credit.id);
    }
  }

  // Sai da lista de espera dessa aula, se estava
  await db().from("waitlist").delete().eq("class_id", classId).eq("client_id", clientId);

  return { ok: true, message: "Inscrição confirmada!" };
}

/** Cancela a inscrição. Aluno: só até 6h antes. Admin: sempre pode. */
export async function cancelEnrollment(
  classId: string,
  clientId: string,
  opts: { byAdmin?: boolean } = {}
): Promise<ActionResult> {
  const { data: klass } = await db()
    .from("classes")
    .select("id, starts_at")
    .eq("id", classId)
    .single();
  if (!klass) return { ok: false, message: "Aula não encontrada." };

  const { data: enr } = await db()
    .from("enrollments")
    .select("id, status, is_makeup")
    .eq("class_id", classId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!enr || enr.status === "cancelado") {
    return { ok: false, message: "Inscrição não encontrada." };
  }

  const h = hoursUntil(klass.starts_at);
  const inTime = h >= ENROLL_CANCEL_WINDOW_HOURS;

  if (!opts.byAdmin && !inTime) {
    return {
      ok: false,
      message: `Cancelamento só até ${ENROLL_CANCEL_WINDOW_HOURS}h antes da aula. Fale com o estúdio.`,
    };
  }

  await db()
    .from("enrollments")
    .update({
      status: "cancelado",
      cancelled_at: new Date().toISOString(),
      cancelled_in_time: inTime,
    })
    .eq("id", enr.id);

  // Devolve crédito se a inscrição cancelada era uma reposição
  if (enr.is_makeup) {
    await db()
      .from("makeup_credits")
      .update({ used_enrollment_id: null })
      .eq("used_enrollment_id", enr.id);
  }

  let msg = "Inscrição cancelada.";

  // Cancelou em tempo → gera crédito de reposição (máx. 2/mês)
  if (inTime && !enr.is_makeup) {
    const m = monthStart();
    const { count } = await db()
      .from("makeup_credits")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("earned_month", m);
    if ((count ?? 0) < MAX_MAKEUPS_PER_MONTH) {
      await db().from("makeup_credits").insert({
        client_id: clientId,
        earned_month: m,
        source_enrollment_id: enr.id,
      });
      msg = "Cancelado. Você ganhou 1 crédito de reposição.";
    } else {
      msg = `Cancelado. Limite de ${MAX_MAKEUPS_PER_MONTH} reposições no mês já atingido.`;
    }
  } else if (!inTime) {
    msg = "Cancelado fora do prazo — sem direito a reposição.";
  }

  // Promove o primeiro da lista de espera
  const { data: next } = await db()
    .from("waitlist")
    .select("id, client_id")
    .eq("class_id", classId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (next) {
    const res = await enrollClient(classId, next.client_id, { byAdmin: true });
    if (res.ok) {
      await db().from("waitlist").delete().eq("id", next.id);
      msg += " Primeiro da lista de espera foi promovido.";
    }
  }

  return { ok: true, message: msg };
}

/** Créditos de reposição disponíveis de um cliente. */
export async function availableMakeups(clientId: string): Promise<number> {
  const { count } = await db()
    .from("makeup_credits")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("used_enrollment_id", null);
  return count ?? 0;
}
