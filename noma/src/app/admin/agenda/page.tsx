import Link from "next/link";
import { db, fmtDateTime, TZ } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createClass, deleteClass } from "./actions";

export const dynamic = "force-dynamic";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const user = await requireUser();
  const { semana } = await searchParams;

  // Semana começando na segunda
  const base = semana ? new Date(`${semana}T12:00:00Z`) : new Date();
  const dow = (base.getUTCDay() + 6) % 7; // 0 = segunda
  const monday = new Date(base);
  monday.setUTCDate(monday.getUTCDate() - dow);
  const mondayStr = monday.toISOString().slice(0, 10);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 7);

  const weekStart = new Date(`${mondayStr}T00:00:00-03:00`).toISOString();
  const weekEnd = new Date(`${sunday.toISOString().slice(0, 10)}T00:00:00-03:00`).toISOString();

  // Professor vê somente as aulas dele; dono vê tudo
  let q = db()
    .from("classes")
    .select(
      "id, starts_at, duration_min, capacity, released_spots, class_types(name), spaces(name), profiles(name), enrollments(id, status), waitlist(id)"
    )
    .gte("starts_at", weekStart)
    .lt("starts_at", weekEnd)
    .order("starts_at");
  if (user.role !== "dono") q = q.eq("teacher_id", user.id);
  const { data: classes } = await q;

  const [{ data: types }, { data: spaces }, { data: teachers }, prevStr, nextStr] =
    await Promise.all([
      db().from("class_types").select("id, name, max_students").eq("active", true).order("name"),
      db().from("spaces").select("id, name, capacity").eq("active", true).order("name"),
      db().from("profiles").select("id, name").order("name"),
      Promise.resolve(
        new Date(monday.getTime() - 7 * 864e5).toISOString().slice(0, 10)
      ),
      Promise.resolve(
        new Date(monday.getTime() + 7 * 864e5).toISOString().slice(0, 10)
      ),
    ]);

  // Agrupa por dia (fuso do estúdio)
  const byDay = new Map<string, any[]>();
  for (const c of classes ?? []) {
    const day = new Date(c.starts_at).toLocaleDateString("pt-BR", {
      timeZone: TZ,
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    });
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(c);
  }

  return (
    <>
      <div className="card">
        <h2>Nova aula</h2>
        <form action={createClass} className="grid grid-3">
          <div className="field">
            <label>Modalidade</label>
            <select name="class_type_id" required>
              {types?.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} (máx. {t.max_students})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Espaço</label>
            <select name="space_id" required>
              {spaces?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} (cap. {s.capacity})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Professor</label>
            <select name="teacher_id" defaultValue={user.id} required>
              {teachers?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Data</label>
            <input name="date" type="date" required />
          </div>
          <div className="field">
            <label>Horário</label>
            <input name="time" type="time" required />
          </div>
          <div className="field">
            <label>Vagas liberadas p/ inscrição online</label>
            <input name="released_spots" type="number" min="0" placeholder="= capacidade" />
          </div>
          <div className="field" style={{ alignSelf: "end" }}>
            <button>Criar aula</button>
          </div>
        </form>
        <p className="muted">
          A capacidade final é o menor valor entre a modalidade e o espaço. "Vagas liberadas"
          limita quantas podem ser preenchidas pelo link do aluno.
        </p>
      </div>

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link className="btn btn-sm btn-outline" href={`/admin/agenda?semana=${prevStr}`}>
          ← Semana anterior
        </Link>
        <b>Semana de {mondayStr}</b>
        <Link className="btn btn-sm btn-outline" href={`/admin/agenda?semana=${nextStr}`}>
          Próxima semana →
        </Link>
      </div>

      {[...byDay.entries()].map(([day, list]) => (
        <div key={day} className="card">
          <h2 style={{ textTransform: "capitalize" }}>{day}</h2>
          {list.map((c: any) => {
            const inscritos = (c.enrollments ?? []).filter(
              (e: any) => e.status !== "cancelado"
            ).length;
            const espera = (c.waitlist ?? []).length;
            return (
              <div key={c.id} className="class-item">
                <div className="info">
                  <div className="t">
                    {fmtDateTime(c.starts_at)} — {c.class_types?.name}
                  </div>
                  <div className="muted">
                    {c.spaces?.name} · {c.profiles?.name} · {inscritos}/{c.capacity} inscritos (
                    {c.released_spots} liberadas{espera > 0 && <> · {espera} na espera</>})
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Link className="btn btn-sm" href={`/admin/agenda/${c.id}`}>
                    Inscritos / Chamada
                  </Link>
                  <form action={deleteClass}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn-sm btn-danger">Excluir</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {!classes?.length && (
        <div className="card">
          <p className="muted">Nenhuma aula nesta semana.</p>
        </div>
      )}
    </>
  );
}
