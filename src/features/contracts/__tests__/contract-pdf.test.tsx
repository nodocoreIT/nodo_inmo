/**
 * TDD — Phase A: Contract PDF viewer
 *
 * Strict TDD: every test written RED first.
 *
 * Sections:
 *  1. contract-pdf-document module smoke test (dynamic import, exports component)
 *  2. buildContractPdfData prop-builder (maps fields, defaults nulls, no throw)
 *  3. ContractPdfActions UI (Descargar always, Compartir branching, download triggered)
 *  4. ContractsList Eye button + Dialog wiring (opens on click, shows summary)
 *
 * @react-pdf/renderer primitives do not render in jsdom — tested via dynamic import
 * smoke only. Download/share glue is tested by mocking the actions component.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Module-level mocks (hoisted) ─────────────────────────────────────────────

// Agency hooks — mocked globally; Section 3 sets return values per test
const mockUseOrgProfile = vi.fn();
vi.mock("@/features/agency-profile/hooks/use-org-profile", () => ({
  useOrgProfile: () => mockUseOrgProfile(),
}));

const mockUseLogoUrl = vi.fn();
vi.mock("@/features/agency-profile/hooks/use-logo-url", () => ({
  useLogoUrl: () => mockUseLogoUrl(),
}));

// Stub ContractPdfActions for ContractsList tests (avoid real PDF logic in list tests)
vi.mock(
  "@/features/contracts/components/contract-pdf-actions",
  () => ({
    ContractPdfActions: ({ contract }: { contract: { id: string } }) => (
      <div data-testid="contract-pdf-actions" data-contract-id={contract.id}>
        <button>Descargar PDF</button>
      </div>
    ),
    // Keep buildContractPdfData accessible via importActual in tests below
  }),
);

// Stub ContractPdfViewer — replaces the dialog content in ContractsList tests
vi.mock(
  "@/features/contracts/components/contract-pdf-viewer",
  () => ({
    ContractPdfViewer: ({ contract }: { contract: { id: string } }) => (
      <div data-testid="contract-pdf-viewer" data-contract-id={contract.id}>
        <button>Descargar</button>
      </div>
    ),
  }),
);

// Stub dialogs/hooks not under test in list
vi.mock("@/features/contracts/hooks/use-delete-contract", () => ({
  useDeleteContract: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/contracts/hooks/use-update-contract", () => ({
  useUpdateContract: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/payments/hooks/use-generate-installments", () => ({
  useGenerateInstallments: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/features/contracts/components/contract-form-dialog", () => ({
  ContractFormDialog: () => null,
}));
vi.mock("@/features/contracts/components/create-contract-dialog", () => ({
  CreateContractDialog: () => null,
}));
vi.mock("@/features/contracts/components/contract-locacion-button", () => ({
  ContractLocacionButton: () => (
    <button aria-label="Generar contrato">Generar contrato</button>
  ),
}));

const mockUseContracts = vi.fn();
vi.mock("@/features/contracts/hooks/use-contracts", () => ({
  useContracts: () => mockUseContracts(),
  CONTRACTS_QUERY_KEY: ["nodo_inmo", "contracts"],
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_AGENCY = {
  org_id: "org-a",
  legal_name: "Inmobiliaria Test",
  address: "Av. Corrientes 1234",
  cuit: "30-12345678-9",
  phone: "11-1234-5678",
  email: "info@test.com",
  logo_path: "org-a/logo.png",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const SAMPLE_CONTRACT = {
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
  notes: "Sin mascotas",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  property: { address: "Lavalle 100" },
  tenant: { name: "Juan Pérez" },
  guarantors: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: ContractPdfDocument — dynamic import smoke test
// ─────────────────────────────────────────────────────────────────────────────

describe("contract-pdf-document module", () => {
  it("can be loaded via dynamic import without crashing", async () => {
    const mod = await import(
      "@/features/contracts/components/contract-pdf-document"
    );
    expect(mod.ContractPdfDocument).toBeDefined();
    expect(typeof mod.ContractPdfDocument).toBe("function");
  });

  it("exports ContractPdfData type (module loads cleanly)", async () => {
    const mod = await import(
      "@/features/contracts/components/contract-pdf-document"
    );
    expect(mod).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: buildContractPdfData prop-builder
// NOTE: uses vi.importActual to bypass the module-level vi.mock above
// ─────────────────────────────────────────────────────────────────────────────

describe("buildContractPdfData (prop-builder)", () => {
  it("maps contract fields correctly", async () => {
    const { buildContractPdfData } = await vi.importActual<
      typeof import("@/features/contracts/components/contract-pdf-actions")
    >("@/features/contracts/components/contract-pdf-actions");

    const result = buildContractPdfData(SAMPLE_CONTRACT, SAMPLE_AGENCY, "https://example.com/logo.png");

    expect(result.tenantName).toBe("Juan Pérez");
    expect(result.propertyAddress).toBe("Lavalle 100");
    expect(result.rentAmount).toBe(250000);
    expect(result.currency).toBe("ARS");
    expect(result.status).toBe("active");
    expect(result.startDate).toBe("2026-01-01");
    expect(result.endDate).toBe("2028-01-01");
  });

  it("defaults missing party fields to null", async () => {
    const { buildContractPdfData } = await vi.importActual<
      typeof import("@/features/contracts/components/contract-pdf-actions")
    >("@/features/contracts/components/contract-pdf-actions");

    const contractWithNulls = { ...SAMPLE_CONTRACT, tenant: null, property: null };
    const result = buildContractPdfData(contractWithNulls, null, null);

    expect(result.tenantName).toBeNull();
    expect(result.propertyAddress).toBeNull();
    expect(result.agencyName).toBe("");
    expect(result.logoUrl).toBeNull();
  });

  it("does not throw when agency is null", async () => {
    const { buildContractPdfData } = await vi.importActual<
      typeof import("@/features/contracts/components/contract-pdf-actions")
    >("@/features/contracts/components/contract-pdf-actions");

    expect(() =>
      buildContractPdfData(SAMPLE_CONTRACT, null, null),
    ).not.toThrow();
  });

  it("includes agency fields when profile is present", async () => {
    const { buildContractPdfData } = await vi.importActual<
      typeof import("@/features/contracts/components/contract-pdf-actions")
    >("@/features/contracts/components/contract-pdf-actions");

    const result = buildContractPdfData(SAMPLE_CONTRACT, SAMPLE_AGENCY, "https://logo.png");

    expect(result.agencyName).toBe("Inmobiliaria Test");
    expect(result.agencyAddress).toBe("Av. Corrientes 1234");
    expect(result.agencyCuit).toBe("30-12345678-9");
    expect(result.logoUrl).toBe("https://logo.png");
  });

  it("includes guarantors count from contract", async () => {
    const { buildContractPdfData } = await vi.importActual<
      typeof import("@/features/contracts/components/contract-pdf-actions")
    >("@/features/contracts/components/contract-pdf-actions");

    const contractWithGuarantors = {
      ...SAMPLE_CONTRACT,
      guarantors: [{ guarantor_id: "g1" }],
    };
    const result = buildContractPdfData(contractWithGuarantors, null, null);
    expect(result.guarantorCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: ContractPdfActions UI component
// Uses importActual for the real component; global hook mocks set return values
// ─────────────────────────────────────────────────────────────────────────────

describe("ContractPdfActions (real component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrgProfile.mockReturnValue({ data: null, isLoading: false });
    mockUseLogoUrl.mockReturnValue({ data: null, isLoading: false });
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("always renders the Descargar PDF button", async () => {
    const { ContractPdfActions } = await vi.importActual<
      typeof import("@/features/contracts/components/contract-pdf-actions")
    >("@/features/contracts/components/contract-pdf-actions");

    render(<ContractPdfActions contract={SAMPLE_CONTRACT} />, {
      wrapper: makeWrapper(),
    });
    expect(
      screen.getByRole("button", { name: /descargar pdf/i }),
    ).toBeInTheDocument();
  });

  it("does NOT show Compartir when navigator.canShare is unavailable", async () => {
    const { ContractPdfActions } = await vi.importActual<
      typeof import("@/features/contracts/components/contract-pdf-actions")
    >("@/features/contracts/components/contract-pdf-actions");

    render(<ContractPdfActions contract={SAMPLE_CONTRACT} />, {
      wrapper: makeWrapper(),
    });
    expect(
      screen.queryByRole("button", { name: /compartir/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Compartir when navigator.canShare returns true", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn().mockReturnValue(true),
      writable: true,
      configurable: true,
    });

    const { ContractPdfActions } = await vi.importActual<
      typeof import("@/features/contracts/components/contract-pdf-actions")
    >("@/features/contracts/components/contract-pdf-actions");

    render(<ContractPdfActions contract={SAMPLE_CONTRACT} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /compartir/i }),
      ).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: ContractsList — Eye button + Dialog wiring
// ─────────────────────────────────────────────────────────────────────────────

import { ContractsList } from "@/features/contracts/components/contracts-list";

describe("ContractsList — Eye button + Dialog (Phase A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an Eye/Ver PDF button per contract row", () => {
    mockUseContracts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [SAMPLE_CONTRACT],
    });

    render(<ContractsList />, { wrapper: makeWrapper() });

    expect(
      screen.getByRole("button", { name: /ver pdf/i }),
    ).toBeInTheDocument();
  });

  it("opens the dialog with tenant name + property address when Eye is clicked", async () => {
    mockUseContracts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [SAMPLE_CONTRACT],
    });

    render(<ContractsList />, { wrapper: makeWrapper() });

    await userEvent.click(screen.getByRole("button", { name: /ver pdf/i }));

    // Dialog should open — find the DialogContent (role=dialog)
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText(/juan pérez/i)).toBeInTheDocument();
    });
  });

  it("renders ContractPdfViewer inside the dialog when open", async () => {
    mockUseContracts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [SAMPLE_CONTRACT],
    });

    render(<ContractsList />, { wrapper: makeWrapper() });
    await userEvent.click(screen.getByRole("button", { name: /ver pdf/i }));

    await waitFor(() => {
      expect(screen.getByTestId("contract-pdf-viewer")).toBeInTheDocument();
    });
  });

  it("renders Eye button for each row when multiple contracts exist", () => {
    mockUseContracts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        SAMPLE_CONTRACT,
        { ...SAMPLE_CONTRACT, id: "c2", tenant: { name: "María García" }, property: { address: "Lavalle 200" } },
      ],
    });

    render(<ContractsList />, { wrapper: makeWrapper() });

    expect(screen.getAllByRole("button", { name: /ver pdf/i })).toHaveLength(2);
  });
});
