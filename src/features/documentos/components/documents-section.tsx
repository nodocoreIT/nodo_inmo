import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { DocumentsTable } from "./documents-table";
import { UploadDocumentDialog } from "./upload-document-dialog";
import { useDocuments } from "@/features/documentos/hooks/use-documents";

/**
 * DocumentsSection — Document management area for the Documentos page.
 *
 * Phase D: Shows all org documents with upload/download/delete actions.
 * Added below the ContractsBrowser section in DocumentosPage.
 */
export function DocumentsSection() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data: documents, isLoading } = useDocuments();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Documentos</h2>
        <Button onClick={() => setUploadOpen(true)}>Subir documento</Button>
      </div>

      <DocumentsTable documents={documents ?? []} isLoading={isLoading} />

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </section>
  );
}
