import { describe, it, expect } from "vitest";
import {
  computeBalance,
  computeTotals,
  groupPendingByOwner,
  computeSettlementBreakdown,
  groupSealedBySettlementGroup,
} from "@/features/caja/lib/caja-math";
import type { SettlementForGrouping } from "@/features/caja/lib/caja-math";

describe("computeBalance", () => {
  it("adds income and subtracts expense", () => {
    expect(
      computeBalance([
        { type: "income", amount: 25000 },
        { type: "income", amount: 50000 },
        { type: "expense", amount: 20000 },
      ]),
    ).toBe(55000);
  });

  it("is 0 for no movements", () => {
    expect(computeBalance([])).toBe(0);
  });
});

describe("computeTotals", () => {
  it("splits income and expense and computes the balance", () => {
    expect(
      computeTotals([
        { type: "income", amount: 25000 },
        { type: "income", amount: 50000 },
        { type: "expense", amount: 20000 },
      ]),
    ).toEqual({ income: 75000, expense: 20000, balance: 55000 });
  });

  it("returns zeros for no movements", () => {
    expect(computeTotals([])).toEqual({ income: 0, expense: 0, balance: 0 });
  });
});

describe("groupPendingByOwner", () => {
  const settlements = [
    { id: "s1", owner_id: "o1", amount: 225000, currency: "ARS", status: "pending", owner: { name: "Juan" } },
    { id: "s2", owner_id: "o1", amount: 225000, currency: "ARS", status: "pending", owner: { name: "Juan" } },
    { id: "s3", owner_id: "o2", amount: 90000, currency: "ARS", status: "pending", owner: { name: "Ana" } },
    { id: "s4", owner_id: "o1", amount: 225000, currency: "ARS", status: "settled", owner: { name: "Juan" } },
  ];

  it("groups pending settlements per owner and sums the totals", () => {
    const groups = groupPendingByOwner(settlements);
    const juan = groups.find((g) => g.owner_id === "o1");
    const ana = groups.find((g) => g.owner_id === "o2");

    expect(juan).toMatchObject({ owner_name: "Juan", total: 450000 });
    expect(juan?.settlement_ids).toEqual(["s1", "s2"]);
    expect(ana).toMatchObject({ owner_name: "Ana", total: 90000 });
  });

  it("ignores already-settled rows", () => {
    const juan = groupPendingByOwner(settlements).find((g) => g.owner_id === "o1");
    expect(juan?.settlement_ids).not.toContain("s4");
  });
});

// ─── computeSettlementBreakdown ───────────────────────────────────────────────

describe("computeSettlementBreakdown", () => {
  // R-B4: function is exported and is callable
  it("is a function (not undefined)", () => {
    expect(typeof computeSettlementBreakdown).toBe("function");
  });

  // R-B5: gross is sum of payment amounts
  it("gross = sum of payment amounts", () => {
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 1000, currency: "ARS" }, { id: "p2", amount: 500, currency: "ARS" }],
      [],
      [],
      0,
      "ARS",
    );
    expect(result.gross).toBe(1500);
  });

  // R-B6: commission is derived from commissionMovements (NOT rate * gross)
  it("commission = sum of commissionMovements for matching payment_ids", () => {
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 1000, currency: "ARS" }, { id: "p2", amount: 500, currency: "ARS" }],
      [{ payment_id: "p1", amount: 100 }, { payment_id: "p2", amount: 50 }],
      [],
      0,
      "ARS",
    );
    expect(result.commission).toBe(150);
  });

  // R-B6: commission_rate stored verbatim from input
  it("commission_rate is stored verbatim from input", () => {
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 1000, currency: "ARS" }],
      [{ payment_id: "p1", amount: 100 }],
      [],
      10,
      "ARS",
    );
    expect(result.commission_rate).toBe(10);
  });

  // R-B7: deductions lists only expenses matching the settlement currency
  it("deductions contains only expenses matching the currency", () => {
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 1000, currency: "ARS" }],
      [],
      [
        { id: "e1", amount: 200, currency: "ARS", expense_date: "2026-05-01", description: "Fix ARS", type: "arreglo" },
        { id: "e2", amount: 50, currency: "USD", expense_date: "2026-05-02", description: "Fix USD", type: "arreglo" },
      ],
      0,
      "ARS",
    );
    expect(result.deductions).toHaveLength(1);
    expect(result.deductions[0].amount).toBe(200);
  });

  // R-B8: net = gross - commission - sum(deductions)
  it("net = gross - commission - sum(deductions)", () => {
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 1000, currency: "ARS" }],
      [{ payment_id: "p1", amount: 100 }],
      [
        { id: "e1", amount: 50, currency: "ARS", expense_date: "2026-05-01", description: "Fix", type: "arreglo" },
        { id: "e2", amount: 30, currency: "ARS", expense_date: "2026-05-02", description: "Fix2", type: "arreglo" },
      ],
      10,
      "ARS",
    );
    expect(result.net).toBe(820);
  });

  // R-B8: net with no deductions
  it("net with no deductions = gross - commission", () => {
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 1000, currency: "ARS" }],
      [{ payment_id: "p1", amount: 100 }],
      [],
      10,
      "ARS",
    );
    expect(result.net).toBe(900);
  });

  // R-B8: net is rounded to 2 decimal places
  it("net is rounded to 2 decimal places", () => {
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 1000.5, currency: "ARS" }],
      [{ payment_id: "p1", amount: 100.33 }],
      [{ id: "e1", amount: 0.01, currency: "ARS", expense_date: "2026-05-01", description: "x", type: "arreglo" }],
      10,
      "ARS",
    );
    const decimal = result.net.toString().split(".")[1];
    expect(!decimal || decimal.length <= 2).toBe(true);
  });

  // R-B9: pure / referential — same inputs produce same outputs
  it("is pure: same inputs produce deeply equal results", () => {
    const payments = [{ id: "p1", amount: 1000, currency: "ARS" }];
    const commissions = [{ payment_id: "p1", amount: 100 }];
    const expenses = [{ id: "e1", amount: 50, currency: "ARS", expense_date: "2026-05-01", description: "Fix", type: "arreglo" }];
    const r1 = computeSettlementBreakdown(payments, commissions, expenses, 10, "ARS");
    const r2 = computeSettlementBreakdown(payments, commissions, expenses, 10, "ARS");
    expect(r1).toEqual(r2);
  });

  // R-B17: output shape has required keys + deductions array with required sub-keys
  it("result has required keys and deductions array with required sub-keys", () => {
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 1000, currency: "ARS" }],
      [{ payment_id: "p1", amount: 100 }],
      [{ id: "e1", amount: 50, currency: "ARS", expense_date: "2026-05-01", description: "Fix", type: "arreglo" }],
      10,
      "ARS",
    );
    expect(result).toHaveProperty("gross");
    expect(result).toHaveProperty("commission_rate");
    expect(result).toHaveProperty("commission");
    expect(result).toHaveProperty("deductions");
    expect(result).toHaveProperty("net");
    expect(Array.isArray(result.deductions)).toBe(true);
    expect(result.deductions[0]).toHaveProperty("id");
    expect(result.deductions[0]).toHaveProperty("amount");
    expect(result.deductions[0]).toHaveProperty("description");
    expect(result.deductions[0]).toHaveProperty("expense_date");
  });

  // ADR-5 anti-drift golden case: same inputs as pgTAP golden fixture
  // pgTAP golden: 2 × 250000 payments, 2 × 25000 commission, 1 × 12000 ARS expense
  // Expected: gross=500000, commission=50000, commission_rate=10, deduction_total=12000, net=438000
  it("ADR-5 golden case: matches pgTAP golden fixture exactly", () => {
    const result = computeSettlementBreakdown(
      [
        { id: "d1", amount: 250000, currency: "ARS" },
        { id: "d2", amount: 250000, currency: "ARS" },
      ],
      [
        { payment_id: "d1", amount: 25000 },
        { payment_id: "d2", amount: 25000 },
      ],
      [
        { id: "e1", amount: 12000, currency: "ARS", expense_date: "2026-05-14", description: "Plomeria B1", type: "arreglo" },
        // USD expense must not appear in deductions
        { id: "e2", amount: 500, currency: "USD", expense_date: "2026-05-20", description: "Accesorio USD", type: "compra_accesorio" },
      ],
      10,
      "ARS",
    );
    expect(result.gross).toBe(500000);
    expect(result.commission).toBe(50000);
    expect(result.commission_rate).toBe(10);
    expect(result.deductions).toHaveLength(1);
    expect(result.deductions[0].amount).toBe(12000);
    expect(result.net).toBe(438000);
    // Identity: net = gross - commission - deduction_total
    const deductionTotal = result.deductions.reduce((s, d) => s + d.amount, 0);
    expect(result.net).toBe(result.gross - result.commission - deductionTotal);
  });

  // SUGGESTION-1: SettlementBreakdown must include owner_share and deduction_total
  // so PR-C can read the frozen snapshot without silent drops.
  it("result includes owner_share (gross - commission) for PR-C display", () => {
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 500000, currency: "ARS" }, { id: "p2", amount: 500000, currency: "ARS" }],
      [{ payment_id: "p1", amount: 50000 }, { payment_id: "p2", amount: 50000 }],
      [],
      10,
      "ARS",
    );
    expect(result).toHaveProperty("owner_share");
    expect(result.owner_share).toBe(900000); // 1000000 - 100000
  });

  it("result includes deduction_total (sum of deduction amounts) for PR-C display", () => {
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 500000, currency: "ARS" }],
      [{ payment_id: "p1", amount: 50000 }],
      [
        { id: "e1", amount: 12000, currency: "ARS", expense_date: "2026-05-14", description: "Fix", type: "arreglo" },
        { id: "e2", amount: 8000, currency: "ARS", expense_date: "2026-05-15", description: "Fix2", type: "arreglo" },
      ],
      10,
      "ARS",
    );
    expect(result).toHaveProperty("deduction_total");
    expect(result.deduction_total).toBe(20000);
  });

  // Edge: zero gross → commission_rate = 0 (no divide-by-zero)
  it("zero gross: commission_rate = 0 (no divide-by-zero)", () => {
    const result = computeSettlementBreakdown([], [], [], 0, "ARS");
    expect(result.gross).toBe(0);
    expect(result.commission_rate).toBe(0);
    expect(result.net).toBe(0);
  });

  // Edge: commissionMovements only for matching payment_ids
  it("commission only sums movements whose payment_id is in payments list", () => {
    // p3 is NOT in the payments list — its movement must be excluded
    const result = computeSettlementBreakdown(
      [{ id: "p1", amount: 1000, currency: "ARS" }],
      [
        { payment_id: "p1", amount: 100 },
        { payment_id: "p3", amount: 999 },  // NOT in payments — must be excluded
      ],
      [],
      10,
      "ARS",
    );
    expect(result.commission).toBe(100);
  });
});

// ─── groupSealedBySettlementGroup ─────────────────────────────────────────────

describe("groupSealedBySettlementGroup", () => {
  const baseBreakdown = {
    gross: 500000,
    commission_rate: 10,
    commission: 50000,
    owner_share: 450000,
    deductions: [],
    deduction_total: 0,
    net: 450000,
    currency: "ARS",
    cobro_count: 2,
    sealed_at: "2026-06-01T10:00:00Z",
  };

  function makeSettlement(overrides: Partial<SettlementForGrouping>): SettlementForGrouping {
    return {
      id: "s1",
      owner_id: "o1",
      currency: "ARS",
      status: "settled",
      breakdown: baseBreakdown,
      settlement_group: "sg-aaa-111",
      settled_date: "2026-06-01",
      owner: { name: "Juan" },
      ...overrides,
    };
  }

  // Test 1 — Regression: two settlements for the same owner with different settlement_groups
  // → returns 2 groups (history must NOT collapse same-owner entries).
  it("returns 2 groups for the same owner with different settlement_group UUIDs", () => {
    const settlements = [
      makeSettlement({ id: "s1", settlement_group: "sg-aaa-111", settled_date: "2026-06-01" }),
      makeSettlement({ id: "s2", settlement_group: "sg-bbb-222", settled_date: "2026-05-01" }),
    ];
    const groups = groupSealedBySettlementGroup(settlements);
    expect(groups).toHaveLength(2);
    const keys = groups.map((g) => g.settlement_group);
    expect(keys).toContain("sg-aaa-111");
    expect(keys).toContain("sg-bbb-222");
  });

  // Test 2 — Multiple rows with the same settlement_group → 1 group, first row's breakdown
  it("deduplicates rows with the same settlement_group, keeping the first row's breakdown", () => {
    const firstBreakdown = { ...baseBreakdown, net: 450000 };
    const secondBreakdown = { ...baseBreakdown, net: 999999 }; // should be ignored
    const settlements = [
      makeSettlement({ id: "s1", settlement_group: "sg-aaa-111", breakdown: firstBreakdown }),
      makeSettlement({ id: "s2", settlement_group: "sg-aaa-111", breakdown: secondBreakdown }),
    ];
    const groups = groupSealedBySettlementGroup(settlements);
    expect(groups).toHaveLength(1);
    expect(groups[0].breakdown.net).toBe(450000);
  });

  // Test 3 — Null breakdown row → skipped, no throw, not in output
  it("skips null-breakdown rows silently without throwing", () => {
    const settlements = [
      makeSettlement({ id: "s1", settlement_group: "sg-aaa-111", breakdown: null }),
      makeSettlement({ id: "s2", settlement_group: "sg-bbb-222" }), // valid
    ];
    let groups: ReturnType<typeof groupSealedBySettlementGroup> | undefined;
    expect(() => {
      groups = groupSealedBySettlementGroup(settlements);
    }).not.toThrow();
    expect(groups).toHaveLength(1);
    expect(groups![0].settlement_group).toBe("sg-bbb-222");
  });

  // Test 4 — Null settlement_group → skipped
  it("skips rows with a null settlement_group", () => {
    const settlements = [
      makeSettlement({ id: "s1", settlement_group: null }),
      makeSettlement({ id: "s2", settlement_group: "sg-bbb-222" }),
    ];
    const groups = groupSealedBySettlementGroup(settlements);
    expect(groups).toHaveLength(1);
    expect(groups[0].settlement_group).toBe("sg-bbb-222");
  });

  // Test 5 — Pending row → skipped (guard 1)
  it("skips pending rows (guard 1: status !== 'settled')", () => {
    const settlements = [
      makeSettlement({ id: "s1", status: "pending", settlement_group: "sg-aaa-111" }),
      makeSettlement({ id: "s2", settlement_group: "sg-bbb-222" }),
    ];
    const groups = groupSealedBySettlementGroup(settlements);
    expect(groups).toHaveLength(1);
    expect(groups[0].settlement_group).toBe("sg-bbb-222");
  });

  // Test 6 — Ordering preserved: input ordered settled_date DESC → output newest-first
  it("preserves newest-first ordering from input (insertion order)", () => {
    const settlements = [
      makeSettlement({ id: "s1", settlement_group: "sg-newer", settled_date: "2026-06-01" }),
      makeSettlement({ id: "s2", settlement_group: "sg-older", settled_date: "2026-05-01" }),
    ];
    const groups = groupSealedBySettlementGroup(settlements);
    expect(groups[0].settlement_group).toBe("sg-newer");
    expect(groups[1].settlement_group).toBe("sg-older");
  });

  // Test 7 — cobro_count sourced from breakdown.cobro_count; defaults to 0 when absent
  it("sources cobro_count from breakdown.cobro_count, defaulting to 0 when absent", () => {
    const breakdownWithCount = { ...baseBreakdown, cobro_count: 5 };
    const breakdownWithoutCount = { ...baseBreakdown };
    delete (breakdownWithoutCount as Partial<typeof baseBreakdown>).cobro_count;

    const settlements = [
      makeSettlement({ id: "s1", settlement_group: "sg-aaa-111", breakdown: breakdownWithCount }),
      makeSettlement({ id: "s2", settlement_group: "sg-bbb-222", breakdown: breakdownWithoutCount }),
    ];
    const groups = groupSealedBySettlementGroup(settlements);
    const withCount = groups.find((g) => g.settlement_group === "sg-aaa-111");
    const withoutCount = groups.find((g) => g.settlement_group === "sg-bbb-222");
    expect(withCount?.cobro_count).toBe(5);
    expect(withoutCount?.cobro_count).toBe(0);
  });

  // Empty input → empty output
  it("returns an empty array for empty input", () => {
    expect(groupSealedBySettlementGroup([])).toEqual([]);
  });

  // Single settlement happy path
  it("returns a single group for a single valid settled settlement", () => {
    const groups = groupSealedBySettlementGroup([makeSettlement({})]);
    expect(groups).toHaveLength(1);
    expect(groups[0].owner_name).toBe("Juan");
    expect(groups[0].currency).toBe("ARS");
    expect(groups[0].cobro_count).toBe(2);
  });
});
