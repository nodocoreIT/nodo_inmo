/**
 * TDD — useUploadDocument + sanitizeFilename
 *
 * Strict TDD: tests written RED first.
 *
 * Test cases:
 *  1. Uploads file to correct storage path {orgId}/{uuid}-{sanitizedName}
 *  2. Inserts DB row with correct fields including file_path
 *  3. Throws if upload step fails (DB insert is NOT called)
 *  4. Throws if DB insert fails after successful upload (orphan scenario)
 *  5. Invalidates DOCUMENTS_QUERY_KEY on success
 *  6. Throws if orgId is null
 *  7. sanitizeFilename converts spaces and special chars to hyphens
 *  8. sanitizeFilename collapses consecutive hyphens
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Shared spy registry ───────────────────────────────────────────────────────
const spies = {
  upload: vi.fn(),
  storageFrom: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  from: vi.fn(),
  schema: vi.fn(),
  invalidateQueries: vi.fn(),
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

// ── Mock useAuth ──────────────────────────────────────────────────────────────
const mockUseAuth = vi.fn();
vi.mock("@/app/auth/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Import hook AFTER mocks ───────────────────────────────────────────────────
import { useUploadDocument, sanitizeFilename } from "@/features/documentos/hooks/use-upload-document";
import { DOCUMENTS_QUERY_KEY } from "@/features/documentos/hooks/use-documents";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const INSERTED_DOC = { id: "doc-1", org_id: "org-abc", label: "Factura", document_type: "factura", file_path: "org-abc/uuid-factura.pdf" };

describe("useUploadDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ orgId: "org-abc" });

    spies.storageFrom.mockReturnValue({ upload: spies.upload });
    spies.upload.mockResolvedValue({ data: { path: "org-abc/uuid-factura.pdf" }, error: null });

    spies.single.mockResolvedValue({ data: INSERTED_DOC, error: null });
    spies.select.mockReturnValue({ single: spies.single });
    spies.insert.mockReturnValue({ select: spies.select });
    spies.from.mockReturnValue({ insert: spies.insert });
    spies.schema.mockReturnValue({ from: spies.from });
  });

  it("uploads file to correct storage bucket", async () => {
    const { result } = renderHook(() => useUploadDocument(), { wrapper });
    const file = new File(["content"], "factura.pdf", { type: "application/pdf" });

    await result.current.mutateAsync({
      file,
      label: "Factura",
      document_type: "factura",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spies.storageFrom).toHaveBeenCalledWith("org-documents");
    expect(spies.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^org-abc\/.+-factura\.pdf$/),
      file,
      { upsert: false },
    );
  });

  it("inserts DB row with correct fields including file_path from storage key", async () => {
    const { result } = renderHook(() => useUploadDocument(), { wrapper });
    const file = new File(["content"], "presupuesto.pdf", { type: "application/pdf" });

    await result.current.mutateAsync({
      file,
      label: "Presupuesto obra",
      document_type: "presupuesto",
      property_id: "prop-1",
      notes: "Tercer piso",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spies.from).toHaveBeenCalledWith("documents");
    expect(spies.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "org-abc",
        label: "Presupuesto obra",
        document_type: "presupuesto",
        property_id: "prop-1",
        notes: "Tercer piso",
        file_path: expect.stringMatching(/^org-abc\/.+/),
      }),
    );
  });

  it("throws if upload step fails and DB insert is NOT called", async () => {
    spies.upload.mockResolvedValue({ data: null, error: new Error("Upload failed") });

    const { result } = renderHook(() => useUploadDocument(), { wrapper });
    const file = new File(["content"], "bad.pdf", { type: "application/pdf" });

    await expect(
      result.current.mutateAsync({ file, label: "Bad", document_type: "otro" }),
    ).rejects.toThrow("Upload failed");

    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("throws if DB insert fails after successful upload (orphan scenario documented)", async () => {
    spies.single.mockResolvedValue({ data: null, error: new Error("Insert failed") });

    const { result } = renderHook(() => useUploadDocument(), { wrapper });
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });

    await expect(
      result.current.mutateAsync({ file, label: "Doc", document_type: "certificado" }),
    ).rejects.toThrow("Insert failed");
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

    const { result } = renderHook(() => useUploadDocument(), { wrapper: capturingWrapper });
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });

    await result.current.mutateAsync({ file, label: "Doc", document_type: "otro" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedClient!.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: DOCUMENTS_QUERY_KEY }),
    );
  });

  it("throws if orgId is null (user not provisioned)", async () => {
    mockUseAuth.mockReturnValue({ orgId: null });

    const { result } = renderHook(() => useUploadDocument(), { wrapper });
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });

    await expect(
      result.current.mutateAsync({ file, label: "Doc", document_type: "otro" }),
    ).rejects.toThrow("No org_id");
  });
});

// ── sanitizeFilename ──────────────────────────────────────────────────────────

describe("sanitizeFilename", () => {
  it("converts spaces to hyphens", () => {
    expect(sanitizeFilename("mi factura mensual.pdf")).toBe("mi-factura-mensual.pdf");
  });

  it("collapses consecutive hyphens into one", () => {
    // "factura  --  mensual.pdf": spaces + existing hyphens all become hyphens, then collapsed to one
    expect(sanitizeFilename("factura  --  mensual.pdf")).toBe("factura-mensual.pdf");
    expect(sanitizeFilename("foo   bar.pdf")).toBe("foo-bar.pdf");
  });
});
