/**
 * TDD — CajaPage
 * Tests: balance + movements (Movimientos tab), and pending settlements grouped
 * by owner with a working "Liquidar" action (Liquidaciones tab).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

import { MemoryRouter } from "react-router-dom";
import { CajaPage } from "@/features/caja/components/caja-page";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const MOVEMENTS = [
  { id: "m1", date: "2026-06-03", concept: "Comisión cobro 01/2026", source: "commission", type: "income", amount: 25000, currency: "ARS" },
  { id: "m2", date: "2026-06-02", concept: "Gastos oficina", source: "manual", type: "expense", amount: 20000, currency: "ARS" },
];
const SETTLEMENTS = [
  { id: "s1", owner_id: "o1", amount: 225000, currency: "ARS", status: "pending", owner: { name: "Juan" } },
  { id: "s2", owner_id: "o1", amount: 225000, currency: "ARS", status: "pending", owner: { name: "Juan" } },
];

describe("CajaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCashMovements.mockReturnValue({ data: MOVEMENTS, isLoading: false, isError: false });
    mockUseOwnerSettlements.mockReturnValue({ data: SETTLEMENTS, isLoading: false, isError: false });
  });

  it("shows the balance and movements on the Movimientos tab", () => {
    render(<CajaPage />, { wrapper });
    expect(screen.getByText("$ 5.000")).toBeInTheDocument(); // 25000 - 20000
    expect(screen.getByText("Gastos oficina")).toBeInTheDocument();
    expect(screen.getByText("Comisión cobro 01/2026")).toBeInTheDocument();
  });

  it("links to rendiciones for pending settlements on the Liquidaciones tab", async () => {
    render(<CajaPage />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "Liquidaciones" }));
    expect(screen.getByText(/rendición/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ir a rendiciones/i })).toHaveAttribute(
      "href",
      "/admin/rendiciones",
    );
  });

  it("shows an empty state when there are no movements", () => {
    mockUseCashMovements.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<CajaPage />, { wrapper });
    expect(screen.getByText(/todavía no hay movimientos/i)).toBeInTheDocument();
  });
});
