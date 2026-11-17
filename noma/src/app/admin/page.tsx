import Link from "next/link";
import { db, fmtDate, fmtTime, brl, TZ } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();

  const now = new Date();
  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD local
  const startOfDay = new Date(`${todayStr}T00:00:00-03:00`).toISOString();
  const endOfDay = new Date(`${todayStr}T23:59:59-03:00`).toISOString();

  // Aulas de hoje — professor vê somente as dele
  let classQuery = db()
    .from("classes")
    .select(
      "id, starts_at, capacity, released_spots, class_types(name), spaces(name), profiles(name), enrollments(id, status)"
    )
    .gte("starts_at", startOfDay)
    .lte("starts_at", endOfDay)
    .order("starts_at");
  if (user.role !== "dono") classQuery = classQuery.eq("teacher_id", user.id);
  const { data: todayClasses } = await classQuery;

  // Vencimentos nos próximos 7 dias + atrasados
  const in7 = new Date(now.getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const { data: dueSubs } = await db()
    .from("subscriptions")
    .select("id, next_due_date, clients(id, name, phone), plans(name, monthly_price)")
    .eq("status", "ativa")
    .lte("next_due_date", in7)
    .order("next_due_date");

  // Aniversariantes do mês
  const month = Number(todayStr.slice(5, 7));
  const { data: allClients } = await db()
    .from("clients")
    .select("id, name, birth_date")
    .not("birth_date", "is", null);
  const birthdays = (allClients ?? [])
    .filter((c) => c.birth_date && Number(String(c.birth_date).slice(5, 7)) === month)
    .sort((a, b) => String(a.birth_date).slice(8) < String(b.birth_date).slice(8) ? -1 : 1);

  // Contadores
  const { count: totalClients } = await db()
    .from("clients")
    .select("id", { count: "exact", head: true });
  const { count: fixos } = await db()
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("status", "fixo");

  return (
    <>
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="n">{totalClients ?? 0}</div>
          <div className="l">Clientes</div>
        </div>
        <div className="card stat">
          <div className="n">{fixos ?? 0}</div>
          <div className="l">Alunos fixos</div>
        </div>
        <div className="card stat">
          <div className="n">{todayClasses?.length ?? 0}</div>
          <div className="l">Aulas hoje</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Aulas de hoje {user.role !== "dono" && <span className="muted">(suas)</span>}</h2>
          {!todayClasses?.length && <p className="muted">Nenhuma aula hoje.</p>}
          {todayClasses?.map((c: any) => {
            const inscritos = (c.enrollments ?? []).filter(
              (e: any) => e.status !== "cancelado"
            ).length;
            return (
              <div key={c.id} className="class-item">
                <div className="info">
                  <div className="t">
                    {fmtTime(c.starts_at)} — {c.class_types?.name}
                  </div>
                  <div className="muted">
                    {c.spaces?.name} · {c.profiles?.name} · {inscritos}/{c.capacity} inscritos
                  </div>
                </div>
                <Link className="btn btn-sm" href={`/admin/agenda/${c.id}`}>
                  Chamada
                </Link>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h2>Vencimentos (próx. 7 dias e atrasados)</h2>
          {!dueSubs?.length && <p className="muted">Nenhum vencimento próximo.</p>}
          {dueSubs?.map((s: any) => {
            const overdue = s.next_due_date < todayStr;
            return (
              <div key={s.id} className="class-item">
                <div className="info">
                  <div className="t">{s.clients?.name}</div>
                  <div className="muted">
                    {s.plans?.name} · {brl(Number(s.plans?.monthly_price ?? 0))}
                  </div>
                </div>
                <span className={overdue ? "badge badge-danger" : "badge badge-experimental"}>
                  {overdue ? "Atrasado: " : "Vence: "}
                  {fmtDate(s.next_due_date)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>🎂 Aniversariantes do mês</h2>
        {!birthdays.length && <p className="muted">Nenhum aniversariante este mês.</p>}
        {birthdays.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Cliente</th>
              </tr>
            </thead>
            <tbody>
              {birthdays.map((c) => (
                <tr key={c.id}>
                  <td>{String(c.birth_date).slice(8, 10)}</td>
                  <td>{c.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
