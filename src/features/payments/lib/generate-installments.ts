/**
 * Pure installment (cuota) generation from a contract.
 *
 * One installment per month from the contract's start month up to (but not
 * including) the month its end_date falls on — i.e. a period is generated while
 * its first day is strictly before end_date. A 2026-01-01 → 2028-01-01 contract
 * yields 24 installments (Jan 2026 … Dec 2027).
 *
 * Each installment uses the contract's current rent_amount (index adjustments
 * like IPC/ICL are applied later by editing individual cuotas — a future slice).
 * The due day is the contract's start day-of-month, clamped to the month length.
 */
export interface InstallmentDraft {
  period: string; // 'YYYY-MM-01'
  due_date: string; // 'YYYY-MM-DD'
  amount: number;
  currency: string;
  status: "pending";
}

export interface GenerateInput {
  start_date: string; // 'YYYY-MM-DD'
  end_date: string; // 'YYYY-MM-DD'
  rent_amount: number;
  currency: string;
  /** Only generate installments through this month (inclusive). Defaults to today. */
  as_of?: Date;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function currentMonthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function generateInstallments(input: GenerateInput): InstallmentDraft[] {
  const [sy, sm, sd] = input.start_date.split("-").map(Number);
  const end = new Date(`${input.end_date}T00:00:00Z`);
  const asOfKey = currentMonthKeyFromDate(input.as_of ?? new Date());

  const drafts: InstallmentDraft[] = [];
  let year = sy;
  let month = sm; // 1-based

  // Guard against malformed input / runaway loops (cap at 100 years).
  for (let i = 0; i < 1200; i++) {
    const periodKey = `${year}-${pad(month)}`;
    if (periodKey > asOfKey) break;

    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    if (periodStart >= end) break;

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const dueDay = Math.min(sd, daysInMonth);

    drafts.push({
      period: `${year}-${pad(month)}-01`,
      due_date: `${year}-${pad(month)}-${pad(dueDay)}`,
      amount: input.rent_amount,
      currency: input.currency,
      status: "pending",
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return drafts;
}

/** A pending installment whose due date is in the past is overdue (derived, not stored). */
export function isOverdue(
  payment: { status: string; due_date: string },
  today: Date = new Date(),
): boolean {
  if (payment.status !== "pending") return false;
  const todayIso = today.toISOString().slice(0, 10);
  return payment.due_date < todayIso;
}
