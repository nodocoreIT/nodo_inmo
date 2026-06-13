import { describe, it, expect } from "vitest";
import { buildCobroBreakdown, resolveCommissionRatePercent } from "../lib/cobro-breakdown";
import type { PaymentWithRelations } from "../hooks/use-payments";

function samplePayment(overrides: Partial<PaymentWithRelations> = {}): PaymentWithRelations {
  return {
    id: "p1",
    org_id: "org",
    contract_id: "c1",
    period: "2026-02-01",
    due_date: "2026-02-10",
    amount: 440000,
    currency: "ARS",
    status: "paid",
    paid_date: "2026-06-13",
    paid_amount: 440000,
    expenses_amount: 50000,
    payment_method: "transfer",
    notes: null,
    created_at: "",
    updated_at: "",
    contract: {
      rent_amount: 440000,
      commission_amount: 44000,
      property: {
        address: "Calle 123",
        commission_rate: null,
        owner: { name: "Propietario", commission_rate: 8 },
      },
      tenant: { name: "Inquilino" },
    },
    ...overrides,
  };
}

describe("resolveCommissionRatePercent", () => {
  it("uses contract commission_amount over property rate", () => {
    expect(resolveCommissionRatePercent(samplePayment())).toBe(10);
  });
});

describe("buildCobroBreakdown", () => {
  it("computes commission on rent + expenses", () => {
    const result = buildCobroBreakdown(samplePayment(), 49000);
    expect(result.rentAmount).toBe(440000);
    expect(result.expensesAmount).toBe(50000);
    expect(result.grossAmount).toBe(490000);
    expect(result.commissionAmount).toBe(49000);
    expect(result.commissionRate).toBe(10);
    expect(result.ownerShare).toBe(441000);
  });
});
