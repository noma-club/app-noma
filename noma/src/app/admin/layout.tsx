import { requireUser } from "@/lib/auth";
import AdminShell from "@/components/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <AdminShell user={{ name: user.name, role: user.role }}>
      {children}
    </AdminShell>
  );
}
