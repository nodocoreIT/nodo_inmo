import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useOwners } from "@/features/owners/hooks/use-owners";
import type { OwnerRow } from "@/features/owners/hooks/use-owners";
import { useUpdateOwner } from "@/features/owners/hooks/use-update-owner";
import { useDeleteOwner } from "@/features/owners/hooks/use-delete-owner";
import { CreateOwnerDialog } from "./create-owner-dialog";
import { OwnerFormDialog } from "./owner-form-dialog";
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

export function OwnersList() {
  const { data, isLoading, isError } = useOwners();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOwner, setEditOwner] = useState<OwnerRow | null>(null);

  const updateOwner = useUpdateOwner();
  const deleteOwner = useDeleteOwner();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy">Propietarios</h2>
          <p className="mt-1 text-sm text-slate2">
            Listado de propietarios de la agencia
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo propietario
        </Button>
      </div>

      {/* Content */}
      {isLoading && (
        <div
          role="status"
          aria-label="Cargando propietarios"
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
          Error al cargar los propietarios. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            Todavía no cargaste propietarios
          </p>
          <p className="text-xs text-slate2-300">
            Hacé clic en "Nuevo propietario" para empezar.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Comisión</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((owner) => (
                <TableRow key={owner.id}>
                  <TableCell className="font-medium">{owner.name}</TableCell>
                  <TableCell>{owner.dni ?? "—"}</TableCell>
                  <TableCell>{owner.phone ?? "—"}</TableCell>
                  <TableCell>{owner.email ?? "—"}</TableCell>
                  <TableCell>{owner.commission_rate}%</TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      owner={owner}
                      onEdit={() => setEditOwner(owner)}
                      onDeleteConfirm={() => deleteOwner.mutateAsync(owner.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <CreateOwnerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => setCreateOpen(false)}
      />

      {/* Edit dialog */}
      {editOwner && (
        <OwnerFormDialog
          open={!!editOwner}
          onOpenChange={(open) => {
            if (!open) setEditOwner(null);
          }}
          owner={editOwner}
          onSuccess={() => setEditOwner(null)}
          onSubmit={(payload, own) =>
            updateOwner
              .mutateAsync({ id: own!.id, ...payload })
              .then(() => undefined)
          }
          isPending={updateOwner.isPending}
        />
      )}
    </div>
  );
}

// ── Row actions ───────────────────────────────────────────────────────────────

interface RowActionsProps {
  owner: OwnerRow;
  onEdit: () => void;
  onDeleteConfirm: () => void;
}

function RowActions({ onEdit, onDeleteConfirm }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
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
            <AlertDialogTitle>¿Eliminar este propietario?</AlertDialogTitle>
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
