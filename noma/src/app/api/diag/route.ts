import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * =============================================================
 * DIAGNÓSTICO TEMPORÁRIO — apague este arquivo depois de usar.
 *
 * Acesse:  https://<seu-site>/api/diag
 *
 * NÃO imprime nenhum segredo. Só diz se cada peça está presente
 * e funcionando, para sabermos exatamente onde o login quebra.
 * =============================================================
 */

/** Descobre o papel da chave Supabase sem revelá-la. */
function describeKey(key: string): string {
  if (!key) return "AUSENTE";
  if (key.startsWith("sb_secret_")) return "chave nova 'sb_secret_' (equivale a service_role) ✅";
  if (key.startsWith("sb_publishable_")) return "chave nova 'sb_publishable_' — É PÚBLICA, NÃO SERVE ❌";
  const parts = key.split(".");
  if (parts.length !== 3) return `formato desconhecido (${key.length} chars) ❓`;
  try {
    const json = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const role = String(json.role ?? "(sem claim 'role')");
    if (role === "service_role") return "JWT com role=service_role ✅";
    return `JWT com role=${role} — PRECISA SER service_role ❌`;
  } catch {
    return "JWT ilegível ❓";
  }
}

export async function GET(req: NextRequest) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const secret = process.env.SESSION_SECRET ?? "";

  // 1) Variáveis de ambiente
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: url ? `presente (${url})` : "AUSENTE ❌",
    SUPABASE_SERVICE_ROLE_KEY: describeKey(key),
    SESSION_SECRET: secret
      ? `presente (${secret.length} chars) ✅`
      : "AUSENTE — usando fallback de dev ⚠️",
  };

  // 2) Leitura comum na tabela profiles (é o que o getSessionUser faz).
  //    Se RLS bloquear ou a chave não for service_role, cai aqui.
  let leituraProfiles: string;
  try {
    const { data, error } = await db()
      .from("profiles")
      .select("id", { count: "exact" })
      .limit(5);
    if (error) leituraProfiles = `ERRO: ${error.message} ❌`;
    else if (!data || data.length === 0)
      leituraProfiles =
        "0 linhas — RLS está bloqueando (chave não é service_role) ❌";
    else leituraProfiles = `OK, ${data.length} linha(s) visível(is) ✅`;
  } catch (e) {
    leituraProfiles = `EXCEÇÃO: ${(e as Error).message} ❌`;
  }

  // 3) A RPC de login (SECURITY DEFINER — ignora RLS)
  let rpcLogin: string;
  try {
    const { error } = await db().rpc("verify_app_user", {
      p_username: "__inexistente__",
      p_password: "__inexistente__",
    });
    rpcLogin = error ? `ERRO: ${error.message} ❌` : "função existe e respondeu ✅";
  } catch (e) {
    rpcLogin = `EXCEÇÃO: ${(e as Error).message} ❌`;
  }

  // 4) O cookie chegou nesta requisição?
  const raw = req.cookies.get(COOKIE)?.value;
  const cookie = raw
    ? `presente (${raw.split(".").length} partes) ✅`
    : "não chegou nesta requisição ⚠️";

  return NextResponse.json(
    {
      aviso: "Arquivo de diagnóstico temporário. Apague src/app/api/diag depois.",
      env,
      leitura_comum_profiles: leituraProfiles,
      rpc_verify_app_user: rpcLogin,
      cookie_noma_session: cookie,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
