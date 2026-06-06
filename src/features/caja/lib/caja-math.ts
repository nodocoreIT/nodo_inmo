/**
 * Pure Caja math: balance from movements, pending settlements grouped by owner,
 * and the settlement breakdown computation (TS mirror of the settle_owner SQL RPC).
 */

import type { SealedBreakdown } from "@/features/caja/lib/settlement-statement-data";

export type { SealedBreakdown };

export interface MovementLike {
  type: string; // 'income' | 'expense'
  amount: number;
}

/** Balance = sum(income) - sum(expense). */
export function computeBalance(movements: MovementLike[]): number {
  return movements.reduce(
    (acc, m) => acc + (m.type === "income" ? m.amount : -m.amount),
    0,
  );
}

/** Totals split by type plus the resulting balance. */
export function computeTotals(movements: MovementLike[]): {
  income: number;
  expense: number;
  balance: number;
} {
  let income = 0;
  let expense = 0;
  for (const m of movements) {
    if (m.type === "income") income += m.amount;
    else expense += m.amount;
  }
  return { income, expense, balance: income - expense };
}

export interface SettlementLike {
  id: string;
  owner_id: string;
  amount: number;
  currency: string;
  status: string;
  owner?: { name: string } | null;
}

export interface OwnerGroup {
  owner_id: string;
  owner_name: string;
  currency: string;
  total: number;
  settlement_ids: string[];
}

/**
 * Group PENDING settlements by owner (and currency), summing the amount owed.
 * Settled rows are ignored.
 */
export function groupPendingByOwner(settlements: SettlementLike[]): OwnerGroup[] {
  const map = new Map<string, OwnerGroup>();

  for (const s of settlements) {
    if (s.status !== "pending") continue;
    const key = `${s.owner_id}:${s.currency}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += s.amount;
      existing.settlement_ids.push(s.id);
    } else {
      map.set(key, {
        owner_id: s.owner_id,
        owner_name: s.owner?.name ?? "—",
        currency: s.currency,
        total: s.amount,
        settlement_ids: [s.id],
      });
    }
  }

  return Array.from(map.values());
}

// ─── Sealed settlements: grouping by settlement_group ────────────────────────

/**
 * Minimal shape required from a settled settlement row for grouping.
 * Matches the DB row + embedded owner join used by use-settled-settlements.
 */
export interface SettlementForGrouping {
  id: string;
  owner_id: string;
  currency: string;
  status: string;
  breakdown: unknown;
  settlement_group: string | null;
  settled_date: string | null;
  owner?: { name: string } | null;
}

/**
 * One entry in the history table — one per distinct settlement_group UUID.
 * Keyed by settlement_group so each liquidación is a unique row in the UI.
 */
export interface SealedGroup {
  settlement_group: string;
  owner_id: string;
  owner_name: string;
  currency: string;
  breakdown: SealedBreakdown;
  settled_date: string;
  cobro_count: number;
}

/**
 * Group settled settlements by settlement_group UUID, preserving insertion order
 * (which is newest-first when the input is ordered `settled_date DESC`).
 *
 * Guards (in order — MUST NOT be removed):
 *   1. status !== "settled"   → skip (guard 1: non-settled rows)
 *   2. !s.breakdown           → skip (guard 2: null-breakdown — load-bearing)
 *   3. !s.settlement_group    → skip (guard 3: missing group key)
 *
 * First row per key wins; subsequent rows with the same key are skipped.
 * cobro_count is sourced from breakdown.cobro_count (default 0 for older snapshots).
 */
export function groupSealedBySettlementGroup(
  settlements: SettlementForGrouping[],
): SealedGroup[] {
  const map = new Map<string, SealedGroup>();

  for (const s of settlements) {
    if (s.status !== "settled") continue;          // guard 1
    if (!s.breakdown) continue;                    // guard 2 (MUST NOT be removed)
    if (!s.settlement_group) continue;             // guard 3

    const key = s.settlement_group;
    if (map.has(key)) continue;                    // first row per group wins

    const breakdown = s.breakdown as unknown as SealedBreakdown;
    map.set(key, {
      settlement_group: key,
      owner_id: s.owner_id,
      owner_name: s.owner?.name ?? "—",
      currency: s.currency,
      breakdown,
      settled_date: s.settled_date ?? "",
      cobro_count: breakdown.cobro_count ?? 0,
    });
  }

  return Array.from(map.values());
}

// ─── Settlement breakdown (TS mirror of the settle_owner SQL RPC — ADR-5) ────
//
// This is a DISPLAY-ONLY pure function. It is used for the pre-seal projection
// in the UI and as a regression-guarded mirror of the SQL canonical computation.
// It NEVER feeds the sealed snapshot — the RPC is the single source of truth.
//
// IMPORTANT: Keep the arithmetic in sync with the settle_owner plpgsql function.
// If SQL and TS diverge, this mirror is the bug (ADR-5, HEADLINE-2).

export interface BreakdownDeduction {
  id: string;
  amount: number;
  description: string;
  expense_date: string;
  type: string;
}

export interface SettlementBreakdown {
  gross: number;
  commission_rate: number;
  commission: number;
  /** gross - commission; the owner's share before expense deductions */
  owner_share: number;
  deductions: BreakdownDeduction[];
  /** sum of all deduction amounts */
  deduction_total: number;
  net: number;
}

/**
 * Pure projection used for pre-seal display in the UI and as the vitest mirror
 * of the SQL seal arithmetic (ADR-5). No side-effects, no network calls.
 *
 * @param payments        All payments in the settlement batch (any currency).
 * @param commissionMovements  Commission cash_movements posted by the trigger.
 * @param expenses        All chargeable expenses for the owner (any currency).
 * @param commissionRate  Effective rate for display (stored verbatim, not used to compute commission).
 * @param currency        Settlement currency — filters payments, commissions, deductions.
 */
export function computeSettlementBreakdown(
  payments: { id: string; amount: number; currency: string }[],
  commissionMovements: { payment_id: string; amount: number }[],
  expenses: { id: string; amount: number; currency: string; expense_date: string; description: string; type: string }[],
  commissionRate: number,
  currency: string,
): SettlementBreakdown {
  // Build a Set of payment ids in this batch for O(1) membership checks
  const paymentIds = new Set(payments.map((p) => p.id));

  // gross = sum of payment amounts for this currency
  const gross = payments
    .filter((p) => p.currency === currency)
    .reduce((sum, p) => sum + p.amount, 0);

  // commission = sum of commission movements whose payment is in this batch
  // (as-of-cobro frozen value — NOT rate * gross)
  const commission = commissionMovements
    .filter((cm) => paymentIds.has(cm.payment_id))
    .reduce((sum, cm) => sum + cm.amount, 0);

  // deductions = chargeable expenses matching this currency
  const deductions: BreakdownDeduction[] = expenses
    .filter((e) => e.currency === currency)
    .map((e) => ({
      id: e.id,
      amount: e.amount,
      description: e.description,
      expense_date: e.expense_date,
      type: e.type,
    }));

  const ownerShare = gross - commission;
  const deductionTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
  const net = parseFloat((ownerShare - deductionTotal).toFixed(2));

  return {
    gross,
    commission_rate: commissionRate,
    commission,
    owner_share: ownerShare,
    deductions,
    deduction_total: deductionTotal,
    net,
  };
}
