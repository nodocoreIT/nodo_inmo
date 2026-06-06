/**
 * TDD — Phase B: Documentos section
 *
 * Strict TDD: every test written RED first.
 *
 * Tests:
 *  1. DocumentosPage renders contract rows
 *  2. Search filters rows by tenant name
 *  3. Download action (ContractPdfActions) present per row
 *  4. Loading, error, empty, no-results states
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Module-level mocks (hoisted) ─────────────────────────────────────────────

const mockUseContracts = vi.fn();
vi.mock("@/features/contracts/hooks/use-contracts", () => ({
  useContracts: () => mockUseContracts(),
  CONTRACTS_QUERY_KEY: ["nodo_inmo", "contracts"],
}));

// Stub ContractPdfActions — avoids PDF logic, just renders a Download button
vi.mock("@/features/contracts/components/contract-pdf-actions", () => ({
  ContractPdfActions: ({ contract }: { contract: { id: string } }) => (
    <div data-testid={`pdf-actions-${contract.id}`}>
      <button>Descargar PDF</button>
    </div>
  ),
}));

// Stub ContractLocacionButton — avoids org-profile/auth hooks in list tests
vi.mock("@/features/contracts/components/contract-locacion-button", () => ({
  ContractLocacionButton: () => (
    <button aria-label="Generar contrato">Generar contrato</button>
  ),
}));

// Stub DocumentsSection — Phase D addition; not under test here
vi.mock("@/features/documentos/components/documents-section", () => ({
  DocumentsSection: () => <div data-testid="documents-section" />,
}));

// Stub the search store — we'll set the query via the mock
let mockQuery = "";
vi.mock("@/shared/search/use-search-store", () => ({
  useSearchStore: (selector: (s: { query: string }) => string) =>
    selector({ query: mockQuery }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONTRACT_A = {
  id: "c1",
  org_id: "org-a",
  property_id: "p1",
  tenant_id: "t1",
  start_date: "2026-01-01",
  end_date: "2028-01-01",
  rent_amount: 250000,
  currency: "ARS",
  adjustment_index: "ICL",
  adjustment_period_months: 3,
  next_adjustment_date: "2026-04-01",
  deposit_amount: 250000,
  expenses_paid_by: "tenant",
  commission_amount: 25000,
  status: "active",
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  property: { address: "Lavalle 100" },
  tenant: { name: "Juan Pérez" },
  guarantors: [],
};

const CONTRACT_B = {
  ...CONTRACT_A,
  id: "c2",
  tenant: { name: "María García" },
  property: { address: "Corrientes 200" },
  status: "draft",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

import { DocumentosPage } from "@/features/documentos/components/documentos-page";

describe("DocumentosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = "";
  });

  it("shows loading state", () => {
    mockUseContracts.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<DocumentosPage />, { wrapper: makeWrapper() });
    expect(screen.getByRole("status", { name: /cargando/i })).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseContracts.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<DocumentosPage />, { wrapper: makeWrapper() });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows empty state when no contracts", () => {
    mockUseContracts.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<DocumentosPage />, { wrapper: makeWrapper() });
    expect(screen.getByText(/no hay documentos/i)).toBeInTheDocument();
  });

  it("renders a row for each contract with tenant name and property", () => {
    mockUseContracts.mockReturnValue({
      data: [CONTRACT_A, CONTRACT_B],
      isLoading: false,
      isError: false,
    });
    render(<DocumentosPage />, { wrapper: makeWrapper() });

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("María García")).toBeInTheDocument();
    expect(screen.getByText("Lavalle 100")).toBeInTheDocument();
    expect(screen.getByText("Corrientes 200")).toBeInTheDocument();
  });

  it("renders ContractPdfActions for each row", () => {
    mockUseContracts.mockReturnValue({
      data: [CONTRACT_A, CONTRACT_B],
      isLoading: false,
      isError: false,
    });
    render(<DocumentosPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId("pdf-actions-c1")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-actions-c2")).toBeInTheDocument();
  });

  it("filters rows by tenant name when search query is set", () => {
    mockQuery = "juan";
    mockUseContracts.mockReturnValue({
      data: [CONTRACT_A, CONTRACT_B],
      isLoading: false,
      isError: false,
    });
    render(<DocumentosPage />, { wrapper: makeWrapper() });

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.queryByText("María García")).not.toBeInTheDocument();
  });

  it("filters rows by property address when search query is set", () => {
    mockQuery = "corrientes";
    mockUseContracts.mockReturnValue({
      data: [CONTRACT_A, CONTRACT_B],
      isLoading: false,
      isError: false,
    });
    render(<DocumentosPage />, { wrapper: makeWrapper() });

    expect(screen.queryByText("Juan Pérez")).not.toBeInTheDocument();
    expect(screen.getByText("María García")).toBeInTheDocument();
  });

  it("shows no-results state when search matches nothing", () => {
    mockQuery = "nomatch";
    mockUseContracts.mockReturnValue({
      data: [CONTRACT_A, CONTRACT_B],
      isLoading: false,
      isError: false,
    });
    render(<DocumentosPage />, { wrapper: makeWrapper() });

    expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
  });

  it("renders status badges for each row", () => {
    mockUseContracts.mockReturnValue({
      data: [CONTRACT_A],
      isLoading: false,
      isError: false,
    });
    render(<DocumentosPage />, { wrapper: makeWrapper() });

    expect(screen.getByText("Activo")).toBeInTheDocument();
  });
});
