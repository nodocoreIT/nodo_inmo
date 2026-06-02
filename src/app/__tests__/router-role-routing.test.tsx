/**
 * TDD — Role-based routing:
 *   - admin session → lands on /admin portal (layout renders)
 *   - agent session → lands on /admin portal
 *   - owner session → lands on /owner portal
 *   - tenant session → lands on /tenant portal
 *   - unauthenticated → lands on /login
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseAuth = vi.fn();

vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the properties hook so AdminPortalPage renders without a real Supabase call
vi.mock("@/features/properties/hooks/use-properties", () => ({
  useProperties: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({ from: vi.fn() })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn(), id: "s1" } },
      }),
    },
  },
}));

import { AdminPortalPage } from "@/portals/admin/admin-portal-page";
import { OwnerPortalPage } from "@/portals/owner/owner-portal-page";
import { TenantPortalPage } from "@/portals/tenant/tenant-portal-page";
import { RoleRouter } from "@/app/auth/role-router";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderRoleRouter(initialPath = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<RoleRouter />} />
          <Route path="/admin/*" element={<AdminPortalPage />} />
          <Route path="/owner/*" element={<OwnerPortalPage />} />
          <Route path="/tenant/*" element={<TenantPortalPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RoleRouter (role-based portal routing)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects admin role to /admin portal", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: { app_metadata: { role: "admin" } } },
      role: "admin",
      user: { email: "admin@nodo.com" },
      orgId: "org-1",
      signOut: vi.fn(),
    });
    renderRoleRouter();
    // Admin layout renders the Propiedades nav link
    expect(screen.getByRole("link", { name: /propiedades/i })).toBeInTheDocument();
  });

  it("redirects agent role to /admin portal", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: { app_metadata: { role: "agent" } } },
      role: "agent",
      user: { email: "agent@nodo.com" },
      orgId: "org-1",
      signOut: vi.fn(),
    });
    renderRoleRouter();
    expect(screen.getByRole("link", { name: /propiedades/i })).toBeInTheDocument();
  });

  it("redirects owner role to /owner portal", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: { app_metadata: { role: "owner" } } },
      role: "owner",
      user: { email: "owner@nodo.com" },
      orgId: "org-1",
      signOut: vi.fn(),
    });
    renderRoleRouter();
    expect(screen.getByText(/portal propietario/i)).toBeInTheDocument();
  });

  it("redirects tenant role to /tenant portal", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: { app_metadata: { role: "tenant" } } },
      role: "tenant",
      user: { email: "tenant@nodo.com" },
      orgId: "org-1",
      signOut: vi.fn(),
    });
    renderRoleRouter();
    expect(screen.getByText(/portal inquilino/i)).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    mockUseAuth.mockReturnValue({ loading: false, session: null, role: null });
    renderRoleRouter();
    expect(screen.getByText(/login page/i)).toBeInTheDocument();
  });
});
