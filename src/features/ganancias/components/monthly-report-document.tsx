import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { formatMoney } from "@/features/contracts/lib/contract-labels";
import type { MonthlyBalanceSummary } from "../lib/monthly-balance";

export interface MonthlyReportData {
  agencyName: string;
  address: string;
  periodLabel: string;
  periodYm: string;
  summary: MonthlyBalanceSummary;
  logoUrl?: string | null;
}

const BRAND = "#1a4d3e";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 40, color: "#1a1a2e" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
  },
  logo: { width: 72, height: 48, objectFit: "contain" },
  brand: { fontSize: 14, fontFamily: "Helvetica-Bold", color: BRAND },
  sub: { fontSize: 9, color: "#475569", marginTop: 2 },
  title: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 14,
    color: BRAND,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 5,
  },
  head: { fontFamily: "Helvetica-Bold", backgroundColor: "#f1f5f9" },
  cDate: { width: "10%" },
  cDetail: { width: "36%" },
  cOrigin: { width: "12%" },
  cAccount: { width: "16%" },
  cArs: { width: "13%", textAlign: "right" },
  cUsd: { width: "13%", textAlign: "right" },
  total: {
    marginTop: 10,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textAlign: "right",
    color: BRAND,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
  },
});

function amountStyle(value: number | null) {
  if (value != null && value < 0) return { color: "#dc2626" };
  return {};
}

export function MonthlyReportDocument(data: MonthlyReportData) {
  const { agencyName, address, summary, logoUrl } = data;
  const [mm, yyyy] = data.periodYm.split("-");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{agencyName || "NODO INMO"}</Text>
            <Text style={styles.sub}>SERVICIOS INMOBILIARIOS</Text>
            {address ? <Text style={styles.sub}>{address}</Text> : null}
          </View>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
        </View>

        <Text style={styles.title}>
          Balance mensual — Período {mm}/{yyyy}
        </Text>

        <View style={[styles.row, styles.head]}>
          <Text style={styles.cDate}>FECHA</Text>
          <Text style={styles.cDetail}>DETALLE</Text>
          <Text style={styles.cOrigin}>ORIGEN</Text>
          <Text style={styles.cAccount}>CUENTA</Text>
          <Text style={styles.cArs}>ARS</Text>
          <Text style={styles.cUsd}>U$S</Text>
        </View>

        {summary.movements.map((m) => (
          <View key={m.id} style={styles.row}>
            <Text style={styles.cDate}>
              {m.date.slice(8, 10)}/{m.date.slice(5, 7)}
            </Text>
            <Text style={styles.cDetail}>{m.detail}</Text>
            <Text style={styles.cOrigin}>{m.origin}</Text>
            <Text style={styles.cAccount}>{m.account}</Text>
            <Text style={[styles.cArs, amountStyle(m.amountArs)]}>
              {m.amountArs != null ? formatMoney(m.amountArs, "ARS") : "-"}
            </Text>
            <Text style={[styles.cUsd, amountStyle(m.amountUsd)]}>
              {m.amountUsd != null ? formatMoney(m.amountUsd, "USD") : "-"}
            </Text>
          </View>
        ))}

        <Text style={styles.total}>
          NETO MENSUAL: {formatMoney(summary.netoArs, "ARS")}
          {summary.netoUsd !== 0 ? ` · ${formatMoney(summary.netoUsd, "USD")}` : ""}
        </Text>

        <Text style={styles.footer}>
          {agencyName} — Documento interno de control.
        </Text>
      </Page>
    </Document>
  );
}
