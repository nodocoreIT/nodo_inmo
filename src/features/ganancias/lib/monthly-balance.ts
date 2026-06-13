import type { CashMovementRow } from "@/features/caja/hooks/use-cash-movements";
import type { CashAccount } from "@/shared/hooks/use-cash-accounts";

export interface MonthlyMovementRow {
  id: string;
  date: string;
  detail: string;
  origin: string;
  account: string;
  amountArs: number | null;
  amountUsd: number | null;
}

export interface AccountBalance {
  label: string;
  currency: "ARS" | "USD";
  balance: number;
  kind: "BANCO" | "EFECTIVO";
}

export interface CategoryTotals {
  ars: number;
  usd: number;
}

export interface MonthlyBalanceSummary {
  admAlquileres: CategoryTotals;
  contratos: CategoryTotals;
  ventas: CategoryTotals;
  netoArs: number;
  netoUsd: number;
  movements: MonthlyMovementRow[];
  accountBalances: AccountBalance[];
  totalArs: number;
  totalUsd: number;
}

const ORIGIN_LABEL: Record<string, string> = {
  commission: "Alquiler",
  manual: "Manual",
  owner_payout: "Liquidación",
};

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function signedAmount(m: CashMovementRow): number {
  return m.type === "income" ? m.amount : -m.amount;
}

function accountKind(label: string): "BANCO" | "EFECTIVO" {
  const lower = label.toLowerCase();
  if (lower.includes("efectivo")) return "EFECTIVO";
  return "BANCO";
}

function addToCategory(
  target: CategoryTotals,
  amount: number,
  currency: string,
): void {
  if (currency === "USD") target.usd += amount;
  else target.ars += amount;
}

export function buildMonthlyBalance(
  movements: CashMovementRow[],
  periodYm: string,
  accounts: CashAccount[] = [],
): MonthlyBalanceSummary {
  const inMonth = movements.filter((m) => monthKey(m.date) === periodYm);

  const admAlquileres: CategoryTotals = { ars: 0, usd: 0 };
  const contratos: CategoryTotals = { ars: 0, usd: 0 };
  const ventas: CategoryTotals = { ars: 0, usd: 0 };

  for (const m of inMonth) {
    if (m.type !== "income") continue;
    const signed = signedAmount(m);
    if (m.source === "commission") addToCategory(admAlquileres, signed, m.currency);
    if (m.source === "manual") addToCategory(contratos, signed, m.currency);
  }

  const netoArs = inMonth
    .filter((m) => m.currency === "ARS")
    .reduce((sum, m) => sum + signedAmount(m), 0);

  const netoUsd = inMonth
    .filter((m) => m.currency === "USD")
    .reduce((sum, m) => sum + signedAmount(m), 0);

  const accountMap = new Map<string, AccountBalance>();

  for (const acc of accounts) {
    const key = `${acc.label}:${acc.currency}`;
    accountMap.set(key, {
      label: acc.label,
      currency: acc.currency,
      balance: acc.initial_balance ?? 0,
      kind: acc.kind === "EFECTIVO" ? "EFECTIVO" : "BANCO",
    });
  }

  for (const m of movements) {
    const label = m.category ?? "Sin cuenta";
    const currency = m.currency as "ARS" | "USD";
    const key = `${label}:${currency}`;
    const prev = accountMap.get(key) ?? {
      label,
      currency,
      balance: 0,
      kind: accountKind(label),
    };
    prev.balance += signedAmount(m);
    accountMap.set(key, prev);
  }

  const accountBalances = Array.from(accountMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  const totalArs = accountBalances
    .filter((a) => a.currency === "ARS")
    .reduce((s, a) => s + a.balance, 0);
  const totalUsd = accountBalances
    .filter((a) => a.currency === "USD")
    .reduce((s, a) => s + a.balance, 0);

  return {
    admAlquileres,
    contratos,
    ventas,
    netoArs,
    netoUsd,
    movements: inMonth.map((m) => ({
      id: m.id,
      date: m.date,
      detail: m.concept,
      origin: ORIGIN_LABEL[m.source] ?? m.source,
      account: m.category ?? "—",
      amountArs: m.currency === "ARS" ? signedAmount(m) : null,
      amountUsd: m.currency === "USD" ? signedAmount(m) : null,
    })),
    accountBalances,
    totalArs,
    totalUsd,
  };
}

export function formatPeriodTitle(periodYm: string): string {
  const [y, m] = periodYm.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date
    .toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    .toUpperCase();
}
