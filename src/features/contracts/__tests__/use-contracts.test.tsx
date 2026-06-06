/**
 * TDD — useContracts hook
 * Tests:
 *   - queries nodo_inmo.contracts embedding property (with owner) + tenant (with dni) + guarantors (with dni)
 *   - orders by created_at desc
 *   - returns data from a successful query
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockOrder = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockSchema = vi.fn();

vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: (...args: unknown[]) => mockSchema(...args),
  },
}));

import { useContracts } from "@/features/contracts/hooks/use-contracts";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useContracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSchema.mockReturnValue({ from: mockFrom });
  });

  it("queries contracts embedding property (with owner), tenant (with dni), guarantors (with dni), ordered by created_at desc", async () => {
    const { result } = renderHook(() => useContracts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSchema).toHaveBeenCalledWith("nodo_inmo");
    expect(mockFrom).toHaveBeenCalledWith("contracts");
    const selectArg = mockSelect.mock.calls[0][0] as string;
    expect(selectArg).toContain("property:properties");
    expect(selectArg).toContain("owner:contacts");
    expect(selectArg).toContain("tenant:contacts");
    expect(selectArg).toContain("guarantors:contract_guarantors");
    expect(selectArg).toContain("dni");
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("returns data from a successful query", async () => {
    const fixture = [
      {
        id: "c-1",
        property: {
          address: "Lavalle 100",
          property_type: "apartment",
          rooms: 3,
          total_sqm: 75,
          inventory_description: null,
          owner: { name: "Carlos García", dni: "20123456", email: null, phone: null, address: "Av. Corrientes 1234" },
        },
        tenant: { name: "Juan Pérez", dni: "30987654", address: "Lavalle 100" },
        guarantors: [
          { guarantor_id: "g-1", guarantor: { name: "Ana López", dni: "25555555", address: "Rivadavia 500" } },
        ],
        rent_amount: 250000,
        currency: "ARS",
        status: "active",
        contract_type: "habitacional",
        signing_city: "Ciudad Autónoma de Buenos Aires",
        signing_date: null,
      },
    ];
    mockOrder.mockResolvedValue({ data: fixture, error: null });

    const { result } = renderHook(() => useContracts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fixture);
  });
});
