import { db, fmtDate, brl } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addPayment, addExpense, markExpensePaid } from "./actions";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "aluguel",
  "internet",
  "contabilidade",
  "luz",
  "impostos",
  "celular",
  "equipamento",
  "manutencao",
  "outro",
];

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireUser();
  const { mes } = await searchParams;
  const month = mes ?? new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;

  const { data: payments } = await db()
    .from("payments")
    .select("id, description, kind, amount, method, paid_at, clients(name)")
    .gte("paid_at", monthStart)
    .lt("paid_at", nextMonth)
    .order("paid_at", { ascending: false });

  const { data: expenses } = await db()
    .from("expenses")
    .select("id, description, category, amount, recurring, due_day, paid_at")
    .eq("reference_month", monthStart)
    .order("category");

  const { data: clients } = await db().from("clients").select("id, name").order("name");

  const totalIn = (payments ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
  const totalOut = (expenses ?? [])
    .filter((e: any) => e.paid_at)
    .reduce((s, e: any) => s + Number(e.amount), 0);
  const totalPending = (expenses ?? [])
    .filter((e: any) => !e.paid_at)
    .reduce((s, e: any) => s + Number(e.amount), 0);

  const prevMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const nextMonthLink = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;

  return (
    <>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a className="btn btn-sm btn-outline" href={`/admin/financeiro?mes=${prevMonth}`}>
          ← {prevMonth}
        </a>
        <h2 style={{ margin: 0 }}>Fluxo de caixa — {month}</h2>
        <a className="btn btn-sm btn-outline" href={`/admin/financeiro?mes=${nextMonthLink}`}>
          {nextMonthLink} →
        </a>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="n" style={{ color: "var(--green-dark)" }}>{brl(totalIn)}</div>
          <div className="l">Recebido no mês</div>
        </div>
        <div className="card stat">
          <div className="n" style={{ color: "var(--danger)" }}>{brl(totalOut)}</div>
          <div className="l">Despesas pagas ({brl(totalPending)} a pagar)</div>
        </div>
        <div className="card stat">
          <div className="n" style={{ color: totalIn - totalOut >= 0 ? "var(--green-dark)" : "var(--danger)" }}>
            {brl(totalIn - totalOut)}
          </div>
          <div className="l">Saldo do mês</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Recebimentos</h2>
          <form action={addPayment}>
            <div className="grid grid-2">
              <div className="field">
                <label>Descrição</label>
                <input name="description" placeholder="Aula avulsa, produto..." required />
              </div>
              <div className="field">
                <label>Cliente (opcional)</label>
                <select name="client_id" defaultValue="">
                  <option value="">—</option>
                  {clients?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tipo</label>
                <select name="kind" defaultValue="aula_avulsa">
                  <option value="mensalidade">Mensalidade</option>
                  <option value="aula_avulsa">Aula avulsa</option>
                  <option value="produto">Produto</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="field">
                <label>Valor (R$)</label>
                <input name="amount" type="number" step="0.01" min="0.01" required />
              </div>
              <div className="field">
                <label>Forma</label>
                <select name="method" defaultValue="pix">
                  <option value="pix">Pix</option>
                  <option value="credito">Crédito</option>
                  <option value="debito">Débito</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
              <div className="field">
                <label>Data</label>
                <input name="paid_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>
            <button>Lançar recebimento</button>
          </form>

          <h3>Lançamentos do mês</h3>
          <table>
            <thead>
              <tr><th>Data</th><th>Descrição</th><th>Forma</th><th>Valor</th></tr>
            </thead>
            <tbody>
              {payments?.map((p: any) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.paid_at)}</td>
                  <td>
                    {p.description}
                    {p.clients?.name && <span className="muted"> — {p.clients.name}</span>}
                  </td>
                  <td>{p.method}</td>
                  <td>{brl(Number(p.amount))}</td>
                </tr>
              ))}
              {!payments?.length && (
                <tr><td colSpan={4} className="muted">Nenhum recebimento no mês.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Despesas</h2>
          <form action={addExpense}>
            <div className="grid grid-2">
              <div className="field">
                <label>Descrição</label>
                <input name="description" required />
              </div>
              <div className="field">
                <label>Categoria</label>
                <select name="category" defaultValue="outro">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Valor (R$)</label>
                <input name="amount" type="number" step="0.01" min="0.01" required />
              </div>
              <div className="field">
                <label>Mês de referência</label>
                <input name="reference_month" type="month" defaultValue={month} />
              </div>
              <div className="field">
                <label>
                  <input type="checkbox" name="recurring" style={{ width: "auto", marginRight: 6 }} />
                  Recorrente (dia venc.:)
                </label>
                <input name="due_day" type="number" min="1" max="31" defaultValue={10} />
              </div>
              <div className="field">
                <label>Paga em (vazio = a pagar)</label>
                <input name="paid_at" type="date" />
              </div>
            </div>
            <button>Lançar despesa</button>
          </form>

          <h3>Despesas do mês</h3>
          <table>
            <thead>
              <tr><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Status</th></tr>
            </thead>
            <tbody>
              {expenses?.map((e: any) => (
                <tr key={e.id}>
                  <td>{e.category}{e.recurring ? " 🔁" : ""}</td>
                  <td>{e.description}</td>
                  <td>{brl(Number(e.amount))}</td>
                  <td>
                    {e.paid_at ? (
                      <span className="badge badge-fixo">Paga {fmtDate(e.paid_at)}</span>
                    ) : (
                      <form action={markExpensePaid} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="btn-sm btn-outline">Marcar paga</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {!expenses?.length && (
                <tr><td colSpan={4} className="muted">Nenhuma despesa no mês.</td></tr>
              )}
            </tbody>
          </table>
          <p className="muted">
            🔁 = recorrente. Dica: lance as recorrentes de cada mês a partir do seed ou duplique
            mudando o mês de referência.
          </p>
        </div>
      </div>
    </>
  );
}
