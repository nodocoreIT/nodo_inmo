import { useState, useEffect } from "react";
import { Download, Share2, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { useLogoUrl } from "@/features/agency-profile/hooks/use-logo-url";
import type { MonthlyReportData } from "./monthly-report-document";
import {
  downloadMonthlyReport,
  shareMonthlyReport,
} from "../lib/monthly-report-pdf";

interface MonthlyReportPdfViewerProps {
  data: MonthlyReportData;
}

async function buildBlob(data: MonthlyReportData, logoUrl: string | null): Promise<Blob> {
  const [{ pdf }, { MonthlyReportDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/features/ganancias/components/monthly-report-document"),
  ]);
  const React = await import("react");
  return (pdf as (doc: React.ReactElement) => { toBlob: () => Promise<Blob> })(
    React.createElement(MonthlyReportDocument, { ...data, logoUrl }),
  ).toBlob();
}

export function MonthlyReportPdfViewer({ data }: MonthlyReportPdfViewerProps) {
  const { data: profile, isLoading: profileLoading } = useOrgProfile();
  const { data: logoUrl, isLoading: logoLoading } = useLogoUrl(profile?.logo_path);

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
        const enriched = {
          ...data,
          agencyName: profile?.legal_name ?? data.agencyName,
          address: profile?.address ?? data.address,
        };
        const generated = await buildBlob(enriched, logoUrl ?? null);
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
  }, [data, profile, logoUrl, isReady]);

  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [new File([], "test.pdf", { type: "application/pdf" })] })
    ) {
      setCanShare(true);
    }
  }, []);

  if (isGenerating || !isReady) {
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
          onClick={() => void downloadMonthlyReport(data)}
        >
          <Download className="h-4 w-4" />
          Descargar
        </Button>
        {canShare && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void shareMonthlyReport(data)}
          >
            <Share2 className="h-4 w-4" />
            Compartir
          </Button>
        )}
      </div>
      {blobUrl ? (
        <iframe
          title="Vista previa balance mensual"
          src={blobUrl}
          className="h-full w-full rounded-md border border-border"
        />
      ) : null}
    </div>
  );
}
