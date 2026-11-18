import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AzexFooter from "@/components/AzexFooter";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/admin");
  const { erro } = await searchParams;

  return (
    <div className="center-page">
      <div className="card">
        <img src="/logo.svg" alt="Noma Club" className="logo-mark" />
        <div className="logo">Noma Club</div>
        <div className="tagline">Pilates · Movimento · Conexão</div>
        <p className="muted" style={{ textAlign: "center", marginTop: -8 }}>
          Acesso de professores e donos
        </p>
        {erro && <div className="msg msg-err">{erro}</div>}
        <form action="/api/login" method="post">
          <div className="field">
            <label>Usuário</label>
            <input name="username" required autoComplete="username" autoCapitalize="none" placeholder="seu usuário" />
          </div>
          <div className="field">
            <label>Senha</label>
            <input name="password" type="password" required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-block">Entrar</button>
        </form>
      </div>
      <AzexFooter />
    </div>
  );
}
