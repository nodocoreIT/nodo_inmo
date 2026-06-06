/**
 * TDD — DocumentsTable component
 *
 * Test cases:
 *  1. Renders empty state when documents is []
 *  2. Renders one row per document
 *  3. Displays property address when property.address is present
 *  4. Displays "—" when both property and contract are null
 *  5. Download button is present for each row
 *  6. Delete button is present for each row
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/features/documentos/hooks/use-delete-document", () => ({
  useDeleteDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/features/documentos/hooks/use-document-url", () => ({
  getDocumentSignedUrl: vi.fn().mockResolvedValue("https://signed-url.example.com"),
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────
import { DocumentsTable } from "@/features/documentos/components/documents-table";
import type { DocumentWithRelations } from "@/features/documentos/hooks/use-documents";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const DOC_WITH_PROPERTY: DocumentWithRelations = {
  id: "doc-1",
  org_id: "org-a",
  property_id: "prop-1",
  contract_id: null,
  label: "Factura electricidad",
  document_type: "factura",
  file_path: "org-a/uuid-factura.pdf",
  notes: null,
  uploaded_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
  property: { address: "Lavalle 100" },
  contract: null,
};

const DOC_NO_ASSOCIATION: DocumentWithRelations = {
  ...DOC_WITH_PROPERTY,
  id: "doc-2",
  label: "Certificado habitabilidad",
  document_type: "certificado",
  property: null,
  contract: null,
};

describe("DocumentsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when documents is []", () => {
    render(<DocumentsTable documents={[]} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/no hay documentos cargados/i)).toBeInTheDocument();
  });

  it("renders one row per document", () => {
    render(
      <DocumentsTable documents={[DOC_WITH_PROPERTY, DOC_NO_ASSOCIATION]} />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText("Factura electricidad")).toBeInTheDocument();
    expect(screen.getByText("Certificado habitabilidad")).toBeInTheDocument();
  });

  it("displays property address when property.address is present", () => {
    render(<DocumentsTable documents={[DOC_WITH_PROPERTY]} />, { wrapper: makeWrapper() });
    expect(screen.getByText("Lavalle 100")).toBeInTheDocument();
  });

  it("displays '—' when both property and contract are null", () => {
    render(<DocumentsTable documents={[DOC_NO_ASSOCIATION]} />, { wrapper: makeWrapper() });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("download button is present for each row", () => {
    render(
      <DocumentsTable documents={[DOC_WITH_PROPERTY, DOC_NO_ASSOCIATION]} />,
      { wrapper: makeWrapper() },
    );
    const downloadButtons = screen.getAllByRole("button", { name: /descargar/i });
    expect(downloadButtons).toHaveLength(2);
  });

  it("delete button is present for each row", () => {
    render(
      <DocumentsTable documents={[DOC_WITH_PROPERTY, DOC_NO_ASSOCIATION]} />,
      { wrapper: makeWrapper() },
    );
    const deleteButtons = screen.getAllByRole("button", { name: /eliminar/i });
    expect(deleteButtons).toHaveLength(2);
  });
});
