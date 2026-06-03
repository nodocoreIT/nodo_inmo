/**
 * TDD — Edit & Delete owner row actions
 *
 * Tests:
 *   Edit:
 *     - clicking "Editar" opens form dialog prefilled with the owner values
 *     - submitting the edit form calls useUpdateOwner with the changed fields and the right id
 *     - org_id must NOT be sent in the update payload
 *   Delete:
 *     - clicking "Eliminar" shows a confirm AlertDialog with the expected copy
 *     - confirming calls useDeleteOwner with the right id
 *     - cancelling does NOT call delete
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mock supabase ─────────────────────────────────────────────────────────────
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

// ── Mock AlertDialog with simple passthrough ──────────────────────────────────
vi.mock("@/shared/components/ui/alert-dialog", () => {
  const React = require("react");

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

  const AlertDialogHeader = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  const AlertDialogFooter = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  const AlertDialogTitle = ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  );
  const AlertDialogDescription = ({
    children,
  }: {
    children: React.ReactNode;
  }) => <p>{children}</p>;

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
const mockUseOwners = vi.fn();
vi.mock("@/features/owners/hooks/use-owners", () => ({
  useOwners: () => mockUseOwners(),
  OWNERS_QUERY_KEY: ["nodo_inmo", "owners"],
}));

const mockUpdateMutateAsync = vi.fn();
vi.mock("@/features/owners/hooks/use-update-owner", () => ({
  useUpdateOwner: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

const mockDeleteMutateAsync = vi.fn();
vi.mock("@/features/owners/hooks/use-delete-owner", () => ({
  useDeleteOwner: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}));

// Import AFTER all mocks
import { OwnersList } from "@/features/owners/components/owners-list";

// ── Fixture ───────────────────────────────────────────────────────────────────
const fixtureOwner = {
  id: "owner-111",
  name: "Roberto Fernández",
  dni: "25-88866544-3",
  phone: "11-3333-0099",
  email: "roberto@example.com",
  address: "Lavalle 500",
  commission_rate: 8,
  can_view_rentals: true,
  can_view_construction: false,
  can_view_sales: true,
  portal_user_id: null,
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
  mockUseOwners.mockReturnValue({
    data: [fixtureOwner],
    isLoading: false,
    isError: false,
    error: null,
  });
  return render(<OwnersList />, { wrapper });
}

// ── Edit tests ────────────────────────────────────────────────────────────────
describe("OwnersList — Edit row action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clicking Editar opens the form dialog prefilled with the owner name", async () => {
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /editar/i }));
    await waitFor(() => {
      const input = screen.getByLabelText(/nombre/i);
      expect((input as HTMLInputElement).value).toBe("Roberto Fernández");
    });
  });

  it("clicking Editar prefills all scalar fields (DNI, phone, commission_rate)", async () => {
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /editar/i }));
    await waitFor(() => {
      expect((screen.getByLabelText(/dni/i) as HTMLInputElement).value).toBe(
        "25-88866544-3",
      );
      expect(
        (screen.getByLabelText(/teléfono/i) as HTMLInputElement).value,
      ).toBe("11-3333-0099");
      expect(
        (screen.getByLabelText(/comisión/i) as HTMLInputElement).value,
      ).toBe("8");
    });
  });

  it("submitting edit form calls useUpdateOwner with id + changed fields, no org_id", async () => {
    mockUpdateMutateAsync.mockResolvedValue({ id: "owner-111" });
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /editar/i }));

    const nameInput = await screen.findByLabelText(/nombre/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Roberto Actualizado");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledOnce();
    });
    const [callArgs] = mockUpdateMutateAsync.mock.calls[0];
    expect(callArgs).toMatchObject({ id: "owner-111", name: "Roberto Actualizado" });
    expect(callArgs).not.toHaveProperty("org_id");
  });
});

// ── Delete tests ──────────────────────────────────────────────────────────────
describe("OwnersList — Delete row action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clicking Eliminar shows the confirm AlertDialog with Spanish copy", async () => {
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(
        screen.getByText(/¿eliminar este propietario\?/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/esta acción no se puede deshacer/i),
      ).toBeInTheDocument();
    });
  });

  it("confirming delete calls useDeleteOwner with the right id", async () => {
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
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith("owner-111");
    });
  });

  it("cancelling the confirm dialog does NOT call useDeleteOwner", async () => {
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
