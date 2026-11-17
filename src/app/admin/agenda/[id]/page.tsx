import { db, fmtDateTime } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { adminEnroll, adminCancel, setAttendance } from "../actions";

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const { data: klass } = await db()
    .from("classes")
    .select(
      "id, starts_at, capacity, released_spots, class_types(name), spaces(name), profiles(name)"
    )
    .eq("id", id)
    .single();

  if (!klass) {
    return (
      <div className="card">
        <p>Aula não encontrada.</p>
      </div>
    );
  }

  const { data: enrollments } = await db()
    .from("enrollments")
    .select("id, status, is_makeup, cancelled_in_time, clients(id, name, phone, status)")
    .eq("class_id", id)
    .order("created_at");

  const { data: waitlist } = await db()
    .from("waitlist")
    .select("id, created_at, clients(id, name)")
    .eq("class_id", id)
    .order("created_at");

  const { data: allClients } = await db()
    .from("clients")
    .select("id, name")
    .order("name");

  const active = (enrollments ?? []).filter((e: any) => e.status !== "cancelado");
  const cancelled = (enrollments ?? []).filter((e: any) => e.status === "cancelado");
  const k: any = klass;

  return (
    <>
      <div className="card">
        <h2>
          {k.class_types?.name} — {fmtDateTime(k.starts_at)}
        </h2>
        <p className="muted">
          {k.spaces?.name} · Prof. {k.profiles?.name} · {active.length}/{k.capacity} inscritos ·{" "}
          {k.released_spots} vagas liberadas online
        </p>

        <h3>Inscrever cliente (admin ignora a regra das 6h)</h3>
        <form action={adminEnroll} className="inline">
          <input type="hidden" name="class_id" value={id} />
          <select name="client_id" required style={{ minWidth: 220 }}>
            <option value="">Selecione…</option>
            {allClients?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="btn-sm">Inscrever</button>
        </form>
      </div>

      <div className="card">
        <h2>Chamada</h2>
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Situação</th>
              <th>Presença</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {active.map((e: any) => (
              <tr key={e.id}>
                <td>
                  {e.clients?.name}
                  {e.is_makeup && <span className="badge badge-experimental"> reposição</span>}
                </td>
                <td>
                  <span
                    className={
                      e.status === "presente"
                        ? "badge badge-fixo"
                        : e.status === "falta"
                        ? "badge badge-danger"
                        : "badge badge-visitante"
                    }
                  >
                    {e.status}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  <form action={setAttendance}>
                    <input type="hidden" name="enrollment_id" value={e.id} />
                    <input type="hidden" name="class_id" value={id} />
                    <input type="hidden" name="status" value="presente" />
                    <button className="btn-sm">Presente</button>
                  </form>
                  <form action={setAttendance}>
                    <input type="hidden" name="enrollment_id" value={e.id} />
                    <input type="hidden" name="class_id" value={id} />
                    <input type="hidden" name="status" value="falta" />
                    <button className="btn-sm btn-outline">Falta</button>
                  </form>
                </td>
                <td>
                  <form action={adminCancel}>
                    <input type="hidden" name="class_id" value={id} />
                    <input type="hidden" name="client_id" value={e.clients?.id} />
                    <button className="btn-sm btn-danger">Cancelar</button>
                  </form>
                </td>
              </tr>
            ))}
            {!active.length && (
              <tr>
                <td colSpan={4} className="muted">Nenhum inscrito.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Lista de espera ({waitlist?.length ?? 0})</h2>
          {!waitlist?.length && <p className="muted">Vazia.</p>}
          <ol>
            {waitlist?.map((w: any) => (
              <li key={w.id}>{w.clients?.name}</li>
            ))}
          </ol>
          <p className="muted">
            Ao abrir vaga (cancelamento), o 1º da lista é inscrito automaticamente.
          </p>
        </div>

        <div className="card">
          <h2>Cancelamentos</h2>
          {!cancelled.length && <p className="muted">Nenhum.</p>}
          <ul>
            {cancelled.map((e: any) => (
              <li key={e.id}>
                {e.clients?.name}{" "}
                <span className="muted">
                  ({e.cancelled_in_time ? "no prazo — gerou reposição" : "fora do prazo — sem reposição"})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
