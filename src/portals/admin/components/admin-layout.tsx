import { NavLink, Outlet } from "react-router-dom";
import {
  Building2,
  Users,
  FileText,
  CreditCard,
  Wallet,
  LogOut,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { BrandMark } from "@/shared/components/brand-mark";
import { useAuth } from "@/app/auth/use-auth";
import { cn } from "@/shared/lib/utils";

// ── Nav item definition ───────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/admin/properties", label: "Propiedades", icon: Building2 },
  { to: "/admin/owners", label: "Propietarios", icon: Users },
  { to: "/admin/tenants", label: "Inquilinos", icon: Users },
  { to: "/admin/contracts", label: "Contratos", icon: FileText },
  { to: "/admin/payments", label: "Pagos", icon: CreditCard },
  { to: "/admin/caja", label: "Caja", icon: Wallet, adminOnly: true },
];

// ── Layout ────────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const { user, role, signOut } = useAuth();

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.adminOnly || role === "admin",
  );

  return (
    <div className="flex min-h-screen bg-paper">
      {/* ── Sidebar ── */}
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-border bg-navy">
        {/* Brand mark */}
        <div className="flex h-16 items-center px-5">
          <BrandMark onDark iconClassName="h-6 w-6" />
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Navegación principal">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand text-white"
                    : "text-slate2-300 hover:bg-navy-700 hover:text-white",
                )
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate2">{user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="gap-2 text-slate2 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
