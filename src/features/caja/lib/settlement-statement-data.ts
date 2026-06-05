/**
 * Pure data-mapping / prop-builder for the settlement statement PDF.
 *
 * This module is the single boundary between the DB data and the PDF document.
 * It maps raw Supabase rows + breakdown JSONB into a typed object that
 * settlement-statement-document.tsx renders verbatim (HEADLINE-2 / ADR-5).
 *
 * No network calls, no side-effects — pure function.
 */

import type { SettlementBreakdown } from "@/features/caja/lib/caja-math";
import type { OrgProfileRow } from "@/features/agency-profile/hooks/use-org-profile";

// The extended breakdown as it comes from the sealed DB snapshot.
// `SettlementBreakdown` already has: gross, commission_rate, commission,
// owner_share, deductions, deduction_total, net.
// The sealed JSONB also carries: currency, version, sealed_at, settlement_group, cobro_count.
export interface SealedBreakdown extends SettlementBreakdown {
  currency: string;
  version?: number;
  sealed_at?: string;
  settlement_group?: string;
  cobro_count?: number;
}

export interface StatementData {
  breakdown: SealedBreakdown;
  currency: string;
  agencyName: string;
  address: string;
  cuit: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  ownerName: string;
  settledDate: string;
}

export interface BuildStatementDataInput {
  breakdown: SealedBreakdown;
  agency: OrgProfileRow | null;
  logoUrl: string | null;
  ownerName: string;
  settledDate: string;
}

/**
 * Build the prop object that drives the PDF document.
 *
 * Reads breakdown verbatim — no recomputation (HEADLINE-2).
 * Handles null agency gracefully (R-A22 / R-C2) — every field defaults to "".
 */
export function buildStatementData(input: BuildStatementDataInput): StatementData {
  const { breakdown, agency, logoUrl, ownerName, settledDate } = input;

  return {
    breakdown,
    currency: breakdown.currency,
    agencyName: agency?.legal_name ?? "",
    address: agency?.address ?? "",
    cuit: agency?.cuit ?? "",
    phone: agency?.phone ?? "",
    email: agency?.email ?? "",
    logoUrl: logoUrl ?? null,
    ownerName,
    settledDate,
  };
}

/**
 * Slugify owner name for use in a filename.
 * "Juan Pérez" → "juan-perez"
 */
export function slugifyOwnerName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
