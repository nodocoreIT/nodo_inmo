/**
 * PDF download + Web Share actions for the settlement comprobante.
 *
 * @react-pdf/renderer and the document component are loaded via DYNAMIC import
 * inside each action — they are never in the static admin bundle. (R-C1)
 *
 * Download: pdf().toBlob() → object URL → anchor click → revoke. (R-C7 / R-C8)
 * Share: navigator.share({ files }) when available; falls back to download. (R-C9 / R-C10 / R-C11)
 */

import React from "react";
import type { StatementData } from "./settlement-statement-data";
import { slugifyOwnerName } from "./settlement-statement-data";

/** Build the PDF blob from the statement data. Dynamic imports for bundle isolation. */
export async function buildBlob(data: StatementData): Promise<Blob> {
  const [{ pdf }, { SettlementStatementDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/features/caja/components/settlement-statement-document"),
  ]);

  return (pdf as (doc: React.ReactElement) => { toBlob: () => Promise<Blob> })(
    React.createElement(SettlementStatementDocument, data),
  ).toBlob();
}

/** Build the canonical filename for a settlement PDF. (R-C8) */
export function buildFilename(data: StatementData): string {
  const slug = slugifyOwnerName(data.ownerName);
  return `liquidacion-${slug}-${data.currency}.pdf`;
}

/**
 * Download the settlement PDF via a programmatic anchor click. (R-C7 / R-C8)
 */
export async function handleDownload(data: StatementData): Promise<void> {
  const blob = await buildBlob(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildFilename(data);
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Share the settlement PDF via the Web Share API when available.
 * Falls back gracefully to download on desktop (no throw). (R-C9 / R-C10 / R-C11)
 */
export async function handleShare(data: StatementData): Promise<void> {
  const blob = await buildBlob(data);
  const filename = buildFilename(data);
  const file = new File([blob], filename, { type: "application/pdf" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title: `Liquidación — ${data.ownerName}`,
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
}
