/**
 * UI label mappings — DB enum values → Spanish display strings.
 * DB values stay in English; these are presentation-only.
 */

export const OPERATION_LABELS: Record<string, string> = {
  rent: "Alquiler",
  sale: "Venta",
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "Departamento",
  house: "Casa",
  commercial: "Local",
  land: "Terreno",
  other: "Otro",
};

export const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Reservada",
  rented: "Alquilada",
  sold: "Vendida",
  inactive: "Inactiva",
};

export const CURRENCY_LABELS: Record<string, string> = {
  ARS: "ARS",
  USD: "US$",
};

/** Format a price using es-AR locale (thousands separator). */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null || price === undefined) return "—";
  const formatted = new Intl.NumberFormat("es-AR").format(price);
  const currencySymbol = currency === "USD" ? "US$" : "$";
  return `${currencySymbol} ${formatted}`;
}
