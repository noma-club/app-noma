"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type User = { name: string; role: string };

type NavItem = { href: string; label: string; icon: IconName; exact?: boolean; ownerOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/admin", label: "Início", icon: "home", exact: true },
  { href: "/admin/agenda", label: "Agenda", icon: "calendar" },
  { href: "/admin/clientes", label: "Clientes", icon: "users" },
  { href: "/admin/financeiro", label: "Financeiro", icon: "wallet" },
  { href: "/admin/usuarios", label: "Usuários", icon: "shield", ownerOnly: true },
];

type IconName =
  | "home" | "calendar" | "users" | "wallet" | "shield"
  | "menu" | "chevron-left" | "chevron-right" | "logout";

function Icon({ name }: { name: IconName }) {
  const p: Record<IconName, React.ReactNode> = {
    home: <path d="M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5" />,
    calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M20.5 20a5 5 0 0 0-4-4.9" /></>,
    wallet: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16.5 14h1.5" /></>,
    shield: <path d="M12 3.5 19 6v5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    "chevron-left": <path d="M15 6l-6 6 6 6" />,
    "chevron-right": <path d="M9 6l6 6-6 6" />,
    logout: <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 12h9M16 8l4 4-4 4" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" width="21" height="21" aria-hidden="true">
      {p[name]}
    </svg>
  );
}

export default function AdminShell({
  user, logout, children,
}: {
  user: User;
  logout: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("noma_sidebar") === "1"); } catch {}
  }, []);

  // Fecha o drawer ao navegar (mobile)
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleCollapse() {
    setCollapsed((c) => {
      const n = !c;
      try { localStorage.setItem("noma_sidebar", n ? "1" : "0"); } catch {}
      return n;
    });
  }

  const items = NAV.filter((n) => !n.ownerOnly || user.role === "dono");
  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname.startsWith(n.href));
  const current = items.find(isActive);

  return (
    <div className="shell">
      <div
        className={`sidebar-overlay ${mobileOpen ? "show" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sb-brand">
          <img src="/logo.svg" alt="" />
          <span className="sb-label brand-text">Noma Club</span>
        </div>

        <nav className="sb-nav">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`sb-link ${isActive(n) ? "active" : ""}`}
              title={n.label}
            >
              <span className="sb-ico"><Icon name={n.icon} /></span>
              <span className="sb-label">{n.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sb-foot">
          <button type="button" className="sb-collapse" onClick={toggleCollapse}
            title={collapsed ? "Expandir menu" : "Recolher menu"}>
            <span className="sb-ico"><Icon name={collapsed ? "chevron-right" : "chevron-left"} /></span>
            <span className="sb-label">Recolher</span>
          </button>
          <div className="sb-credit sb-label">
            por <a href="https://azex.tech" target="_blank" rel="noopener noreferrer">Azex Tech</a>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="appbar">
          <button type="button" className="hamb" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Icon name="menu" />
          </button>
          <h1 className="appbar-title">{current?.label ?? "Noma Club"}</h1>
          <div className="appbar-user">
            <div className="whoami">
              <b>{user.name}</b>
              <span>{user.role === "dono" ? "Dono" : "Professor"}</span>
            </div>
            <form action={logout}>
              <button type="submit" className="btn-sm btn-logout" title="Sair">
                <Icon name="logout" />
                <span className="hide-sm">Sair</span>
              </button>
            </form>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="azex">
          <span className="spark">Desenvolvido por</span>
          <a href="https://azex.tech" target="_blank" rel="noopener noreferrer">Azex Tech</a>
        </footer>
      </div>
    </div>
  );
}
