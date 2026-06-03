/**
 * TDD — Owners list
 * Tests:
 *   - loading state renders spinner with role="status"
 *   - empty state renders "Todavía no cargaste propietarios"
 *   - renders rows with name, DNI, phone, email, commission_rate
 *   - error state renders role="alert"
 *   - renders "Nuevo propietario" button
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
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
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
const mockUseOwners = vi.fn();
vi.mock("@/features/owners/hooks/use-owners", () => ({
  useOwners: () => mockUseOwners(),
  OWNERS_QUERY_KEY: ["nodo_inmo", "owners"],
}));

import { OwnersList } from "@/features/owners/components/owners-list";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("OwnersList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state with role=status", () => {
    mockUseOwners.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });
    render(<OwnersList />, { wrapper });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state message", () => {
    mockUseOwners.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<OwnersList />, { wrapper });
    expect(
      screen.getByText(/todavía no cargaste propietarios/i),
    ).toBeInTheDocument();
  });

  it("renders owner rows with name, DNI, phone, email and commission", () => {
    mockUseOwners.mockReturnValue({
      data: [
        {
          id: "o-1",
          name: "María García",
          dni: "20-12345678-9",
          phone: "11-5555-0001",
          email: "maria@example.com",
          commission_rate: 5,
          address: "Corrientes 100",
          org_id: "org-1",
          can_view_rentals: true,
          can_view_construction: false,
          can_view_sales: true,
          portal_user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<OwnersList />, { wrapper });

    expect(screen.getByText("María García")).toBeInTheDocument();
    expect(screen.getByText("20-12345678-9")).toBeInTheDocument();
    expect(screen.getByText("11-5555-0001")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
    expect(screen.getByText("5%")).toBeInTheDocument();
  });

  it("shows null columns as em-dash", () => {
    mockUseOwners.mockReturnValue({
      data: [
        {
          id: "o-2",
          name: "Juan Sin DNI",
          dni: null,
          phone: null,
          email: null,
          commission_rate: 10,
          address: null,
          org_id: "org-1",
          can_view_rentals: false,
          can_view_construction: false,
          can_view_sales: false,
          portal_user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<OwnersList />, { wrapper });
    // At least one em-dash rendered for null fields
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("shows error state", () => {
    mockUseOwners.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Network error"),
    });
    render(<OwnersList />, { wrapper });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders Nuevo propietario button", () => {
    mockUseOwners.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<OwnersList />, { wrapper });
    expect(
      screen.getByRole("button", { name: /nuevo propietario/i }),
    ).toBeInTheDocument();
  });
});
