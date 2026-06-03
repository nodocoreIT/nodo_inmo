/**
 * TDD — useGenerateInstallments
 * Tests: builds the installment rows from a contract and upserts them with
 * the org_id, ignoring duplicate (contract_id, period) rows.
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUpsert = vi.fn();
const mockFrom = vi.fn();
const mockSchema = vi.fn();

vi.mock("@/shared/lib/supabase", () => ({
  supabase: { schema: (...a: unknown[]) => mockSchema(...a) },
}));

vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => ({ orgId: "org-1" }),
}));

import { useGenerateInstallments } from "@/features/payments/hooks/use-generate-installments";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useGenerateInstallments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockSchema.mockReturnValue({ from: mockFrom });
  });

  it("upserts generated rows with org_id and ignoreDuplicates", async () => {
    const { result } = renderHook(() => useGenerateInstallments(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        contract_id: "c-1",
        start_date: "2026-01-01",
        end_date: "2026-04-01",
        rent_amount: 250000,
        currency: "ARS",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSchema).toHaveBeenCalledWith("nodo_inmo");
    expect(mockFrom).toHaveBeenCalledWith("payments");

    const [rows, opts] = mockUpsert.mock.calls[0];
    expect(rows).toHaveLength(3); // Jan, Feb, Mar 2026
    expect(rows[0]).toMatchObject({
      org_id: "org-1",
      contract_id: "c-1",
      period: "2026-01-01",
      amount: 250000,
      currency: "ARS",
      status: "pending",
    });
    expect(opts).toMatchObject({
      onConflict: "contract_id,period",
      ignoreDuplicates: true,
    });
  });
});
