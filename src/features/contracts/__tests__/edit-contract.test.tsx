/**
 * TDD — Edit contract (ContractFormDialog in edit mode)
 * Tests: prefills values + guarantors from the contract, and submits the
 * (possibly edited) payload including guarantor_ids.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/shared/lib/supabase", () => ({
  supabase: { schema: vi.fn(() => ({ from: vi.fn(() => ({ insert: vi.fn() })) })) },
}));

vi.mock("@/features/properties/hooks/use-properties", () => ({
  useProperties: () => ({
    data: [
      { id: "prop-1", address: "Lavalle 100" },
      { id: "prop-2", address: "Mitre 200" },
    ],
  }),
}));

vi.mock("@/features/contacts/hooks/use-contacts", () => ({
  useContacts: (role?: string) => ({
    data:
      role === "tenant"
        ? [{ id: "tenant-1", name: "Juan Pérez" }]
        : role === "guarantor"
          ? [
              { id: "guar-1", name: "Ana García" },
              { id: "guar-2", name: "Luis Díaz" },
            ]
          : [],
  }),
}));

vi.mock("@/shared/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => (
    <select value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
    if (value === "") throw new Error("empty SelectItem value");
    return <option value={value}>{children}</option>;
  },
}));

import { ContractFormDialog } from "@/features/contracts/components/contract-form-dialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const contract: any = {
  id: "c-1",
  property_id: "prop-1",
  tenant_id: "tenant-1",
  start_date: "2026-01-01",
  end_date: "2028-01-01",
  rent_amount: 250000,
  currency: "ARS",
  deposit_amount: 250000,
  commission_amount: null,
  expenses_paid_by: "tenant",
  adjustment_index: "ICL",
  adjustment_period_months: 3,
  status: "active",
  notes: null,
  property: { address: "Lavalle 100" },
  tenant: { name: "Juan Pérez" },
  guarantors: [{ guarantor_id: "guar-1" }],
};

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("ContractFormDialog — edit mode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the edit title and prefills rent + guarantor", () => {
    render(
      <ContractFormDialog open onOpenChange={vi.fn()} contract={contract} onSubmit={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getByText(/editar contrato/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/alquiler/i)).toHaveValue("$ 250.000");
    expect(screen.getByLabelText(/ana garcía/i)).toBeChecked();
    expect(screen.getByLabelText(/luis díaz/i)).not.toBeChecked();
  });

  it("renders the Datos del contrato section with contract_type, signing_date, and signing_city", () => {
    render(
      <ContractFormDialog open onOpenChange={vi.fn()} contract={contract} onSubmit={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getAllByText(/datos del contrato/i).length).toBeGreaterThan(0);
    // FormLabel text present
    expect(screen.getByText(/tipo de contrato/i)).toBeInTheDocument();
    expect(screen.getByText(/fecha de firma/i)).toBeInTheDocument();
    expect(screen.getByText(/ciudad de firma/i)).toBeInTheDocument();
    // Inputs accessible
    expect(screen.getByLabelText(/fecha de firma/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ciudad de firma/i)).toBeInTheDocument();
  });

  it("defaults contract_type to habitacional", () => {
    render(
      <ContractFormDialog open onOpenChange={vi.fn()} contract={contract} onSubmit={vi.fn()} />,
      { wrapper },
    );
    // The Select mock renders as <select> — find by role combobox
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    // contract_type select is the last combobox added (after existing currency, expenses_paid_by, etc.)
    const contractTypeSelect = selects.find((s) => s.value === "habitacional");
    expect(contractTypeSelect).toBeDefined();
    expect(contractTypeSelect?.value).toBe("habitacional");
  });

  it("submits the edited payload with the reconciled guarantor_ids", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ContractFormDialog open onOpenChange={vi.fn()} contract={contract} onSubmit={onSubmit} />,
      { wrapper },
    );

    // bump the rent and add a second guarantor
    const rent = screen.getByLabelText(/alquiler/i);
    await userEvent.clear(rent);
    await userEvent.type(rent, "300000");
    await userEvent.click(screen.getByLabelText(/luis díaz/i));

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      property_id: "prop-1",
      tenant_id: "tenant-1",
      rent_amount: 300000,
      contract_type: "habitacional",
    });
    expect(payload.guarantor_ids.sort()).toEqual(["guar-1", "guar-2"]);
  });
});
