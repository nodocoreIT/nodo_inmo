/**
 * ContractPdfActions — Download + Share buttons for a contract PDF.
 *
 * Self-contained component: owns branding hooks, prop-builder, and
 * download/share glue. Two callers (Eye dialog in contracts-list,
 * DocumentosPage table) get identical button cluster + branding for free.
 *
 * @react-pdf/renderer is NEVER statically imported here. It loads ONLY
 * via dynamic import() inside buildBlob — bundle isolation preserved.
 */

import React, { useState, useEffect } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { ContractWithRelations } from "@/features/contracts/hooks/use-contracts";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import type { OrgProfileRow } from "@/features/agency-profile/hooks/use-org-profile";
import { useLogoUrl } from "@/features/agency-profile/hooks/use-logo-url";
import { slugifyOwnerName } from "@/features/caja/lib/settlement-statement-data";
import type { ContractPdfData } from "./contract-pdf-document";

// ─── Prop-builder ─────────────────────────────────────────────────────────────

/**
 * Maps ContractWithRelations + agency profile → flat ContractPdfData.
 * This is the single DB→PDF boundary. Phase C extends this builder when
 * owner joins + party DNIs become available. The document stays unchanged.
 */
export function buildContractPdfData(
  contract: ContractWithRelations,
  agency: OrgProfileRow | null,
  logoUrl: string | null,
): ContractPdfData {
  // Derive duration in months between start and end
  let durationMonths: number | null = null;
  if (contract.start_date && contract.end_date) {
    const start = new Date(contract.start_date);
    const end = new Date(contract.end_date);
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    durationMonths = months > 0 ? months : null;
  }

  return {
    // Agency (graceful empty strings when null)
    agencyName: agency?.legal_name ?? "",
    agencyAddress: agency?.address ?? "",
    agencyCuit: agency?.cuit ?? "",
    agencyPhone: agency?.phone ?? "",
    agencyEmail: agency?.email ?? "",
    logoUrl: logoUrl ?? null,

    // Parties — Phase A: locador and DNIs not yet in the query
    locadorName: null,
    locadorDni: null,
    tenantName: contract.tenant?.name ?? null,
    tenantDni: null,
    guarantorCount: contract.guarantors?.length ?? 0,

    // Property — Phase A: type/rooms/sqm not yet in the query
    propertyAddress: contract.property?.address ?? null,
    propertyType: null,
    propertyRooms: null,
    propertySqm: null,

    // Contract terms
    startDate: contract.start_date,
    endDate: contract.end_date,
    durationMonths,
    rentAmount: contract.rent_amount,
    currency: contract.currency,
    adjustmentIndex: contract.adjustment_index,
    adjustmentPeriodMonths: contract.adjustment_period_months,
    nextAdjustmentDate: contract.next_adjustment_date ?? null,
    depositAmount: contract.deposit_amount ?? null,
    expensesPaidBy: contract.expenses_paid_by ?? null,
    commissionAmount: contract.commission_amount ?? null,
    status: contract.status,
    notes: contract.notes ?? null,
  };
}

// ─── Blob builder (dynamic imports — bundle isolation) ────────────────────────

export async function buildBlob(data: ContractPdfData): Promise<Blob> {
  const [{ pdf }, { ContractPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./contract-pdf-document"),
  ]);

  return (pdf as (doc: React.ReactElement) => { toBlob: () => Promise<Blob> })(
    React.createElement(ContractPdfDocument, data),
  ).toBlob();
}

export function buildFilename(contract: ContractWithRelations): string {
  const tenantSlug = slugifyOwnerName(contract.tenant?.name ?? "inquilino");
  const propertySlug = slugifyOwnerName(
    contract.property?.address ?? "propiedad",
  );
  return `contrato-${tenantSlug}-${propertySlug}.pdf`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ContractPdfActionsProps {
  contract: ContractWithRelations;
}

export function ContractPdfActions({ contract }: ContractPdfActionsProps) {
  const { data: profile } = useOrgProfile();
  const { data: logoUrl } = useLogoUrl(profile?.logo_path);

  const [canShare, setCanShare] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Compute canShare on mount (avoids SSR/jsdom flakiness)
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

  function buildData() {
    return buildContractPdfData(contract, profile ?? null, logoUrl ?? null);
  }

  async function handleDownload() {
    setIsGenerating(true);
    try {
      const data = buildData();
      const blob = await buildBlob(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename(contract);
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleShare() {
    setIsGenerating(true);
    try {
      const data = buildData();
      const blob = await buildBlob(data);
      const filename = buildFilename(contract);
      const file = new File([blob], filename, { type: "application/pdf" });

      if (
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Contrato — ${contract.tenant?.name ?? "inquilino"}`,
        });
      } else {
        // Desktop fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={isGenerating}
        onClick={() => void handleDownload()}
      >
        <Download className="h-3.5 w-3.5" />
        Descargar PDF
      </Button>
      {canShare && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isGenerating}
          onClick={() => void handleShare()}
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartir
        </Button>
      )}
    </div>
  );
}
