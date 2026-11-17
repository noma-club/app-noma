import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { isLockedOut, recordFailure, recordSuccess } from "./ratelimit";

const COOKIE = "noma_session";

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "desconhecido").split(",")[0].trim();
}

/** Autentica via Supabase Auth e grava o access_token em cookie httpOnly. */
export async function signIn(email: string, password: string) {
  email = email.trim().toLowerCase();
  const ip = await clientIp();

  // Anti brute force: lockout por e-mail e por IP
  const locked = await isLockedOut(email, ip);
  if (locked) return { error: locked };

  const { data, error } = await db().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    await recordFailure(email, ip);
    // Mensagem genérica: não revela se o e-mail existe (OWASP A07)
    return { error: "E-mail ou senha inválidos." };
  }
  await recordSuccess(email);

  const jar = await cookies();
  jar.set(COOKIE, data.session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8, // 8h
    path: "/",
  });
  return { error: null };
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export type SessionUser = { id: string; email: string; name: string; role: string };

/** Retorna o usuário logado (dono/professor) ou null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await db()
    .from("profiles")
    .select("name, role, active")
    .eq("id", data.user.id)
    .single();

  // Usuário desativado pelo dono não entra
  if (profile && profile.active === false) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    name: profile?.name ?? data.user.email ?? "Usuário",
    role: profile?.role ?? "professor",
  };
}

/** Guard das páginas admin: redireciona pro login se não autenticado. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Guard de páginas exclusivas de dono (ex.: gerenciamento de usuários). */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "dono") redirect("/admin");
  return user;
}
