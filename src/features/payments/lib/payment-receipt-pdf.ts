import React from "react";
import type { PaymentReceiptData } from "../components/payment-receipt-document";
import type { PaymentWithRelations } from "../hooks/use-payments";

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").slice(0, 30);
}

export function buildReceiptData(
  payment: PaymentWithRelations,
  agency: { legal_name?: string | null; address?: string | null } | null,
): PaymentReceiptData {
  return {
    agencyName: agency?.legal_name ?? "NODO INMO",
    address: agency?.address ?? "",
    receiptNumber: payment.id.slice(0, 4).toUpperCase(),
    paidDate: payment.paid_date ?? new Date().toISOString().slice(0, 10),
    tenantName: payment.contract?.tenant?.name ?? "—",
    propertyAddress: payment.contract?.property?.address ?? "—",
    period: payment.period,
    paymentMethod: payment.payment_method ?? "Efectivo",
    rentAmount: payment.paid_amount ?? payment.amount,
    currency: payment.currency,
  };
}

export async function downloadPaymentReceipt(
  payment: PaymentWithRelations,
  agency: { legal_name?: string | null; address?: string | null } | null,
): Promise<void> {
  const data = buildReceiptData(payment, agency);
  const [{ pdf }, { PaymentReceiptDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/features/payments/components/payment-receipt-document"),
  ]);

  const blob = await (pdf as (doc: React.ReactElement) => { toBlob: () => Promise<Blob> })(
    React.createElement(PaymentReceiptDocument, data),
  ).toBlob();

  const tenant = slugify(data.tenantName);
  const periodTag = data.period.slice(0, 7).replace("-", "_");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Recibo_${tenant}_${periodTag}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
