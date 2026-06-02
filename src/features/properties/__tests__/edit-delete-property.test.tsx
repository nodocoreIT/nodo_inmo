/**
 * TDD — Edit & Delete property row actions
 *
 * Tests:
 *   Edit:
 *     - clicking "Editar" opens form dialog prefilled with the property values
 *     - submitting the edit form calls useUpdateProperty with the changed fields and the right id
 *     - on success the PROPERTIES_QUERY_KEY is invalidated (mocked via the hook)
 *   Delete:
 *     - clicking "Eliminar" shows a confirm AlertDialog with the expected copy
 *     - confirming calls useDeleteProperty with the right id
 *     - cancelling does NOT call delete
 *
 * Strategy:
 *   - Mock useProperties to return a single fixture property
 *   - Mock useUpdateProperty and useDeleteProperty at the hook level (not supabase)
 *   - Mock Radix Select with native <select> (same pattern as create-property.test.tsx)
 *   - Mock Radix AlertDialog with a thin wrapper so jsdom can interact with it
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mock supabase (prevent real network calls) ────────────────────────────────
vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      })),
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
vi.mock("@/shared/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => (
    <select value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    "aria-label"?: string;
    id?: string;
  }) => <>{children}</>,
  SelectValue: (_props: { placeholder?: string }) => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

// ── Mock AlertDialog with simple passthrough so jsdom can click buttons ───────
vi.mock("@/shared/components/ui/alert-dialog", () => {
  const React = require("react");
  // Root holds open state exposed via a test-friendly <div data-open>
  const AlertDialog = ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
    children: React.ReactNode;
  }) => {
    const [localOpen, setLocalOpen] = React.useState(open ?? false);
    React.useEffect(() => {
      if (open !== undefined) setLocalOpen(open);
    }, [open]);
    const handleChange = (v: boolean) => {
      setLocalOpen(v);
      onOpenChange?.(v);
    };
    return (
      <div data-testid="alert-dialog" data-open={localOpen}>
        {React.Children.map(children, (child: React.ReactNode) =>
          React.isValidElement(child)
            ? React.cloneElement(
                child as React.ReactElement<{
                  _alertOpen?: boolean;
                  _alertSetOpen?: (v: boolean) => void;
                }>,
                {
                  _alertOpen: localOpen,
                  _alertSetOpen: handleChange,
                },
              )
            : child,
        )}
      </div>
    );
  };

  const AlertDialogTrigger = ({
    children,
    _alertSetOpen,
  }: {
    children: React.ReactNode;
    _alertSetOpen?: (v: boolean) => void;
  }) => (
    <span onClick={() => _alertSetOpen?.(true)} data-testid="alert-trigger">
      {children}
    </span>
  );

  const AlertDialogContent = ({
    children,
    _alertOpen,
  }: {
    children: React.ReactNode;
    _alertOpen?: boolean;
  }) => (_alertOpen ? <div role="alertdialog">{children}</div> : null);

  const AlertDialogHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const AlertDialogFooter = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const AlertDialogTitle = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>;
  const AlertDialogDescription = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;

  const AlertDialogAction = ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler;
    className?: string;
  }) => (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  );

  const AlertDialogCancel = ({
    children,
    _alertSetOpen,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    _alertSetOpen?: (v: boolean) => void;
    onClick?: React.MouseEventHandler;
    className?: string;
  }) => (
    <button
      className={className}
      onClick={(e) => {
        _alertSetOpen?.(false);
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );

  return {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
  };
});

// ── Mock hooks ────────────────────────────────────────────────────────────────
const mockUseProperties = vi.fn();
vi.mock("@/features/properties/hooks/use-properties", () => ({
  useProperties: () => mockUseProperties(),
  PROPERTIES_QUERY_KEY: ["nodo_inmo", "properties"],
}));

const mockUpdateMutateAsync = vi.fn();
const mockUpdateIsPending = vi.fn(() => false);
vi.mock("@/features/properties/hooks/use-update-property", () => ({
  useUpdateProperty: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: mockUpdateIsPending(),
  }),
}));

const mockDeleteMutateAsync = vi.fn();
vi.mock("@/features/properties/hooks/use-delete-property", () => ({
  useDeleteProperty: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}));

// Import AFTER all mocks
import { PropertiesList } from "@/features/properties/components/properties-list";

// ── Fixture ───────────────────────────────────────────────────────────────────
const fixtureProperty = {
  id: "prop-111",
  address: "Corrientes 1234",
  property_type: "apartment",
  operation: "rent",
  status: "available",
  sale_price: 120000,
  currency: "ARS",
  rooms: 2,
  total_sqm: 65,
  description: "Luminoso departamento",
  inventory_description: null,
  main_photo: null,
  owner_id: null,
  org_id: "org-abc",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderList() {
  mockUseProperties.mockReturnValue({
    data: [fixtureProperty],
    isLoading: false,
    isError: false,
    error: null,
  });
  return render(<PropertiesList />, { wrapper });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("PropertiesList — Edit row action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clicking Editar opens the form dialog prefilled with the property address", async () => {
    renderList();

    await userEvent.click(screen.getByRole("button", { name: /editar/i }));

    await waitFor(() => {
      const input = screen.getByLabelText(/dirección/i);
      expect((input as HTMLInputElement).value).toBe("Corrientes 1234");
    });
  });

  it("clicking Editar prefills all form fields (operation, property_type, rooms)", async () => {
    renderList();

    await userEvent.click(screen.getByRole("button", { name: /editar/i }));

    await waitFor(() => {
      // Selects are mocked as native <select> — check their value
      const selects = screen.getAllByRole("combobox");
      const operationSelect = selects.find(
        (s) => (s as HTMLSelectElement).value === "rent",
      );
      expect(operationSelect).toBeDefined();

      const typeSelect = selects.find(
        (s) => (s as HTMLSelectElement).value === "apartment",
      );
      expect(typeSelect).toBeDefined();

      // Numeric fields
      const roomsInput = screen.getByLabelText(/ambientes/i);
      expect((roomsInput as HTMLInputElement).value).toBe("2");
    });
  });

  it("submitting the edit form calls useUpdateProperty with the right id and changed fields", async () => {
    mockUpdateMutateAsync.mockResolvedValue({ id: "prop-111" });

    renderList();

    await userEvent.click(screen.getByRole("button", { name: /editar/i }));

    // Change address
    const addressInput = await screen.findByLabelText(/dirección/i);
    await userEvent.clear(addressInput);
    await userEvent.type(addressInput, "Callao 500");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledOnce();
    });

    const [callArgs] = mockUpdateMutateAsync.mock.calls[0];
    expect(callArgs).toMatchObject({
      id: "prop-111",
      address: "Callao 500",
    });
    // org_id must NOT be sent
    expect(callArgs).not.toHaveProperty("org_id");
  });
});

describe("PropertiesList — Delete row action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clicking Eliminar shows the confirm AlertDialog with Spanish copy", async () => {
    renderList();

    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(
        screen.getByText(/¿eliminar esta propiedad\?/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/esta acción no se puede deshacer/i),
      ).toBeInTheDocument();
    });
  });

  it("confirming delete calls useDeleteProperty with the right id", async () => {
    mockDeleteMutateAsync.mockResolvedValue(undefined);

    renderList();

    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await screen.findByRole("alertdialog");

    const dialog = screen.getByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", {
      name: /eliminar/i,
    });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith("prop-111");
    });
  });

  it("cancelling the confirm dialog does NOT call useDeleteProperty", async () => {
    renderList();

    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await screen.findByRole("alertdialog");

    const dialog = screen.getByRole("alertdialog");
    const cancelButton = within(dialog).getByRole("button", {
      name: /cancelar/i,
    });
    await userEvent.click(cancelButton);

    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
  });
});
