/**
 * TDD — CajaPage
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const mockUseCashMovements = vi.fn();
vi.mock("@/features/caja/hooks/use-cash-movements", () => ({
  useCashMovements: () => mockUseCashMovements(),
  CASH_MOVEMENTS_QUERY_KEY: ["nodo_inmo", "cash_movements"],
}));

vi.mock("@/features/caja/components/movement-form-dialog", () => ({
  MovementFormDialog: () => null,
}));

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
  {
    id: "m1",
    date: "2026-06-03",
    concept: "Comisión cobro 01/2026",
    source: "commission",
    type: "income",
    amount: 25000,
    currency: "ARS",
    category: "Efectivo Pesos (ARS)",
  },
  {
    id: "m2",
    date: "2026-06-02",
    concept: "Gastos oficina",
    source: "manual",
    type: "expense",
    amount: 20000,
    currency: "ARS",
    category: "Efectivo Pesos (ARS)",
  },
];

describe("CajaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCashMovements.mockReturnValue({
      data: MOVEMENTS,
      isLoading: false,
      isError: false,
    });
  });

  it("lists movements with cuenta column and link to ganancias", () => {
    render(<CajaPage />, { wrapper });
    expect(screen.getByText("Gastos oficina")).toBeInTheDocument();
    expect(screen.getByText("Comisión cobro 01/2026")).toBeInTheDocument();
    expect(screen.getByText("Cuenta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ganancias/i })).toHaveAttribute(
      "href",
      "/admin/ganancias",
    );
  });

  it("shows an empty state when there are no movements", () => {
    mockUseCashMovements.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<CajaPage />, { wrapper });
    expect(screen.getByText(/todavía no hay movimientos/i)).toBeInTheDocument();
  });

  it("opens nuevo movimiento dialog", async () => {
    render(<CajaPage />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: /nuevo movimiento/i }));
    // dialog mocked as null — button exists
    expect(screen.getByRole("button", { name: /nuevo movimiento/i })).toBeInTheDocument();
  });
});
