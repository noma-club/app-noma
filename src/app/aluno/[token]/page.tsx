import { db, fmtDate, fmtDateTime, hoursUntil, ENROLL_CANCEL_WINDOW_HOURS } from "@/lib/db";
import { availableMakeups } from "@/lib/enrollment";
import { alunoEnroll, alunoCancel } from "./actions";

export const dynamic = "force-dynamic";

export default async function AlunoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: client } = await db()
    .from("clients")
    .select("id, name, status, subscriptions(status, next_due_date, plans(name))")
    .eq("access_token", token)
    .single();

  if (!client) {
    return (
      <div className="center-page">
        <div className="card">
          <img src="/logo.svg" alt="Noma Club" className="logo-mark" />
          <div className="logo">Noma Club</div>
        <div className="tagline">Pilates · Movimento · Conexão</div>
          <p>Link inválido. Fale com o estúdio para receber seu acesso.</p>
        </div>
      </div>
    );
  }

  const activeSub = (client.subscriptions ?? []).find((s: any) => s.status === "ativa");
  const makeups = await availableMakeups(client.id);

  // Aulas dos próximos 14 dias
  const now = new Date().toISOString();
  const in14 = new Date(Date.now() + 14 * 864e5).toISOString();
  const { data: classes } = await db()
    .from("classes")
    .select(
      "id, starts_at, capacity, released_spots, class_types(name), spaces(name), profiles(name), enrollments(id, client_id, status), waitlist(id, client_id)"
    )
    .gte("starts_at", now)
    .lte("starts_at", in14)
    .order("starts_at");

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="card" style={{ marginTop: 16 }}>
        <img src="/logo.svg" alt="Noma Club" className="logo-mark" />
        <div className="logo">Noma Club</div>
        <div className="tagline">Pilates · Movimento · Conexão</div>
        <p style={{ textAlign: "center", margin: 0 }}>
          Olá, <b>{client.name}</b>!
        </p>
        <p className="muted" style={{ textAlign: "center" }}>
          {activeSub ? (
            <>
              Plano <b>{(activeSub as any).plans?.name}</b> · próximo vencimento{" "}
              <b>{fmtDate((activeSub as any).next_due_date)}</b>
            </>
          ) : (
            <>Você ainda não tem um plano ativo.</>
          )}
          {" · "}Reposições disponíveis: <b>{makeups}</b>
        </p>
        <p className="muted" style={{ textAlign: "center" }}>
          Inscrições e cancelamentos até <b>{ENROLL_CANCEL_WINDOW_HOURS}h antes</b> da aula.
          Cancelando no prazo você ganha reposição (máx. 2/mês).
        </p>
      </div>

      <h2 style={{ fontSize: 16 }}>Próximas aulas</h2>
      {!classes?.length && (
        <div className="card">
          <p className="muted">Nenhuma aula aberta nos próximos 14 dias.</p>
        </div>
      )}

      {classes?.map((c: any) => {
        const activeEnr = (c.enrollments ?? []).filter((e: any) => e.status !== "cancelado");
        const mine = activeEnr.find((e: any) => e.client_id === client.id);
        const inWaitlist = (c.waitlist ?? []).some((w: any) => w.client_id === client.id);
        const spotsLeft = Math.max(0, c.released_spots - activeEnr.length);
        const h = hoursUntil(c.starts_at);
        const windowOpen = h >= ENROLL_CANCEL_WINDOW_HOURS;

        return (
          <div key={c.id} className="class-item">
            <div className="info">
              <div className="t">
                {fmtDateTime(c.starts_at)} — {c.class_types?.name}
              </div>
              <div className="muted">
                {c.spaces?.name} · Prof. {c.profiles?.name} ·{" "}
                {spotsLeft > 0 ? `${spotsLeft} vaga(s)` : "Lotada"}
              </div>
            </div>
            <div>
              {mine ? (
                windowOpen ? (
                  <form action={alunoCancel}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="class_id" value={c.id} />
                    <button className="btn-sm btn-outline">Cancelar</button>
                  </form>
                ) : (
                  <span className="badge badge-fixo">Inscrito ✓</span>
                )
              ) : inWaitlist ? (
                <span className="badge badge-experimental">Na espera</span>
              ) : windowOpen ? (
                <div style={{ display: "flex", gap: 4, flexDirection: "column" }}>
                  <form action={alunoEnroll}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="class_id" value={c.id} />
                    <button className="btn-sm">
                      {spotsLeft > 0 ? "Inscrever" : "Entrar na espera"}
                    </button>
                  </form>
                  {makeups > 0 && spotsLeft > 0 && (
                    <form action={alunoEnroll}>
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="class_id" value={c.id} />
                      <input type="hidden" name="as_makeup" value="1" />
                      <button className="btn-sm btn-outline">Usar reposição</button>
                    </form>
                  )}
                </div>
              ) : (
                <span className="badge badge-visitante">Encerrado</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
