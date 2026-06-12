/**
 * TDD — DashboardStatCard + DashboardPage
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mockUseDashboardMetrics = vi.fn();
vi.mock("../hooks/use-dashboard-metrics", () => ({
  useDashboardMetrics: () => mockUseDashboardMetrics(),
}));

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

vi.mock("@/features/agenda/hooks/use-tasks", () => ({
  useTasks: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => ({
    user: { email: "juan@test.com", user_metadata: { full_name: "Juan Mendía" } },
    orgId: "org-1",
  }),
}));

vi.mock("@/features/agency-profile/hooks/use-org-profile", () => ({
  useOrgProfile: () => ({ data: null, isLoading: false }),
}));


import { DashboardStatCard } from "../components/dashboard-stat-card";
import { DashboardPage } from "../components/dashboard-page";
import type { DashboardMetrics } from "../hooks/use-dashboard-metrics";

function resolvedMetrics(overrides: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return {
    loading: false,
    error: null,
    activeContracts: 3,
    overduePayments: {
      count: 2,
      totalByCurrency: { ARS: 1000 },
      items: [],
    },
    pendingSettlements: {
      count: 1,
      totalByCurrency: { ARS: 5000 },
      items: [],
    },
    recentSealed: {
      count: 1,
      totalByCurrency: { ARS: 8000 },
    },
    pastMonthDebts: [
      {
        id: "p-1",
        tenantName: "Guillermo Zimermann",
        monthLabel: "04/2026",
        amount: 550000,
        currency: "ARS",
      },
    ],
    currentMonthCollections: [
      {
        key: "g1",
        tenantName: "Marcelo Rohwain",
        propertyAddress: "Congreso 1750",
        status: "sin_cobrar",
        balance: 490502,
        currency: "ARS",
        payments: [{ id: "p-2", remaining: 490502 }],
      },
    ],
    recentReceipts: [
      {
        id: "p-3",
        tenantName: "Ana García",
        amount: 250000,
        currency: "ARS",
        paidDate: "2026-06-01",
      },
    ],
    ...overrides,
  };
}

describe("DashboardStatCard", () => {
  it("renders the label and count", () => {
    render(<DashboardStatCard label="Overdue" count={3} />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

function renderWithRouter(ui: React.ReactElement) {
  return render(ui, { wrapper: MemoryRouter });
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePayments.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseOwnerSettlements.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseContracts.mockReturnValue({ data: [], isLoading: false, error: null });
  });

  it("renders a loading spinner when loading=true", () => {
    mockUseDashboardMetrics.mockReturnValue({ loading: true, error: null });
    renderWithRouter(<DashboardPage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders an error alert when error is set", () => {
    mockUseDashboardMetrics.mockReturnValue({
      loading: false,
      error: new Error("fail"),
    });
    renderWithRouter(<DashboardPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Error al cargar el panel. Intentá de nuevo.",
    );
  });

  it("renders the new dashboard sections", () => {
    mockUseDashboardMetrics.mockReturnValue(resolvedMetrics());
    renderWithRouter(<DashboardPage />);

    expect(screen.getByText(/Hola, Juan/i)).toBeInTheDocument();
    expect(screen.getByText("Rendiciones")).toBeInTheDocument();
    expect(screen.getByText("Ganancias")).toBeInTheDocument();
    expect(screen.getByText("Ventas")).toBeInTheDocument();
    expect(screen.getByText("Deudas de meses anteriores")).toBeInTheDocument();
    expect(screen.getByText(/Cobros del mes de/i)).toBeInTheDocument();
    expect(screen.getByText("Recibos recientes")).toBeInTheDocument();
  });

  it("renders past month debt lines", () => {
    mockUseDashboardMetrics.mockReturnValue(resolvedMetrics());
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText(/Guillermo Zimermann/)).toBeInTheDocument();
    expect(screen.getByText(/04\/2026/)).toBeInTheDocument();
  });

  it("renders current month collection rows", () => {
    mockUseDashboardMetrics.mockReturnValue(resolvedMetrics());
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText("Marcelo Rohwain")).toBeInTheDocument();
    expect(screen.getByText("Sin cobrar")).toBeInTheDocument();
  });

  it("hides the past-debts banner when there are no debts", () => {
    mockUseDashboardMetrics.mockReturnValue(
      resolvedMetrics({ pastMonthDebts: [] }),
    );
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByText("Deudas de meses anteriores")).not.toBeInTheDocument();
  });

  it("never calls useOwnerSettlements or useContracts directly", () => {
    mockUseDashboardMetrics.mockReturnValue(resolvedMetrics());
    renderWithRouter(<DashboardPage />);
    expect(mockUseOwnerSettlements).not.toHaveBeenCalled();
    expect(mockUseContracts).not.toHaveBeenCalled();
  });
});
