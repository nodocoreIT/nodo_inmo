import { Download, Share2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { useLogoUrl } from "@/features/agency-profile/hooks/use-logo-url";
import {
  buildStatementData,
} from "@/features/caja/lib/settlement-statement-data";
import {
  handleDownload,
  handleShare,
} from "@/features/caja/lib/settlement-pdf-actions";
import type { SealedGroup } from "@/features/caja/lib/caja-math";

/**
 * Action buttons (Descargar / Compartir) for a sealed settlement.
 *
 * Reads only the stored breakdown from the group — no recomputation.
 * Can be used from any tab that has a SealedGroup reference (design D5).
 */
export function SealedSettlementActions({ group }: { group: SealedGroup }) {
  const { data: agency } = useOrgProfile();
  const { data: logoUrl } = useLogoUrl(agency?.logo_path);

  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([], "test.pdf", { type: "application/pdf" })] });

  function buildData() {
    return buildStatementData({
      breakdown: group.breakdown,
      agency: agency ?? null,
      logoUrl: logoUrl ?? null,
      ownerName: group.owner_name,
      settledDate: group.settled_date,
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => void handleDownload(buildData())}
      >
        <Download className="h-3.5 w-3.5" />
        Descargar
      </Button>
      {canShare && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void handleShare(buildData())}
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartir
        </Button>
      )}
    </div>
  );
}
