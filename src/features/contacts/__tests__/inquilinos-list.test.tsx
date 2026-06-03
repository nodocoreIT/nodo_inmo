/**
 * TDD — InquilinosList view
 * Tests:
 *   - renders heading "Inquilinos"
 *   - "Nuevo inquilino" button is present
 *   - empty state shows "Todavía no cargaste inquilinos"
 *   - renders rows with name, DNI, phone, email — NO comisión column
 *   - create dialog submits with roles: ['tenant']
 *   - calls useContacts with 'tenant' role
 *   - error state renders role="alert"
 *   - loading state renders role="status"
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({ from: vi.fn(() => ({ select: vi.fn() })) })),
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
    orgId: "org-1",
    signOut: vi.fn(),
    session: {},
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseContacts = vi.fn();
vi.mock("@/features/contacts/hooks/use-contacts", () => ({
  useContacts: (...args: unknown[]) => mockUseContacts(...args),
  CONTACTS_QUERY_KEY: ["nodo_inmo", "contacts"],
}));

const mockCreateMutateAsync = vi.fn();
vi.mock("@/features/contacts/hooks/use-create-contact", () => ({
  useCreateContact: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/features/contacts/hooks/use-update-contact", () => ({
  useUpdateContact: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/features/contacts/hooks/use-delete-contact", () => ({
  useDeleteContact: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

import { InquilinosList } from "@/features/contacts/components/inquilinos-list";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const fixtureTenant = {
  id: "c-tenant-1",
  name: "Laura Inquilina",
  dni: "27-99988877-2",
  phone: "11-2222-0002",
  email: "laura@example.com",
  address: "Lavalle 200",
  commission_rate: 0,
  roles: ["tenant"],
  can_view_rentals: false,
  can_view_construction: false,
  can_view_sales: false,
  portal_user_id: null,
  org_id: "org-1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("InquilinosList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Nuevo inquilino' button", () => {
    mockUseContacts.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<InquilinosList />, { wrapper });
    expect(screen.getByRole("button", { name: /nuevo inquilino/i })).toBeInTheDocument();
  });

  it("shows loading state with role=status", () => {
    mockUseContacts.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<InquilinosList />, { wrapper });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state message for tenants", () => {
    mockUseContacts.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<InquilinosList />, { wrapper });
    expect(screen.getByText(/todavía no cargaste inquilinos/i)).toBeInTheDocument();
  });

  it("shows error state with role=alert", () => {
    mockUseContacts.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<InquilinosList />, { wrapper });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders tenant rows with Nombre, DNI, Teléfono, Email columns", () => {
    mockUseContacts.mockReturnValue({
      data: [fixtureTenant],
      isLoading: false,
      isError: false,
    });
    render(<InquilinosList />, { wrapper });
    expect(screen.getByText("Laura Inquilina")).toBeInTheDocument();
    expect(screen.getByText("27-99988877-2")).toBeInTheDocument();
    expect(screen.getByText("11-2222-0002")).toBeInTheDocument();
    expect(screen.getByText("laura@example.com")).toBeInTheDocument();
  });

  it("does NOT render Comisión column header for tenants", () => {
    mockUseContacts.mockReturnValue({
      data: [fixtureTenant],
      isLoading: false,
      isError: false,
    });
    render(<InquilinosList />, { wrapper });
    expect(screen.queryByText(/comisión/i)).not.toBeInTheDocument();
  });

  it("calls useContacts with 'tenant' role", () => {
    mockUseContacts.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<InquilinosList />, { wrapper });
    expect(mockUseContacts).toHaveBeenCalledWith("tenant");
  });

  it("create submits with roles: ['tenant']", async () => {
    mockCreateMutateAsync.mockResolvedValue({ id: "new-c" });
    mockUseContacts.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<InquilinosList />, { wrapper });

    await userEvent.click(screen.getByRole("button", { name: /nuevo inquilino/i }));
    const nameInput = await screen.findByLabelText(/nombre/i);
    await userEvent.type(nameInput, "Nuevo Inquilino");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledOnce());
    const payload = mockCreateMutateAsync.mock.calls[0][0];
    expect(payload.roles).toEqual(["tenant"]);
  });
});
