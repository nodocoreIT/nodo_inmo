import { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { PaginationControls } from "@/shared/components/ui/pagination";
import { PAGE_SIZE } from "@/shared/lib/constants";
import { useProperties } from "@/features/properties/hooks/use-properties";
import type { PropertyRow } from "@/features/properties/hooks/use-properties";
import { useSearchStore } from "@/shared/search/use-search-store";
import { matchesQuery } from "@/shared/search/matches-query";
import { useUpdateProperty } from "@/features/properties/hooks/use-update-property";
import { useDeleteProperty } from "@/features/properties/hooks/use-delete-property";
import { CreatePropertyDialog } from "./create-property-dialog";
import { PropertyFormDialog } from "./property-form-dialog";
import type { PropertyFormValues } from "./property-form-dialog";
import { VoicePropertyButton } from "./voice-property-button";
import { RegisterExpenseButton } from "@/features/property-expenses/components/register-expense-button";
import { SharePropertyButton } from "./share-property-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  formatPrice,
} from "@/features/properties/lib/property-labels";
import { formatCurrencyInput, parseCurrencyInput } from "@/shared/lib/format-money";
import {
  PROVINCIAS,
  LOCALIDADES_BY_PROVINCIA,
  type Provincia,
} from "@/shared/data/argentina-geo";
import { cn } from "@/shared/lib/utils";

// ── Filter types ──────────────────────────────────────────────────────────────

interface Filters {
  property_type: string;
  rooms: string;
  priceMin: string;
  priceMax: string;
  provincia: string;
  localidad: string;
}

const EMPTY_FILTERS: Filters = {
  property_type: "",
  rooms: "",
  priceMin: "",
  priceMax: "",
  provincia: "",
  localidad: "",
};

const ALL = "__all__";

// ── Component ─────────────────────────────────────────────────────────────────

export function PropertiesList() {
  const { data, isLoading, isError } = useProperties();
  const query = useSearchStore((s) => s.query);
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceDefaults, setVoiceDefaults] = useState<Partial<PropertyFormValues> | null>(null);
  const [editProperty, setEditProperty] = useState<PropertyRow | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const handleVoiceExtracted = (values: Partial<PropertyFormValues>) => {
    setVoiceDefaults(values);
    setVoiceOpen(true);
  };

  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({
      ...f,
      [key]: value,
      ...(key === "provincia" ? { localidad: "" } : {}),
    }));
  }

  const hasFilters = Object.values(filters).some((v) => v !== "");

  const localidadOptions = useMemo(
    () =>
      filters.provincia
        ? (LOCALIDADES_BY_PROVINCIA[filters.provincia as Provincia] ?? [])
        : [],
    [filters.provincia],
  );

  const filtered = useMemo(
    () =>
      (data ?? []).filter((p) => {
        if (
          !matchesQuery(
            [p.address, p.property_type, p.operation, p.status, p.description],
            query,
          )
        )
          return false;
        if (filters.property_type && p.property_type !== filters.property_type)
          return false;
        if (filters.rooms) {
          if (filters.rooms === "5+") {
            if ((p.rooms ?? 0) < 5) return false;
          } else {
            if (p.rooms !== Number(filters.rooms)) return false;
          }
        }
        if (filters.priceMin !== "") {
          const min = parseCurrencyInput(filters.priceMin);
          if (min !== null && (p.sale_price === null || p.sale_price < min))
            return false;
        }
        if (filters.priceMax !== "") {
          const max = parseCurrencyInput(filters.priceMax);
          if (max !== null && (p.sale_price === null || p.sale_price > max))
            return false;
        }
        if (filters.provincia && p.provincia !== filters.provincia) return false;
        if (filters.localidad && p.localidad !== filters.localidad) return false;
        return true;
      }),
    [data, query, filters],
  );

  const noResults = !!data && data.length > 0 && filtered.length === 0;

  useEffect(() => {
    setPage(0);
  }, [query, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedRows = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Action row */}
      <div className="flex items-center justify-end gap-2">
        <VoicePropertyButton onExtracted={handleVoiceExtracted} />
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva propiedad
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card px-4 py-3">
        <FilterSelect
          label="Tipo"
          value={filters.property_type}
          onChange={(v) => setFilter("property_type", v)}
          placeholder="Todos"
          options={[
            { value: "apartment", label: "Departamento" },
            { value: "house", label: "Casa" },
            { value: "commercial", label: "Local" },
            { value: "land", label: "Terreno" },
            { value: "other", label: "Otro" },
          ]}
          className="w-36"
        />

        <FilterSelect
          label="Ambientes"
          value={filters.rooms}
          onChange={(v) => setFilter("rooms", v)}
          placeholder="Todos"
          options={["1", "2", "3", "4", "5+"].map((r) => ({
            value: r,
            label: r === "5+" ? "5 o más" : r,
          }))}
          className="w-28"
        />

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Precio</span>
          <div className="flex items-center gap-1.5">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="$ Mín"
              value={filters.priceMin}
              onChange={(e) =>
                setFilter("priceMin", formatCurrencyInput(e.target.value.replace(/\D/g, "")))
              }
              className="h-9 w-28"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="$ Máx"
              value={filters.priceMax}
              onChange={(e) =>
                setFilter("priceMax", formatCurrencyInput(e.target.value.replace(/\D/g, "")))
              }
              className="h-9 w-28"
            />
          </div>
        </div>

        <FilterSelect
          label="Provincia"
          value={filters.provincia}
          onChange={(v) => setFilter("provincia", v)}
          placeholder="Todas"
          options={PROVINCIAS.map((p) => ({ value: p, label: p }))}
          className="w-44"
        />

        <FilterSelect
          label="Localidad"
          value={filters.localidad}
          onChange={(v) => setFilter("localidad", v)}
          placeholder={filters.provincia ? "Todas" : "Elegí provincia"}
          options={localidadOptions.map((l) => ({ value: l, label: l }))}
          className="w-44"
          disabled={!filters.provincia}
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mb-0 self-end gap-1 text-slate2 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading && (
        <div
          role="status"
          aria-label="Cargando propiedades"
          className="flex items-center justify-center py-16"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="sr-only">Cargando…</span>
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Error al cargar las propiedades. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            Todavía no cargaste propiedades
          </p>
          <p className="text-xs text-slate2-300">
            Hacé clic en "Nueva propiedad" para empezar.
          </p>
        </div>
      )}

      {!isLoading && !isError && noResults && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-mist py-12 text-center">
          <p className="text-sm font-medium text-slate2">
            {query
              ? `Sin resultados para "${query}"`
              : "Sin propiedades para los filtros seleccionados"}
          </p>
          {hasFilters && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="h-auto p-0 text-xs text-brand"
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dirección</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Amb.</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((property) => (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">
                    {property.address}
                  </TableCell>
                  <TableCell>
                    {PROPERTY_TYPE_LABELS[property.property_type] ??
                      property.property_type}
                  </TableCell>
                  <TableCell>
                    {OPERATION_LABELS[property.operation] ?? property.operation}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={property.status} />
                  </TableCell>
                  <TableCell>
                    {formatPrice(property.sale_price, property.currency)}
                  </TableCell>
                  <TableCell>{property.rooms ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      property={property}
                      onEdit={() => setEditProperty(property)}
                      onDeleteConfirm={() =>
                        deleteProperty.mutateAsync(property.id)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        itemLabel="propiedades"
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      {/* Create dialog */}
      <CreatePropertyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => setCreateOpen(false)}
      />

      {/* Voice-dictated create dialog */}
      {voiceDefaults !== null && (
        <CreatePropertyDialog
          open={voiceOpen}
          onOpenChange={(open) => {
            setVoiceOpen(open);
            if (!open) setVoiceDefaults(null);
          }}
          defaultValues={voiceDefaults}
          onSuccess={() => {
            setVoiceOpen(false);
            setVoiceDefaults(null);
          }}
        />
      )}

      {/* Edit dialog */}
      {editProperty && (
        <PropertyFormDialog
          open={!!editProperty}
          onOpenChange={(open) => {
            if (!open) setEditProperty(null);
          }}
          property={editProperty}
          onSuccess={() => setEditProperty(null)}
          onSubmit={(payload, prop) =>
            updateProperty.mutateAsync({ id: prop!.id, ...payload }).then(() => undefined)
          }
          isPending={updateProperty.isPending}
        />
      )}
    </div>
  );
}

// ── FilterSelect ──────────────────────────────────────────────────────────────

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
  disabled?: boolean;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select
        value={value || ALL}
        onValueChange={(v) => onChange(v === ALL ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger className={cn("h-9", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Row actions ───────────────────────────────────────────────────────────────

interface RowActionsProps {
  property: PropertyRow;
  onEdit: () => void;
  onDeleteConfirm: () => void;
}

function RowActions({ property, onEdit, onDeleteConfirm }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <SharePropertyButton property={property} />
      <RegisterExpenseButton propertyId={property.id} />

      <Button
        variant="ghost"
        size="sm"
        aria-label="Editar"
        onClick={onEdit}
      >
        <Pencil className="h-4 w-4" />
        <span className="sr-only">Editar</span>
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Eliminar">
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="sr-only">Eliminar</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta propiedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;

  const colorMap: Record<string, string> = {
    available: "bg-green-100 text-green-800",
    reserved: "bg-yellow-100 text-yellow-800",
    rented: "bg-blue-100 text-blue-800",
    sold: "bg-slate-100 text-slate-700",
    inactive: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium ${
        colorMap[status] ?? "bg-mist text-slate2"
      }`}
    >
      {label}
    </span>
  );
}
