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
  rentAmount: number;
  currency: string;
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
  total: {
    marginTop: 16,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
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
          Alquiler correspondiente al mes de {formatPeriod(data.period)}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>PROPIEDAD: </Text>
          {data.propertyAddress}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>FORMA DE PAGO: </Text>
          {data.paymentMethod || "Efectivo"}
        </Text>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.line}>
            DETALLE: Alquiler: {formatMoney(data.rentAmount, data.currency)}
          </Text>
        </View>

        <Text style={styles.total}>
          TOTAL RECIBIDO: {formatMoney(data.rentAmount, data.currency)}
        </Text>

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
