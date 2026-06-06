/**
 * TDD — DocumentsSection component
 *
 * Test cases:
 *  1. Renders "Subir documento" button
 *  2. Clicking button opens upload dialog
 *  3. Passes documents to DocumentsTable
 *  4. Shows loading state when isLoading is true
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseDocuments = vi.fn();
vi.mock("@/features/documentos/hooks/use-documents", () => ({
  useDocuments: () => mockUseDocuments(),
  DOCUMENTS_QUERY_KEY: ["nodo_inmo", "documents"],
}));

// Stub UploadDocumentDialog to avoid full form rendering in section tests
vi.mock("@/features/documentos/components/upload-document-dialog", () => ({
  UploadDocumentDialog: ({ open }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? <div data-testid="upload-dialog">Dialog</div> : null,
}));

// Stub DocumentsTable to keep section tests focused
vi.mock("@/features/documentos/components/documents-table", () => ({
  DocumentsTable: ({ documents, isLoading }: { documents: unknown[]; isLoading?: boolean }) => (
    <div data-testid="documents-table" data-loading={isLoading ? "true" : "false"} data-count={documents.length}>
      Documents table
    </div>
  ),
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────
import { DocumentsSection } from "@/features/documentos/components/documents-section";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("DocumentsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocuments.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders 'Subir documento' button", () => {
    render(<DocumentsSection />, { wrapper: makeWrapper() });
    expect(screen.getByRole("button", { name: /subir documento/i })).toBeInTheDocument();
  });

  it("clicking button opens the upload dialog", async () => {
    const user = userEvent.setup();
    render(<DocumentsSection />, { wrapper: makeWrapper() });

    // Dialog initially closed
    expect(screen.queryByTestId("upload-dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /subir documento/i }));

    await waitFor(() => {
      expect(screen.getByTestId("upload-dialog")).toBeInTheDocument();
    });
  });

  it("passes documents to DocumentsTable", () => {
    const docs = [
      { id: "d1", label: "Test", document_type: "otro" },
      { id: "d2", label: "Test 2", document_type: "factura" },
    ];
    mockUseDocuments.mockReturnValue({ data: docs, isLoading: false });

    render(<DocumentsSection />, { wrapper: makeWrapper() });

    const table = screen.getByTestId("documents-table");
    expect(table.dataset.count).toBe("2");
  });

  it("shows loading state when isLoading is true", () => {
    mockUseDocuments.mockReturnValue({ data: undefined, isLoading: true });

    render(<DocumentsSection />, { wrapper: makeWrapper() });

    const table = screen.getByTestId("documents-table");
    expect(table.dataset.loading).toBe("true");
  });
});
