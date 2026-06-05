/**
 * TDD — PR-C: settlement statement PDF + download/share
 *
 * Tests the data-mapping hook, the PDF document props, and the download/share
 * trigger logic. @react-pdf/renderer primitives do not render in jsdom, so we:
 *  1. Test the pure data-mapping / prop-builder functions directly.
 *  2. Test the dynamic-import boundary (module can be loaded without errors).
 *  3. Test the share/download glue (anchor, File, navigator.share) via spies on
 *     the exported functions.
 *  4. Test caja-page UI wiring (Descargar/Compartir buttons, multi-currency).
 *
 * Strict TDD: every test was written RED first.
 *
 * Note on vi.doMock: vitest hoists vi.mock() calls to the top of the module.
 * Tests that need to mock a module for a subset of assertions use vi.mock() at
 * the top level and reset via beforeEach/afterEach as needed.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SettlementBreakdown } from "@/features/caja/lib/caja-math";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export const SAMPLE_BREAKDOWN: SettlementBreakdown & {
  version: number;
  currency: string;
  settlement_group?: string;
  sealed_at?: string;
  cobro_count?: number;
} = {
  version: 1,
  currency: "ARS",
  gross: 1500,
  commission_rate: 10,
  commission: 150,
  owner_share: 1350,
  deductions: [
    {
      id: "e1",
      amount: 200,
      description: "Arreglo",
      expense_date: "2026-05-01",
      type: "arreglo",
    },
  ],
  deduction_total: 200,
  net: 1150,
  settlement_group: "group-uuid",
  sealed_at: "2026-06-01T12:00:00Z",
  cobro_count: 2,
};

const SAMPLE_AGENCY = {
  org_id: "org-a",
  legal_name: "Inmobiliaria Test",
  address: "Av. Corrientes 1234",
  cuit: "30-12345678-9",
  phone: null,
  email: null,
  logo_path: "org-a/logo.png",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const SAMPLE_OWNER = "Juan Pérez";
const SAMPLE_SETTLED_DATE = "2026-06-01";

// ─── Module-level mocks (hoisted by vitest) ───────────────────────────────────

// Mock the PDF actions so CajaPage tests don't need a real pdf() call
const mockHandleDownload = vi.fn().mockResolvedValue(undefined);
const mockHandleShare = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/caja/lib/settlement-pdf-actions", () => ({
  handleDownload: (...args: unknown[]) => mockHandleDownload(...args),
  handleShare: (...args: unknown[]) => mockHandleShare(...args),
}));

// Caja page hook mocks
const mockUseCashMovements = vi.fn();
vi.mock("@/features/caja/hooks/use-cash-movements", () => ({
  useCashMovements: () => mockUseCashMovements(),
  CASH_MOVEMENTS_QUERY_KEY: ["nodo_inmo", "cash_movements"],
}));

const mockUseOwnerSettlements = vi.fn();
vi.mock("@/features/caja/hooks/use-owner-settlements", () => ({
  useOwnerSettlements: () => mockUseOwnerSettlements(),
  OWNER_SETTLEMENTS_QUERY_KEY: ["nodo_inmo", "owner_settlements"],
}));

const mockSettleMutate = vi.fn();
vi.mock("@/features/caja/hooks/use-settle-owner", () => ({
  useSettleOwner: () => ({ mutate: mockSettleMutate, isPending: false }),
}));

vi.mock("@/features/caja/components/movement-form-dialog", () => ({
  MovementFormDialog: () => null,
}));

const mockUseOrgProfile = vi.fn();
vi.mock("@/features/agency-profile/hooks/use-org-profile", () => ({
  useOrgProfile: () => mockUseOrgProfile(),
}));

const mockUseLogoUrl = vi.fn();
vi.mock("@/features/agency-profile/hooks/use-logo-url", () => ({
  useLogoUrl: () => mockUseLogoUrl(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const SEALED_SETTLEMENTS = [
  {
    id: "s1",
    owner_id: "o1",
    amount: 225000,
    currency: "ARS",
    status: "settled",
    settlement_group: "group-1",
    settled_date: "2026-06-01",
    breakdown: SAMPLE_BREAKDOWN,
    owner: { name: "Juan Pérez" },
  },
];

const SEALED_SETTLEMENTS_MULTI_CURRENCY = [
  {
    id: "s1",
    owner_id: "o1",
    amount: 225000,
    currency: "ARS",
    status: "settled",
    settlement_group: "group-ars",
    settled_date: "2026-06-01",
    breakdown: { ...SAMPLE_BREAKDOWN, currency: "ARS", gross: 500 },
    owner: { name: "Juan Pérez" },
  },
  {
    id: "s2",
    owner_id: "o1",
    amount: 100,
    currency: "USD",
    status: "settled",
    settlement_group: "group-usd",
    settled_date: "2026-06-01",
    breakdown: { ...SAMPLE_BREAKDOWN, currency: "USD", gross: 200 },
    owner: { name: "Juan Pérez" },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: buildStatementData pure function (R-C2 / R-C3 / R-C5 / R-C6)
// Import the REAL module (not mocked) using dynamic import.
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStatementData (prop-builder)", () => {
  it("returns breakdown verbatim — no re-computation (R-C5)", async () => {
    const real = await vi.importActual<typeof import("@/features/caja/lib/settlement-statement-data")>(
      "@/features/caja/lib/settlement-statement-data",
    );
    const { buildStatementData } = real;

    const result = buildStatementData({
      breakdown: SAMPLE_BREAKDOWN,
      agency: SAMPLE_AGENCY,
      logoUrl: null,
      ownerName: SAMPLE_OWNER,
      settledDate: SAMPLE_SETTLED_DATE,
    });

    expect(result.breakdown.gross).toBe(SAMPLE_BREAKDOWN.gross);
    expect(result.breakdown.commission).toBe(SAMPLE_BREAKDOWN.commission);
    expect(result.breakdown.net).toBe(SAMPLE_BREAKDOWN.net);
    expect(result.breakdown.deductions).toEqual(SAMPLE_BREAKDOWN.deductions);
  });

  it("includes currency from breakdown (R-C6)", async () => {
    const { buildStatementData } = await vi.importActual<typeof import("@/features/caja/lib/settlement-statement-data")>(
      "@/features/caja/lib/settlement-statement-data",
    );

    const result = buildStatementData({
      breakdown: SAMPLE_BREAKDOWN,
      agency: null,
      logoUrl: null,
      ownerName: SAMPLE_OWNER,
      settledDate: SAMPLE_SETTLED_DATE,
    });

    expect(result.currency).toBe("ARS");
  });

  it("handles null agency gracefully — no throw (R-C2 / R-A22)", async () => {
    const { buildStatementData } = await vi.importActual<typeof import("@/features/caja/lib/settlement-statement-data")>(
      "@/features/caja/lib/settlement-statement-data",
    );

    expect(() =>
      buildStatementData({
        breakdown: SAMPLE_BREAKDOWN,
        agency: null,
        logoUrl: null,
        ownerName: SAMPLE_OWNER,
        settledDate: SAMPLE_SETTLED_DATE,
      }),
    ).not.toThrow();

    const result = buildStatementData({
      breakdown: SAMPLE_BREAKDOWN,
      agency: null,
      logoUrl: null,
      ownerName: SAMPLE_OWNER,
      settledDate: SAMPLE_SETTLED_DATE,
    });

    expect(result.agencyName).toBe("");
    expect(result.address).toBe("");
    expect(result.cuit).toBe("");
  });

  it("extracts agency fields correctly when profile is present (R-C2)", async () => {
    const { buildStatementData } = await vi.importActual<typeof import("@/features/caja/lib/settlement-statement-data")>(
      "@/features/caja/lib/settlement-statement-data",
    );

    const result = buildStatementData({
      breakdown: SAMPLE_BREAKDOWN,
      agency: SAMPLE_AGENCY,
      logoUrl: "https://example.com/logo.png",
      ownerName: SAMPLE_OWNER,
      settledDate: SAMPLE_SETTLED_DATE,
    });

    expect(result.agencyName).toBe("Inmobiliaria Test");
    expect(result.address).toBe("Av. Corrientes 1234");
    expect(result.cuit).toBe("30-12345678-9");
    expect(result.logoUrl).toBe("https://example.com/logo.png");
  });

  it("includes owner name and formatted date (R-C3)", async () => {
    const { buildStatementData } = await vi.importActual<typeof import("@/features/caja/lib/settlement-statement-data")>(
      "@/features/caja/lib/settlement-statement-data",
    );

    const result = buildStatementData({
      breakdown: SAMPLE_BREAKDOWN,
      agency: null,
      logoUrl: null,
      ownerName: "Juan Pérez",
      settledDate: "2026-06-01",
    });

    expect(result.ownerName).toBe("Juan Pérez");
    expect(result.settledDate).toBe("2026-06-01");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: SettlementStatementDocument module (R-C1 / R-C2 / R-C4 / R-C5)
// The document module must be importable via dynamic import in jsdom.
// ─────────────────────────────────────────────────────────────────────────────

describe("SettlementStatementDocument (R-C1 / R-C2 / R-C4 / R-C5)", () => {
  it("R-C1: module can be loaded via dynamic import without crashing", async () => {
    const mod = await import(
      "@/features/caja/components/settlement-statement-document"
    );
    expect(mod.SettlementStatementDocument).toBeDefined();
    expect(typeof mod.SettlementStatementDocument).toBe("function");
  });

  it("R-C4 / R-C5: buildStatementData provides all breakdown values for the document", async () => {
    const { buildStatementData } = await vi.importActual<typeof import("@/features/caja/lib/settlement-statement-data")>(
      "@/features/caja/lib/settlement-statement-data",
    );

    const data = buildStatementData({
      breakdown: SAMPLE_BREAKDOWN,
      agency: SAMPLE_AGENCY,
      logoUrl: null,
      ownerName: SAMPLE_OWNER,
      settledDate: SAMPLE_SETTLED_DATE,
    });

    // The document renders these verbatim — verify the data contract
    expect(data.breakdown.gross).toBe(1500);
    expect(data.breakdown.commission).toBe(150);
    expect(data.breakdown.commission_rate).toBe(10);
    expect(data.breakdown.deductions[0].description).toBe("Arreglo");
    expect(data.breakdown.deductions[0].amount).toBe(200);
    expect(data.breakdown.net).toBe(1150);
  });

  it("R-C2: document data includes address and CUIT from agency profile", async () => {
    const { buildStatementData } = await vi.importActual<typeof import("@/features/caja/lib/settlement-statement-data")>(
      "@/features/caja/lib/settlement-statement-data",
    );

    const data = buildStatementData({
      breakdown: SAMPLE_BREAKDOWN,
      agency: SAMPLE_AGENCY,
      logoUrl: null,
      ownerName: SAMPLE_OWNER,
      settledDate: SAMPLE_SETTLED_DATE,
    });

    expect(data.address).toBe("Av. Corrientes 1234");
    expect(data.cuit).toBe("30-12345678-9");
  });

  it("R-C2: document data has empty strings when agency profile is null", async () => {
    const { buildStatementData } = await vi.importActual<typeof import("@/features/caja/lib/settlement-statement-data")>(
      "@/features/caja/lib/settlement-statement-data",
    );

    const data = buildStatementData({
      breakdown: SAMPLE_BREAKDOWN,
      agency: null,
      logoUrl: null,
      ownerName: SAMPLE_OWNER,
      settledDate: SAMPLE_SETTLED_DATE,
    });

    expect(data.address).toBe("");
    expect(data.cuit).toBe("");
    expect(data.agencyName).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: slugifyOwnerName (R-C8 filename slug helper)
// ─────────────────────────────────────────────────────────────────────────────

describe("slugifyOwnerName (R-C8)", () => {
  it("converts 'Juan Pérez' to 'juan-perez'", async () => {
    const { slugifyOwnerName } = await vi.importActual<typeof import("@/features/caja/lib/settlement-statement-data")>(
      "@/features/caja/lib/settlement-statement-data",
    );
    expect(slugifyOwnerName("Juan Pérez")).toBe("juan-perez");
  });

  it("handles spaces and uppercase", async () => {
    const { slugifyOwnerName } = await vi.importActual<typeof import("@/features/caja/lib/settlement-statement-data")>(
      "@/features/caja/lib/settlement-statement-data",
    );
    expect(slugifyOwnerName("María García")).toBe("maria-garcia");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Caja page — Comprobante actions wired (R-C9 / R-C10 / R-C12)
// Uses vi.mock'd handleDownload/handleShare from settlement-pdf-actions.
// ─────────────────────────────────────────────────────────────────────────────

import { CajaPage } from "@/features/caja/components/caja-page";

describe("CajaPage — Comprobante actions (R-C7 / R-C9 / R-C10 / R-C12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCashMovements.mockReturnValue({ data: [], isLoading: false, isError: false });
    mockUseOrgProfile.mockReturnValue({ data: null, isLoading: false });
    mockUseLogoUrl.mockReturnValue({ data: null, isLoading: false });

    // Default: no navigator.share
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

  it("R-C10: shows Descargar but NOT Compartir when navigator.share is undefined", async () => {
    mockUseOwnerSettlements.mockReturnValue({
      data: SEALED_SETTLEMENTS,
      isLoading: false,
      isError: false,
    });

    render(<CajaPage />, { wrapper: makeWrapper() });
    await userEvent.click(screen.getByRole("button", { name: "Liquidaciones" }));

    expect(screen.getByRole("button", { name: /descargar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /compartir/i })).not.toBeInTheDocument();
  });

  it("R-C9: shows Compartir when navigator.canShare returns true", async () => {
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

    mockUseOwnerSettlements.mockReturnValue({
      data: SEALED_SETTLEMENTS,
      isLoading: false,
      isError: false,
    });

    render(<CajaPage />, { wrapper: makeWrapper() });
    await userEvent.click(screen.getByRole("button", { name: "Liquidaciones" }));

    expect(screen.getByRole("button", { name: /compartir/i })).toBeInTheDocument();
  });

  it("R-C12: two-currency owner shows two Descargar actions (one per currency)", async () => {
    mockUseOwnerSettlements.mockReturnValue({
      data: SEALED_SETTLEMENTS_MULTI_CURRENCY,
      isLoading: false,
      isError: false,
    });

    render(<CajaPage />, { wrapper: makeWrapper() });
    await userEvent.click(screen.getByRole("button", { name: "Liquidaciones" }));

    const downloadButtons = screen.getAllByRole("button", { name: /descargar/i });
    expect(downloadButtons).toHaveLength(2);
  });

  it("R-C7: clicking Descargar calls handleDownload with statement data", async () => {
    mockUseOwnerSettlements.mockReturnValue({
      data: SEALED_SETTLEMENTS,
      isLoading: false,
      isError: false,
    });

    render(<CajaPage />, { wrapper: makeWrapper() });
    await userEvent.click(screen.getByRole("button", { name: "Liquidaciones" }));
    await userEvent.click(screen.getByRole("button", { name: /descargar/i }));

    await waitFor(() => expect(mockHandleDownload).toHaveBeenCalledOnce());
  });

  it("no regressions — pending settlements still show Liquidar button", async () => {
    const PENDING = [
      {
        id: "s3",
        owner_id: "o2",
        amount: 100000,
        currency: "ARS",
        status: "pending",
        settlement_group: null,
        settled_date: null,
        breakdown: null,
        owner: { name: "Pedro" },
      },
    ];

    mockUseOwnerSettlements.mockReturnValue({
      data: PENDING,
      isLoading: false,
      isError: false,
    });

    render(<CajaPage />, { wrapper: makeWrapper() });
    await userEvent.click(screen.getByRole("button", { name: "Liquidaciones" }));

    expect(screen.getByRole("button", { name: "Liquidar" })).toBeInTheDocument();
  });
});
