import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _db: SupabaseClient | null = null;

/**
 * Normaliza a URL do projeto: remove sufixos colados por engano
 * (/rest/v1, /auth/v1, barra final). A supabase-js monta os caminhos sozinha.
 */
function supabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/(rest|auth|storage|realtime)\/v1\/?$/i, "")
    .replace(/\/+$/, "");
}

/** Cliente Supabase com service_role — usar SOMENTE no servidor. */
export function db(): SupabaseClient {
  if (!_db) {
    _db = createClient(
      supabaseUrl(),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
      { auth: { persistSession: false } }
    );
  }
  return _db;
}

export const TZ = "America/Sao_Paulo";

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Regra de negócio: inscrição/cancelamento só até 6h antes do início. */
export const ENROLL_CANCEL_WINDOW_HOURS = 6;
/** Regra de negócio: máximo de reposições por mês (cancelamento pelo cliente). */
export const MAX_MAKEUPS_PER_MONTH = 2;

export function hoursUntil(startsAt: string | Date): number {
  return (new Date(startsAt).getTime() - Date.now()) / 36e5;
}
