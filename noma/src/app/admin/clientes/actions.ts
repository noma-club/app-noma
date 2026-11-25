"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { check } from "@/lib/dbwrite";
import { redirect } from "next/navigation";

const BACK = "/admin/clientes";

/** Interrompe a ação mostrando o motivo na tela, em vez de sair calado. */
function fail(msg: string): never {
  redirect(`${BACK}?erro=${encodeURIComponent(msg)}`);
}

export async function createClient(formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  check(
    await db().from("clients").insert({
      name,
      birth_date: String(formData.get("birth_date") || "") || null,
      cpf: String(formData.get("cpf") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      status: String(formData.get("status") || "visitante"),
    }),
    BACK,
    "Criar cliente"
  );
  revalidatePath("/admin/clientes");
}

export async function updateClientStatus(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  await db().from("clients").update({ status }).eq("id", id);
  revalidatePath("/admin/clientes");
}

/** Fechar plano: cliente vira FIXO e ganha assinatura com vencimento mensal. */
export async function createSubscription(formData: FormData) {
  await requireOwner();
  const clientId = String(formData.get("client_id"));
  const planId = String(formData.get("plan_id"));
  const startDate = String(formData.get("start_date"));
  if (!clientId || !planId || !startDate) return;

  const { data: plan, error: planErr } = await db()
    .from("plans")
    .select("duration_months")
    .eq("id", planId)
    .single();
  if (planErr || !plan) {
    fail(
      `Fechar plano falhou — não consegui ler o plano escolhido${
        planErr ? `: ${planErr.message}` : " (plano não encontrado)."
      }`
    );
  }

  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + plan.duration_months);
  const nextDue = new Date(start);
  nextDue.setUTCMonth(nextDue.getUTCMonth() + 1);

  check(
    await db().from("subscriptions").insert({
      client_id: clientId,
      plan_id: planId,
      start_date: startDate,
      end_date: end.toISOString().slice(0, 10),
      next_due_date: nextDue.toISOString().slice(0, 10),
      status: "ativa",
    }),
    BACK,
    "Fechar plano"
  );
  // Regra da reunião: aluno é fixo a partir do momento que fecha um plano
  check(
    await db().from("clients").update({ status: "fixo" }).eq("id", clientId),
    BACK,
    "Marcar aluno como fixo"
  );
  revalidatePath("/admin/clientes");
}

/** Registra pagamento da mensalidade e empurra o vencimento 1 mês. */
export async function registerSubscriptionPayment(formData: FormData) {
  await requireOwner();
  const subId = String(formData.get("subscription_id"));
  const method = String(formData.get("method"));
  const { data: sub, error: subErr } = await db()
    .from("subscriptions")
    .select("id, client_id, next_due_date, plans(name, monthly_price)")
    .eq("id", subId)
    .single();
  if (subErr || !sub) {
    fail(
      `Receber mensalidade falhou — não consegui ler a assinatura${
        subErr ? `: ${subErr.message}` : " (assinatura não encontrada)."
      }`
    );
  }

  const plan: any = sub.plans;
  await db().from("payments").insert({
    client_id: sub.client_id,
    subscription_id: sub.id,
    description: `Mensalidade ${plan?.name ?? ""} (venc. ${sub.next_due_date})`,
    kind: "mensalidade",
    amount: Number(plan?.monthly_price ?? 0),
    method,
  });

  const next = new Date(`${sub.next_due_date}T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  await db()
    .from("subscriptions")
    .update({ next_due_date: next.toISOString().slice(0, 10) })
    .eq("id", sub.id);

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin");
}
