import { db } from "./db";

/**
 * Anti brute force (OWASP A07 — Identification and Authentication Failures).
 * Lockout por e-mail E por IP, com estado persistido no banco:
 *   - 5 falhas do mesmo e-mail em 15 min  → bloqueia o e-mail por 15 min
 *   - 20 falhas do mesmo IP em 15 min     → bloqueia o IP (ataque distribuído em contas)
 * Sucesso zera o contador do e-mail.
 */

const WINDOW_MIN = 15;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

function since(): string {
  return new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
}

async function failures(identifier: string): Promise<number> {
  const { count } = await db()
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("identifier", identifier)
    .eq("success", false)
    .gte("created_at", since());
  return count ?? 0;
}

export async function isLockedOut(email: string, ip: string): Promise<string | null> {
  const [byEmail, byIp] = await Promise.all([
    failures(`email:${email}`),
    failures(`ip:${ip}`),
  ]);
  if (byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP) {
    return `Muitas tentativas. Tente novamente em ${WINDOW_MIN} minutos.`;
  }
  return null;
}

export async function recordFailure(email: string, ip: string): Promise<void> {
  await db()
    .from("login_attempts")
    .insert([
      { identifier: `email:${email}`, success: false },
      { identifier: `ip:${ip}`, success: false },
    ]);
}

export async function recordSuccess(email: string): Promise<void> {
  // Zera o histórico de falhas do e-mail após login válido
  await db().from("login_attempts").delete().eq("identifier", `email:${email}`);
}
