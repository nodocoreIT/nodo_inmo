import { useState, useEffect } from "react";
import { Download, Share2, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { StatementData } from "@/features/caja/lib/settlement-statement-data";
import {
  buildBlob,
  handleDownload,
  handleShare,
} from "@/features/caja/lib/settlement-pdf-actions";

interface SettlementPdfViewerProps {
  data: StatementData;
}

export function SettlementPdfViewer({ data }: SettlementPdfViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    setIsGenerating(true);
    setError(null);

    void (async () => {
      try {
        const generated = await buildBlob(data);
        objectUrl = URL.createObjectURL(generated);
        setBlobUrl(objectUrl);
      } catch {
        setError("No se pudo generar el PDF.");
      } finally {
        setIsGenerating(false);
      }
    })();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data]);

  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [new File([], "test.pdf", { type: "application/pdf" })] })
    ) {
      setCanShare(true);
    }
  }, []);

  if (isGenerating) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-slate2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Generando PDF…
      </div>
    );
  }

  if (error) {
    return <p className="p-6 text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end gap-2 px-4 pb-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => void handleDownload(data)}
        >
          <Download className="h-4 w-4" />
          Descargar
        </Button>
        {canShare && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void handleShare(data)}
          >
            <Share2 className="h-4 w-4" />
            Compartir
          </Button>
        )}
      </div>
      {blobUrl ? (
        <iframe
          title={`Vista previa liquidación — ${data.ownerName}`}
          src={blobUrl}
          className="h-full w-full rounded-md border border-border"
        />
      ) : null}
    </div>
  );
}
