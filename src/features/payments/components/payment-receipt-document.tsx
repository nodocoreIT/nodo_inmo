import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatMoney, formatDate } from "@/features/contracts/lib/contract-labels";
import { formatPeriod } from "../lib/payment-labels";

export interface PaymentReceiptData {
  agencyName: string;
  address: string;
  receiptNumber: string;
  paidDate: string;
  tenantName: string;
  propertyAddress: string;
  period: string;
  paymentMethod: string;
  currency: string;
  rentAmount: number;
  expensesAmount: number;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  ownerShare: number;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 48, color: "#1a1a2e" },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center" },
  sub: { fontSize: 9, textAlign: "center", color: "#475569" },
  title: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  line: { marginBottom: 6 },
  label: { fontFamily: "Helvetica-Bold" },
  detailBox: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    borderRadius: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  detailLabel: { fontSize: 10, color: "#334155" },
  detailAmount: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    borderTopStyle: "solid",
    marginVertical: 8,
  },
  total: {
    marginTop: 16,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  adminSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  adminTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#64748b",
    textAlign: "center",
  },
});

export function PaymentReceiptDocument(data: PaymentReceiptData) {
  const hasExpenses = data.expensesAmount > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>{data.agencyName}</Text>
        <Text style={styles.sub}>SERVICIOS INMOBILIARIOS</Text>
        {data.address ? <Text style={styles.sub}>{data.address}</Text> : null}
        <Text style={styles.title}>RECIBO DE PAGO #{data.receiptNumber}</Text>

        <Text style={styles.line}>
          <Text style={styles.label}>FECHA: </Text>
          {formatDate(data.paidDate)}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>RECIBIMOS DE: </Text>
          {data.tenantName}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>CONCEPTO: </Text>
          Alquiler y cargos del mes de {formatPeriod(data.period)}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>PROPIEDAD: </Text>
          {data.propertyAddress}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>CUENTA / FORMA DE PAGO: </Text>
          {data.paymentMethod || "Transferencia"}
        </Text>

        <View style={styles.detailBox}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 8 }}>DETALLE DEL COBRO</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Alquiler ({formatPeriod(data.period)})</Text>
            <Text style={styles.detailAmount}>
              {formatMoney(data.rentAmount, data.currency)}
            </Text>
          </View>
          {hasExpenses ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expensas / Otros</Text>
              <Text style={styles.detailAmount}>
                {formatMoney(data.expensesAmount, data.currency)}
              </Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={{ ...styles.detailLabel, fontFamily: "Helvetica-Bold" }}>
              TOTAL RECIBIDO
            </Text>
            <Text style={styles.detailAmount}>
              {formatMoney(data.grossAmount, data.currency)}
            </Text>
          </View>
        </View>

        <View style={styles.adminSection}>
          <Text style={styles.adminTitle}>Desglose administrativo</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              Comisión inmobiliaria ({data.commissionRate}%)
            </Text>
            <Text style={styles.detailAmount}>
              {formatMoney(data.commissionAmount, data.currency)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Neto propietario</Text>
            <Text style={styles.detailAmount}>
              {formatMoney(data.ownerShare, data.currency)}
            </Text>
          </View>
        </View>

        <Text style={{ marginTop: 40, textAlign: "center" }}>
          Firma y Sello Aclaratorio
        </Text>

        <Text style={styles.footer}>
          Documento no válido como factura. Comprobante de recepción de fondos para
          el período indicado.
        </Text>
        <Text style={styles.footer}>{data.agencyName} — Profesionalismo y Confianza.</Text>
      </Page>
    </Document>
  );
}
