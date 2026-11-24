import Link from "next/link";
import { db, TZ, fmtTime } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createClass, deleteClass } from "./actions";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

const DOW = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const user = await requireUser();
  const isOwner = user.role === "dono";
  const { semana } = await searchParams;

  // Semana começando na segunda (âncora ao meio-dia UTC = mesma data local, BR sem DST)
  const base = semana ? new Date(`${semana}T12:00:00Z`) : new Date();
  const dow = (base.getUTCDay() + 6) % 7; // 0 = segunda
  const monday = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12));
  monday.setUTCDate(monday.getUTCDate() - dow);
  const mondayStr = monday.toISOString().slice(0, 10);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * 864e5);
    return { key: d.toISOString().slice(0, 10), dow: DOW[i], dnum: d.getUTCDate() };
  });
  const weekStart = new Date(`${days[0].key}T00:00:00-03:00`).toISOString();
  const weekEnd = new Date(`${days[6].key}T23:59:59-03:00`).toISOString();
  const todayKey = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

  let q = db()
    .from("classes")
    .select(
      "id, starts_at, capacity, released_spots, class_types(name), spaces(name), profiles(name), enrollments(id, status), waitlist(id)"
    )
    .gte("starts_at", weekStart)
    .lte("starts_at", weekEnd)
    .order("starts_at");
  if (user.role !== "dono") q = q.eq("teacher_id", user.id);
  const { data: classes } = await q;

  const [{ data: types }, { data: spaces }, { data: teachers }] = await Promise.all([
    db().from("class_types").select("id, name, max_students").eq("active", true).order("name"),
    db().from("spaces").select("id, name, capacity").eq("active", true).order("name"),
    db().from("profiles").select("id, name").eq("active", true).order("name"),
  ]);

  const prevStr = new Date(monday.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const nextStr = new Date(monday.getTime() + 7 * 864e5).toISOString().slice(0, 10);

  // Agrupa por data local (fuso do estúdio)
  const byDate = new Map<string, any[]>();
  for (const c of classes ?? []) {
    const k = new Date(c.starts_at).toLocaleDateString("sv-SE", { timeZone: TZ });
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(c);
  }

  return (
    <>
      {/* ---------------- Nova aula (somente dono) ---------------- */}
      {isOwner && (
      <div className="card">
        <h2>Nova aula</h2>
        <form action={createClass} className="grid grid-3">
          <div className="field">
            <label>Modalidade</label>
            <select name="class_type_id" required>
              {types?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} (máx. {t.max_students})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Espaço</label>
            <select name="space_id" required>
              {spaces?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} (cap. {s.capacity})</option>
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
            <input name="date" type="date" required defaultValue={todayKey} />
          </div>
          <div className="field">
            <label>Horário</label>
            <input name="time" type="time" required />
          </div>
          <div className="field">
            <label>Vagas liberadas online</label>
            <input name="released_spots" type="number" min="0" placeholder="= capacidade" />
          </div>
          <div className="field" style={{ alignSelf: "end" }}>
            <button type="submit" className="btn-block">Criar aula</button>
          </div>
        </form>
        <p className="muted">
          A capacidade é o menor valor entre modalidade e espaço. "Vagas liberadas" limita quantas
          podem ser preenchidas pelo link do aluno.
        </p>
      </div>
      )}

      {/* ---------------- Calendário semanal ---------------- */}
      <div className="card">
        <div className="period-nav" style={{ marginBottom: 14 }}>
          <Link className="btn btn-sm btn-outline" href={`/admin/agenda?semana=${prevStr}`}>← Semana anterior</Link>
          <h2 className="title" style={{ margin: 0 }}>
            Semana de {Number(mondayStr.slice(8))}/{mondayStr.slice(5, 7)}
          </h2>
          <Link className="btn btn-sm btn-outline" href={`/admin/agenda?semana=${nextStr}`}>Próxima semana →</Link>
        </div>

        <div className="cal-scroll">
          <div className="cal-grid">
            {days.map((d) => {
              const list = byDate.get(d.key) ?? [];
              return (
                <div key={d.key} className={`cal-day ${d.key === todayKey ? "today" : ""}`}>
                  <div className="cal-dayhead">
                    <div className="dow">{d.dow}</div>
                    <div className="dnum">{d.dnum}</div>
                  </div>
                  {list.map((c: any) => {
                    const inscritos = (c.enrollments ?? []).filter((e: any) => e.status !== "cancelado").length;
                    const cheia = inscritos >= c.capacity;
                    const vagas = Math.max(0, c.released_spots - inscritos);
                    return (
                      <Link
                        key={c.id}
                        href={`/admin/agenda/${c.id}`}
                        className={`cal-event ${cheia ? "full" : vagas > 0 ? "okvagas" : ""}`}
                      >
                        <div className="ev-time">{fmtTime(c.starts_at)}</div>
                        <div className="ev-name">{c.class_types?.name}</div>
                        <div className="ev-meta">
                          {c.spaces?.name} · {inscritos}/{c.capacity}
                        </div>
                      </Link>
                    );
                  })}
                  {!list.length && <div className="cal-empty">—</div>}
                </div>
              );
            })}
          </div>
        </div>
        <p className="muted mt">
          Toque numa aula para ver inscritos e fazer a chamada. Borda
          {" "}<span style={{ color: "var(--green)" }}>verde</span> = tem vaga,
          {" "}<span style={{ color: "var(--danger)" }}>vermelha</span> = lotada.
        </p>
      </div>

      {/* ---------------- Lista para excluir ---------------- */}
      {!!classes?.length && (
        <div className="card">
          <h3>Gerenciar aulas da semana</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Dia</th><th>Horário</th><th>Aula</th><th>Espaço</th><th></th></tr>
              </thead>
              <tbody>
                {(classes ?? []).map((c: any) => {
                  const k = new Date(c.starts_at).toLocaleDateString("sv-SE", { timeZone: TZ });
                  const di = days.find((x) => x.key === k);
                  return (
                    <tr key={c.id}>
                      <td>{di ? `${di.dow} ${di.dnum}` : k}</td>
                      <td>{fmtTime(c.starts_at)}</td>
                      <td>{c.class_types?.name}</td>
                      <td>{c.spaces?.name}</td>
                      <td className="num">
                        {isOwner && (
                        <form action={deleteClass}>
                          <input type="hidden" name="id" value={c.id} />
                          <ConfirmButton message="Excluir esta aula?" className="btn-sm btn-ghost">✕</ConfirmButton>
                        </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
