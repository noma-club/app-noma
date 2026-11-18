import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, signOut } from "@/lib/auth";
import AzexFooter from "@/components/AzexFooter";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  async function doLogout() {
    "use server";
    await signOut();
    redirect("/login");
  }

  return (
    <>
      <header className="topbar">
        <span className="brand">
          <img src="/logo.svg" alt="" />
          Noma Club
        </span>
        <nav>
          <Link href="/admin">Início</Link>
          <Link href="/admin/agenda">Agenda</Link>
          <Link href="/admin/clientes">Clientes</Link>
          <Link href="/admin/financeiro">Financeiro</Link>
          {user.role === "dono" && <Link href="/admin/usuarios">Usuários</Link>}
        </nav>
        <div className="user">
          <span className="whoami">
            <b>{user.name}</b>
            <span>{user.role === "dono" ? "Dono" : "Professor"}</span>
          </span>
          <form action={doLogout}>
            <button type="submit" className="btn-sm btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.5)" }}>
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="container">{children}</main>
      <AzexFooter />
    </>
  );
}
