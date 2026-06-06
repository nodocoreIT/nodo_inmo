import { useMemo } from "react";
import { usePayments } from "@/features/payments/hooks/use-payments";
import { useOwnerSettlements } from "@/features/caja/hooks/use-owner-settlements";
import { useContracts } from "@/features/contracts/hooks/use-contracts";
import { effectiveStatus } from "@/features/payments/lib/payment-labels";
import { groupPendingByOwner } from "@/features/caja/lib/caja-math";

// ── Public types ──────────────────────────────────────────────────────────────

/** Per-currency monetary totals keyed by currency code (e.g. "ARS", "USD").
 *  NEVER collapse different currencies into a single scalar. */
export type CurrencyTotals = Record<string, number>;

export interface MetricGroup {
  count: number;
  totalByCurrency: CurrencyTotals;
}

export interface OverdueItem {
  id: string;
  tenantName: string;
  propertyAddress: string;
  amount: number;
  currency: string;
  dueDate: string;
}

export interface PendingOwnerItem {
  ownerId: string;
  ownerName: string;
  total: number;
  currency: string;
}

export interface DashboardMetrics {
  overduePayments: MetricGroup & { items: OverdueItem[] };
  pendingSettlements: MetricGroup & { items: PendingOwnerItem[] };
  recentSealed: MetricGroup;
  activeContracts: number;
  loading: boolean;
  error: unknown;
}

// ── Private constants + helpers ───────────────────────────────────────────────

export const RECENT_SEALED_WINDOW_DAYS = 30;

function sumByCurrency<T>(
  rows: T[],
  pick: (row: T) => { amount: number; currency: string },
): CurrencyTotals {
  const out: CurrencyTotals = {};
  for (const row of rows) {
    const { amount, currency } = pick(row);
    out[currency] = (out[currency] ?? 0) + amount;
  }
  return out;
}

function startOfDayMinusDays(today: Date, days: number): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboardMetrics(today: Date = new Date()): DashboardMetrics {
  const payments = usePayments();
  const settlements = useOwnerSettlements();
  const contracts = useContracts();

  const loading =
    payments.isLoading || settlements.isLoading || contracts.isLoading;
  const error = payments.error ?? settlements.error ?? contracts.error ?? null;

  return useMemo<DashboardMetrics>(() => {
    const paymentRows = payments.data ?? [];
    const settlementRows = settlements.data ?? [];
    const contractRows = contracts.data ?? [];

    // Active contracts
    const activeContracts = contractRows.filter(
      (c) => c.status === "active",
    ).length;

    // Overdue payments
    const overdue = paymentRows.filter(
      (p) => effectiveStatus(p, today) === "overdue",
    );
    const overduePayments = {
      count: overdue.length,
      totalByCurrency: sumByCurrency(overdue, (p) => ({
        amount: p.amount,
        currency: p.currency,
      })),
      items: overdue.map((p) => ({
        id: p.id,
        tenantName: p.contract?.tenant?.name ?? "—",
        propertyAddress: p.contract?.property?.address ?? "—",
        amount: p.amount,
        currency: p.currency,
        dueDate: p.due_date,
      })),
    };

    // Pending settlements — reuse groupPendingByOwner (currency-safe)
    const groups = groupPendingByOwner(settlementRows);
    const pendingSettlements = {
      count: groups.length,
      totalByCurrency: sumByCurrency(groups, (g) => ({
        amount: g.total,
        currency: g.currency,
      })),
      items: groups.map((g) => ({
        ownerId: g.owner_id,
        ownerName: g.owner_name,
        total: g.total,
        currency: g.currency,
      })),
    };

    // Recently sealed (last 30 days)
    const cutoff = startOfDayMinusDays(today, RECENT_SEALED_WINDOW_DAYS);
    const sealed = settlementRows.filter(
      (s) =>
        s.status === "settled" &&
        s.settled_date != null &&
        new Date(s.settled_date) >= cutoff,
    );
    const recentSealed = {
      count: sealed.length,
      totalByCurrency: sumByCurrency(sealed, (s) => ({
        amount: s.amount,
        currency: s.currency,
      })),
    };

    return {
      overduePayments,
      pendingSettlements,
      recentSealed,
      activeContracts,
      loading,
      error,
    };
  }, [payments.data, settlements.data, contracts.data, today, loading, error]);
}
