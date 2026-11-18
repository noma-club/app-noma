import { NextRequest, NextResponse } from "next/server";
import { verifyLogin, makeSessionValue, COOKIE, MAX_AGE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const ip = (req.headers.get("x-forwarded-for") ?? "desconhecido").split(",")[0].trim();
  const origin = new URL(req.url).origin;

  const res = await verifyLogin(username, password, ip);

  if (res.error || !res.userId) {
    return NextResponse.redirect(
      `${origin}/login?erro=${encodeURIComponent(res.error ?? "Falha no login.")}`,
      303
    );
  }

  // Set-Cookie + redirect na MESMA resposta (confiável no OpenNext/Cloudflare)
  const response = NextResponse.redirect(`${origin}/admin`, 303);
  response.cookies.set(COOKIE, await makeSessionValue(res.userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return response;
}
