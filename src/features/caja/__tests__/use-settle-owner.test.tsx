/**
 * TDD — useSettleOwner
 * Marks the owner's pending settlements as settled. Does NOT create a Caja
 * movement (accounting model A: the owner's share never entered Caja).
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockIn = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockSchema = vi.fn();

vi.mock("@/shared/lib/supabase", () => ({
  supabase: { schema: (...a: unknown[]) => mockSchema(...a) },
}));

import { useSettleOwner } from "@/features/caja/hooks/use-settle-owner";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useSettleOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIn.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ update: mockUpdate, insert: mockInsert });
    mockSchema.mockReturnValue({ from: mockFrom });
  });

  it("marks settlements settled without creating a Caja movement", async () => {
    const { result } = renderHook(() => useSettleOwner(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        settlement_ids: ["s1", "s2"],
        total: 450000,
        currency: "ARS",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("owner_settlements");
    expect(mockFrom).not.toHaveBeenCalledWith("cash_movements");
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "settled" }),
    );
    expect(mockIn).toHaveBeenCalledWith("id", ["s1", "s2"]);
  });
});
