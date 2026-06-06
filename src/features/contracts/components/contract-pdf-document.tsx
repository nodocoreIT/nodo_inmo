/**
 * Contract PDF document — React-PDF component.
 *
 * IMPORTANT: This module imports @react-pdf/renderer at the top level.
 * It MUST only be loaded via dynamic import() — never statically imported
 * from any file on the admin bundle critical path.
 *
 * The component is pure / presentational: it renders ContractPdfData verbatim.
 * Phase A renders graceful "—" for fields not yet available (owner DNI,
 * property type/rooms/sqm). Phase C will extend buildContractPdfData to fill
 * those in — this document stays unchanged.
 */

// This file must only be dynamically imported — never statically
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { formatDate } from "@/features/contracts/lib/contract-labels";
import {
  CONTRACT_STATUS_LABELS,
  ADJUSTMENT_INDEX_LABELS,
  EXPENSES_PAID_BY_LABELS,
} from "@/features/contracts/lib/contract-labels";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Flat, PDF-ready data shape. Built by buildContractPdfData in contract-pdf-actions. */
export interface ContractPdfData {
  // Agency header
  agencyName: string;
  agencyAddress: string;
  agencyCuit: string;
  agencyPhone: string;
  agencyEmail: string;
  logoUrl: string | null;

  // Parties
  locadorName: string | null;
  locadorDni: string | null;
  tenantName: string | null;
  tenantDni: string | null;
  guarantorCount: number;

  // Property
  propertyAddress: string | null;
  propertyType: string | null;
  propertyRooms: number | null;
  propertySqm: number | null;

  // Contract terms
  startDate: string;
  endDate: string;
  durationMonths: number | null;
  rentAmount: number;
  currency: string;
  adjustmentIndex: string;
  adjustmentPeriodMonths: number;
  nextAdjustmentDate: string | null;
  depositAmount: number | null;
  expensesPaidBy: string | null;
  commissionAmount: number | null;
  status: string;
  notes: string | null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a2e",
    backgroundColor: "#ffffff",
  },
  // Header band
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
  },
  headerLeft: {
    flexDirection: "column",
    gap: 2,
  },
  logo: {
    width: 80,
    height: 40,
    objectFit: "contain",
  },
  agencyName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
  },
  agencyDetail: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },
  // Title section
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: "#475569",
    marginBottom: 2,
  },
  // Section header
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
  },
  // Field rows
  fieldRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  fieldLabel: {
    fontSize: 9,
    color: "#64748b",
    width: 140,
    flexShrink: 0,
  },
  fieldValue: {
    fontSize: 10,
    color: "#1a1a2e",
    flex: 1,
  },
  fieldValueBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    flex: 1,
  },
  // Notes section
  notesBox: {
    marginTop: 16,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    borderRadius: 4,
  },
  notesText: {
    fontSize: 9,
    color: "#475569",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderTopStyle: "solid",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
});

// ─── Money formatter (React-PDF compatible — no Intl formatting needed) ───────

function fmtMoney(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined) return "—";
  const symbol = currency === "USD" ? "US$ " : "$ ";
  const formatted = amount.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted} ${currency}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractPdfDocument(props: ContractPdfData) {
  const {
    agencyName,
    agencyAddress,
    agencyCuit,
    agencyPhone,
    agencyEmail,
    logoUrl,
    locadorName,
    tenantName,
    guarantorCount,
    propertyAddress,
    propertyType,
    propertyRooms,
    propertySqm,
    startDate,
    endDate,
    durationMonths,
    rentAmount,
    currency,
    adjustmentIndex,
    adjustmentPeriodMonths,
    nextAdjustmentDate,
    depositAmount,
    expensesPaidBy,
    commissionAmount,
    status,
    notes,
  } = props;

  const generatedAt = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusLabel = CONTRACT_STATUS_LABELS[status] ?? status;
  const adjustmentLabel =
    ADJUSTMENT_INDEX_LABELS[adjustmentIndex] ?? adjustmentIndex;
  const expensesLabel = expensesPaidBy
    ? (EXPENSES_PAID_BY_LABELS[expensesPaidBy] ?? expensesPaidBy)
    : "—";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {agencyName ? (
              <Text style={styles.agencyName}>{agencyName}</Text>
            ) : null}
            {agencyAddress ? (
              <Text style={styles.agencyDetail}>{agencyAddress}</Text>
            ) : null}
            {agencyCuit ? (
              <Text style={styles.agencyDetail}>CUIT: {agencyCuit}</Text>
            ) : null}
            {agencyPhone ? (
              <Text style={styles.agencyDetail}>Tel: {agencyPhone}</Text>
            ) : null}
            {agencyEmail ? (
              <Text style={styles.agencyDetail}>{agencyEmail}</Text>
            ) : null}
            {!agencyName && !agencyAddress && !agencyCuit ? (
              <Text style={styles.agencyDetail}>—</Text>
            ) : null}
          </View>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
        </View>

        {/* ── Title ──────────────────────────────────────────────────────── */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Contrato de locación</Text>
          <Text style={styles.subtitle}>
            {propertyAddress ?? "—"} · {statusLabel}
          </Text>
        </View>

        {/* ── Partes ─────────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Partes</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Locador</Text>
          <Text style={styles.fieldValue}>{locadorName ?? "—"}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Locatario</Text>
          <Text style={styles.fieldValue}>{tenantName ?? "—"}</Text>
        </View>
        {guarantorCount > 0 ? (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Garantes</Text>
            <Text style={styles.fieldValue}>{guarantorCount} garante(s)</Text>
          </View>
        ) : null}

        {/* ── Inmueble ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Inmueble</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Dirección</Text>
          <Text style={styles.fieldValue}>{propertyAddress ?? "—"}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Tipo</Text>
          <Text style={styles.fieldValue}>{propertyType ?? "—"}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Ambientes</Text>
          <Text style={styles.fieldValue}>
            {propertyRooms !== null && propertyRooms !== undefined
              ? String(propertyRooms)
              : "—"}
          </Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Superficie</Text>
          <Text style={styles.fieldValue}>
            {propertySqm !== null && propertySqm !== undefined
              ? `${propertySqm} m²`
              : "—"}
          </Text>
        </View>

        {/* ── Términos ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Términos</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Inicio</Text>
          <Text style={styles.fieldValue}>{formatDate(startDate)}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Fin</Text>
          <Text style={styles.fieldValue}>{formatDate(endDate)}</Text>
        </View>
        {durationMonths !== null && durationMonths !== undefined ? (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Duración</Text>
            <Text style={styles.fieldValue}>{durationMonths} meses</Text>
          </View>
        ) : null}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Alquiler</Text>
          <Text style={styles.fieldValueBold}>
            {fmtMoney(rentAmount, currency)}
          </Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Ajuste</Text>
          <Text style={styles.fieldValue}>
            {adjustmentLabel} / {adjustmentPeriodMonths} meses
          </Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Próximo ajuste</Text>
          <Text style={styles.fieldValue}>
            {nextAdjustmentDate ? formatDate(nextAdjustmentDate) : "—"}
          </Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Depósito</Text>
          <Text style={styles.fieldValue}>
            {fmtMoney(depositAmount, currency)}
          </Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Expensas a cargo de</Text>
          <Text style={styles.fieldValue}>{expensesLabel}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Comisión agencia</Text>
          <Text style={styles.fieldValue}>
            {fmtMoney(commissionAmount, currency)}
          </Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Estado</Text>
          <Text style={styles.fieldValue}>{statusLabel}</Text>
        </View>

        {/* ── Notas ──────────────────────────────────────────────────────── */}
        {notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.sectionHeader}>Notas</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generado el {generatedAt}</Text>
          <Text style={styles.footerText}>
            Documento generado automáticamente
          </Text>
        </View>
      </Page>
    </Document>
  );
}
