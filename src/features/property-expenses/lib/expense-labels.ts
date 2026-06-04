/** Display labels for expense type enum values. */
export const TYPE_LABELS: Record<string, string> = {
  arreglo: "Arreglo",
  compra_accesorio: "Compra de accesorio",
};

/** Display labels for currency enum values. */
export const CURRENCY_LABELS: Record<string, string> = {
  ARS: "ARS ($)",
  USD: "USD (U$S)",
};

/**
 * Format an expense amount for display.
 * Uses the same Intl pattern as the caja / payments modules.
 */
export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
