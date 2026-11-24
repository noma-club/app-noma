import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { isLockedOut, recordFailure, recordSuccess } from "./ratelimit";
import { normalizeUsername } from "./password";

export const COOKIE = "noma_session";
export const MAX_AGE = 60 * 60 * 8; // 8h

/**
 * IMPORTANTE (OpenNext/Cloudflare): variáveis de ambiente e secrets são
 * resolvidas POR REQUISIÇÃO, não no carregamento do módulo. Ler
 * `process.env.SESSION_SECRET` no topo do arquivo congela o valor errado
 * (normalmente o fallback de dev), e aí a assinatura do cookie feita no
 * login não bate na verificação da próxima requisição -> sessão "cai"
 * logo após entrar. Por isso o segredo é lido SEMPRE dentro da função,
 * em tempo de requisição.
 */
function sessionSecret(): string {
  return process.env.SESSION_SECRET || "noma-dev-secret-troque-em-producao";
}

/* =========================================================
   Sessão: cookie assinado com HMAC-SHA256 (validação local,
   sem chamada de rede por requisição).
   Formato do valor: "<userId>.<expiraEmMs>.<assinaturaHex>"
   ========================================================= */

async function hmacHex(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  let hex = "";
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Comparação de tempo constante (evita timing attacks na assinatura). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeSessionValue(userId: string): Promise<string> {
  const exp = Date.now() + MAX_AGE * 1000;
  const body = `${userId}.${exp}`;
  const sig = await hmacHex(body);
  return `${body}.${sig}`;
}

async function readSessionUserId(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || !exp || Date.now() > exp) return null;
  const expected = await hmacHex(`${userId}.${expStr}`);
  if (!safeEqual(sig, expected)) return null;
  return userId;
}

/* =========================================================
   Login por USUÁRIO + SENHA (sem e-mail, sem Supabase Auth)
   ========================================================= */

/**
 * Verifica usuário+senha (bcrypt no banco) + anti brute force.
 * NÃO grava cookie aqui — quem grava é o route handler /api/login,
 * porque definir cookie + redirect dentro de Server Action é
 * não-confiável no OpenNext/Cloudflare (o Set-Cookie se perde).
 */
export async function verifyLogin(
  username: string,
  password: string,
  ip: string
): Promise<{ userId?: string; error?: string }> {
  const user = normalizeUsername(username);

  const locked = await isLockedOut(user, ip);
  if (locked) return { error: locked };

  const { data, error } = await db().rpc("verify_app_user", {
    p_username: user,
    p_password: password,
  });
  const row = Array.isArray(data) ? data[0] : data;

  if (error || !row) {
    await recordFailure(user, ip);
    return { error: "Usuário ou senha inválidos." };
  }

  await recordSuccess(user);
  return { userId: row.id };
}

export type SessionUser = { id: string; username: string; name: string; role: string };

/** Usuário logado, validado localmente + 1 leitura de perfil (confiável). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const userId = await readSessionUserId(jar.get(COOKIE)?.value);
  if (!userId) return null;

  const { data: profile, error } = await db()
    .from("profiles")
    .select("name, role, active, username")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile || profile.active === false) return null;

  return {
    id: userId,
    username: profile.username ?? "",
    name: profile.name ?? "Usuário",
    role: profile.role === "dono" ? "dono" : "professor",
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "dono") redirect("/admin");
  return user;
}
