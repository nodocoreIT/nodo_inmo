/**
 * TDD — RED phase
 * AdminLayout:
 *   - renders nav links (Propiedades, Propietarios, Contratos, Pagos)
 *   - Caja link shown for admin, hidden for agent
 *   - top bar shows user email
 *   - "Cerrar sesión" button calls signOut
 *   - renders <Outlet /> content area
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mockSignOut = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { AdminLayout } from "@/portals/admin/components/admin-layout";

function renderLayout(role: "admin" | "agent" = "admin") {
  mockUseAuth.mockReturnValue({
    user: { email: "admin@nodo.com" },
    role,
    orgId: "org-1",
    signOut: mockSignOut,
    session: {},
    loading: false,
  });

  return render(
    <MemoryRouter initialEntries={["/admin/properties"]}>
      <Routes>
        <Route path="/admin/*" element={<AdminLayout />}>
          <Route path="properties" element={<div>Outlet content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Propiedades nav link", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: /propiedades/i })).toBeInTheDocument();
  });

  it("renders Propietarios, Contratos, Pagos nav links", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: /propietarios/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contratos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pagos/i })).toBeInTheDocument();
  });

  it("shows Caja link for admin role", () => {
    renderLayout("admin");
    expect(screen.getByRole("link", { name: /caja/i })).toBeInTheDocument();
  });

  it("hides Caja link for agent role", () => {
    renderLayout("agent");
    expect(screen.queryByRole("link", { name: /caja/i })).not.toBeInTheDocument();
  });

  it("shows user email in top bar", () => {
    renderLayout();
    expect(screen.getByText("admin@nodo.com")).toBeInTheDocument();
  });

  it("calls signOut when Cerrar sesión is clicked", async () => {
    mockSignOut.mockResolvedValue({});
    renderLayout();
    await userEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it("renders outlet content area", () => {
    renderLayout();
    expect(screen.getByText("Outlet content")).toBeInTheDocument();
  });
});
