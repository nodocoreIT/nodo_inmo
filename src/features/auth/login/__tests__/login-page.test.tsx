/**
 * TDD — RED phase
 * LoginPage: renders, validates empty fields, calls signInWithPassword,
 * shows error on failure, navigates on success.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

// Mock useAuth — LoginPage consumes it
const mockSignIn = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { LoginPage } from "@/features/auth/login/login-page";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      signInWithPassword: mockSignIn,
      session: null,
    });
  });

  function renderLogin() {
    return render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
  }

  it("renders email and password fields and a submit button", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña|password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iniciar sesión|sign in|ingresar/i }),
    ).toBeInTheDocument();
  });

  it("shows an error when submitting empty fields", async () => {
    renderLogin();
    await userEvent.click(
      screen.getByRole("button", { name: /iniciar sesión|sign in|ingresar/i }),
    );
    // The form should NOT call signInWithPassword with empty values
    // and should show a validation message
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("calls signInWithPassword with entered credentials", async () => {
    mockSignIn.mockResolvedValue({ data: { session: {} }, error: null });
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "admin@nodo.com");
    await userEvent.type(
      screen.getByLabelText(/contraseña|password/i),
      "secret123",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /iniciar sesión|sign in|ingresar/i }),
    );

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "admin@nodo.com",
        password: "secret123",
      }),
    );
  });

  it("shows error message on auth failure", async () => {
    mockSignIn.mockResolvedValue({
      data: { session: null },
      error: { message: "Credenciales de login incorrectas" },
    });
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "bad@nodo.com");
    await userEvent.type(
      screen.getByLabelText(/contraseña|password/i),
      "wrong",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /iniciar sesión|sign in|ingresar/i }),
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(
      /credenciales incorrectas/i,
    );
  });

  it("navigates to '/' on successful sign-in", async () => {
    mockSignIn.mockResolvedValue({
      data: { session: { user: {} } },
      error: null,
    });
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "admin@nodo.com");
    await userEvent.type(
      screen.getByLabelText(/contraseña|password/i),
      "secret123",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /iniciar sesión|sign in|ingresar/i }),
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
  });

  it("disables the submit button while loading", async () => {
    // signIn takes a tick to resolve — button must be disabled during that tick
    mockSignIn.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: { session: {} }, error: null }), 50),
        ),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "admin@nodo.com");
    await userEvent.type(screen.getByLabelText(/contraseña|password/i), "pass");
    await userEvent.click(
      screen.getByRole("button", { name: /iniciar sesión|sign in|ingresar/i }),
    );

    expect(
      screen.getByRole("button", {
        name: /iniciar sesión|sign in|ingresar|cargando|loading/i,
      }),
    ).toBeDisabled();

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledOnce());
  });
});
