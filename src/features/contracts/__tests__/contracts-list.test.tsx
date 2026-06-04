/**
 * TDD — ContractsList
 * Tests: loading, error, empty state, and rendering rows with the embedded
 * property address + tenant name, formatted money, and status label.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseContracts = vi.fn();
vi.mock("@/features/contracts/hooks/use-contracts", () => ({
  useContracts: () => mockUseContracts(),
  CONTRACTS_QUERY_KEY: ["nodo_inmo", "contracts"],
}));

const mockDeleteMutateAsync = vi.fn();
vi.mock("@/features/contracts/hooks/use-delete-contract", () => ({
  useDeleteContract: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
}));

vi.mock("@/features/contracts/hooks/use-update-contract", () => ({
  useUpdateContract: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/payments/hooks/use-generate-installments", () => ({
  useGenerateInstallments: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Edit dialog imports supabase-backed hooks; stub it for the list test.
vi.mock("@/features/contracts/components/contract-form-dialog", () => ({
  ContractFormDialog: () => null,
}));

// CreateContractDialog pulls in auth/supabase; stub it out for the list test.
vi.mock("@/features/contracts/components/create-contract-dialog", () => ({
  CreateContractDialog: () => null,
}));

import { ContractsList } from "@/features/contracts/components/contracts-list";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderList() {
  return render(<ContractsList />, { wrapper });
}

describe("ContractsList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a loading state", () => {
    mockUseContracts.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderList();
    expect(screen.getByRole("status", { name: /cargando contratos/i })).toBeInTheDocument();
  });

  it("shows an error state", () => {
    mockUseContracts.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderList();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows an empty state when there are no contracts", () => {
    mockUseContracts.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderList();
    expect(screen.getByText(/todavía no cargaste contratos/i)).toBeInTheDocument();
  });

  it("renders a row with property address, tenant name, money and status", () => {
    mockUseContracts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: "c1",
          property: { address: "Lavalle 100" },
          tenant: { name: "Juan Pérez" },
          start_date: "2026-01-01",
          end_date: "2028-01-01",
          rent_amount: 250000,
          currency: "ARS",
          adjustment_index: "ICL",
          adjustment_period_months: 3,
          status: "active",
        },
      ],
    });
    renderList();

    expect(screen.getByText("Lavalle 100")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText(/250\.000/)).toBeInTheDocument();
    expect(screen.getByText(/01\/01\/2026/)).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });
});
