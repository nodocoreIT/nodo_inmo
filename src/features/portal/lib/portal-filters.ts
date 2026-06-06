import type { PortalProperty } from "../hooks/use-portal-properties";
import { matchesQuery } from "@/shared/search/matches-query";

export type PortalFilters = {
  query: string;
  operation: "all" | "rent" | "sale";
  property_type: string;
  min_price: number | null;
  max_price: number | null;
  rooms: number | null;
  bathrooms: number | null;
  has_pool: boolean;
  pets_allowed: boolean;
  has_garage: boolean;
};

export const DEFAULT_FILTERS: PortalFilters = {
  query: "",
  operation: "all",
  property_type: "",
  min_price: null,
  max_price: null,
  rooms: null,
  bathrooms: null,
  has_pool: false,
  pets_allowed: false,
  has_garage: false,
};

export function hasActiveFilters(f: PortalFilters): boolean {
  return (
    f.query !== "" ||
    f.operation !== "all" ||
    f.property_type !== "" ||
    f.min_price !== null ||
    f.max_price !== null ||
    f.rooms !== null ||
    f.bathrooms !== null ||
    f.has_pool ||
    f.pets_allowed ||
    f.has_garage
  );
}

export function applyPortalFilters(
  properties: PortalProperty[],
  filters: PortalFilters,
): PortalProperty[] {
  return properties.filter((p) => {
    if (filters.operation !== "all" && p.operation !== filters.operation) return false;
    if (filters.property_type && p.property_type !== filters.property_type) return false;
    if (filters.min_price !== null && (p.sale_price ?? 0) < filters.min_price) return false;
    if (filters.max_price !== null && (p.sale_price ?? 0) > filters.max_price) return false;
    if (filters.rooms !== null) {
      if (filters.rooms >= 4) {
        if ((p.rooms ?? 0) < 4) return false;
      } else {
        if (p.rooms !== filters.rooms) return false;
      }
    }
    if (filters.bathrooms !== null && p.bathrooms !== filters.bathrooms) return false;
    if (filters.has_pool && !p.has_pool) return false;
    if (filters.pets_allowed && !p.pets_allowed) return false;
    if (filters.has_garage && !p.has_garage) return false;
    if (filters.query) {
      return matchesQuery([p.address, p.description, p.property_type], filters.query);
    }
    return true;
  });
}

export const OPERATION_LABELS: Record<string, string> = {
  rent: "Alquiler",
  sale: "Venta",
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "Departamento",
  house: "Casa",
  commercial: "Local comercial",
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

export const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  reserved: "bg-yellow-100 text-yellow-800",
  rented: "bg-blue-100 text-blue-800",
  sold: "bg-slate-100 text-slate-700",
  inactive: "bg-slate-100 text-slate-500",
};

export function formatPortalPrice(
  price: number | null,
  currency: string,
): string {
  if (price === null || price === undefined) return "Consultar";
  const symbol = currency === "USD" ? "USD " : "$ ";
  return `${symbol}${price.toLocaleString("es-AR")}`;
}
