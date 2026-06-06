/**
 * TDD — useDeleteDocument hook
 *
 * Strict TDD: tests written RED first.
 *
 * Test cases:
 *  1. Calls storage.remove with the correct file_path array
 *  2. Calls DB delete with the correct id
 *  3. Throws if storage removal fails (DB delete is NOT called)
 *  4. Throws if DB delete fails after storage removal
 *  5. Invalidates DOCUMENTS_QUERY_KEY on success
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Shared spy registry ───────────────────────────────────────────────────────
const spies = {
  remove: vi.fn(),
  storageFrom: vi.fn(),
  deleteEq: vi.fn(),
  delete: vi.fn(),
  from: vi.fn(),
  schema: vi.fn(),
};

// ── Mock supabase ─────────────────────────────────────────────────────────────
vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: (...args: unknown[]) => spies.schema(...args),
    storage: {
      from: (...args: unknown[]) => spies.storageFrom(...args),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn(), id: "s1" } },
      }),
    },
  },
}));

// ── Import hook AFTER mocks ───────────────────────────────────────────────────
import { useDeleteDocument } from "@/features/documentos/hooks/use-delete-document";
import { DOCUMENTS_QUERY_KEY } from "@/features/documentos/hooks/use-documents";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDeleteDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    spies.storageFrom.mockReturnValue({ remove: spies.remove });
    spies.remove.mockResolvedValue({ data: null, error: null });

    spies.deleteEq.mockResolvedValue({ data: null, error: null });
    spies.delete.mockReturnValue({ eq: spies.deleteEq });
    spies.from.mockReturnValue({ delete: spies.delete });
    spies.schema.mockReturnValue({ from: spies.from });
  });

  it("calls storage.remove with the correct file_path array", async () => {
    const { result } = renderHook(() => useDeleteDocument(), { wrapper });

    await result.current.mutateAsync({ id: "doc-1", file_path: "org-a/uuid-file.pdf" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spies.storageFrom).toHaveBeenCalledWith("org-documents");
    expect(spies.remove).toHaveBeenCalledWith(["org-a/uuid-file.pdf"]);
  });

  it("calls DB delete with the correct id", async () => {
    const { result } = renderHook(() => useDeleteDocument(), { wrapper });

    await result.current.mutateAsync({ id: "doc-1", file_path: "org-a/uuid-file.pdf" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spies.from).toHaveBeenCalledWith("documents");
    expect(spies.deleteEq).toHaveBeenCalledWith("id", "doc-1");
  });

  it("throws if storage removal fails and DB delete is NOT called", async () => {
    spies.remove.mockResolvedValue({ data: null, error: new Error("Storage error") });

    const { result } = renderHook(() => useDeleteDocument(), { wrapper });

    await expect(
      result.current.mutateAsync({ id: "doc-1", file_path: "org-a/uuid-file.pdf" }),
    ).rejects.toThrow("Storage error");

    expect(spies.delete).not.toHaveBeenCalled();
  });

  it("throws if DB delete fails after storage removal", async () => {
    spies.deleteEq.mockResolvedValue({ data: null, error: new Error("DB error") });

    const { result } = renderHook(() => useDeleteDocument(), { wrapper });

    await expect(
      result.current.mutateAsync({ id: "doc-1", file_path: "org-a/uuid-file.pdf" }),
    ).rejects.toThrow("DB error");
  });

  it("invalidates DOCUMENTS_QUERY_KEY on success", async () => {
    let capturedClient: QueryClient | null = null;
    function capturingWrapper({ children }: { children: ReactNode }) {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      capturedClient = client;
      vi.spyOn(client, "invalidateQueries");
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => useDeleteDocument(), { wrapper: capturingWrapper });
    await result.current.mutateAsync({ id: "doc-1", file_path: "org-a/uuid-file.pdf" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedClient!.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: DOCUMENTS_QUERY_KEY }),
    );
  });
});
