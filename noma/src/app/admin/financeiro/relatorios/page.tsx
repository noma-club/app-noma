import Link from "next/link";
import { db, brl } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { currentMonth, addMonths, monthBounds, monthLabel, monthLabelLong } from "@/lib/finance";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const RANGES = [3, 6, 12];

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ meses?: string; ate?: string }>;
}) {
  await requireOwner();
  const { meses, ate } = await searchParams;
  const nMonths = RANGES.includes(Number(meses)) ? Number(meses) : 6;
  const endMonth = ate ?? currentMonth();
  const startMonth = addMonths(endMonth, -(nMonths - 1));

  const windowStart = monthBounds(startMonth).start;
  const windowEnd = monthBounds(endMonth).next;

  // Lista de meses do período (mais antigo → mais novo)
  const months: string[] = [];
  for (let i = 0; i < nMonths; i++) months.push(addMonths(startMonth, i));

  const [{ data: payments }, { data: expenses }] = await Promise.all([
    db().from("payments").select("amount, kind, paid_at")
      .gte("paid_at", windowStart).lt("paid_at", windowEnd),
    db().from("expenses").select("amount, category, paid_at, reference_month")
      .gte("reference_month", windowStart).lt("reference_month", windowEnd),
  ]);

  // ----- Evolução mensal (receitas vs despesas pagas) -----
  const byMonth = new Map<string, { in: number; out: number }>();
  months.forEach((m) => byMonth.set(m, { in: 0, out: 0 }));
  (payments ?? []).forEach((p: any) => {
    const m = String(p.paid_at).slice(0, 7);
    if (byMonth.has(m)) byMonth.get(m)!.in += Number(p.amount);
  });
  (expenses ?? []).forEach((e: any) => {
    if (!e.paid_at) return; // só despesas efetivamente pagas entram na evolução de caixa
    const m = String(e.reference_month).slice(0, 7);
    if (byMonth.has(m)) byMonth.get(m)!.out += Number(e.amount);
  });
  const maxBar = Math.max(1, ...months.map((m) => Math.max(byMonth.get(m)!.in, byMonth.get(m)!.out)));

  // ----- Por categoria (no período todo) -----
  const expByCat = groupSum(expenses, "category");
  const incByCat = groupSum(payments, "kind");

  // ----- Totais / DRE -----
  const totalIn = (payments ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
  const totalOut = (expenses ?? []).filter((e: any) => e.paid_at).reduce((s, e: any) => s + Number(e.amount), 0);
  const resultado = totalIn - totalOut;
  const margem = totalIn > 0 ? (resultado / totalIn) * 100 : 0;
  const mediaInMes = totalIn / nMonths;
  const mediaOutMes = totalOut / nMonths;

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>📊 Relatórios financeiros</h2>
          <div className="row gap-sm">
            <PrintButton />
            <Link className="btn-sm btn-outline hide-print" href="/admin/financeiro">← Fluxo de caixa</Link>
          </div>
        </div>
        <p className="muted">
          Período: <b>{monthLabelLong(startMonth)}</b> a <b>{monthLabelLong(endMonth)}</b> ({nMonths} meses).
        </p>
        <div className="chips mt hide-print">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/financeiro/relatorios?meses=${r}&ate=${endMonth}`}
              className="chip"
              style={{ textDecoration: "none", fontWeight: r === nMonths ? 700 : 500 }}
            >
              Últimos {r} meses
            </Link>
          ))}
        </div>
      </div>

      {/* DRE simplificada */}
      <div className="grid grid-4">
        <div className="card stat">
          <div className="n" style={{ color: "var(--success)" }}>{brl(totalIn)}</div>
          <div className="l">Faturamento ({nMonths}m)</div>
        </div>
        <div className="card stat">
          <div className="n" style={{ color: "var(--danger)" }}>{brl(totalOut)}</div>
          <div className="l">Despesas pagas ({nMonths}m)</div>
        </div>
        <div className="card stat">
          <div className="n" style={{ color: resultado >= 0 ? "var(--success)" : "var(--danger)" }}>{brl(resultado)}</div>
          <div className="l">Resultado</div>
        </div>
        <div className="card stat">
          <div className="n" style={{ color: margem >= 0 ? "var(--success)" : "var(--danger)" }}>{margem.toFixed(1)}%</div>
          <div className="l">Margem</div>
        </div>
      </div>

      {/* Evolução mensal */}
      <div className="card">
        <h2>Evolução mensal</h2>
        <div className="row gap-sm" style={{ marginBottom: 4, fontSize: 12 }}>
          <span className="badge badge-ok">Recebimentos</span>
          <span className="badge badge-danger">Despesas</span>
        </div>
        <div className="cols">
          {months.map((m) => {
            const d = byMonth.get(m)!;
            return (
              <div key={m} className="col">
                <div className="pair">
                  <div className="b in" style={{ height: `${(d.in / maxBar) * 100}%` }} title={`Recebido: ${brl(d.in)}`} />
                  <div className="b out" style={{ height: `${(d.out / maxBar) * 100}%` }} title={`Despesas: ${brl(d.out)}`} />
                </div>
                <div className="lbl">{monthLabel(m)}</div>
              </div>
            );
          })}
        </div>
        <div className="table-wrap mt">
          <table>
            <thead>
              <tr>
                <th>Mês</th><th className="num">Recebido</th><th className="num">Despesas</th><th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const d = byMonth.get(m)!;
                const s = d.in - d.out;
                return (
                  <tr key={m}>
                    <td>{monthLabelLong(m)}</td>
                    <td className="num">{brl(d.in)}</td>
                    <td className="num">{brl(d.out)}</td>
                    <td className="num" style={{ color: s >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>{brl(s)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>Média/mês</td>
                <td className="num">{brl(mediaInMes)}</td>
                <td className="num">{brl(mediaOutMes)}</td>
                <td className="num">{brl(mediaInMes - mediaOutMes)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Quebras por categoria */}
      <div className="grid grid-2">
        <CategoryBreakdown title="Despesas por categoria" rows={expByCat} total={totalOutAll(expenses)} kind="out" />
        <CategoryBreakdown title="Recebimentos por categoria" rows={incByCat} total={totalIn} kind="in" />
      </div>
    </>
  );
}

function groupSum(rows: any[] | null, key: string): { name: string; value: number }[] {
  const map = new Map<string, number>();
  (rows ?? []).forEach((r: any) => {
    const k = r[key] ?? "—";
    map.set(k, (map.get(k) ?? 0) + Number(r.amount));
  });
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

// Total de TODAS as despesas do período (pagas ou não) para a quebra por categoria
function totalOutAll(expenses: any[] | null) {
  return (expenses ?? []).reduce((s, e: any) => s + Number(e.amount), 0);
}

function CategoryBreakdown({
  title, rows, total, kind,
}: { title: string; rows: { name: string; value: number }[]; total: number; kind: "in" | "out" }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card">
      <h2>{title}</h2>
      {!rows.length && <p className="muted">Sem lançamentos no período.</p>}
      {rows.map((r) => (
        <div key={r.name} className="barrow">
          <span className="cat">{r.name}</span>
          <div className="bar-track">
            <div className={`bar-fill ${kind}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="val">
            {brl(r.value)}
            <span className="muted"> · {total > 0 ? ((r.value / total) * 100).toFixed(0) : 0}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}
