import Link from "next/link";
import { db, fmtDate, brl } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import {
  currentMonth,
  addMonths,
  monthBounds,
  monthLabel,
  monthLabelLong,
  variation,
  fmtPct,
} from "@/lib/finance";
import ConfirmButton from "@/components/ConfirmButton";
import {
  addPayment,
  addExpense,
  markExpensePaid,
  deleteExpense,
  deletePayment,
  addExpenseCategory,
  toggleExpenseCategory,
  addIncomeCategory,
  toggleIncomeCategory,
} from "./actions";

export const dynamic = "force-dynamic";

function sum(rows: any[] | null, pred: (r: any) => boolean = () => true) {
  return (rows ?? []).filter(pred).reduce((s, r) => s + Number(r.amount), 0);
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireOwner();
  const { mes } = await searchParams;
  const month = mes ?? currentMonth();
  const prev = addMonths(month, -1);
  const { start, next } = monthBounds(month);
  const { start: pStart, next: pNext } = monthBounds(prev);

  // Lançamentos do mês e do mês anterior (para comparação)
  const [{ data: payments }, { data: pPayments }, { data: expenses }, { data: pExpenses }] =
    await Promise.all([
      db().from("payments").select("id, description, kind, amount, method, paid_at, clients(name)")
        .gte("paid_at", start).lt("paid_at", next).order("paid_at", { ascending: false }),
      db().from("payments").select("amount").gte("paid_at", pStart).lt("paid_at", pNext),
      db().from("expenses").select("id, description, category, amount, recurring, due_day, paid_at")
        .eq("reference_month", start).order("category"),
      db().from("expenses").select("amount, paid_at").eq("reference_month", pStart),
    ]);

  const [{ data: clients }, { data: expCats }, { data: incCats }] = await Promise.all([
    db().from("clients").select("id, name").order("name"),
    db().from("expense_categories").select("id, name, active").order("name"),
    db().from("income_categories").select("id, name, active").order("name"),
  ]);

  const activeExpCats = (expCats ?? []).filter((c: any) => c.active);
  const activeIncCats = (incCats ?? []).filter((c: any) => c.active);

  // Totais do mês
  const totalIn = sum(payments);
  const totalOut = sum(expenses, (e) => !!e.paid_at);
  const totalPending = sum(expenses, (e) => !e.paid_at);
  const saldo = totalIn - totalOut;

  // Totais do mês anterior
  const pIn = sum(pPayments);
  const pOut = sum(pExpenses, (e) => !!e.paid_at);
  const pSaldo = pIn - pOut;

  const prevLabel = monthLabel(prev);

  return (
    <>
      {/* Navegação de período */}
      <div className="card">
        <div className="period-nav">
          <Link className="btn btn-sm btn-outline" href={`/admin/financeiro?mes=${prev}`}>
            ← {monthLabel(prev)}
          </Link>
          <h2 className="title">Fluxo de caixa · {monthLabelLong(month)}</h2>
          <Link className="btn btn-sm btn-outline" href={`/admin/financeiro?mes=${addMonths(month, 1)}`}>
            {monthLabel(addMonths(month, 1))} →
          </Link>
        </div>
        <div className="row mt" style={{ justifyContent: "center" }}>
          <Link className="btn btn-sm" href="/admin/financeiro/relatorios">
            📊 Relatórios financeiros
          </Link>
        </div>
      </div>

      {/* Indicadores com comparação vs mês anterior */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card stat green">
          <div className="n" style={{ color: "var(--success)" }}>{brl(totalIn)}</div>
          <div className="l">Recebido</div>
          <DeltaInline cur={totalIn} prev={pIn} prevLabel={prevLabel} />
        </div>
        <div className="card stat wine">
          <div className="n" style={{ color: "var(--danger)" }}>{brl(totalOut)}</div>
          <div className="l">Despesas pagas</div>
          <DeltaInline cur={totalOut} prev={pOut} prevLabel={prevLabel} invert />
        </div>
        <div className="card stat gold">
          <div className="n" style={{ color: "var(--warn)" }}>{brl(totalPending)}</div>
          <div className="l">A pagar no mês</div>
        </div>
        <div className={`card stat ${saldo >= 0 ? "green" : "wine"}`}>
          <div className="n" style={{ color: saldo >= 0 ? "var(--success)" : "var(--danger)" }}>
            {brl(saldo)}
          </div>
          <div className="l">Saldo</div>
          <DeltaInline cur={saldo} prev={pSaldo} prevLabel={prevLabel} />
        </div>
      </div>

      <div className="grid grid-2">
        {/* ---------------- Recebimentos ---------------- */}
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
                <label>Categoria</label>
                <select name="kind" defaultValue={activeIncCats[0]?.name ?? "outro"}>
                  {activeIncCats.map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
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
            <button type="submit" className="btn-block">Lançar recebimento</button>
          </form>

          <h3>Lançamentos do mês</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Data</th><th>Descrição</th><th>Forma</th><th className="num">Valor</th><th></th></tr>
              </thead>
              <tbody>
                {payments?.map((p: any) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.paid_at)}</td>
                    <td>
                      {p.description}
                      {p.clients?.name && <span className="muted"> — {p.clients.name}</span>}
                      <span className="badge badge-avulso" style={{ marginLeft: 6 }}>{p.kind}</span>
                    </td>
                    <td>{p.method}</td>
                    <td className="num">{brl(Number(p.amount))}</td>
                    <td className="num">
                      <form action={deletePayment}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmButton message="Excluir este recebimento?" className="btn-sm btn-ghost">✕</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
                {!payments?.length && (
                  <tr><td colSpan={5} className="muted">Nenhum recebimento no mês.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------------- Despesas ---------------- */}
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
                <select name="category" defaultValue={activeExpCats[0]?.name ?? "outro"}>
                  {activeExpCats.map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
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
              <div className="field field-check">
                <input id="rec" type="checkbox" name="recurring" />
                <label htmlFor="rec" style={{ margin: 0 }}>Recorrente — dia venc.:</label>
                <input name="due_day" type="number" min="1" max="31" defaultValue={10} style={{ width: 70 }} />
              </div>
              <div className="field">
                <label>Paga em (vazio = a pagar)</label>
                <input name="paid_at" type="date" />
              </div>
            </div>
            <button type="submit" className="btn-block">Lançar despesa</button>
          </form>

          <h3>Despesas do mês</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Categoria</th><th>Descrição</th><th className="num">Valor</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {expenses?.map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.category}{e.recurring ? " 🔁" : ""}</td>
                    <td>{e.description}</td>
                    <td className="num">{brl(Number(e.amount))}</td>
                    <td>
                      {e.paid_at ? (
                        <span className="badge badge-ok">Paga {fmtDate(e.paid_at)}</span>
                      ) : (
                        <form action={markExpensePaid}>
                          <input type="hidden" name="id" value={e.id} />
                          <button type="submit" className="btn-sm btn-outline">Marcar paga</button>
                        </form>
                      )}
                    </td>
                    <td className="num">
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={e.id} />
                        <ConfirmButton message="Excluir esta despesa?" className="btn-sm btn-ghost">✕</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
                {!expenses?.length && (
                  <tr><td colSpan={5} className="muted">Nenhuma despesa no mês.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="muted mt">🔁 = recorrente. Lance em cada mês de referência ou duplique mudando o mês.</p>
        </div>
      </div>

      {/* ---------------- Gestão de categorias ---------------- */}
      <div className="grid grid-2">
        <CategoryManager
          title="Categorias de despesa"
          cats={expCats ?? []}
          addAction={addExpenseCategory}
          toggleAction={toggleExpenseCategory}
        />
        <CategoryManager
          title="Categorias de recebimento"
          cats={incCats ?? []}
          addAction={addIncomeCategory}
          toggleAction={toggleIncomeCategory}
        />
      </div>
    </>
  );
}

/* Indicador de variação vs mês anterior */
function DeltaInline({
  cur, prev, prevLabel, invert = false,
}: { cur: number; prev: number; prevLabel: string; invert?: boolean }) {
  const v = variation(cur, prev);
  // Para despesas (invert), subir é ruim
  const good = v === null ? null : invert ? v <= 0 : v >= 0;
  const cls = v === null || v === 0 ? "delta-flat" : good ? "delta-up" : "delta-down";
  const arrow = v === null || v === 0 ? "→" : v > 0 ? "▲" : "▼";
  return (
    <div className={`delta ${cls}`}>
      {arrow} {fmtPct(v)} <span className="muted" style={{ fontWeight: 400 }}>vs {prevLabel}</span>
    </div>
  );
}

/* Card de gestão de categorias (adicionar / ativar / desativar) */
function CategoryManager({
  title, cats, addAction, toggleAction,
}: {
  title: string;
  cats: any[];
  addAction: (fd: FormData) => void;
  toggleAction: (fd: FormData) => void;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="muted">Crie categorias próprias. Desativar esconde a categoria dos formulários, mas mantém o histórico dos lançamentos antigos.</p>
      <form action={addAction} className="inline mt">
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <input name="name" placeholder="Nova categoria..." required />
        </div>
        <button type="submit" className="btn-sm">Adicionar</button>
      </form>
      <div className="chips mt">
        {cats.map((c: any) => (
          <span key={c.id} className="chip" style={{ opacity: c.active ? 1 : 0.5 }}>
            {c.name}
            <form action={toggleAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="active" value={c.active ? "0" : "1"} />
              <button type="submit" title={c.active ? "Desativar" : "Reativar"}>
                {c.active ? "✕" : "↺"}
              </button>
            </form>
          </span>
        ))}
        {!cats.length && <span className="muted">Nenhuma categoria.</span>}
      </div>
    </div>
  );
}
