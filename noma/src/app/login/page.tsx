import { redirect } from "next/navigation";
import { signIn, getSessionUser } from "@/lib/auth";
import AzexFooter from "@/components/AzexFooter";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/admin");
  const { erro } = await searchParams;

  async function doLogin(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const res = await signIn(email, password);
    if (res.error) redirect(`/login?erro=${encodeURIComponent(res.error)}`);
    redirect("/admin");
  }

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
        <form action={doLogin}>
          <div className="field">
            <label>E-mail</label>
            <input name="email" type="email" required autoComplete="email" />
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
