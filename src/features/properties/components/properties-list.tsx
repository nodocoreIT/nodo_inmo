import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useProperties } from "@/features/properties/hooks/use-properties";
import type { PropertyRow } from "@/features/properties/hooks/use-properties";
import { useSearchStore } from "@/shared/search/use-search-store";
import { matchesQuery } from "@/shared/search/matches-query";
import { useUpdateProperty } from "@/features/properties/hooks/use-update-property";
import { useDeleteProperty } from "@/features/properties/hooks/use-delete-property";
import { CreatePropertyDialog } from "./create-property-dialog";
import { PropertyFormDialog } from "./property-form-dialog";
import { RegisterExpenseButton } from "@/features/property-expenses/components/register-expense-button";
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
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  formatPrice,
} from "@/features/properties/lib/property-labels";

export function PropertiesList() {
  const { data, isLoading, isError } = useProperties();
  const query = useSearchStore((s) => s.query);
  const [createOpen, setCreateOpen] = useState(false);
  const [editProperty, setEditProperty] = useState<PropertyRow | null>(null);

  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();

  const filtered = (data ?? []).filter((p) =>
    matchesQuery(
      [p.address, p.property_type, p.operation, p.status, p.description],
      query,
    ),
  );
  const noResults = !!data && data.length > 0 && filtered.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Action row */}
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva propiedad
        </Button>
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
            Sin resultados para "{query}"
          </p>
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
              {filtered.map((property) => (
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

      {/* Create dialog */}
      <CreatePropertyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => setCreateOpen(false)}
      />

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

// ── Row actions ───────────────────────────────────────────────────────────────

interface RowActionsProps {
  property: PropertyRow;
  onEdit: () => void;
  onDeleteConfirm: () => void;
}

function RowActions({ property, onEdit, onDeleteConfirm }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {/* "Registrar gasto" — only renders for admin role (gated inside the button) */}
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
