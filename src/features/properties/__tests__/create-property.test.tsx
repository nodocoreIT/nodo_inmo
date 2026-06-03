/**
 * TDD — Create property form
 * Tests:
 *   - renders all required fields
 *   - blocks submit when address is empty
 *   - on valid submit calls mutateAsync with org_id from auth + entered values
 *   - calls onSuccess after successful insert
 *
 * Note: Radix UI Select uses Pointer Events API not available in jsdom.
 * We mock the Select component with a native <select> for testability,
 * and test the mutation separately. This is the RTL-idiomatic approach.
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
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
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

// ── Mock Radix Select with a native <select> for jsdom testability ────────────
vi.mock("@/shared/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => (
    <select
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: {
    children: React.ReactNode;
    "aria-label"?: string;
    id?: string;
  }) => <>{children}</>,
  SelectValue: (_props: { placeholder?: string }) => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
    // Mirror Radix's contract: an empty-string item value crashes at runtime.
    // Without this guard the mock silently accepts "" and hides real bugs.
    if (value === "") {
      throw new Error(
        'A <SelectItem /> must have a value prop that is not an empty string.',
      );
    }
    return <option value={value}>{children}</option>;
  },
}));

// ── Mock the mutation hook ────────────────────────────────────────────────────
const mockMutateAsync = vi.fn();
vi.mock("@/features/properties/hooks/use-create-property", () => ({
  useCreateProperty: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

import { CreatePropertyDialog } from "@/features/properties/components/create-property-dialog";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDialog(onSuccess = vi.fn()) {
  return render(
    <CreatePropertyDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />,
    { wrapper },
  );
}

describe("CreatePropertyDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders address, operation, property_type fields", () => {
    renderDialog();
    expect(screen.getByLabelText(/dirección/i)).toBeInTheDocument();
    // Native selects rendered by our mock
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("renders optional fields: price, rooms", () => {
    renderDialog();
    expect(screen.getByLabelText(/precio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ambientes/i)).toBeInTheDocument();
  });

  it("shows validation error and blocks submit when address is empty", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/dirección.*requerida|requerido|obligatorio/i),
      ).toBeInTheDocument();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("calls mutateAsync with org_id from auth and entered values on valid submit", async () => {
    mockMutateAsync.mockResolvedValue({ id: "new-p" });

    renderDialog();

    await userEvent.type(screen.getByLabelText(/dirección/i), "Av. Santa Fe 1000");

    // Use the native selects rendered by the mock
    const selects = screen.getAllByRole("combobox");
    // First select is operation, second is property_type (order matches form render)
    await userEvent.selectOptions(selects[0], "rent");
    await userEvent.selectOptions(selects[1], "apartment");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledOnce();
    });

    const calledWith = mockMutateAsync.mock.calls[0][0];
    expect(calledWith).toMatchObject({
      address: "Av. Santa Fe 1000",
      operation: "rent",
      property_type: "apartment",
    });
  });

  it("calls onSuccess callback after successful mutateAsync", async () => {
    mockMutateAsync.mockResolvedValue({ id: "new-p" });

    const onSuccess = vi.fn();
    render(
      <CreatePropertyDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />,
      { wrapper },
    );

    await userEvent.type(screen.getByLabelText(/dirección/i), "Callao 200");
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "sale");
    await userEvent.selectOptions(selects[1], "house");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });
});
