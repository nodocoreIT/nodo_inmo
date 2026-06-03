/**
 * TDD — Edit & Delete contact row actions (via PropietariosList)
 * Tests:
 *   - clicking Editar opens form dialog prefilled with contact name
 *   - submitting edit form calls useUpdateContact with id + changed fields, no org_id
 *   - clicking Eliminar shows confirm AlertDialog with Spanish copy
 *   - confirming delete calls useDeleteContact with right id
 *   - cancelling does NOT call delete
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn(), id: "s1" } },
      }),
    },
  },
}));

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

// AlertDialog mock (same pattern as owner tests)
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
                { _alertOpen: localOpen, _alertSetOpen: handleChange },
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
  }) => <button className={className} onClick={onClick}>{children}</button>;

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

const mockUseContacts = vi.fn();
vi.mock("@/features/contacts/hooks/use-contacts", () => ({
  useContacts: (...args: unknown[]) => mockUseContacts(...args),
  CONTACTS_QUERY_KEY: ["nodo_inmo", "contacts"],
}));

vi.mock("@/features/contacts/hooks/use-create-contact", () => ({
  useCreateContact: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const mockUpdateMutateAsync = vi.fn();
vi.mock("@/features/contacts/hooks/use-update-contact", () => ({
  useUpdateContact: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
}));

const mockDeleteMutateAsync = vi.fn();
vi.mock("@/features/contacts/hooks/use-delete-contact", () => ({
  useDeleteContact: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
}));

import { PropietariosList } from "@/features/contacts/components/propietarios-list";

const fixtureContact = {
  id: "contact-111",
  name: "Roberto Fernández",
  dni: "25-88866544-3",
  phone: "11-3333-0099",
  email: "roberto@example.com",
  address: "Lavalle 500",
  commission_rate: 8,
  roles: ["owner"],
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
  mockUseContacts.mockReturnValue({
    data: [fixtureContact],
    isLoading: false,
    isError: false,
  });
  return render(<PropietariosList />, { wrapper });
}

describe("PropietariosList — Edit row action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking Editar opens form dialog prefilled with contact name", async () => {
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /editar/i }));
    await waitFor(() => {
      const input = screen.getByLabelText(/nombre/i);
      expect((input as HTMLInputElement).value).toBe("Roberto Fernández");
    });
  });

  it("clicking Editar prefills DNI, phone, commission_rate", async () => {
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /editar/i }));
    await waitFor(() => {
      expect((screen.getByLabelText(/dni/i) as HTMLInputElement).value).toBe("25-88866544-3");
      expect((screen.getByLabelText(/teléfono/i) as HTMLInputElement).value).toBe("11-3333-0099");
      expect((screen.getByLabelText(/comisión/i) as HTMLInputElement).value).toBe("8");
    });
  });

  it("submitting edit form calls useUpdateContact with id + changed fields, no org_id", async () => {
    mockUpdateMutateAsync.mockResolvedValue({ id: "contact-111" });
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /editar/i }));

    const nameInput = await screen.findByLabelText(/nombre/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Roberto Actualizado");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockUpdateMutateAsync).toHaveBeenCalledOnce());
    const [callArgs] = mockUpdateMutateAsync.mock.calls[0];
    expect(callArgs).toMatchObject({ id: "contact-111", name: "Roberto Actualizado" });
    expect(callArgs).not.toHaveProperty("org_id");
  });
});

describe("PropietariosList — Delete row action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking Eliminar shows confirm AlertDialog with Spanish copy", async () => {
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByText(/¿eliminar este contacto\?/i)).toBeInTheDocument();
      expect(screen.getByText(/esta acción no se puede deshacer/i)).toBeInTheDocument();
    });
  });

  it("confirming delete calls useDeleteContact with the right id", async () => {
    mockDeleteMutateAsync.mockResolvedValue(undefined);
    renderList();

    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await screen.findByRole("alertdialog");

    const dialog = screen.getByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", { name: /eliminar/i });
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockDeleteMutateAsync).toHaveBeenCalledWith("contact-111"));
  });

  it("cancelling the confirm dialog does NOT call useDeleteContact", async () => {
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await screen.findByRole("alertdialog");

    const dialog = screen.getByRole("alertdialog");
    const cancelButton = within(dialog).getByRole("button", { name: /cancelar/i });
    await userEvent.click(cancelButton);

    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
  });
});
