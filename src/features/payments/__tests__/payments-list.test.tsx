/**
 * TDD — PaymentsList
 * Tests: renders rows with derived status, filters by status, marks paid,
 * and shows the empty state.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { useSearchStore } from "@/shared/search/use-search-store";

const mockUsePayments = vi.fn();
vi.mock("@/features/payments/hooks/use-payments", () => ({
  usePayments: () => mockUsePayments(),
  PAYMENTS_QUERY_KEY: ["nodo_inmo", "payments"],
}));

const mockUpdateMutate = vi.fn();
vi.mock("@/features/payments/hooks/use-update-payment", () => ({
  useUpdatePayment: () => ({ mutate: mockUpdateMutate, isPending: false }),
}));

import { PaymentsList } from "@/features/payments/components/payments-list";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

// Fixtures use extreme dates so "overdue" is deterministic regardless of today.
const PAID = {
  id: "p-paid", period: "2026-01-01", due_date: "2026-01-10", amount: 250000,
  currency: "ARS", status: "paid", paid_date: "2026-01-08", paid_amount: 250000,
  contract: { property: { address: "Lavalle 100" }, tenant: { name: "Juan" } },
};
const PENDING = {
  id: "p-pend", period: "2999-02-01", due_date: "2999-02-10", amount: 180000,
  currency: "ARS", status: "pending", paid_date: null, paid_amount: null,
  contract: { property: { address: "Mitre 200" }, tenant: { name: "Ana" } },
};
const OVERDUE = {
  id: "p-over", period: "2020-03-01", due_date: "2020-03-10", amount: 90000,
  currency: "ARS", status: "pending", paid_date: null, paid_amount: null,
  contract: { property: { address: "Callao 500" }, tenant: { name: "Luis" } },
};

describe("PaymentsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({ query: "" });
    mockUsePayments.mockReturnValue({
      data: [PAID, PENDING, OVERDUE],
      isLoading: false,
      isError: false,
    });
  });

  it("renders rows with derived status badges", () => {
    render(<PaymentsList />, { wrapper });
    expect(screen.getByText("Lavalle 100")).toBeInTheDocument();
    expect(screen.getByText("Mitre 200")).toBeInTheDocument();
    expect(screen.getByText("Callao 500")).toBeInTheDocument();
    expect(screen.getByText("Cobrada")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Vencida")).toBeInTheDocument();
  });

  it("filters to only overdue installments", async () => {
    render(<PaymentsList />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "Vencidas" }));
    expect(screen.getByText("Callao 500")).toBeInTheDocument();
    expect(screen.queryByText("Lavalle 100")).not.toBeInTheDocument();
    expect(screen.queryByText("Mitre 200")).not.toBeInTheDocument();
  });

  it("marks an installment as paid", async () => {
    render(<PaymentsList />, { wrapper });
    // Narrow to pending so there's a single actionable row
    await userEvent.click(screen.getByRole("button", { name: "Pendientes" }));
    await userEvent.click(screen.getByRole("button", { name: /marcar cobrada/i }));
    expect(mockUpdateMutate).toHaveBeenCalledOnce();
    expect(mockUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p-pend", status: "paid", paid_amount: 180000 }),
    );
  });

  it("does not show a Cobrar action on paid installments", async () => {
    render(<PaymentsList />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "Cobradas" }));
    const table = screen.getByRole("table");
    expect(
      within(table).queryByRole("button", { name: /marcar cobrada/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no installments", () => {
    mockUsePayments.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<PaymentsList />, { wrapper });
    expect(screen.getByText(/todavía no hay cuotas generadas/i)).toBeInTheDocument();
  });
});
