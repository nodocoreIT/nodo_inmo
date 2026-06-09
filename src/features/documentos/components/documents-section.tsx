import { useState, useMemo } from "react";
import { Button } from "@/shared/components/ui/button";
import { DocumentsTable } from "./documents-table";
import { UploadDocumentDialog } from "./upload-document-dialog";
import { useDocuments } from "@/features/documentos/hooks/use-documents";
import { PaginationControls } from "@/shared/components/ui/pagination";
import { PAGE_SIZE } from "@/shared/lib/constants";

/**
 * DocumentsSection — Document management area for the Documentos page.
 *
 * Phase D: Shows all org documents with upload/download/delete actions.
 * Added below the ContractsBrowser section in DocumentosPage.
 */
export function DocumentsSection() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [page, setPage] = useState(0);
  const { data: documents, isLoading } = useDocuments();

  const all = documents ?? [];
  const totalPages = Math.ceil(all.length / PAGE_SIZE);
  const pagedDocuments = useMemo(
    () => all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [all, page],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Documentos</h2>
        <Button onClick={() => setUploadOpen(true)}>Subir documento</Button>
      </div>

      <DocumentsTable documents={pagedDocuments} isLoading={isLoading} />

      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={all.length}
        pageSize={PAGE_SIZE}
        itemLabel="documentos"
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </section>
  );
}
