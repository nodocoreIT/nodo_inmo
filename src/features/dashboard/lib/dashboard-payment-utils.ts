import type { PaymentWithRelations } from "@/features/payments/hooks/use-payments";

export type CollectionStatus = "sin_cobrar" | "pago_parcial";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function currentMonthKey(today: Date = new Date()): string {
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
}

/** Format YYYY-MM as MM/YYYY for display, e.g. "04/2026". */
export function formatMonthSlash(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  return `${m}/${y}`;
}

export function isUnpaidPayment(payment: { status: string }): boolean {
  return payment.status !== "paid" && payment.status !== "cancelled";
}

export function remainingAmount(payment: {
  amount: number;
  paid_amount: number | null;
}): number {
  return payment.amount - (payment.paid_amount ?? 0);
}

export function isPartialPayment(payment: {
  amount: number;
  paid_amount: number | null;
  status: string;
}): boolean {
  const paid = payment.paid_amount ?? 0;
  return isUnpaidPayment(payment) && paid > 0 && paid < payment.amount;
}

export function isPastMonthPayment(
  payment: PaymentWithRelations,
  today: Date = new Date(),
): boolean {
  if (!isUnpaidPayment(payment)) return false;
  if (remainingAmount(payment) <= 0) return false;
  return monthKey(payment.due_date) < currentMonthKey(today);
}

export function isCurrentMonthPayment(
  payment: PaymentWithRelations,
  today: Date = new Date(),
): boolean {
  if (!isUnpaidPayment(payment)) return false;
  if (remainingAmount(payment) <= 0) return false;
  return monthKey(payment.due_date) === currentMonthKey(today);
}

export function collectionStatusForPayments(
  payments: PaymentWithRelations[],
): CollectionStatus {
  if (payments.some(isPartialPayment)) return "pago_parcial";
  return "sin_cobrar";
}

export function currentMonthLabel(today: Date = new Date()): string {
  return today.toLocaleDateString("es-AR", { month: "long" });
}
