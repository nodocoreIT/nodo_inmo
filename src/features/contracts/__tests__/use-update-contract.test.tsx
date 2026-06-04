/**
 * TDD — useUpdateContract
 * Tests: updates contract fields by id, then reconciles guarantor links
 * (delete all for the contract, re-insert the desired set).
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUpdateEq = vi.fn();
const mockDeleteEq = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockSchema = vi.fn();

vi.mock("@/shared/lib/supabase", () => ({
  supabase: { schema: (...a: unknown[]) => mockSchema(...a) },
}));

vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => ({ orgId: "org-1" }),
}));

import { useUpdateContract } from "@/features/contracts/hooks/use-update-contract";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useUpdateContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEq.mockResolvedValue({ error: null });
    mockDeleteEq.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "contracts") {
        return { update: () => ({ eq: mockUpdateEq }) };
      }
      // contract_guarantors
      return {
        delete: () => ({ eq: mockDeleteEq }),
        insert: mockInsert,
      };
    });
    mockSchema.mockReturnValue({ from: mockFrom });
  });

  it("updates the contract then reconciles guarantor links", async () => {
    const { result } = renderHook(() => useUpdateContract(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "c-1",
        rent_amount: 300000,
        guarantor_ids: ["guar-1", "guar-2"],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // contract fields updated by id (guarantor_ids stripped out)
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "c-1");
    // links cleared for the contract
    expect(mockDeleteEq).toHaveBeenCalledWith("contract_id", "c-1");
    // desired links re-inserted with org_id
    expect(mockInsert).toHaveBeenCalledWith([
      { org_id: "org-1", contract_id: "c-1", guarantor_id: "guar-1" },
      { org_id: "org-1", contract_id: "c-1", guarantor_id: "guar-2" },
    ]);
  });

  it("clears links without inserting when guarantor_ids is empty", async () => {
    const { result } = renderHook(() => useUpdateContract(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: "c-1", guarantor_ids: [] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteEq).toHaveBeenCalledWith("contract_id", "c-1");
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
