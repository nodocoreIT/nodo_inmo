import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useContracts } from "@/features/contracts/hooks/use-contracts";
import { useDeleteContract } from "@/features/contracts/hooks/use-delete-contract";
import { CreateContractDialog } from "./create-contract-dialog";
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
  CONTRACT_STATUS_LABELS,
  ADJUSTMENT_INDEX_LABELS,
  formatMoney,
  formatDate,
} from "@/features/contracts/lib/contract-labels";

export function ContractsList() {
  const { data, isLoading, isError } = useContracts();
  const [createOpen, setCreateOpen] = useState(false);
  const deleteContract = useDeleteContract();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy">Contratos</h2>
          <p className="mt-1 text-sm text-slate2">
            Contratos de alquiler de la agencia
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo contrato
        </Button>
      </div>

      {isLoading && (
        <div
          role="status"
          aria-label="Cargando contratos"
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
          Error al cargar los contratos. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            Todavía no cargaste contratos
          </p>
          <p className="text-xs text-slate2-300">
            Hacé clic en "Nuevo contrato" para empezar.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead>Inquilino</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Alquiler</TableHead>
                <TableHead>Ajuste</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-16 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">
                    {contract.property?.address ?? "—"}
                  </TableCell>
                  <TableCell>{contract.tenant?.name ?? "—"}</TableCell>
                  <TableCell>{formatDate(contract.start_date)}</TableCell>
                  <TableCell>{formatDate(contract.end_date)}</TableCell>
                  <TableCell>
                    {formatMoney(contract.rent_amount, contract.currency)}
                  </TableCell>
                  <TableCell>
                    {ADJUSTMENT_INDEX_LABELS[contract.adjustment_index] ??
                      contract.adjustment_index}{" "}
                    / {contract.adjustment_period_months}m
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={contract.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteAction
                      onConfirm={() => deleteContract.mutateAsync(contract.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateContractDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => setCreateOpen(false)}
      />
    </div>
  );
}

// ── Delete action ───────────────────────────────────────────────────────────────

function DeleteAction({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Eliminar">
          <Trash2 className="h-4 w-4 text-destructive" />
          <span className="sr-only">Eliminar</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este contrato?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const label = CONTRACT_STATUS_LABELS[status] ?? status;

  const colorMap: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    active: "bg-green-100 text-green-800",
    terminated: "bg-red-100 text-red-700",
    expired: "bg-yellow-100 text-yellow-800",
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
