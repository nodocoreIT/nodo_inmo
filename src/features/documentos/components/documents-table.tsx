import { useState } from "react";
import { Download, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { DocumentTypeBadge } from "./document-type-badge";
import { useDeleteDocument } from "@/features/documentos/hooks/use-delete-document";
import { getDocumentSignedUrl } from "@/features/documentos/hooks/use-document-url";
import type { DocumentWithRelations } from "@/features/documentos/hooks/use-documents";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function getAssociation(doc: DocumentWithRelations): string {
  if (doc.property?.address) return doc.property.address;
  if (doc.contract?.tenant?.name) return doc.contract.tenant.name;
  if (doc.contract?.id) return `Contrato ${doc.contract.id.slice(0, 8)}`;
  return "—";
}

// ── DocumentRow ───────────────────────────────────────────────────────────────

function DocumentRow({ doc }: { doc: DocumentWithRelations }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { mutate: deleteDoc, isPending: isDeleting } = useDeleteDocument();

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const url = await getDocumentSignedUrl(doc.file_path);
      window.open(url, "_blank", "noreferrer");
    } catch (err) {
      console.error("Failed to generate signed URL:", err);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{doc.label}</TableCell>
      <TableCell>
        <DocumentTypeBadge type={doc.document_type} />
      </TableCell>
      <TableCell>{getAssociation(doc)}</TableCell>
      <TableCell>{formatDate(doc.uploaded_at)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Descargar ${doc.label}`}
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Eliminar ${doc.label}`}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará "{doc.label}" de forma permanente. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteDoc({ id: doc.id, file_path: doc.file_path })}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── DocumentsTable ────────────────────────────────────────────────────────────

interface DocumentsTableProps {
  documents: DocumentWithRelations[];
  isLoading?: boolean;
}

export function DocumentsTable({ documents, isLoading }: DocumentsTableProps) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Cargando documentos"
        className="flex items-center justify-center py-12"
      >
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
        <span className="sr-only">Cargando…</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Etiqueta</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Asociado a</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                No hay documentos cargados aún.
              </TableCell>
            </TableRow>
          ) : (
            documents.map((doc) => <DocumentRow key={doc.id} doc={doc} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}
