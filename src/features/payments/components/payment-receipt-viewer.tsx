import React, { useState, useEffect } from "react";
import { Download, Share2, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { PaymentWithRelations } from "../hooks/use-payments";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { buildReceiptData } from "../lib/payment-receipt-pdf";

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").slice(0, 30);
}

interface PaymentReceiptViewerProps {
  payment: PaymentWithRelations;
}

export function PaymentReceiptViewer({ payment }: PaymentReceiptViewerProps) {
  const { data: agency, isLoading: agencyLoading } = useOrgProfile();

  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (agencyLoading) return;

    let objectUrl: string | null = null;
    setIsGenerating(true);
    setError(null);

    void (async () => {
      try {
        const data = await buildReceiptData(payment, agency ?? null);
        const [{ pdf }, { PaymentReceiptDocument }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/features/payments/components/payment-receipt-document"),
        ]);

        const generated = await (pdf as (doc: React.ReactElement) => { toBlob: () => Promise<Blob> })(
          React.createElement(PaymentReceiptDocument, data),
        ).toBlob();

        objectUrl = URL.createObjectURL(generated);
        setBlob(generated);
        setBlobUrl(objectUrl);
      } catch (err) {
        console.error(err);
        setError("No se pudo generar el PDF del recibo.");
      } finally {
        setIsGenerating(false);
      }
    })();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payment, agency, agencyLoading]);

  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({
        files: [new File([], "test.pdf", { type: "application/pdf" })],
      })
    ) {
      setCanShare(true);
    }
  }, []);

  function getFilename(): string {
    const tenant = slugify(payment.contract?.tenant?.name ?? "inquilino");
    const periodTag = (payment.period ?? "").slice(0, 7).replace("-", "_");
    return `Recibo_${tenant}_${periodTag}.pdf`;
  }

  function handleDownload() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = getFilename();
    a.click();
  }

  async function handleShare() {
    if (!blob) return;
    const filename = getFilename();
    const file = new File([blob], filename, { type: "application/pdf" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
        text: filename,
      });
    } else {
      handleDownload();
    }
  }

  const showSpinner = agencyLoading || isGenerating;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!blobUrl}
          onClick={handleDownload}
        >
          <Download className="h-3.5 w-3.5" />
          Descargar
        </Button>
        {canShare && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!blobUrl}
            onClick={() => void handleShare()}
          >
            <Share2 className="h-3.5 w-3.5" />
            Compartir
          </Button>
        )}
      </div>

      {showSpinner && (
        <div className="flex h-[65vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex h-[65vh] items-center justify-center text-sm text-destructive">
          {error}
        </div>
      )}

      {blobUrl && !showSpinner && (
        <iframe
          src={blobUrl}
          className="h-[65vh] w-full rounded border border-border"
          title="Vista previa del recibo"
        />
      )}
    </div>
  );
}
