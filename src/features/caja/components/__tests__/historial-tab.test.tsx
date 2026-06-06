/**
 * TDD — HistorialTab
 * Tests: table rendering, expandable rows, accordion behavior, empty/loading/error states.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SealedGroup } from "@/features/caja/lib/caja-math";

// ── Mock: useSettledSettlements ────────────────────────────────────────────────
const mockUseSettledSettlements = vi.fn();
vi.mock("@/features/caja/hooks/use-settled-settlements", () => ({
  useSettledSettlements: () => mockUseSettledSettlements(),
  SETTLED_SETTLEMENTS_QUERY_KEY: ["nodo_inmo", "owner_settlements", "settled"],
}));

// ── Mock: SealedSettlementActions — avoids PDF/profile wiring in render tests ─
vi.mock("@/features/caja/components/sealed-settlement-actions", () => ({
  SealedSettlementActions: ({ group }: { group: SealedGroup }) => (
    <div data-testid={`actions-${group.settlement_group}`}>actions</div>
  ),
}));

import { HistorialTab } from "@/features/caja/components/historial-tab";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const breakdownWithDeductions = {
  gross: 500000,
  commission_rate: 10,
  commission: 50000,
  owner_share: 450000,
  deductions: [
    {
      id: "exp-1",
      description: "Plomería",
      expense_date: "2026-05-10",
      amount: 12000,
      type: "arreglo",
    },
  ],
  deduction_total: 12000,
  net: 438000,
  currency: "ARS",
  cobro_count: 2,
  sealed_at: "2026-06-01T10:00:00Z",
};

const breakdownNoDeductions = {
  gross: 300000,
  commission_rate: 10,
  commission: 30000,
  owner_share: 270000,
  deductions: [],
  deduction_total: 0,
  net: 270000,
  currency: "ARS",
  cobro_count: 1,
  sealed_at: "2026-05-01T10:00:00Z",
};

const GROUP_A: SealedGroup = {
  settlement_group: "sg-aaa-111",
  owner_id: "o1",
  owner_name: "Juan",
  currency: "ARS",
  breakdown: breakdownWithDeductions,
  settled_date: "2026-06-01",
  cobro_count: 2,
};

const GROUP_B: SealedGroup = {
  settlement_group: "sg-bbb-222",
  owner_id: "o1", // same owner, different group
  owner_name: "Juan",
  currency: "ARS",
  breakdown: breakdownNoDeductions,
  settled_date: "2026-05-01",
  cobro_count: 1,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("HistorialTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1 — Both rows render (regression: same-owner entries must not collapse)
  it("renders a row for each group — same owner appears twice (REQ-02, S-01)", () => {
    mockUseSettledSettlements.mockReturnValue({
      groups: [GROUP_A, GROUP_B],
      isLoading: false,
      isError: false,
    });

    render(<HistorialTab />, { wrapper });

    // "Juan" should appear twice
    const rows = screen.getAllByText("Juan");
    expect(rows).toHaveLength(2);

    // Both net amounts visible in their collapsed state
    expect(screen.getByText("$ 438.000")).toBeInTheDocument();
    expect(screen.getByText("$ 270.000")).toBeInTheDocument();
  });

  // Test 2 — Expanding a row reveals its full breakdown
  it("expanding a row reveals the full breakdown (REQ-06, S-03)", async () => {
    mockUseSettledSettlements.mockReturnValue({
      groups: [GROUP_A, GROUP_B],
      isLoading: false,
      isError: false,
    });

    render(<HistorialTab />, { wrapper });

    // Expand GROUP_A
    const expandButton = screen.getByRole("button", {
      name: /expandir sg-aaa-111/i,
    });
    await userEvent.click(expandButton);

    // Breakdown fields for GROUP_A should be visible
    // Use getAllByText where the value may appear in both collapsed row and panel
    expect(screen.getByText("$ 500.000")).toBeInTheDocument(); // gross (only in expanded)
    // Commission label contains the rate — only appears in expanded panel
    expect(screen.getByText(/Comisión \(10%\)/)).toBeInTheDocument();
    // Deduction description ("Plomería · …") — match by regex
    expect(screen.getByText(/Plomería/)).toBeInTheDocument();
    // "Bruto" label — only in expanded breakdown panel
    expect(screen.getByText("Bruto")).toBeInTheDocument();

    // GROUP_B breakdown should NOT be visible (its gross is 300,000)
    expect(screen.queryByText("$ 300.000")).not.toBeInTheDocument(); // GROUP_B gross
  });

  // Test 3 — Single-expanded accordion: expanding B collapses A
  it("accordion: expanding row B collapses row A (design D8)", async () => {
    mockUseSettledSettlements.mockReturnValue({
      groups: [GROUP_A, GROUP_B],
      isLoading: false,
      isError: false,
    });

    render(<HistorialTab />, { wrapper });

    // Expand A
    await userEvent.click(screen.getByRole("button", { name: /expandir sg-aaa-111/i }));
    expect(screen.getByText(/Plomería/)).toBeInTheDocument(); // A's deduction

    // Expand B — A should now be collapsed
    await userEvent.click(screen.getByRole("button", { name: /expandir sg-bbb-222/i }));
    expect(screen.queryByText(/Plomería/)).not.toBeInTheDocument(); // A's detail gone

    // B is now expanded — its gross is visible
    expect(screen.getByText("$ 300.000")).toBeInTheDocument();
  });

  // Test 4 — No-deductions group: expanded panel shows net but no deductions block
  it("no-deductions group: expanded panel shows net without a deductions section", async () => {
    mockUseSettledSettlements.mockReturnValue({
      groups: [GROUP_B],
      isLoading: false,
      isError: false,
    });

    render(<HistorialTab />, { wrapper });

    await userEvent.click(screen.getByRole("button", { name: /expandir sg-bbb-222/i }));

    // Net appears in both collapsed row and expanded panel — use getAllByText
    expect(screen.getAllByText("$ 270.000").length).toBeGreaterThanOrEqual(1);

    // Deductions section heading should NOT appear
    expect(screen.queryByText(/deducciones/i)).not.toBeInTheDocument();
  });

  // Test 5 — Empty state
  it("renders empty state when groups is empty (REQ-10, S-07)", () => {
    mockUseSettledSettlements.mockReturnValue({
      groups: [],
      isLoading: false,
      isError: false,
    });

    render(<HistorialTab />, { wrapper });

    expect(
      screen.getByText(/no hay rendiciones liquidadas aún/i),
    ).toBeInTheDocument();
  });

  // Test 6 — Loading state
  it("renders a status element while loading", () => {
    mockUseSettledSettlements.mockReturnValue({
      groups: [],
      isLoading: true,
      isError: false,
    });

    render(<HistorialTab />, { wrapper });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // Test 7 — Error state
  it("renders an alert element on error", () => {
    mockUseSettledSettlements.mockReturnValue({
      groups: [],
      isLoading: false,
      isError: true,
    });

    render(<HistorialTab />, { wrapper });

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
