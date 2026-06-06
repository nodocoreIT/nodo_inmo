/**
 * TDD — contract-locacion-data (pure mapper)
 * 5 fixture tests: full data, missing owner, no garantes, null deposit, comercial type.
 */
import { describe, it, expect } from "vitest";
import { buildContractDocumentData } from "./contract-locacion-data";
import type { ContractWithRelations } from "@/features/contracts/hooks/use-contracts";

// ── Shared fixtures ────────────────────────────────────────────────────────────

const baseAgency = {
  id: "agency-1",
  org_id: "org-1",
  legal_name: "Inmobiliaria Ejemplo S.A.",
  address: "Av. Corrientes 1234, CABA",
  cuit: "30-12345678-9",
  phone: "011-4444-5555",
  email: "info@ejemplo.com",
  logo_path: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  website: null,
  description: null,
};

function baseContract(overrides: Partial<ContractWithRelations> = {}): ContractWithRelations {
  return {
    id: "c-1",
    org_id: "org-1",
    property_id: "prop-1",
    tenant_id: "tenant-1",
    start_date: "2026-01-01",
    end_date: "2029-01-01",
    rent_amount: 250000,
    currency: "ARS",
    deposit_amount: 250000,
    commission_amount: null,
    expenses_paid_by: "tenant",
    adjustment_index: "IPC",
    adjustment_period_months: 12,
    next_adjustment_date: null,
    status: "active",
    notes: null,
    contract_type: "habitacional",
    signing_city: "Ciudad Autónoma de Buenos Aires",
    signing_date: "2026-01-15",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    property: {
      address: "Lavalle 100, CABA",
      property_type: "apartment",
      rooms: 3,
      total_sqm: 75,
      inventory_description: "Departamento amueblado",
      owner: {
        name: "Carlos García",
        dni: "20123456",
        email: "cgarcia@test.com",
        phone: "011-1234-5678",
        address: "Av. Corrientes 5678",
      },
    },
    tenant: { name: "Juan Pérez", dni: "30987654", address: "Lavalle 100" },
    guarantors: [
      { guarantor_id: "g-1", guarantor: { name: "Ana López", dni: "25555555", address: "Rivadavia 500" } },
    ],
    ...overrides,
  } as ContractWithRelations;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("buildContractDocumentData", () => {
  it("maps full data correctly", () => {
    const result = buildContractDocumentData({
      contract: baseContract(),
      agency: baseAgency as any,
      logoUrl: "https://example.com/logo.png",
    });

    expect(result.agencyName).toBe("Inmobiliaria Ejemplo S.A.");
    expect(result.cuit).toBe("30-12345678-9");
    expect(result.contractType).toBe("habitacional");
    expect(result.contractTypeLabel).toBe("Habitacional");
    expect(result.locador.name).toBe("Carlos García");
    expect(result.locador.dni).toBe("20123456");
    expect(result.locatario.name).toBe("Juan Pérez");
    expect(result.garantes).toHaveLength(1);
    expect(result.garantes[0].name).toBe("Ana López");
    expect(result.propertyAddress).toBe("Lavalle 100, CABA");
    expect(result.propertyTypeLabel).toBe("Departamento");
    expect(result.rooms).toBe("3");
    expect(result.sqm).toBe("75.00");
    expect(result.startDate).toBe("01/01/2026");
    expect(result.endDate).toBe("01/01/2029");
    expect(result.durationMonths).toBe(36);
    expect(result.legalMinNote).toContain("TRES (3) años");
    expect(result.signingDate).toBe("15/01/2026");
    expect(result.signingCity).toBe("Ciudad Autónoma de Buenos Aires");
    expect(result.depositAmount).toContain("250.000");
    expect(result.expensesPaidByLabel).toBe("Inquilino");
    expect(result.adjustmentIndexLabel).toBe("IPC");
    expect(result.logoUrl).toBe("https://example.com/logo.png");
  });

  it("handles missing owner gracefully (null-coalesces to empty strings)", () => {
    const contract = baseContract({
      property: {
        address: "Mitre 200",
        property_type: "house",
        rooms: null,
        total_sqm: null,
        inventory_description: null,
        owner: null,
      },
    });

    const result = buildContractDocumentData({ contract, agency: baseAgency as any, logoUrl: null });

    expect(result.locador.name).toBe("");
    expect(result.locador.dni).toBe("");
    expect(result.rooms).toBe("");
    expect(result.sqm).toBe("");
    expect(result.inventoryDescription).toBe("");
    expect(result.logoUrl).toBeNull();
    expect(result.propertyTypeLabel).toBe("Casa");
  });

  it("handles no guarantors (empty array)", () => {
    const contract = baseContract({ guarantors: [] });

    const result = buildContractDocumentData({ contract, agency: baseAgency as any, logoUrl: null });

    expect(result.garantes).toHaveLength(0);
  });

  it("handles null deposit (renders em dash placeholder)", () => {
    const contract = baseContract({ deposit_amount: null });

    const result = buildContractDocumentData({ contract, agency: baseAgency as any, logoUrl: null });

    expect(result.depositAmount).toBe("—");
  });

  it("maps comercial type correctly with the right legal note", () => {
    const contract = baseContract({ contract_type: "comercial" });

    const result = buildContractDocumentData({ contract, agency: baseAgency as any, logoUrl: null });

    expect(result.contractType).toBe("comercial");
    expect(result.contractTypeLabel).toBe("Comercial");
    expect(result.legalMinNote).toContain("DOS (2) años");
  });
});
