import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatMoney } from "@/features/contracts/lib/contract-labels";
import type { MonthlyBalanceSummary } from "../lib/monthly-balance";

export interface MonthlyReportData {
  agencyName: string;
  address: string;
  periodLabel: string;
  periodYm: string;
  summary: MonthlyBalanceSummary;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 40, color: "#1a1a2e" },
  brand: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center" },
  sub: { fontSize: 9, textAlign: "center", color: "#475569", marginBottom: 4 },
  title: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 6,
  },
  head: { fontFamily: "Helvetica-Bold", backgroundColor: "#f1f5f9" },
  cDate: { width: "12%" },
  cDetail: { width: "48%" },
  cOrigin: { width: "14%" },
  cArs: { width: "13%", textAlign: "right" },
  cUsd: { width: "13%", textAlign: "right" },
  total: {
    marginTop: 10,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textAlign: "right",
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

export function MonthlyReportDocument(data: MonthlyReportData) {
  const { agencyName, address, summary } = data;
  const [mm, yyyy] = data.periodYm.split("-");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>{agencyName || "NODO INMO"}</Text>
        <Text style={styles.sub}>SERVICIOS INMOBILIARIOS</Text>
        {address ? <Text style={styles.sub}>{address}</Text> : null}
        <Text style={styles.title}>
          Historial de Movimientos • Período {mm}/{yyyy}
        </Text>

        <View style={[styles.row, styles.head]}>
          <Text style={styles.cDate}>FECHA</Text>
          <Text style={styles.cDetail}>DETALLE / CONCEPTO</Text>
          <Text style={styles.cOrigin}>ORIGEN</Text>
          <Text style={styles.cArs}>MONTO ARS</Text>
          <Text style={styles.cUsd}>MONTO U$S</Text>
        </View>

        {summary.movements.map((m) => (
          <View key={m.id} style={styles.row}>
            <Text style={styles.cDate}>
              {m.date.slice(8, 10)}/{m.date.slice(5, 7)}
            </Text>
            <Text style={styles.cDetail}>{m.detail}</Text>
            <Text style={styles.cOrigin}>{m.origin}</Text>
            <Text style={styles.cArs}>
              {m.amountArs != null ? formatMoney(m.amountArs, "ARS") : "-"}
            </Text>
            <Text style={styles.cUsd}>
              {m.amountUsd != null ? formatMoney(m.amountUsd, "USD") : "-"}
            </Text>
          </View>
        ))}

        <Text style={styles.total}>
          TOTAL MENSUAL LÍQUIDO: {formatMoney(summary.netoArs, "ARS")}{" "}
          {summary.netoUsd !== 0 ? formatMoney(summary.netoUsd, "USD") : "U$S 0,00"}
        </Text>

        <Text style={styles.footer}>
          Documento interno de control general para el período fiscal indicado.
        </Text>
        <Text style={styles.footer}>
          {agencyName} — Profesionalismo y Confianza.
        </Text>
      </Page>
    </Document>
  );
}
