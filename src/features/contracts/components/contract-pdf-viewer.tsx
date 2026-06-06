import { useState, useEffect } from "react";
import { Download, Share2, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { ContractWithRelations } from "@/features/contracts/hooks/use-contracts";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { useLogoUrl } from "@/features/agency-profile/hooks/use-logo-url";
import {
  buildContractPdfData,
  buildBlob,
  buildFilename,
} from "./contract-pdf-actions";

interface ContractPdfViewerProps {
  contract: ContractWithRelations;
}

export function ContractPdfViewer({ contract }: ContractPdfViewerProps) {
  const { data: profile, isLoading: profileLoading } = useOrgProfile();
  const { data: logoUrl, isLoading: logoLoading } = useLogoUrl(
    profile?.logo_path,
  );

  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  const isReady = !profileLoading && !logoLoading;

  useEffect(() => {
    if (!isReady) return;

    let objectUrl: string | null = null;
    setIsGenerating(true);
    setError(null);

    void (async () => {
      try {
        const data = buildContractPdfData(
          contract,
          profile ?? null,
          logoUrl ?? null,
        );
        const generated = await buildBlob(data);
        objectUrl = URL.createObjectURL(generated);
        setBlob(generated);
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
  }, [contract, profile, logoUrl, isReady]);

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

  function handleDownload() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = buildFilename(contract);
    a.click();
  }

  async function handleShare() {
    if (!blob) return;
    const filename = buildFilename(contract);
    const file = new File([blob], filename, { type: "application/pdf" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Contrato — ${contract.tenant?.name ?? "inquilino"}`,
      });
    } else {
      handleDownload();
    }
  }

  const showSpinner = !isReady || isGenerating;

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
          title="Vista previa del contrato"
        />
      )}
    </div>
  );
}
