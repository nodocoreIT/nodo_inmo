import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { usePortalProperties, type PortalProperty } from "../hooks/use-portal-properties";
import { PropertyCard } from "./property-card";
import { PropertyDetailDialog } from "./property-detail-dialog";
import {
  DEFAULT_FILTERS,
  applyPortalFilters,
  hasActiveFilters,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  type PortalFilters,
} from "../lib/portal-filters";
import { cn } from "@/shared/lib/utils";

const PAGE_SIZE = 12;

export function PortalPage() {
  const { data, isLoading, isError } = usePortalProperties();
  const [filters, setFilters] = useState<PortalFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<PortalProperty | null>(null);
  const [page, setPage] = useState(0);

  function update<K extends keyof PortalFilters>(key: K, value: PortalFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
  }

  const filtered = useMemo(
    () => applyPortalFilters(data ?? [], filters),
    [data, filters],
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Propiedades</h1>
        <p className="text-sm text-slate2">Navegá y filtrá el catálogo de propiedades</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        {/* Row 1: search + operation + type */}
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate2" />
            <input
              type="text"
              placeholder="Buscar por dirección o descripción…"
              value={filters.query}
              onChange={(e) => update("query", e.target.value)}
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          {/* Operation */}
          <select
            value={filters.operation}
            onChange={(e) => update("operation", e.target.value as PortalFilters["operation"])}
            className={cn(
              "rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30",
              filters.operation !== "all" ? "border-brand bg-brand/5 font-medium" : "border-border bg-background",
            )}
          >
            <option value="all">Alquiler o Venta</option>
            {Object.entries(OPERATION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Property type */}
          <select
            value={filters.property_type}
            onChange={(e) => update("property_type", e.target.value)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30",
              filters.property_type ? "border-brand bg-brand/5 font-medium" : "border-border bg-background",
            )}
          >
            <option value="">Todos los tipos</option>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Row 2: rooms + price + amenity chips */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Rooms */}
          <select
            value={filters.rooms ?? ""}
            onChange={(e) => update("rooms", e.target.value ? Number(e.target.value) : null)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30",
              filters.rooms !== null ? "border-brand bg-brand/5 font-medium" : "border-border bg-background",
            )}
          >
            <option value="">Ambientes</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4+</option>
          </select>

          {/* Price max */}
          <input
            type="number"
            placeholder="Precio máx."
            value={filters.max_price ?? ""}
            onChange={(e) => update("max_price", e.target.value ? Number(e.target.value) : null)}
            className={cn(
              "w-36 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30",
              filters.max_price !== null ? "border-brand bg-brand/5 font-medium" : "border-border bg-background",
            )}
          />

          {/* Amenity chips */}
          {(["has_pool", "pets_allowed", "has_garage"] as const).map((key) => {
            const labels: Record<string, string> = {
              has_pool: "Pileta",
              pets_allowed: "Mascotas",
              has_garage: "Garaje",
            };
            return (
              <button
                key={key}
                type="button"
                onClick={() => update(key, !filters[key])}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  filters[key]
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-background text-slate2 hover:bg-mist",
                )}
              >
                {labels[key]}
              </button>
            );
          })}

          {/* Clear */}
          {active && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-slate2 underline-offset-2 hover:underline"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-xs text-slate2">
            <SlidersHorizontal className="inline h-3.5 w-3.5 align-middle" />{" "}
            {filtered.length} propiedad{filtered.length !== 1 ? "es" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Error al cargar las propiedades. Intentá de nuevo.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-mist py-20 text-center">
          <p className="text-sm font-medium text-slate2">Sin resultados para los filtros aplicados</p>
          {active && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && paged.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((p) => (
            <PropertyCard key={p.id} property={p} onSelect={setSelected} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !isError && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate2">
          <span>
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 tabular-nums">{page + 1} / {totalPages}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <PropertyDetailDialog
        property={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
