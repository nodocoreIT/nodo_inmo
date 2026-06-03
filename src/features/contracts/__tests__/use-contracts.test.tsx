/**
 * TDD — useContracts hook
 * Tests:
 *   - queries nodo_inmo.contracts embedding property address + tenant name
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

  it("queries contracts embedding property and tenant, ordered by created_at desc", async () => {
    const { result } = renderHook(() => useContracts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSchema).toHaveBeenCalledWith("nodo_inmo");
    expect(mockFrom).toHaveBeenCalledWith("contracts");
    const selectArg = mockSelect.mock.calls[0][0] as string;
    expect(selectArg).toContain("property:properties");
    expect(selectArg).toContain("tenant:contacts");
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("returns data from a successful query", async () => {
    const fixture = [
      {
        id: "c-1",
        property: { address: "Lavalle 100" },
        tenant: { name: "Juan Pérez" },
        rent_amount: 250000,
        currency: "ARS",
        status: "active",
      },
    ];
    mockOrder.mockResolvedValue({ data: fixture, error: null });

    const { result } = renderHook(() => useContracts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fixture);
  });
});
