import React from "react";
import { supabase } from "@/shared/lib/supabase";
import type { PaymentReceiptData } from "../components/payment-receipt-document";
import type { PaymentWithRelations } from "../hooks/use-payments";
import { buildCobroBreakdown } from "./cobro-breakdown";

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").slice(0, 30);
}

export async function buildReceiptData(
  payment: PaymentWithRelations,
  agency: { legal_name?: string | null; address?: string | null } | null,
): Promise<PaymentReceiptData> {
  let commissionFromCaja: number | null = null;
  let accountLabel: string | null = null;

  if (payment.status === "paid") {
    const { data } = await supabase
      .schema("nodo_inmo")
      .from("cash_movements")
      .select("amount, category")
      .eq("payment_id", payment.id)
      .eq("source", "commission")
      .limit(1)
      .maybeSingle();

    commissionFromCaja = data?.amount ?? null;
    accountLabel = data?.category ?? null;
  }

  const breakdown = buildCobroBreakdown(payment, commissionFromCaja);

  return {
    agencyName: agency?.legal_name ?? "NODO INMO",
    address: agency?.address ?? "",
    receiptNumber: payment.id.slice(0, 4).toUpperCase(),
    paidDate: payment.paid_date ?? new Date().toISOString().slice(0, 10),
    tenantName: payment.contract?.tenant?.name ?? "—",
    propertyAddress: payment.contract?.property?.address ?? "—",
    period: payment.period,
    paymentMethod: accountLabel ?? payment.payment_method ?? "Transferencia",
    currency: payment.currency,
    rentAmount: breakdown.rentAmount,
    expensesAmount: breakdown.expensesAmount,
    grossAmount: breakdown.grossAmount,
    commissionRate: breakdown.commissionRate,
    commissionAmount: breakdown.commissionAmount,
    ownerShare: breakdown.ownerShare,
  };
}

export async function downloadPaymentReceipt(
  payment: PaymentWithRelations,
  agency: { legal_name?: string | null; address?: string | null } | null,
): Promise<void> {
  const data = await buildReceiptData(payment, agency);
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
