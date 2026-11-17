import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, signOut } from "@/lib/auth";

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
        <form action={doLogout} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="user">
            {user.name} ({user.role})
          </span>
          <button className="btn-sm btn-outline" style={{ color: "#fff", borderColor: "#fff" }}>
            Sair
          </button>
        </form>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
