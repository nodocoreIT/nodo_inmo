/**
 * TDD — DashboardStatCard + DashboardPage
 *
 * DashboardStatCard tests (T3): pure presentational, props-in JSX-out.
 * DashboardPage tests (T4): useDashboardMetrics is mocked; component is a thin presenter.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DashboardPage mock (must be at module scope) ──────────────────────────────

const mockUseDashboardMetrics = vi.fn();
vi.mock("../hooks/use-dashboard-metrics", () => ({
  useDashboardMetrics: () => mockUseDashboardMetrics(),
}));

// ── Mock hooks that must NOT be called by DashboardPage directly (DS-15) ──────

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

import { DashboardStatCard } from "../components/dashboard-stat-card";
import { DashboardPage } from "../components/dashboard-page";
import type { DashboardMetrics } from "../hooks/use-dashboard-metrics";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function resolvedMetrics(overrides: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return {
    loading: false,
    error: null,
    activeContracts: 3,
    overduePayments: {
      count: 2,
      totalByCurrency: { ARS: 1000, USD: 50 },
      items: [
        {
          id: "p-1",
          tenantName: "Juan Pérez",
          propertyAddress: "Corrientes 123",
          amount: 1000,
          currency: "ARS",
          dueDate: "2020-01-01",
        },
        {
          id: "p-2",
          tenantName: "Ana García",
          propertyAddress: "Mitre 456",
          amount: 50,
          currency: "USD",
          dueDate: "2020-02-01",
        },
      ],
    },
    pendingSettlements: {
      count: 1,
      totalByCurrency: { ARS: 5000 },
      items: [
        {
          ownerId: "owner-A",
          ownerName: "Carlos Díaz",
          total: 5000,
          currency: "ARS",
        },
      ],
    },
    recentSealed: {
      count: 1,
      totalByCurrency: { ARS: 8000 },
    },
    ...overrides,
  };
}

// ── DashboardStatCard tests (T3) ──────────────────────────────────────────────

describe("DashboardStatCard", () => {
  // T3-t1: renders label and count
  it("renders the label and count", () => {
    render(<DashboardStatCard label="Overdue" count={3} />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  // T3-t2: renders per-currency breakdown as separate lines
  it("renders each currency as a separate line, never merged", () => {
    render(
      <DashboardStatCard
        label="Overdue"
        count={2}
        totalByCurrency={{ ARS: 1000, USD: 50 }}
      />,
    );

    // Each currency must appear independently
    // formatMoney(1000, "ARS") → "$ 1.000", formatMoney(50, "USD") → "US$ 50"
    const arsLine = screen.getByText(/\$\s*1[.,]000/);
    const usdLine = screen.getByText(/US\$\s*50/);
    expect(arsLine).toBeInTheDocument();
    expect(usdLine).toBeInTheDocument();
    // They must be distinct elements
    expect(arsLine).not.toBe(usdLine);
  });

  // T3-t3: omits money section when totalByCurrency is absent
  it("renders no currency breakdown when totalByCurrency is not provided", () => {
    render(<DashboardStatCard label="Activos" count={5} />);

    expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\$\s/)).not.toBeInTheDocument();
  });

  // T3-t4: renders children below the card
  it("renders children slot content", () => {
    render(
      <DashboardStatCard label="Test" count={0}>
        <span>tenant name</span>
      </DashboardStatCard>,
    );

    expect(screen.getByText("tenant name")).toBeInTheDocument();
  });

  // T3-t5: severity danger applies destructive color attribute
  it("sets data-severity=danger when severity=danger", () => {
    const { container } = render(
      <DashboardStatCard label="Overdue" count={3} severity="danger" />,
    );

    const card = container.firstElementChild;
    expect(card).toHaveAttribute("data-severity", "danger");
  });
});

// ── DashboardPage tests (T4) ──────────────────────────────────────────────────

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Underlying hooks must NOT be called by DashboardPage
    mockUsePayments.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseOwnerSettlements.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseContracts.mockReturnValue({ data: [], isLoading: false, error: null });
  });

  // T4-t1: loading state
  it("renders a loading spinner when loading=true", () => {
    mockUseDashboardMetrics.mockReturnValue({ loading: true, error: null });

    render(<DashboardPage />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Pagos vencidos")).not.toBeInTheDocument();
  });

  // T4-t2: error state
  it("renders an error alert when error is set", () => {
    mockUseDashboardMetrics.mockReturnValue({
      loading: false,
      error: new Error("fail"),
    });

    render(<DashboardPage />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      "Error al cargar el panel. Intentá de nuevo.",
    );
    expect(screen.queryByText("Pagos vencidos")).not.toBeInTheDocument();
  });

  // T4-t3: resolved — four card labels render
  it("renders all four card labels in the resolved state", () => {
    mockUseDashboardMetrics.mockReturnValue(resolvedMetrics());

    render(<DashboardPage />);

    expect(screen.getByText("Pagos vencidos")).toBeInTheDocument();
    expect(screen.getByText("Liquidaciones pendientes")).toBeInTheDocument();
    expect(screen.getByText(/Liquidado/)).toBeInTheDocument();
    expect(screen.getByText("Contratos activos")).toBeInTheDocument();
  });

  // T4-t4: card order — overdue before active contracts in DOM
  it("renders Pagos vencidos before Contratos activos", () => {
    mockUseDashboardMetrics.mockReturnValue(resolvedMetrics());

    render(<DashboardPage />);

    const labels = screen
      .getAllByText(/Pagos vencidos|Contratos activos/)
      .map((el) => el.textContent);
    expect(labels[0]).toMatch(/Pagos vencidos/);
  });

  // T4-t5: multi-currency display — ARS and USD appear as separate items
  it("renders ARS and USD overdue totals as separate entries", () => {
    mockUseDashboardMetrics.mockReturnValue(
      resolvedMetrics({
        overduePayments: {
          count: 2,
          totalByCurrency: { ARS: 1000, USD: 50 },
          items: [],
        },
      }),
    );

    render(<DashboardPage />);

    const arsLine = screen.getByText(/\$\s*1[.,]000/);
    const usdLine = screen.getByText(/US\$\s*50/);
    expect(arsLine).toBeInTheDocument();
    expect(usdLine).toBeInTheDocument();
    expect(arsLine).not.toBe(usdLine);
  });

  // T4-t6: overdue list items render
  it("renders known tenant names from overduePayments.items", () => {
    mockUseDashboardMetrics.mockReturnValue(resolvedMetrics());

    render(<DashboardPage />);

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  // T4-t7: list truncation — y N más
  it("renders 'y N más' when overduePayments.items exceeds 5", () => {
    const manyItems = Array.from({ length: 7 }, (_, i) => ({
      id: `p-${i}`,
      tenantName: `Tenant ${i}`,
      propertyAddress: `Address ${i}`,
      amount: 100,
      currency: "ARS",
      dueDate: "2020-01-01",
    }));

    mockUseDashboardMetrics.mockReturnValue(
      resolvedMetrics({
        overduePayments: {
          count: 7,
          totalByCurrency: { ARS: 700 },
          items: manyItems,
        },
      }),
    );

    render(<DashboardPage />);

    expect(screen.getByText("y 2 más")).toBeInTheDocument();
  });

  // T4-t8: empty overdue card — shows empty hint, no list rows
  it("renders empty hint for overdue card when count=0", () => {
    mockUseDashboardMetrics.mockReturnValue(
      resolvedMetrics({
        overduePayments: {
          count: 0,
          totalByCurrency: {},
          items: [],
        },
      }),
    );

    render(<DashboardPage />);

    expect(screen.getByText("Sin pagos vencidos")).toBeInTheDocument();
  });

  // T4-t9: DashboardPage does NOT call underlying data hooks directly (DS-15)
  it("never calls usePayments, useOwnerSettlements, or useContracts directly", () => {
    mockUseDashboardMetrics.mockReturnValue(resolvedMetrics());

    render(<DashboardPage />);

    expect(mockUsePayments).not.toHaveBeenCalled();
    expect(mockUseOwnerSettlements).not.toHaveBeenCalled();
    expect(mockUseContracts).not.toHaveBeenCalled();
  });
});
