/**
 * contract-locacion-data — pure mapper between DB rows and the ContractLocación PDF.
 *
 * This is the single boundary between ContractWithRelations and ContractDocumentData.
 * All null-coalescing happens here so the React-PDF component stays presentational
 * and unit-testable without network or Supabase mocks. (ADR-4 / HEADLINE-1)
 */

import type { ContractWithRelations } from "@/features/contracts/hooks/use-contracts";
import type { OrgProfileRow } from "@/features/agency-profile/hooks/use-org-profile";
import {
  CONTRACT_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  ADJUSTMENT_INDEX_LABELS,
  EXPENSES_PAID_BY_LABELS,
  formatDate,
} from "./contract-labels";

// ── Exported interfaces ────────────────────────────────────────────────────────

export interface ContractParty {
  name: string;
  dni: string;     // "" when null → renderer prints "—"
  address: string;
}

export interface ContractDocumentData {
  // Agency header
  agencyName: string;
  agencyAddress: string;
  cuit: string;
  logoUrl: string | null;
  // Type + meta
  contractType: "habitacional" | "comercial";
  contractTypeLabel: string;       // "Habitacional" | "Comercial"
  // Parties
  locador: ContractParty;          // property owner
  locatario: ContractParty;        // tenant
  garantes: ContractParty[];
  // Objeto
  propertyAddress: string;
  propertyTypeLabel: string;       // "Departamento" | "Casa" | "Local comercial" | ...
  rooms: string;                   // "" when null
  sqm: string;                     // "120.00" or ""
  inventoryDescription: string;    // "" when null
  // Plazo
  startDate: string;               // dd/mm/yyyy
  endDate: string;                 // dd/mm/yyyy
  durationMonths: number;          // computed from start/end
  legalMinNote: string;            // "El plazo mínimo legal es de N años (Ley 27.551)."
  // Canon
  rentAmount: string;              // "$ 250.000 ARS"
  currency: string;
  adjustmentIndexLabel: string;    // "IPC" | "ICL" | "Fijo" | "Dólar"
  adjustmentPeriodMonths: number;
  // Depósito
  depositAmount: string;           // "$ 250.000 ARS" or "—"
  // Servicios
  expensesPaidByLabel: string;     // "Inquilino" | "Propietario"
  // Firma
  signingCity: string;             // signing_city or "" → "____"
  signingDate: string;             // dd/mm/yyyy or "" → "____"
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Month delta between two ISO date strings (rounded to whole months). */
function monthsBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const delta =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  return Math.max(0, delta);
}

/** Format an amount for the PDF (es-AR locale, currency symbol prefix). */
function fmtAmount(amount: number, currency: string): string {
  const symbol = currency === "USD" ? "US$ " : "$ ";
  const formatted = amount.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted} ${currency}`;
}

/** Build a URL-friendly slug from a string (for filenames). */
export function slugifyContractName(contract: ContractWithRelations): string {
  const tenant = contract.tenant?.name ?? "inquilino";
  const property = contract.property?.address ?? "propiedad";
  return [tenant, property]
    .map((s) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .join("-");
}

function legalMinNote(contractType: string): string {
  if (contractType === "comercial") {
    return "El plazo mínimo legal para destino comercial es de DOS (2) años (art. 1198 CCCN).";
  }
  return "El plazo mínimo legal para destino habitacional es de TRES (3) años (art. 1198 CCCN, Ley 27.551).";
}

function toParty(
  contact: { name: string; dni: string | null; address: string | null } | null | undefined,
): ContractParty {
  return {
    name: contact?.name ?? "",
    dni: contact?.dni ?? "",
    address: contact?.address ?? "",
  };
}

// ── Main mapper ────────────────────────────────────────────────────────────────

export function buildContractDocumentData(input: {
  contract: ContractWithRelations;
  agency: OrgProfileRow | null;
  logoUrl: string | null;
}): ContractDocumentData {
  const { contract, agency, logoUrl } = input;

  const contractType = (contract.contract_type as "habitacional" | "comercial") ?? "habitacional";

  // Deposit
  const depositAmount =
    contract.deposit_amount != null
      ? fmtAmount(contract.deposit_amount, contract.currency)
      : "—";

  // Property fields
  const prop = contract.property;
  const sqmRaw = prop?.total_sqm;
  const sqm =
    sqmRaw != null
      ? sqmRaw.toFixed(2)
      : "";

  return {
    // Agency
    agencyName: agency?.legal_name ?? "",
    agencyAddress: agency?.address ?? "",
    cuit: agency?.cuit ?? "",
    logoUrl: logoUrl ?? null,

    // Type
    contractType,
    contractTypeLabel: CONTRACT_TYPE_LABELS[contractType] ?? contractType,

    // Parties
    locador: toParty(prop?.owner),
    locatario: toParty(contract.tenant),
    garantes: (contract.guarantors ?? []).map((g) => toParty(g.guarantor)),

    // Objeto
    propertyAddress: prop?.address ?? "",
    propertyTypeLabel: prop?.property_type
      ? (PROPERTY_TYPE_LABELS[prop.property_type] ?? prop.property_type)
      : "",
    rooms: prop?.rooms != null ? String(prop.rooms) : "",
    sqm,
    inventoryDescription: prop?.inventory_description ?? "",

    // Plazo
    startDate: formatDate(contract.start_date),
    endDate: formatDate(contract.end_date),
    durationMonths: monthsBetween(contract.start_date, contract.end_date),
    legalMinNote: legalMinNote(contractType),

    // Canon
    rentAmount: fmtAmount(contract.rent_amount, contract.currency),
    currency: contract.currency,
    adjustmentIndexLabel:
      ADJUSTMENT_INDEX_LABELS[contract.adjustment_index] ?? contract.adjustment_index,
    adjustmentPeriodMonths: contract.adjustment_period_months,

    // Depósito
    depositAmount,

    // Servicios
    expensesPaidByLabel:
      EXPENSES_PAID_BY_LABELS[contract.expenses_paid_by] ?? contract.expenses_paid_by,

    // Firma
    signingCity: contract.signing_city ?? "",
    signingDate: formatDate(contract.signing_date),
  };
}
