import { redirect } from "next/navigation";
import { requireUser, signOut } from "@/lib/auth";
import AdminShell from "@/components/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  async function doLogout() {
    "use server";
    await signOut();
    redirect("/login");
  }

  return (
    <AdminShell user={{ name: user.name, role: user.role }} logout={doLogout}>
      {children}
    </AdminShell>
  );
}
