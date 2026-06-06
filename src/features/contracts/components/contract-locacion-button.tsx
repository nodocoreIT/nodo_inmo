/**
 * ContractLocacionButton — "Generar contrato" action button for contracts.
 *
 * Self-contained: owns branding hooks, mapper call, and download/share glue.
 * Reused by contracts-list (Phase A) and documentos-page (Phase B).
 *
 * @react-pdf/renderer is NEVER statically imported here. It loads ONLY
 * via dynamic import() inside the action functions. (HEADLINE-2 / ADR-6)
 */

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { ContractWithRelations } from "@/features/contracts/hooks/use-contracts";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { useLogoUrl } from "@/features/agency-profile/hooks/use-logo-url";
import { buildContractDocumentData } from "@/features/contracts/lib/contract-locacion-data";
import {
  handleDownload,
  handleShare,
} from "@/features/contracts/lib/contract-locacion-actions";

interface ContractLocacionButtonProps {
  contract: ContractWithRelations;
}

export function ContractLocacionButton({ contract }: ContractLocacionButtonProps) {
  const { data: profile } = useOrgProfile();
  const { data: logoUrl } = useLogoUrl(profile?.logo_path);
  const [isGenerating, setIsGenerating] = useState(false);

  function buildData() {
    return buildContractDocumentData({
      contract,
      agency: profile ?? null,
      logoUrl: logoUrl ?? null,
    });
  }

  async function onDownload() {
    setIsGenerating(true);
    try {
      await handleDownload(buildData());
    } finally {
      setIsGenerating(false);
    }
  }

  async function onShare() {
    setIsGenerating(true);
    try {
      await handleShare(buildData());
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Generar contrato"
      title="Generar contrato"
      disabled={isGenerating}
      onClick={() => void onDownload()}
      onContextMenu={(e) => {
        e.preventDefault();
        void onShare();
      }}
    >
      <FileText className="h-4 w-4" />
      <span className="sr-only">Generar contrato</span>
    </Button>
  );
}
