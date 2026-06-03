/**
 * TDD — Owner selector inside the property form
 * Tests:
 *   - renders a "Propietario" select populated with owners from useOwners
 *   - includes a "Sin propietario" option (null / empty value)
 *   - selecting an owner and submitting the form passes owner_id in the payload
 *   - leaving "Sin propietario" selected results in owner_id: null in the payload
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mock supabase ─────────────────────────────────────────────────────────────
vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({
      from: vi.fn(() => ({ insert: vi.fn(), select: vi.fn() })),
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

// ── Mock Radix Select with native <select> ────────────────────────────────────
// SelectTrigger forwards id + aria-label to the rendered <select> via context,
// so that label[for] associations work in RTL.
vi.mock("@/shared/components/ui/select", () => {
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TriggerCtx = (React.createContext as any)({} as { id?: string; ariaLabel?: string });

  const Select = ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [triggerMeta, setTriggerMeta] = (React.useState as any)({} as {
      id?: string;
      ariaLabel?: string;
    });
    return (
      <TriggerCtx.Provider value={triggerMeta}>
        {/* clone children to inject setters */}
        {React.Children.map(children, (child: React.ReactNode) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
                _onValueChange: onValueChange,
                _value: value ?? "",
                _setTriggerMeta: setTriggerMeta,
              })
            : child,
        )}
      </TriggerCtx.Provider>
    );
  };

  const SelectTrigger = ({
    id,
    "aria-label": ariaLabel,
    _setTriggerMeta,
    children: _children,
  }: {
    id?: string;
    "aria-label"?: string;
    _setTriggerMeta?: (v: { id?: string; ariaLabel?: string }) => void;
    children?: React.ReactNode;
  }) => {
    const called = React.useRef(false);
    if (!called.current) {
      called.current = true;
      _setTriggerMeta?.({ id, ariaLabel });
    }
    return null;
  };

  const SelectContent = ({
    children,
    _onValueChange,
    _value,
  }: {
    children: React.ReactNode;
    _onValueChange?: (v: string) => void;
    _value?: string;
  }) => {
    const { id, ariaLabel } = React.useContext(TriggerCtx);
    return (
      <select
        id={id}
        aria-label={ariaLabel}
        value={_value ?? ""}
        onChange={(e) => _onValueChange?.(e.target.value)}
      >
        {children}
      </select>
    );
  };

  const SelectValue = (_props: { placeholder?: string }) => null;

  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>;

  return { Select, SelectTrigger, SelectContent, SelectValue, SelectItem };
});

// ── Mock useOwners ────────────────────────────────────────────────────────────
const fixtureOwners = [
  {
    id: "owner-aaa",
    name: "Lucía Martínez",
    dni: null,
    phone: null,
    email: null,
    address: null,
    commission_rate: 10,
    can_view_rentals: false,
    can_view_construction: false,
    can_view_sales: false,
    portal_user_id: null,
    org_id: "org-abc",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "owner-bbb",
    name: "Marcos Silva",
    dni: null,
    phone: null,
    email: null,
    address: null,
    commission_rate: 5,
    can_view_rentals: false,
    can_view_construction: false,
    can_view_sales: false,
    portal_user_id: null,
    org_id: "org-abc",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

vi.mock("@/features/owners/hooks/use-owners", () => ({
  useOwners: () => ({
    data: fixtureOwners,
    isLoading: false,
    isError: false,
  }),
  OWNERS_QUERY_KEY: ["nodo_inmo", "contacts"],
}));

// ── Mock create property mutation ─────────────────────────────────────────────
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

describe("PropertyFormDialog — owner selector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a Propietario select", () => {
    render(
      <CreatePropertyDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getByLabelText(/propietario/i)).toBeInTheDocument();
  });

  it("populates the owner select with owner names from useOwners", () => {
    render(
      <CreatePropertyDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getByText("Lucía Martínez")).toBeInTheDocument();
    expect(screen.getByText("Marcos Silva")).toBeInTheDocument();
  });

  it("includes a 'Sin propietario' option", () => {
    render(
      <CreatePropertyDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getByText(/sin propietario/i)).toBeInTheDocument();
  });

  it("selecting an owner passes owner_id in the submit payload", async () => {
    mockMutateAsync.mockResolvedValue({ id: "new-prop" });
    render(
      <CreatePropertyDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper },
    );

    await userEvent.type(screen.getByLabelText(/dirección/i), "Lavalle 800");

    // Select operation and property_type (required)
    const selects = screen.getAllByRole("combobox");
    const operationSelect = selects.find((s) =>
      Array.from((s as HTMLSelectElement).options).some(
        (o) => o.value === "rent",
      ),
    );
    const typeSelect = selects.find((s) =>
      Array.from((s as HTMLSelectElement).options).some(
        (o) => o.value === "apartment",
      ),
    );
    await userEvent.selectOptions(operationSelect!, "rent");
    await userEvent.selectOptions(typeSelect!, "apartment");

    // Select owner
    const ownerSelect = screen.getByLabelText(/propietario/i);
    await userEvent.selectOptions(ownerSelect, "owner-aaa");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce());
    const calledWith = mockMutateAsync.mock.calls[0][0];
    expect(calledWith.owner_id).toBe("owner-aaa");
  });

  it("leaving 'Sin propietario' selected results in owner_id: null", async () => {
    mockMutateAsync.mockResolvedValue({ id: "new-prop" });
    render(
      <CreatePropertyDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper },
    );

    await userEvent.type(screen.getByLabelText(/dirección/i), "Tucumán 200");

    const selects = screen.getAllByRole("combobox");
    const operationSelect = selects.find((s) =>
      Array.from((s as HTMLSelectElement).options).some(
        (o) => o.value === "rent",
      ),
    );
    const typeSelect = selects.find((s) =>
      Array.from((s as HTMLSelectElement).options).some(
        (o) => o.value === "apartment",
      ),
    );
    await userEvent.selectOptions(operationSelect!, "sale");
    await userEvent.selectOptions(typeSelect!, "house");
    // Do NOT change the owner select — leave it at "Sin propietario"

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce());
    const calledWith = mockMutateAsync.mock.calls[0][0];
    expect(calledWith.owner_id).toBeNull();
  });
});
