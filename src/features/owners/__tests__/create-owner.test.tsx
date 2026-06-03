/**
 * TDD — Create owner form
 * Tests:
 *   - renders name, DNI, phone, email, address, commission_rate, permission checkboxes
 *   - blocks submit when name is empty (validation)
 *   - on valid submit calls mutateAsync with org_id from auth and entered values
 *   - calls onSuccess after successful mutateAsync
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mock supabase ─────────────────────────────────────────────────────────────
vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({
      from: vi.fn(() => ({ insert: vi.fn() })),
    })),
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn(), id: "s1" } },
      }),
    },
  },
}));

// ── Mock useAuth ──────────────────────────────────────────────────────────────
vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => ({
    user: { email: "admin@nodo.com" },
    role: "admin",
    orgId: "org-abc",
    signOut: vi.fn(),
    session: {},
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Mock the mutation hook ────────────────────────────────────────────────────
const mockMutateAsync = vi.fn();
vi.mock("@/features/owners/hooks/use-create-owner", () => ({
  useCreateOwner: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

import { CreateOwnerDialog } from "@/features/owners/components/create-owner-dialog";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDialog(onSuccess = vi.fn()) {
  return render(
    <CreateOwnerDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />,
    { wrapper },
  );
}

describe("CreateOwnerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders name field (required)", () => {
    renderDialog();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it("renders optional fields: DNI, teléfono, email, dirección, comisión", () => {
    renderDialog();
    expect(screen.getByLabelText(/dni/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/teléfono/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dirección/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/comisión/i)).toBeInTheDocument();
  });

  it("renders permission checkboxes", () => {
    renderDialog();
    expect(screen.getByLabelText(/alquileres/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/obra|construcc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ventas/i)).toBeInTheDocument();
  });

  it("shows validation error and blocks submit when name is empty", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/nombre.*requerido|requerido|obligatorio/i),
      ).toBeInTheDocument();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("calls mutateAsync with entered values on valid submit", async () => {
    mockMutateAsync.mockResolvedValue({ id: "new-o" });

    renderDialog();

    await userEvent.type(screen.getByLabelText(/nombre/i), "Carlos López");
    await userEvent.type(screen.getByLabelText(/dni/i), "30-99988877-6");
    await userEvent.type(screen.getByLabelText(/teléfono/i), "11-4444-0002");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledOnce();
    });

    const calledWith = mockMutateAsync.mock.calls[0][0];
    expect(calledWith).toMatchObject({
      name: "Carlos López",
      dni: "30-99988877-6",
      phone: "11-4444-0002",
    });
    // org_id is injected by the hook, not the form — should NOT appear in form payload
  });

  it("commission_rate defaults to 10 on submit", async () => {
    mockMutateAsync.mockResolvedValue({ id: "new-o" });
    renderDialog();
    await userEvent.type(screen.getByLabelText(/nombre/i), "Ana Pérez");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce());
    const calledWith = mockMutateAsync.mock.calls[0][0];
    expect(calledWith.commission_rate).toBe(10);
  });

  it("calls onSuccess callback after successful mutateAsync", async () => {
    mockMutateAsync.mockResolvedValue({ id: "new-o" });
    const onSuccess = vi.fn();
    render(
      <CreateOwnerDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />,
      { wrapper },
    );
    await userEvent.type(screen.getByLabelText(/nombre/i), "Beatriz Ruiz");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });
});
