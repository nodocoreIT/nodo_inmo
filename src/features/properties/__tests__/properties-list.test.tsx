/**
 * TDD — Properties list
 * Tests:
 *   - loading state renders skeleton/spinner
 *   - empty state renders "Todavía no cargaste propiedades"
 *   - renders rows with Spanish-translated enums and formatted price
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock supabase BEFORE importing hooks
vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(),
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
    orgId: "org-1",
    signOut: vi.fn(),
    session: {},
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the hook — we test the component in isolation
const mockUseProperties = vi.fn();
vi.mock("@/features/properties/hooks/use-properties", () => ({
  useProperties: () => mockUseProperties(),
}));

// Mock RegisterExpenseButton — isolate properties-list from expense feature internals
vi.mock("@/features/property-expenses/components/register-expense-button", () => ({
  RegisterExpenseButton: () => null,
}));

import { PropertiesList } from "@/features/properties/components/properties-list";
import { useSearchStore } from "@/shared/search/use-search-store";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("PropertiesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({ query: "" });
  });

  it("shows loading state", () => {
    mockUseProperties.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });
    render(<PropertiesList />, { wrapper });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state message", () => {
    mockUseProperties.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<PropertiesList />, { wrapper });
    expect(
      screen.getByText(/todavía no cargaste propiedades/i),
    ).toBeInTheDocument();
  });

  it("renders property rows with Spanish labels and formatted price", () => {
    mockUseProperties.mockReturnValue({
      data: [
        {
          id: "p-1",
          address: "Av. Corrientes 1234",
          property_type: "apartment",
          operation: "rent",
          status: "available",
          sale_price: 150000,
          currency: "ARS",
          rooms: 2,
          org_id: "org-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          description: null,
          inventory_description: null,
          main_photo: null,
          owner_id: null,
          total_sqm: null,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<PropertiesList />, { wrapper });

    expect(screen.getByText("Av. Corrientes 1234")).toBeInTheDocument();
    // Enum translations
    expect(screen.getByText("Departamento")).toBeInTheDocument();
    expect(screen.getByText("Alquiler")).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    // Price formatted with es-AR thousands separator
    expect(screen.getByText(/150\.000|150,000/)).toBeInTheDocument();
    // Rooms
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders multiple rows", () => {
    mockUseProperties.mockReturnValue({
      data: [
        {
          id: "p-1",
          address: "Av. Corrientes 1234",
          property_type: "house",
          operation: "sale",
          status: "reserved",
          sale_price: 80000,
          currency: "USD",
          rooms: 3,
          org_id: "org-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          description: null,
          inventory_description: null,
          main_photo: null,
          owner_id: null,
          total_sqm: null,
        },
        {
          id: "p-2",
          address: "Callao 500",
          property_type: "commercial",
          operation: "rent",
          status: "rented",
          sale_price: null,
          currency: "ARS",
          rooms: null,
          org_id: "org-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          description: null,
          inventory_description: null,
          main_photo: null,
          owner_id: null,
          total_sqm: null,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<PropertiesList />, { wrapper });

    expect(screen.getByText("Av. Corrientes 1234")).toBeInTheDocument();
    expect(screen.getByText("Casa")).toBeInTheDocument();
    expect(screen.getByText("Venta")).toBeInTheDocument();
    expect(screen.getByText("Reservada")).toBeInTheDocument();
    expect(screen.getByText("Callao 500")).toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Alquilada")).toBeInTheDocument();
  });

  it("filters rows by the global search query", () => {
    mockUseProperties.mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      data: [
        {
          id: "p-1", address: "Av. Corrientes 1234", property_type: "house",
          operation: "sale", status: "available", sale_price: 80000, currency: "USD",
          rooms: 3, org_id: "org-1", created_at: "", updated_at: "", description: null,
          inventory_description: null, main_photo: null, owner_id: null, total_sqm: null,
        },
        {
          id: "p-2", address: "Callao 500", property_type: "commercial",
          operation: "rent", status: "rented", sale_price: null, currency: "ARS",
          rooms: null, org_id: "org-1", created_at: "", updated_at: "", description: null,
          inventory_description: null, main_photo: null, owner_id: null, total_sqm: null,
        },
      ],
    });
    useSearchStore.setState({ query: "callao" });
    render(<PropertiesList />, { wrapper });

    expect(screen.queryByText("Av. Corrientes 1234")).not.toBeInTheDocument();
    expect(screen.getByText("Callao 500")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseProperties.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Network error"),
    });
    render(<PropertiesList />, { wrapper });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders Nueva propiedad button", () => {
    mockUseProperties.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<PropertiesList />, { wrapper });
    expect(
      screen.getByRole("button", { name: /nueva propiedad/i }),
    ).toBeInTheDocument();
  });
});
