/**
 * Pure Caja math: balance from movements, and pending settlements grouped by owner.
 */

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
