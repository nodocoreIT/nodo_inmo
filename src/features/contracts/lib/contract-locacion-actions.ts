/**
 * PDF download + Web Share actions for the "Contrato de Locación".
 *
 * @react-pdf/renderer and the document component are loaded via DYNAMIC import
 * inside buildBlob — they are never in the static admin bundle. (HEADLINE-2 / ADR-6)
 *
 * Download: pdf().toBlob() → object URL → anchor click → revoke.
 * Share: navigator.share({ files }) when available; falls back to download on desktop.
 */

import React from "react";
import type { ContractDocumentData } from "./contract-locacion-data";

/** Build the canonical filename for a contract PDF. */
export function buildFilename(data: ContractDocumentData): string {
  function slugify(s: string): string {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const tenantSlug = slugify(data.locatario.name || "inquilino");
  const propertySlug = slugify(data.propertyAddress || "propiedad");
  return `contrato-locacion-${tenantSlug}-${propertySlug}.pdf`;
}

/** Build the PDF blob. Dynamic imports for bundle isolation. */
async function buildBlob(data: ContractDocumentData): Promise<Blob> {
  const [{ pdf }, { ContractLocacionDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/features/contracts/components/contract-locacion-document"),
  ]);

  return (pdf as (doc: React.ReactElement) => { toBlob: () => Promise<Blob> })(
    React.createElement(ContractLocacionDocument, data),
  ).toBlob();
}

/**
 * Download the contract PDF via a programmatic anchor click.
 */
export async function handleDownload(data: ContractDocumentData): Promise<void> {
  const blob = await buildBlob(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildFilename(data);
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Share the contract PDF via the Web Share API when available.
 * Falls back gracefully to download on desktop.
 */
export async function handleShare(data: ContractDocumentData): Promise<void> {
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
      title: `Contrato de Locación — ${data.locatario.name || "inquilino"}`,
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
