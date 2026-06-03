import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Building2,
  Users,
  FileText,
  CreditCard,
  Wallet,
  LogOut,
  Settings,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { BrandMark } from "@/shared/components/brand-mark";
import { SearchInput } from "@/shared/components/search-input";
import { ProfileDialog } from "@/features/profile/components/profile-dialog";
import { useSearchStore } from "@/shared/search/use-search-store";
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

// Top-bar search placeholder per searchable route.
const SEARCH_PLACEHOLDERS: Record<string, string> = {
  "/admin/properties": "Buscar propiedades…",
  "/admin/owners": "Buscar propietarios…",
  "/admin/tenants": "Buscar inquilinos…",
  "/admin/contracts": "Buscar contratos…",
};

// Header title per route (shown in the top bar, nodo-core style).
const ROUTE_TITLES: Record<string, string> = {
  "/admin/properties": "Propiedades",
  "/admin/owners": "Propietarios",
  "/admin/tenants": "Inquilinos",
  "/admin/contracts": "Contratos",
  "/admin/payments": "Pagos",
  "/admin/caja": "Caja",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(value: string): string {
  const base = value.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const { user, role, signOut } = useAuth();
  const { pathname } = useLocation();
  const resetSearch = useSearchStore((s) => s.reset);
  const [profileOpen, setProfileOpen] = useState(false);

  // Clear the search query when switching areas so they don't inherit it.
  useEffect(() => {
    resetSearch();
  }, [pathname, resetSearch]);

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.adminOnly || role === "admin",
  );

  const placeholder = SEARCH_PLACEHOLDERS[pathname];
  const title = ROUTE_TITLES[pathname] ?? "Gestión";
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const email = user?.email ?? "";
  const displayName = fullName || email;

  return (
    <div className="flex min-h-screen bg-paper]">
      {/* ── Sidebar ── */}
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-border bg-navy">
        {/* Brand mark */}
        <div className="flex h-16 items-center px-5">
          <BrandMark onDark iconClassName="h-6 w-6" />
        </div>

        {/* Nav */}
        <nav
          className="flex flex-1 flex-col gap-1 px-3 py-4"
          aria-label="Navegación principal"
        >
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

        {/* User block pinned to the bottom */}
        <div className="border-t border-navy-700 p-3">
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {displayName}
              </p>
              {fullName && (
                <p className="truncate text-xs text-slate2-300">{email}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Editar perfil"
              onClick={() => setProfileOpen(true)}
              className="flex-shrink-0 rounded-md p-1.5 text-slate2-300 transition-colors hover:bg-navy-700 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            onClick={() => signOut()}
            className="mt-2 w-full justify-center gap-2 border-navy-700 bg-transparent text-slate2-300 hover:bg-navy-700 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar — breadcrumb + section title (left), search (right) */}
        <header className="flex min-h-26 items-center justify-between gap-4 border-b border-border bg-[#EEF3F8] px-6 py-3 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate2">
              Nodo Inmo · Gestión
            </p>
            <h1 className="truncate text-xl font-bold text-navy">{title}</h1>
          </div>
          {placeholder && <SearchInput placeholder={placeholder} />}
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Profile editor */}
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        currentName={fullName}
        email={email}
      />
    </div>
  );
}
