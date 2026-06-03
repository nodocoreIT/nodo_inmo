/**
 * UI label mappings for contracts — DB enum values → Spanish display strings.
 * DB values stay in English; these are presentation-only.
 */

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  terminated: "Rescindido",
  expired: "Vencido",
};

export const ADJUSTMENT_INDEX_LABELS: Record<string, string> = {
  IPC: "IPC",
  ICL: "ICL",
  fixed: "Fijo",
  USD: "Dólar",
};

export const EXPENSES_PAID_BY_LABELS: Record<string, string> = {
  tenant: "Inquilino",
  owner: "Propietario",
};

/** Format an amount using es-AR locale with a currency symbol. */
export function formatMoney(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined) return "—";
  const formatted = new Intl.NumberFormat("es-AR").format(amount);
  const symbol = currency === "USD" ? "US$" : "$";
  return `${symbol} ${formatted}`;
}

/** Format an ISO date (yyyy-mm-dd) as dd/mm/yyyy. */
export function formatDate(date: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}
