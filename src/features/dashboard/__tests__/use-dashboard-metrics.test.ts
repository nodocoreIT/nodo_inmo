/**
 * TDD — useDashboardMetrics hook
 *
 * effectiveStatus and groupPendingByOwner are NOT mocked — real implementations
 * are exercised so the dashboard can never drift from Pagos/Caja definitions.
 */
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks (must be at module scope, before imports) ────────────────────

const mockUsePayments = vi.fn();
vi.mock("@/features/payments/hooks/use-payments", () => ({
  usePayments: () => mockUsePayments(),
}));

const mockUseOwnerSettlements = vi.fn();
vi.mock("@/features/caja/hooks/use-owner-settlements", () => ({
  useOwnerSettlements: () => mockUseOwnerSettlements(),
}));

const mockUseContracts = vi.fn();
vi.mock("@/features/contracts/hooks/use-contracts", () => ({
  useContracts: () => mockUseContracts(),
}));

import { useDashboardMetrics } from "../hooks/use-dashboard-metrics";

// ── Fixed test date (deterministic) ─────────────────────────────────────────

const FIXED_TODAY = new Date("2026-06-06");

// ── Helpers to build minimal fixtures ────────────────────────────────────────

function makePayment(overrides: Partial<{
  id: string;
  status: string;
  due_date: string;
  amount: number;
  currency: string;
  paid_date: string | null;
  paid_amount: number | null;
  contract: { property: { address: string } | null; tenant: { name: string } | null } | null;
}> = {}) {
  return {
    id: overrides.id ?? "p-1",
    status: overrides.status ?? "pending",
    due_date: overrides.due_date ?? "2020-01-01", // past → overdue
    amount: overrides.amount ?? 1000,
    currency: overrides.currency ?? "ARS",
    paid_date: overrides.paid_date !== undefined ? overrides.paid_date : null,
    paid_amount: overrides.paid_amount !== undefined ? overrides.paid_amount : null,
    contract: overrides.contract !== undefined ? overrides.contract : {
      property: { address: "Av. Corrientes 1234" },
      tenant: { name: "Juan Pérez" },
    },
  };
}

function makeSettlement(overrides: Partial<{
  id: string;
  owner_id: string;
  amount: number;
  currency: string;
  status: string;
  settled_date: string | null;
  owner: { name: string } | null;
}> = {}) {
  return {
    id: overrides.id ?? "s-1",
    owner_id: overrides.owner_id ?? "owner-A",
    amount: overrides.amount ?? 5000,
    currency: overrides.currency ?? "ARS",
    status: overrides.status ?? "pending",
    settled_date: overrides.settled_date !== undefined ? overrides.settled_date : null,
    owner: overrides.owner !== undefined ? overrides.owner : { name: "Propietario A" },
  };
}

function makeContract(overrides: Partial<{ id: string; status: string }> = {}) {
  return {
    id: overrides.id ?? "c-1",
    status: overrides.status ?? "active",
  };
}

// Default empty stubs
function emptyPayments() {
  return { data: [], isLoading: false, error: null };
}
function emptySettlements() {
  return { data: [], isLoading: false, error: null };
}
function emptyContracts() {
  return { data: [], isLoading: false, error: null };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useDashboardMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePayments.mockReturnValue(emptyPayments());
    mockUseOwnerSettlements.mockReturnValue(emptySettlements());
    mockUseContracts.mockReturnValue(emptyContracts());
  });

  // T2-t1: loading propagation
  it("returns loading=true when any hook is loading", () => {
    mockUseContracts.mockReturnValue({ data: [], isLoading: true, error: null });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.loading).toBe(true);
  });

  // T2-t2: error propagation
  it("returns the first non-null error from any hook", () => {
    const boom = new Error("boom");
    mockUseOwnerSettlements.mockReturnValue({
      data: [],
      isLoading: false,
      error: boom,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.error).toBe(boom);
  });

  // T2-t3: loading false when all loaded
  it("returns loading=false when all three hooks have loaded", () => {
    // all mocks return isLoading: false (default from beforeEach)
    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.loading).toBe(false);
  });

  // T2-t4: active contracts
  it("counts only contracts with status=active", () => {
    mockUseContracts.mockReturnValue({
      data: [
        makeContract({ id: "c-1", status: "active" }),
        makeContract({ id: "c-2", status: "active" }),
        makeContract({ id: "c-3", status: "active" }),
        makeContract({ id: "c-4", status: "terminated" }),
        makeContract({ id: "c-5", status: "expired" }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.activeContracts).toBe(3);
  });

  // T2-t5: overdue count + items
  it("derives overdue count and items from payments with past due_date and pending status", () => {
    mockUsePayments.mockReturnValue({
      data: [
        makePayment({ id: "p-1", due_date: "2020-01-01", status: "pending" }), // overdue
        makePayment({ id: "p-2", due_date: "2020-01-01", status: "pending" }), // overdue
        makePayment({ id: "p-3", due_date: "2020-01-01", status: "paid" }),    // not overdue
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.overduePayments.count).toBe(2);
    expect(result.current.overduePayments.items).toHaveLength(2);
  });

  // T2-t6: tenantName fallback when contract is missing
  it("uses '—' as tenantName fallback when contract.tenant is absent", () => {
    mockUsePayments.mockReturnValue({
      data: [
        makePayment({
          id: "p-1",
          due_date: "2020-01-01",
          status: "pending",
          contract: null,
        }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.overduePayments.items[0].tenantName).toBe("—");
  });

  // T2-t7: MULTI-CURRENCY — overdue ARS + USD never collapsed
  it("keeps ARS and USD overdue totals separate (never sums them)", () => {
    mockUsePayments.mockReturnValue({
      data: [
        makePayment({ id: "p-1", due_date: "2020-01-01", status: "pending", amount: 1000, currency: "ARS" }),
        makePayment({ id: "p-2", due_date: "2020-01-01", status: "pending", amount: 500, currency: "USD" }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    const { totalByCurrency } = result.current.overduePayments;
    expect(totalByCurrency["ARS"]).toBe(1000);
    expect(totalByCurrency["USD"]).toBe(500);
    expect(Object.keys(totalByCurrency)).toHaveLength(2);
    // Critical: they are never summed
    expect(totalByCurrency["ARS"] + totalByCurrency["USD"]).not.toBe(
      totalByCurrency["ARS"],
    );
    expect(totalByCurrency["ARS"] + totalByCurrency["USD"]).not.toBe(
      totalByCurrency["USD"],
    );
  });

  // T2-t8: pending settlements via groupPendingByOwner
  it("groups pending settlements by owner+currency using real groupPendingByOwner", () => {
    mockUseOwnerSettlements.mockReturnValue({
      data: [
        makeSettlement({ id: "s-1", owner_id: "owner-A", currency: "ARS", amount: 10000, status: "pending", owner: { name: "Ana" } }),
        makeSettlement({ id: "s-2", owner_id: "owner-A", currency: "USD", amount: 200, status: "pending", owner: { name: "Ana" } }),
        makeSettlement({ id: "s-3", owner_id: "owner-B", currency: "ARS", amount: 5000, status: "pending", owner: { name: "Bob" } }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    // 3 owner+currency groups: owner-A:ARS, owner-A:USD, owner-B:ARS
    expect(result.current.pendingSettlements.count).toBe(3);
    expect(result.current.pendingSettlements.items).toHaveLength(3);
    const anaItem = result.current.pendingSettlements.items.find(
      (i) => i.ownerId === "owner-A" && i.currency === "ARS",
    );
    expect(anaItem?.ownerName).toBe("Ana");
  });

  // T2-t9: MULTI-CURRENCY — pending ARS + USD never collapsed
  it("keeps ARS and USD pending settlement totals separate", () => {
    mockUseOwnerSettlements.mockReturnValue({
      data: [
        makeSettlement({ id: "s-1", owner_id: "owner-A", currency: "ARS", amount: 10000, status: "pending", owner: { name: "Ana" } }),
        makeSettlement({ id: "s-2", owner_id: "owner-A", currency: "USD", amount: 200, status: "pending", owner: { name: "Ana" } }),
        makeSettlement({ id: "s-3", owner_id: "owner-B", currency: "ARS", amount: 5000, status: "pending", owner: { name: "Bob" } }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    const { totalByCurrency } = result.current.pendingSettlements;
    expect(totalByCurrency["ARS"]).toBe(15000); // 10000 + 5000
    expect(totalByCurrency["USD"]).toBe(200);
    expect(Object.keys(totalByCurrency)).toHaveLength(2);
  });

  // T2-t10: recent sealed — 30-day window
  it("includes settled rows within 30 days and excludes older rows and null settled_date", () => {
    // FIXED_TODAY = 2026-06-06
    // T-10 = 2026-05-27 → in window
    // T-31 = 2026-05-06 → outside window (exactly 31 days ago)
    // T-5 with null settled_date → excluded
    mockUseOwnerSettlements.mockReturnValue({
      data: [
        makeSettlement({ id: "s-1", status: "settled", settled_date: "2026-05-27", currency: "ARS", amount: 5000 }), // in
        makeSettlement({ id: "s-2", status: "settled", settled_date: "2026-05-06", currency: "ARS", amount: 3000 }), // out (31 days)
        makeSettlement({ id: "s-3", status: "settled", settled_date: null, currency: "ARS", amount: 1000 }),          // excluded (null)
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.recentSealed.count).toBe(1);
  });

  // T2-t11: MULTI-CURRENCY — recent sealed ARS + USD
  it("keeps ARS and USD recent sealed totals separate", () => {
    // Both T-10 ARS and T-5 USD are within the 30-day window
    mockUseOwnerSettlements.mockReturnValue({
      data: [
        makeSettlement({ id: "s-1", status: "settled", settled_date: "2026-05-27", currency: "ARS", amount: 5000 }),
        makeSettlement({ id: "s-2", status: "settled", settled_date: "2026-06-01", currency: "USD", amount: 200 }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    const { totalByCurrency } = result.current.recentSealed;
    expect(totalByCurrency["ARS"]).toBe(5000);
    expect(totalByCurrency["USD"]).toBe(200);
    expect(Object.keys(totalByCurrency)).toHaveLength(2);
  });

  // T2-t12: empty data — no throws, all zeros
  it("returns all zeros and empty objects when hooks return empty arrays", () => {
    // all mocks already return [] from beforeEach

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.activeContracts).toBe(0);
    expect(result.current.overduePayments.count).toBe(0);
    expect(result.current.overduePayments.totalByCurrency).toEqual({});
    expect(result.current.overduePayments.items).toHaveLength(0);
    expect(result.current.pendingSettlements.count).toBe(0);
    expect(result.current.pendingSettlements.totalByCurrency).toEqual({});
    expect(result.current.recentSealed.count).toBe(0);
    expect(result.current.recentSealed.totalByCurrency).toEqual({});
    expect(result.current.pastMonthDebts).toHaveLength(0);
    expect(result.current.currentMonthCollections).toHaveLength(0);
    expect(result.current.recentReceipts).toHaveLength(0);
  });

  it("builds past month debts from unpaid installments before the current month", () => {
    mockUsePayments.mockReturnValue({
      data: [
        makePayment({ id: "p-1", due_date: "2026-04-15", status: "pending" }),
        makePayment({ id: "p-2", due_date: "2026-06-15", status: "pending" }),
        makePayment({ id: "p-3", due_date: "2026-03-15", status: "paid" }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.pastMonthDebts).toHaveLength(1);
    expect(result.current.pastMonthDebts[0].monthLabel).toBe("04/2026");
  });

  it("groups current month unpaid installments by tenant and property", () => {
    mockUsePayments.mockReturnValue({
      data: [
        makePayment({
          id: "p-1",
          due_date: "2026-06-10",
          status: "pending",
          amount: 1000,
          contract: {
            property: { address: "Mitre 100" },
            tenant: { name: "Juan Pérez" },
          },
        }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.currentMonthCollections).toHaveLength(1);
    expect(result.current.currentMonthCollections[0].tenantName).toBe("Juan Pérez");
    expect(result.current.currentMonthCollections[0].status).toBe("sin_cobrar");
  });

  it("lists recent paid installments as receipts", () => {
    mockUsePayments.mockReturnValue({
      data: [
        makePayment({
          id: "p-1",
          due_date: "2026-05-10",
          status: "paid",
          paid_date: "2026-06-01",
          paid_amount: 1000,
          contract: { property: { address: "A" }, tenant: { name: "Ana" } },
        }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDashboardMetrics(FIXED_TODAY));

    expect(result.current.recentReceipts).toHaveLength(1);
    expect(result.current.recentReceipts[0].tenantName).toBe("Ana");
  });
});
