import type { CashMovementRow } from "@/features/caja/hooks/use-cash-movements";

export interface MonthlyMovementRow {
  id: string;
  date: string;
  detail: string;
  origin: string;
  amountArs: number | null;
  amountUsd: number | null;
}

export interface AccountBalance {
  label: string;
  currency: "ARS" | "USD";
  balance: number;
}

export interface MonthlyBalanceSummary {
  admAlquileres: number;
  contratos: number;
  ventas: number;
  direccionObra: number;
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

function movementDetail(m: CashMovementRow): string {
  return m.concept;
}

function signedAmount(m: CashMovementRow): number {
  return m.type === "income" ? m.amount : -m.amount;
}

export function buildMonthlyBalance(
  movements: CashMovementRow[],
  periodYm: string,
): MonthlyBalanceSummary {
  const inMonth = movements.filter((m) => monthKey(m.date) === periodYm);

  let admAlquileres = 0;
  let manualIncome = 0;

  for (const m of inMonth) {
    if (m.type !== "income") continue;
    if (m.source === "commission") admAlquileres += m.amount;
    if (m.source === "manual") manualIncome += m.amount;
  }

  const netoArs = inMonth
    .filter((m) => m.currency === "ARS")
    .reduce((sum, m) => sum + signedAmount(m), 0);

  const netoUsd = inMonth
    .filter((m) => m.currency === "USD")
    .reduce((sum, m) => sum + signedAmount(m), 0);

  const accountMap = new Map<string, AccountBalance>();
  for (const m of movements) {
    const label = m.category ?? "Sin cuenta";
    const currency = m.currency as "ARS" | "USD";
    const key = `${label}:${currency}`;
    const prev = accountMap.get(key) ?? { label, currency, balance: 0 };
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
    contratos: 0,
    ventas: 0,
    direccionObra: manualIncome,
    netoArs,
    netoUsd,
    movements: inMonth.map((m) => ({
      id: m.id,
      date: m.date,
      detail: movementDetail(m),
      origin: ORIGIN_LABEL[m.source] ?? m.source,
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
