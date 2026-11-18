import { TZ } from "./db";

/** "YYYY-MM" do mês atual no fuso do estúdio. */
export function currentMonth(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ }).slice(0, 7);
}

/** Soma (ou subtrai) meses de um "YYYY-MM". */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Primeiro dia (YYYY-MM-01) e primeiro dia do mês seguinte, para filtros [início, fim). */
export function monthBounds(month: string): { start: string; next: string } {
  return { start: `${month}-01`, next: `${addMonths(month, 1)}-01` };
}

/** Rótulo curto pt-BR, ex.: "nov/26". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[m - 1]}/${String(y).slice(2)}`;
}

/** Rótulo longo, ex.: "novembro de 2026". */
export function monthLabelLong(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const nomes = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${nomes[m - 1]} de ${y}`;
}

/** Variação percentual de `prev` para `cur` (null quando não faz sentido). */
export function variation(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function fmtPct(v: number | null): string {
  if (v === null) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(1)}%`;
}
