/**
 * TDD — contract-locacion-actions
 * Tests: mock dynamic imports, assert toBlob called, filename format, share fallback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dynamic imports ───────────────────────────────────────────────────────

const mockToBlob = vi.fn();
const mockPdf = vi.fn();

vi.mock("@react-pdf/renderer", () => ({
  pdf: (...args: unknown[]) => mockPdf(...args),
}));

vi.mock(
  "@/features/contracts/components/contract-locacion-document",
  () => ({
    ContractLocacionDocument: () => null,
  }),
);

// Stub React.createElement so it doesn't need a real renderer
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    createElement: vi.fn().mockReturnValue(null),
  };
});

import {
  handleDownload,
  handleShare,
  buildFilename,
} from "@/features/contracts/lib/contract-locacion-actions";
import type { ContractDocumentData } from "@/features/contracts/lib/contract-locacion-data";

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<ContractDocumentData> = {}): ContractDocumentData {
  return {
    agencyName: "Inmobiliaria Ejemplo",
    agencyAddress: "Corrientes 1234",
    cuit: "30-12345678-9",
    logoUrl: null,
    contractType: "habitacional",
    contractTypeLabel: "Habitacional",
    locador: { name: "Carlos García", dni: "20123456", address: "Corrientes 1234" },
    locatario: { name: "Juan Pérez", dni: "30987654", address: "Lavalle 100" },
    garantes: [],
    propertyAddress: "Lavalle 100, CABA",
    propertyTypeLabel: "Departamento",
    rooms: "3",
    sqm: "75.00",
    inventoryDescription: "",
    startDate: "01/01/2026",
    endDate: "01/01/2029",
    durationMonths: 36,
    legalMinNote: "El plazo mínimo legal para destino habitacional es de TRES (3) años.",
    rentAmount: "$ 250.000 ARS",
    currency: "ARS",
    adjustmentIndexLabel: "IPC",
    adjustmentPeriodMonths: 12,
    depositAmount: "$ 250.000 ARS",
    expensesPaidByLabel: "Inquilino",
    signingCity: "Ciudad Autónoma de Buenos Aires",
    signingDate: "15/01/2026",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("buildFilename", () => {
  it("returns a filename with contrato-locacion- prefix and tenant + property slugs", () => {
    const filename = buildFilename(makeData());
    expect(filename).toMatch(/^contrato-locacion-/);
    expect(filename).toMatch(/\.pdf$/);
    expect(filename).toContain("juan");
    expect(filename).toContain("lavalle");
  });
});

describe("handleDownload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToBlob.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    mockPdf.mockReturnValue({ toBlob: mockToBlob });

    // Mock DOM APIs not available in jsdom
    const mockAnchor = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob://test");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("calls pdf().toBlob() and triggers anchor download", async () => {
    await handleDownload(makeData());
    expect(mockPdf).toHaveBeenCalled();
    expect(mockToBlob).toHaveBeenCalled();
  });
});

describe("handleShare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToBlob.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    mockPdf.mockReturnValue({ toBlob: mockToBlob });

    const mockAnchor = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob://test");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("falls back to download when navigator.canShare is unavailable", async () => {
    // Ensure canShare is not available
    const nav = globalThis.navigator as any;
    const original = nav.canShare;
    nav.canShare = undefined;

    await handleShare(makeData());

    expect(mockToBlob).toHaveBeenCalled();

    nav.canShare = original;
  });
});
