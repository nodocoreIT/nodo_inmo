/**
 * Settlement statement PDF document — React-PDF component.
 *
 * IMPORTANT: This module imports @react-pdf/renderer at the top level.
 * It MUST only be loaded via dynamic import() — never statically imported
 * from any file on the admin bundle critical path. (R-C1 / design §6.3)
 *
 * The component is pure / presentational: it reads the sealed breakdown
 * verbatim and never re-computes amounts (HEADLINE-2 / ADR-5).
 *
 * Graceful placeholders ("—") when agency profile fields are absent (R-C2 / R-A22).
 */

import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { StatementData } from "@/features/caja/lib/settlement-statement-data";
import { formatDate } from "@/features/contracts/lib/contract-labels";

// ─── Styles ───────────────────────────────────────────────────────────────────

const BRAND = "#1a4d3e";

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
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
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
    color: BRAND,
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
    color: BRAND,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: "#475569",
    marginBottom: 2,
  },
  // Table
  table: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableRowLast: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableRowTotal: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderTopWidth: 2,
    borderTopColor: "#cbd5e1",
    borderTopStyle: "solid",
  },
  tableRowDeduction: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    borderBottomStyle: "solid",
    paddingVertical: 6,
    paddingHorizontal: 12,
    paddingLeft: 24,
  },
  cellLabel: {
    flex: 1,
    fontSize: 10,
    color: "#334155",
  },
  cellLabelBold: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
  },
  cellLabelDeduction: {
    flex: 1,
    fontSize: 9,
    color: "#64748b",
  },
  cellAmount: {
    fontSize: 10,
    color: "#334155",
    textAlign: "right",
    minWidth: 100,
  },
  cellAmountBold: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    textAlign: "right",
    minWidth: 100,
  },
  cellAmountDeduction: {
    fontSize: 9,
    color: "#64748b",
    textAlign: "right",
    minWidth: 100,
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

function fmtAmount(amount: number, currency: string): string {
  const symbol = currency === "USD" ? "US$ " : "$ ";
  const formatted = amount.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted} ${currency}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettlementStatementDocument(props: StatementData) {
  const {
    breakdown,
    currency,
    agencyName,
    address,
    cuit,
    phone,
    email,
    logoUrl,
    ownerName,
    settledDate,
  } = props;

  const generatedAt = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {agencyName ? (
              <Text style={styles.agencyName}>{agencyName}</Text>
            ) : null}
            {address ? (
              <Text style={styles.agencyDetail}>{address}</Text>
            ) : null}
            {cuit ? (
              <Text style={styles.agencyDetail}>CUIT: {cuit}</Text>
            ) : null}
            {phone ? (
              <Text style={styles.agencyDetail}>Tel: {phone}</Text>
            ) : null}
            {email ? (
              <Text style={styles.agencyDetail}>{email}</Text>
            ) : null}
            {!agencyName && !address && !cuit ? (
              <Text style={styles.agencyDetail}>—</Text>
            ) : null}
          </View>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.logo} />
          ) : null}
        </View>

        {/* ── Title + meta ────────────────────────────────────────────────── */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>
            Liquidación de Cobranzas y Rendición de Cuentas
          </Text>
          <Text style={styles.subtitle}>PROPIETARIO: {ownerName}</Text>
          <Text style={styles.subtitle}>
            FECHA DE EMISIÓN: {formatDate(settledDate)}
          </Text>
        </View>

        {/* ── Breakdown table ─────────────────────────────────────────────── */}
        <View style={styles.table}>
          {/* Row 1: Gross */}
          <View style={styles.tableRow}>
            <Text style={styles.cellLabel}>Bruto cobrado</Text>
            <Text style={styles.cellAmount}>
              {fmtAmount(breakdown.gross, currency)}
            </Text>
          </View>

          {/* Row 2: Commission */}
          <View style={styles.tableRow}>
            <Text style={styles.cellLabel}>
              Comisión ({breakdown.commission_rate}%)
            </Text>
            <Text style={styles.cellAmount}>
              − {fmtAmount(breakdown.commission, currency)}
            </Text>
          </View>

          {/* Row 3: Owner share subtotal */}
          <View style={styles.tableRow}>
            <Text style={styles.cellLabel}>Subtotal propietario</Text>
            <Text style={styles.cellAmount}>
              {fmtAmount(breakdown.owner_share, currency)}
            </Text>
          </View>

          {/* Deductions */}
          {breakdown.deductions.map((d, i) => (
            <View
              key={d.id ?? i}
              style={styles.tableRowDeduction}
            >
              <Text style={styles.cellLabelDeduction}>
                {d.description} ({formatDate(d.expense_date)})
              </Text>
              <Text style={styles.cellAmountDeduction}>
                − {fmtAmount(d.amount, currency)}
              </Text>
            </View>
          ))}

          {/* Deduction total (only if there are deductions) */}
          {breakdown.deductions.length > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.cellLabel}>Total deducciones</Text>
              <Text style={styles.cellAmount}>
                − {fmtAmount(breakdown.deduction_total, currency)}
              </Text>
            </View>
          )}

          {/* Net total (bold, highlighted) */}
          <View style={styles.tableRowTotal}>
            <Text style={styles.cellLabelBold}>SALDO NETO A PERCIBIR</Text>
            <Text style={styles.cellAmountBold}>
              {fmtAmount(breakdown.net, currency)}
            </Text>
          </View>
        </View>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generado el {generatedAt}</Text>
          <Text style={styles.footerText}>
            Documento generado automáticamente — no requiere firma
          </Text>
        </View>
      </Page>
    </Document>
  );
}
