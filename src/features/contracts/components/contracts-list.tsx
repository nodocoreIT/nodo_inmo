import { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Trash2, FileText, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { PaginationControls } from "@/shared/components/ui/pagination";
import { Button } from "@/shared/components/ui/button";
import { useContracts } from "@/features/contracts/hooks/use-contracts";
import type { ContractWithRelations } from "@/features/contracts/hooks/use-contracts";
import { useDeleteContract } from "@/features/contracts/hooks/use-delete-contract";
import { useUpdateContract } from "@/features/contracts/hooks/use-update-contract";
import { ContractFormDialog } from "./contract-form-dialog";
import { useSearchStore } from "@/shared/search/use-search-store";
import { matchesQuery } from "@/shared/search/matches-query";
import { CreateContractDialog } from "./create-contract-dialog";
import { ContractPdfViewer } from "./contract-pdf-viewer";
import { ContractStatusBadge } from "./contract-status-badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  ADJUSTMENT_INDEX_LABELS,
  formatMoney,
  formatDate,
} from "@/features/contracts/lib/contract-labels";
import { PAGE_SIZE } from "@/shared/lib/constants";

export function ContractsList() {
  const { data, isLoading, isError } = useContracts();
  const query = useSearchStore((s) => s.query);
  const [createOpen, setCreateOpen] = useState(false);
  const [editContract, setEditContract] =
    useState<ContractWithRelations | null>(null);
  const [viewContract, setViewContract] =
    useState<ContractWithRelations | null>(null);
  const deleteContract = useDeleteContract();
  const updateContract = useUpdateContract();
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: "tenant" | "property" | "start_date" | "end_date" | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });

  const filtered = (data ?? []).filter((c) =>
    matchesQuery(
      [c.property?.address, c.tenant?.name, c.status, c.adjustment_index],
      query,
    ),
  );
  const noResults = !!data && data.length > 0 && filtered.length === 0;

  const sortedAndFiltered = useMemo(() => {
    const list = [...filtered];
    if (!sortConfig.key) return list;

    list.sort((a, b) => {
      let valA = "";
      let valB = "";

      if (sortConfig.key === "tenant") {
        valA = a.tenant?.name ?? "";
        valB = b.tenant?.name ?? "";
      } else if (sortConfig.key === "property") {
        valA = a.property?.address ?? "";
        valB = b.property?.address ?? "";
      } else if (sortConfig.key === "start_date") {
        valA = a.start_date ?? "";
        valB = b.start_date ?? "";
      } else if (sortConfig.key === "end_date") {
        valA = a.end_date ?? "";
        valB = b.end_date ?? "";
      }

      if (sortConfig.direction === "asc") {
        return valA.localeCompare(valB, undefined, { sensitivity: "base" });
      } else {
        return valB.localeCompare(valA, undefined, { sensitivity: "base" });
      }
    });

    return list;
  }, [filtered, sortConfig]);

  const totalPages = Math.ceil(sortedAndFiltered.length / PAGE_SIZE);
  const pagedRows = useMemo(
    () => sortedAndFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedAndFiltered, page],
  );

  useEffect(() => {
    setPage(0);
  }, [query]);

  return (
    <div className="flex flex-col gap-6">
      {/* Action row */}
      <div className="flex items-center justify-end">
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
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => {
                    setSortConfig((prev) => {
                      if (prev.key === "tenant") {
                        if (prev.direction === "asc") {
                          return { key: "tenant", direction: "desc" };
                        } else {
                          return { key: null, direction: "asc" };
                        }
                      }
                      return { key: "tenant", direction: "asc" };
                    });
                  }}
                >
                  <div className="flex items-center gap-1">
                    Inquilino
                    {sortConfig.key === "tenant" && sortConfig.direction === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-brand" />
                    ) : sortConfig.key === "tenant" && sortConfig.direction === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => {
                    setSortConfig((prev) => {
                      if (prev.key === "property") {
                        if (prev.direction === "asc") {
                          return { key: "property", direction: "desc" };
                        } else {
                          return { key: null, direction: "asc" };
                        }
                      }
                      return { key: "property", direction: "asc" };
                    });
                  }}
                >
                  <div className="flex items-center gap-1">
                    Propiedad
                    {sortConfig.key === "property" && sortConfig.direction === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-brand" />
                    ) : sortConfig.key === "property" && sortConfig.direction === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => {
                    setSortConfig((prev) => {
                      if (prev.key === "start_date") {
                        if (prev.direction === "asc") {
                          return { key: "start_date", direction: "desc" };
                        } else {
                          return { key: null, direction: "asc" };
                        }
                      }
                      return { key: "start_date", direction: "asc" };
                    });
                  }}
                >
                  <div className="flex items-center gap-1">
                    Inicio
                    {sortConfig.key === "start_date" && sortConfig.direction === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-brand" />
                    ) : sortConfig.key === "start_date" && sortConfig.direction === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => {
                    setSortConfig((prev) => {
                      if (prev.key === "end_date") {
                        if (prev.direction === "asc") {
                          return { key: "end_date", direction: "desc" };
                        } else {
                          return { key: null, direction: "asc" };
                        }
                      }
                      return { key: "end_date", direction: "asc" };
                    });
                  }}
                >
                  <div className="flex items-center gap-1">
                    Fin
                    {sortConfig.key === "end_date" && sortConfig.direction === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-brand" />
                    ) : sortConfig.key === "end_date" && sortConfig.direction === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Alquiler</TableHead>
                <TableHead>Ajuste</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-32 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>{contract.tenant?.name ?? "—"}</TableCell>
                  <TableCell className="font-medium">
                    {contract.property?.address ?? "—"}
                  </TableCell>
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
                    <ContractStatusBadge status={contract.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Ver PDF"
                        title="Ver PDF"
                        onClick={() => setViewContract(contract)}
                      >
                        <FileText className="h-4 w-4" />
                        <span className="sr-only">Ver PDF</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Editar"
                        onClick={() => setEditContract(contract)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <DeleteAction
                        onConfirm={() =>
                          deleteContract.mutateAsync(contract.id)
                        }
                      />
                    </div>
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
        itemLabel="contratos"
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      <CreateContractDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => setCreateOpen(false)}
      />

      {editContract && (
        <ContractFormDialog
          open={!!editContract}
          onOpenChange={(open) => {
            if (!open) setEditContract(null);
          }}
          contract={editContract}
          onSuccess={() => setEditContract(null)}
          onSubmit={(payload) =>
            updateContract
              .mutateAsync({ id: editContract.id, ...payload })
              .then(() => undefined)
          }
          isPending={updateContract.isPending}
        />
      )}

      {/* PDF viewer dialog */}
      <Dialog
        open={!!viewContract}
        onOpenChange={(open) => {
          if (!open) setViewContract(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Contrato</DialogTitle>
            <DialogDescription>
              {viewContract?.tenant?.name ?? "—"} ·{" "}
              {viewContract?.property?.address ?? "—"} ·{" "}
              <ContractStatusBadge status={viewContract?.status ?? ""} />
            </DialogDescription>
          </DialogHeader>
          {viewContract && <ContractPdfViewer contract={viewContract} />}
        </DialogContent>
      </Dialog>
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
