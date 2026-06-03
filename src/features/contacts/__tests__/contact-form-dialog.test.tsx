/**
 * TDD — ContactFormDialog
 * Tests:
 *   - renders common fields (name, dni, phone, email, address)
 *   - shows owner-specific fields (commission, portal permissions) when defaultRole='owner'
 *   - hides owner-specific fields when defaultRole='tenant'
 *   - blocks submit when name is empty
 *   - edit mode: shows role checkboxes for owner/tenant toggle
 *   - edit mode: prefills all scalar fields
 *   - edit mode: roles checkboxes reflect current roles
 *   - commission defaults to 10 when role is owner
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
    orgId: "org-abc",
    signOut: vi.fn(),
    session: {},
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ContactFormDialog } from "@/features/contacts/components/contact-form-dialog";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const fixtureContact = {
  id: "c-111",
  name: "Roberto Contacto",
  dni: "25-88866544-3",
  phone: "11-3333-0099",
  email: "roberto@example.com",
  address: "Lavalle 500",
  commission_rate: 8,
  roles: ["owner", "tenant"],
  can_view_rentals: true,
  can_view_construction: false,
  can_view_sales: true,
  portal_user_id: null,
  org_id: "org-abc",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockOnSubmit = vi.fn();

describe("ContactFormDialog — create mode with defaultRole='owner'", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders name, dni, phone, email, address fields", () => {
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        defaultRole="owner"
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dni/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/teléfono/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dirección/i)).toBeInTheDocument();
  });

  it("shows commission and portal permissions when defaultRole='owner'", () => {
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        defaultRole="owner"
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    expect(screen.getByLabelText(/comisión/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/alquileres/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/obra|construcc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ventas/i)).toBeInTheDocument();
  });

  it("hides commission and portal permissions when defaultRole='tenant'", () => {
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        defaultRole="tenant"
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    expect(screen.queryByLabelText(/comisión/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/alquileres/i)).not.toBeInTheDocument();
  });

  it("blocks submit and shows error when name is empty", async () => {
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        defaultRole="owner"
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(screen.getByText(/nombre.*requerido|requerido|obligatorio/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("submits with roles: ['owner'] when defaultRole='owner'", async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        defaultRole="owner"
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    await userEvent.type(screen.getByLabelText(/nombre/i), "Nueva Persona");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledOnce());
    const [payload] = mockOnSubmit.mock.calls[0];
    expect(payload.roles).toEqual(["owner"]);
  });

  it("submits with roles: ['tenant'] when defaultRole='tenant'", async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        defaultRole="tenant"
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    await userEvent.type(screen.getByLabelText(/nombre/i), "Inquilino Nuevo");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledOnce());
    const [payload] = mockOnSubmit.mock.calls[0];
    expect(payload.roles).toEqual(["tenant"]);
  });

  it("commission defaults to 10 when defaultRole='owner'", async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        defaultRole="owner"
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    await userEvent.type(screen.getByLabelText(/nombre/i), "Ana Pérez");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledOnce());
    const [payload] = mockOnSubmit.mock.calls[0];
    expect(payload.commission_rate).toBe(10);
  });
});

describe("ContactFormDialog — edit mode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prefills all scalar fields in edit mode", () => {
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        contact={fixtureContact}
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    expect((screen.getByLabelText(/nombre/i) as HTMLInputElement).value).toBe("Roberto Contacto");
    expect((screen.getByLabelText(/dni/i) as HTMLInputElement).value).toBe("25-88866544-3");
    expect((screen.getByLabelText(/teléfono/i) as HTMLInputElement).value).toBe("11-3333-0099");
    expect((screen.getByLabelText(/comisión/i) as HTMLInputElement).value).toBe("8");
  });

  it("shows role checkboxes in edit mode", () => {
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        contact={fixtureContact}
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    expect(screen.getByLabelText(/propietario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/inquilino/i)).toBeInTheDocument();
  });

  it("role checkboxes reflect current roles (owner+tenant both checked)", () => {
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        contact={fixtureContact}
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    const ownerCb = screen.getByLabelText(/propietario/i) as HTMLInputElement;
    const tenantCb = screen.getByLabelText(/inquilino/i) as HTMLInputElement;
    expect(ownerCb.checked).toBe(true);
    expect(tenantCb.checked).toBe(true);
  });

  it("shows owner-specific fields when contact has owner role", () => {
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        contact={fixtureContact}
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );
    expect(screen.getByLabelText(/comisión/i)).toBeInTheDocument();
  });

  it("submits updated roles when role checkbox toggled", async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    render(
      <ContactFormDialog
        open
        onOpenChange={vi.fn()}
        contact={{ ...fixtureContact, roles: ["owner"] }}
        onSubmit={mockOnSubmit}
      />,
      { wrapper },
    );

    // Check tenant role checkbox
    const tenantCb = screen.getByLabelText(/inquilino/i);
    await userEvent.click(tenantCb);

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledOnce());
    const [payload] = mockOnSubmit.mock.calls[0];
    expect(payload.roles).toContain("owner");
    expect(payload.roles).toContain("tenant");
  });
});
