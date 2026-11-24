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

  // =========================================================
  // IMPORTANTE (OpenNext/Cloudflare): NÃO gravamos o cookie numa
  // resposta de REDIRECT (3xx) — nesse caminho o header Set-Cookie
  // é perdido de forma intermitente, e o resultado é exatamente
  // "loga, volta pra tela de login sem erro".
  // A gravação de cookie é confiável numa resposta 200 normal.
  // Então: devolvemos uma página 200 com o Set-Cookie e mandamos o
  // navegador para /admin pelo cliente (meta refresh + JS). Quando o
  // /admin é requisitado, o cookie JÁ está salvo e a sessão vale.
  // =========================================================
  const value = await makeSessionValue(res.userId);

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=/admin">
<title>Entrando…</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
    background:#4d0014;color:#ffd8d9}
  a{color:#ffd8d9}
</style>
</head>
<body>
  <p>Entrando… <a href="/admin">continuar</a></p>
  <script>location.replace('/admin');</script>
</body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

  response.cookies.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: true, // o app é sempre servido por HTTPS na Cloudflare
    maxAge: MAX_AGE,
    path: "/",
  });

  return response;
}
