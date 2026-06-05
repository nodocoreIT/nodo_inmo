/**
 * TDD — useSettleOwner (PR-B rewire to settle_owner RPC)
 *
 * The hook must call supabase.schema('nodo_inmo').rpc('settle_owner', {...})
 * instead of three sequential .from() calls. The RPC handles atomicity,
 * breakdown write, and expense stamping server-side.
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockRpc = vi.fn();
const mockSchema = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: (...a: unknown[]) => mockSchema(...a),
  },
}));

import { useSettleOwner } from "@/features/caja/hooks/use-settle-owner";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const sampleBreakdown = {
  version: 1,
  currency: "ARS",
  gross: 500000,
  commission_rate: 10,
  commission: 50000,
  owner_share: 450000,
  deductions: [{ expense_id: "e1", amount: 12000, description: "Plomeria", expense_date: "2026-05-14", type: "arreglo" }],
  deduction_total: 12000,
  net: 438000,
  settlement_group: "group-uuid",
  sealed_at: "2026-06-04T12:00:00Z",
  cobro_count: 2,
};

describe("useSettleOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: RPC succeeds and returns the breakdown
    mockRpc.mockResolvedValue({ data: sampleBreakdown, error: null });
    mockSchema.mockReturnValue({ rpc: mockRpc, from: mockFrom });
  });

  // R-B10 / R-B13: hook calls the RPC (not from().update())
  it("calls supabase.schema('nodo_inmo').rpc('settle_owner') with correct params", async () => {
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

    expect(mockSchema).toHaveBeenCalledWith("nodo_inmo");
    expect(mockRpc).toHaveBeenCalledWith("settle_owner", {
      p_owner_id: "o1",
      p_currency: "ARS",
      p_settlement_ids: ["s1", "s2"],
    });
  });

  // R-B13: hook does NOT make a separate .from('property_expenses').update() call
  // (stamping is handled by the RPC server-side)
  it("does NOT call .from('property_expenses').update() — stamping is the RPC's job", async () => {
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

    // The from() method must never be called (no client-side multi-mutation)
    expect(mockFrom).not.toHaveBeenCalledWith("property_expenses");
    expect(mockFrom).not.toHaveBeenCalledWith("owner_settlements");
  });

  // R-B12: the RPC return value (breakdown JSONB) is forwarded as the mutation result
  it("forwards the RPC return value as the mutation result", async () => {
    const { result } = renderHook(() => useSettleOwner(), { wrapper });
    let returned: unknown;

    await act(async () => {
      returned = await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        settlement_ids: ["s1", "s2"],
        total: 450000,
        currency: "ARS",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(returned).toEqual(sampleBreakdown);
  });

  // R-B14: if rpc() rejects, the mutation surfaces the error (no swallowing)
  it("surfaces the error when rpc() rejects", async () => {
    const testError = new Error("settle_owner: admin role required");
    mockRpc.mockResolvedValue({ data: null, error: testError });

    const { result } = renderHook(() => useSettleOwner(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          owner_id: "o1",
          owner_name: "Juan",
          settlement_ids: ["s1", "s2"],
          total: 450000,
          currency: "ARS",
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(testError);
  });

  // R-B16: hook passes only the p_settlement_ids provided; no client-side re-filtering
  it("passes p_settlement_ids verbatim — no client-side re-filtering", async () => {
    const { result } = renderHook(() => useSettleOwner(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        settlement_ids: ["s1", "s2", "s3"],
        total: 675000,
        currency: "ARS",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith("settle_owner", {
      p_owner_id: "o1",
      p_currency: "ARS",
      p_settlement_ids: ["s1", "s2", "s3"],
    });
  });

  // R-B18: no code path in the hook calls a breakdown UPDATE on an already-sealed row
  // (seal-once guard lives in the RPC; the hook has a single RPC call, no update-breakdown path)
  it("makes exactly one RPC call per mutation — no separate breakdown update path", async () => {
    const { result } = renderHook(() => useSettleOwner(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        settlement_ids: ["s1"],
        total: 225000,
        currency: "ARS",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Only one RPC call total
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("settle_owner", expect.any(Object));
  });

  // Empty settlement_ids: early return without calling RPC
  it("returns early without calling RPC when settlement_ids is empty", async () => {
    const { result } = renderHook(() => useSettleOwner(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        settlement_ids: [],
        total: 0,
        currency: "ARS",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
