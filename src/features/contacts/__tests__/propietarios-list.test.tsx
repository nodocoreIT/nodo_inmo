/**
 * TDD — PropietariosList view
 * Tests:
 *   - renders heading "Propietarios"
 *   - "Nuevo propietario" button is present
 *   - empty state shows "Todavía no cargaste propietarios"
 *   - renders rows with name, DNI, phone, email, commission (Comisión column)
 *   - create dialog opens with defaultRole owner (mutation called with roles:['owner'])
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

import { PropietariosList } from "@/features/contacts/components/propietarios-list";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const fixtureOwner = {
  id: "c-owner-1",
  name: "Carlos Propietario",
  dni: "20-55554444-1",
  phone: "11-1111-0001",
  email: "carlos@example.com",
  address: "Corrientes 100",
  commission_rate: 8,
  roles: ["owner"],
  can_view_rentals: true,
  can_view_construction: false,
  can_view_sales: true,
  portal_user_id: null,
  org_id: "org-1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("PropietariosList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Propietarios heading", () => {
    mockUseContacts.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<PropietariosList />, { wrapper });
    expect(screen.getByRole("heading", { name: /propietarios/i })).toBeInTheDocument();
  });

  it("renders 'Nuevo propietario' button", () => {
    mockUseContacts.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<PropietariosList />, { wrapper });
    expect(screen.getByRole("button", { name: /nuevo propietario/i })).toBeInTheDocument();
  });

  it("shows loading state with role=status", () => {
    mockUseContacts.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<PropietariosList />, { wrapper });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state message", () => {
    mockUseContacts.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<PropietariosList />, { wrapper });
    expect(screen.getByText(/todavía no cargaste propietarios/i)).toBeInTheDocument();
  });

  it("shows error state with role=alert", () => {
    mockUseContacts.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<PropietariosList />, { wrapper });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders owner rows with Nombre, DNI, Teléfono, Email, Comisión columns", () => {
    mockUseContacts.mockReturnValue({
      data: [fixtureOwner],
      isLoading: false,
      isError: false,
    });
    render(<PropietariosList />, { wrapper });
    expect(screen.getByText("Carlos Propietario")).toBeInTheDocument();
    expect(screen.getByText("20-55554444-1")).toBeInTheDocument();
    expect(screen.getByText("11-1111-0001")).toBeInTheDocument();
    expect(screen.getByText("carlos@example.com")).toBeInTheDocument();
    expect(screen.getByText("8%")).toBeInTheDocument();
  });

  it("calls useContacts with 'owner' role", () => {
    mockUseContacts.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<PropietariosList />, { wrapper });
    expect(mockUseContacts).toHaveBeenCalledWith("owner");
  });

  it("create submits with roles: ['owner']", async () => {
    mockCreateMutateAsync.mockResolvedValue({ id: "new-c" });
    mockUseContacts.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<PropietariosList />, { wrapper });

    await userEvent.click(screen.getByRole("button", { name: /nuevo propietario/i }));
    const nameInput = await screen.findByLabelText(/nombre/i);
    await userEvent.type(nameInput, "Nuevo Propietario");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledOnce());
    const payload = mockCreateMutateAsync.mock.calls[0][0];
    expect(payload.roles).toEqual(["owner"]);
  });
});
