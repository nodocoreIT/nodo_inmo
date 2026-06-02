/**
 * TDD — RED phase
 * RequireAuth guard:
 *   - unauthenticated → redirect to /login
 *   - loading → renders nothing
 *   - authenticated WITH role → renders children
 *   - authenticated WITHOUT role → renders "pending access" state (no crash)
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mockUseAuth = vi.fn();

vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { RequireAuth } from "@/shared/components/require-auth/require-auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWithRouter(ui: React.ReactNode, initialPath = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/protected" element={ui} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing while loading", () => {
    mockUseAuth.mockReturnValue({ loading: true, session: null, role: null });
    const { container } = renderWithRouter(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>,
    );
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects to /login when unauthenticated", () => {
    mockUseAuth.mockReturnValue({ loading: false, session: null, role: null });
    renderWithRouter(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>,
    );
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders children when authenticated with a role", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: { app_metadata: { role: "admin" } } },
      role: "admin",
    });
    renderWithRouter(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>,
    );
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("renders pending state when authenticated but role is absent (no crash)", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: { app_metadata: {} } },
      role: null,
    });
    renderWithRouter(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>,
    );
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    // Should render a graceful pending message — NOT redirect to login
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    // Expects a graceful pending heading — not a crash, not a login redirect
    expect(
      screen.getByRole("heading", { name: /acceso pendiente/i }),
    ).toBeInTheDocument();
  });

  it("does NOT redirect to login when role is absent but session exists", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: {} },
      role: null,
    });
    renderWithRouter(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>,
    );
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });
});
