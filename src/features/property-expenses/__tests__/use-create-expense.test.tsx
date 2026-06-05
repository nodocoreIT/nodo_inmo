/**
 * TDD — useCreateExpense & useUploadReceipt hooks
 *
 * RED first: these tests fail before the hooks exist.
 *
 * Spec coverage:
 *   R10 / R24 — insert payload includes org_id from useAuth
 *   R20       — receipt_path is a storage key, not a URL
 *   R24       — upload happens before insert; if upload fails, insert is never called
 *   R26       — no call to from('cash_movements') at any point
 *
 * Note: vi.mock factories are hoisted to the top of the file by vitest.
 * Spy references must be set up INSIDE the factory (not via top-level const) to
 * avoid "Cannot access before initialization" TDZ errors.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Shared spy registry ───────────────────────────────────────────────────────
// Declared at module level so beforeEach can reset them; assigned inside the
// mock factory to avoid TDZ errors caused by hoisting.
const spies = {
  insert: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
  storageFrom: vi.fn(),
};

// ── Mock supabase ─────────────────────────────────────────────────────────────
vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({
      from: (...args: unknown[]) => spies.from(...args),
    })),
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

// ── Mock useAuth ──────────────────────────────────────────────────────────────
const mockUseAuth = vi.fn();
vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Import hooks AFTER mocks ──────────────────────────────────────────────────
import { useCreateExpense } from "@/features/property-expenses/hooks/use-create-expense";
import { useUploadReceipt } from "@/features/property-expenses/hooks/use-upload-receipt";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ── useCreateExpense ──────────────────────────────────────────────────────────

describe("useCreateExpense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ orgId: "org-abc" });
    spies.from.mockReturnValue({ insert: spies.insert });
    spies.insert.mockResolvedValue({ data: [{ id: "exp-1" }], error: null });
  });

  it("calls schema('nodo_inmo').from('property_expenses').insert with org_id from useAuth", async () => {
    const { result } = renderHook(() => useCreateExpense(), { wrapper });

    await result.current.mutateAsync({
      property_id: "prop-1",
      type: "arreglo",
      amount: 5000,
      currency: "ARS",
      expense_date: "2026-06-04",
      description: "Pintura fachada",
      charged_to_owner: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spies.from).toHaveBeenCalledWith("property_expenses");
    expect(spies.insert).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: "org-abc", property_id: "prop-1" }),
    );
  });

  it("does NOT include an https:// prefix in receipt_path when provided (R20)", async () => {
    const { result } = renderHook(() => useCreateExpense(), { wrapper });

    await result.current.mutateAsync({
      property_id: "prop-1",
      type: "arreglo",
      amount: 1000,
      currency: "ARS",
      expense_date: "2026-06-04",
      description: "Prueba",
      charged_to_owner: false,
      receipt_path: "org-abc/prop-1/uuid-receipt.jpg",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const payload = spies.insert.mock.calls[0][0];
    expect(payload.receipt_path).not.toMatch(/^https?:\/\//);
    expect(payload.receipt_path).toBe("org-abc/prop-1/uuid-receipt.jpg");
  });

  it("throws when orgId is absent (user not provisioned)", async () => {
    mockUseAuth.mockReturnValue({ orgId: null });
    const { result } = renderHook(() => useCreateExpense(), { wrapper });

    await expect(
      result.current.mutateAsync({
        property_id: "prop-1",
        type: "arreglo",
        amount: 100,
        currency: "ARS",
        expense_date: "2026-06-04",
        description: "Prueba",
        charged_to_owner: true,
      }),
    ).rejects.toThrow("No org_id");
  });

  it("does NOT call from('cash_movements') at any point (R26 — ledger isolation)", async () => {
    const { result } = renderHook(() => useCreateExpense(), { wrapper });

    await result.current.mutateAsync({
      property_id: "prop-1",
      type: "compra_accesorio",
      amount: 200,
      currency: "USD",
      expense_date: "2026-06-04",
      description: "Repuesto",
      charged_to_owner: false,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const fromCalls = spies.from.mock.calls.map((call) => call[0]);
    expect(fromCalls).not.toContain("cash_movements");
  });
});

// ── useUploadReceipt ──────────────────────────────────────────────────────────

describe("useUploadReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ orgId: "org-abc" });
    spies.storageFrom.mockReturnValue({ upload: spies.upload });
    spies.upload.mockResolvedValue({
      data: { path: "org-abc/prop-1/uuid-file.jpg" },
      error: null,
    });
  });

  it("calls storage.from('property-expense-receipts').upload with correct bucket and key pattern", async () => {
    const { result } = renderHook(() => useUploadReceipt(), { wrapper });

    const file = new File(["content"], "receipt.jpg", { type: "image/jpeg" });
    const key = await result.current.mutateAsync({ propertyId: "prop-1", file });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spies.storageFrom).toHaveBeenCalledWith("property-expense-receipts");
    expect(spies.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^org-abc\/prop-1\/.+receipt\.jpg$/),
      file,
      { upsert: true },
    );
    // Returns the storage key (not a URL)
    expect(typeof key).toBe("string");
    expect(key).toBeTruthy();
    expect(key).not.toMatch(/^https?:\/\//);
  });

  it("key starts with org_id as first path segment (tenant scoping for RLS)", async () => {
    const { result } = renderHook(() => useUploadReceipt(), { wrapper });

    const file = new File(["content"], "factura.png", { type: "image/png" });
    await result.current.mutateAsync({ propertyId: "prop-2", file });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const uploadedKey = spies.upload.mock.calls[0][0] as string;
    expect(uploadedKey.split("/")[0]).toBe("org-abc");
    expect(uploadedKey.split("/")[1]).toBe("prop-2");
  });

  it("throws when upload fails, so insert caller is blocked (R24)", async () => {
    spies.upload.mockResolvedValue({ data: null, error: new Error("Upload failed") });
    const { result } = renderHook(() => useUploadReceipt(), { wrapper });

    const file = new File(["content"], "bad.jpg", { type: "image/jpeg" });
    await expect(result.current.mutateAsync({ propertyId: "prop-1", file })).rejects.toThrow();
  });
});
