/**
 * TDD — RED phase
 * Role-based routing:
 *   - admin session → lands on /admin portal
 *   - owner session → lands on /owner portal
 *   - tenant session → lands on /tenant portal
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mockUseAuth = vi.fn();

vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// We import the individual portal placeholder pages directly
import { AdminPortalPage } from "@/portals/admin/admin-portal-page";
import { OwnerPortalPage } from "@/portals/owner/owner-portal-page";
import { TenantPortalPage } from "@/portals/tenant/tenant-portal-page";
import { RoleRouter } from "@/app/auth/role-router";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderRoleRouter(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<RoleRouter />} />
        <Route path="/admin/*" element={<AdminPortalPage />} />
        <Route path="/owner/*" element={<OwnerPortalPage />} />
        <Route path="/tenant/*" element={<TenantPortalPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
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
    });
    renderRoleRouter();
    expect(screen.getByText(/portal admin/i)).toBeInTheDocument();
  });

  it("redirects agent role to /admin portal", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: { app_metadata: { role: "agent" } } },
      role: "agent",
    });
    renderRoleRouter();
    expect(screen.getByText(/portal admin/i)).toBeInTheDocument();
  });

  it("redirects owner role to /owner portal", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: { app_metadata: { role: "owner" } } },
      role: "owner",
    });
    renderRoleRouter();
    expect(screen.getByText(/portal propietario/i)).toBeInTheDocument();
  });

  it("redirects tenant role to /tenant portal", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: { app_metadata: { role: "tenant" } } },
      role: "tenant",
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
