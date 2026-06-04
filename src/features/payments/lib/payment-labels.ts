import { isOverdue } from "./generate-installments";

/**
 * Effective status shown in the UI. "overdue" is derived from a pending
 * installment whose due date has passed (it is never stored in the DB).
 */
export type EffectiveStatus = "pending" | "paid" | "overdue" | "cancelled";

export const PAYMENT_STATUS_LABELS: Record<EffectiveStatus, string> = {
  pending: "Pendiente",
  paid: "Cobrada",
  overdue: "Vencida",
  cancelled: "Anulada",
};

export function effectiveStatus(
  payment: { status: string; due_date: string },
  today: Date = new Date(),
): EffectiveStatus {
  if (payment.status === "paid") return "paid";
  if (payment.status === "cancelled") return "cancelled";
  return isOverdue(payment, today) ? "overdue" : "pending";
}

/** Format a period (YYYY-MM-01) as "MMM YYYY" in Spanish, e.g. "Ene 2026". */
const MONTHS_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function formatPeriod(period: string): string {
  const [y, m] = period.split("-");
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return period;
  return `${MONTHS_ES[idx]} ${y}`;
}
