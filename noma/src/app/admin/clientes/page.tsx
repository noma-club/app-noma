import { db, fmtDate, brl } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  createClient,
  updateClientStatus,
  createSubscription,
  registerSubscriptionPayment,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  visitante: "Visitante",
  experimental: "Experimental",
  avulso: "Avulso",
  fixo: "Fixo",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const me = await requireUser();
  const isOwner = me.role === "dono";
  const { ok, erro } = await searchParams;

  const { data: clients } = await db()
    .from("clients")
    .select(
      "id, name, birth_date, cpf, phone, status, access_token, subscriptions(id, status, next_due_date, plans(name, monthly_price))"
    )
    .order("name");

  const { data: plans } = await db()
    .from("plans")
    .select("id, name, duration_months, monthly_price")
    .eq("active", true)
    .order("name");

  return (
    <>
      {ok && <div className="msg msg-ok">{ok}</div>}
      {erro && <div className="msg msg-err">{erro}</div>}

      {isOwner && (
      <div className="card">
        <h2>Novo cliente</h2>
        <p className="muted">
          Obrigatórios: nome, data de nascimento, CPF e telefone. Visitante/experimental/avulso —
          vira <b>fixo</b> automaticamente ao fechar um plano.
        </p>
        <form action={createClient} className="grid grid-3">
          <div className="field">
            <label>Nome *</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>Data de nascimento</label>
            <input name="birth_date" type="date" />
          </div>
          <div className="field">
            <label>CPF</label>
            <input name="cpf" placeholder="000.000.000-00" />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input name="phone" placeholder="(00) 00000-0000" />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select name="status" defaultValue="visitante">
              <option value="visitante">Visitante</option>
              <option value="experimental">Experimental</option>
              <option value="avulso">Avulso</option>
              <option value="fixo">Fixo</option>
            </select>
          </div>
          <div className="field" style={{ alignSelf: "end" }}>
            <button>Cadastrar</button>
          </div>
        </form>
      </div>
      )}

      {clients?.map((c: any) => {
        const activeSub = (c.subscriptions ?? []).find((s: any) => s.status === "ativa");
        return (
          <div key={c.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <b>{c.name}</b>{" "}
                <span className={`badge badge-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                <div className="muted">
                  {c.phone && <>📞 {c.phone} · </>}
                  {c.birth_date && <>🎂 {fmtDate(c.birth_date)} · </>}
                  {c.cpf && <>CPF {c.cpf}</>}
                </div>
                {activeSub && (
                  <div className="muted">
                    Plano: <b>{activeSub.plans?.name}</b> ·{" "}
                    {brl(Number(activeSub.plans?.monthly_price ?? 0))}/mês · Próx. vencimento:{" "}
                    <b>{fmtDate(activeSub.next_due_date)}</b>
                  </div>
                )}
                <div className="muted">
                  Link do aluno: <code>/aluno/{c.access_token}</code>
                </div>
              </div>

              {isOwner && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
                <form action={updateClientStatus} className="inline">
                  <input type="hidden" name="id" value={c.id} />
                  <select name="status" defaultValue={c.status}>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <button className="btn-sm btn-outline">Mudar tipo</button>
                </form>

                {activeSub ? (
                  <form action={registerSubscriptionPayment} className="inline">
                    <input type="hidden" name="subscription_id" value={activeSub.id} />
                    <select name="method" defaultValue="pix">
                      <option value="pix">Pix</option>
                      <option value="credito">Crédito</option>
                      <option value="debito">Débito</option>
                      <option value="dinheiro">Dinheiro</option>
                    </select>
                    <button className="btn-sm">Receber mensalidade</button>
                  </form>
                ) : (
                  <form action={createSubscription} className="inline">
                    <input type="hidden" name="client_id" value={c.id} />
                    <select name="plan_id" required>
                      <option value="">Fechar plano…</option>
                      {plans?.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.duration_months}m — {brl(Number(p.monthly_price))}/mês)
                        </option>
                      ))}
                    </select>
                    <input
                      name="start_date"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                      style={{ width: 150 }}
                    />
                    <button className="btn-sm">Ativar</button>
                  </form>
                )}
              </div>
              )}
            </div>
          </div>
        );
      })}
      {!clients?.length && (
        <div className="card">
          <p className="muted">Nenhum cliente cadastrado ainda.</p>
        </div>
      )}
    </>
  );
}
