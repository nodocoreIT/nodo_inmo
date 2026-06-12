import { useMemo, useState } from "react";
import { Plus, ArrowUpRight, ArrowDownRight, Pencil, Trash2 } from "lucide-react";
import { PaginationControls } from "@/shared/components/ui/pagination";
import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useCashMovements, type CashMovementRow } from "@/features/caja/hooks/use-cash-movements";
import { useDeleteCashMovement } from "@/features/caja/hooks/use-delete-cash-movement";
import { MovementFormDialog } from "./movement-form-dialog";
import { formatMoney, formatDate } from "@/features/contracts/lib/contract-labels";
import { cn } from "@/shared/lib/utils";
import { PAGE_SIZE } from "@/shared/lib/constants";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  commission: "Comisión",
  owner_payout: "Liquidación",
};

type SortKey = "date" | "concept" | "source" | "category" | "amount";
type SortDir = "asc" | "desc";

export function CajaPage() {
  const { data, isLoading, isError } = useCashMovements();
  const deleteMovement = useDeleteCashMovement();
  const [formOpen, setFormOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<CashMovementRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashMovementRow | null>(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterDate, setFilterDate] = useState("");
  const [filterConcept, setFilterConcept] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterType, setFilterType] = useState<"" | "income" | "expense">("");

  const movements = data ?? [];

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const m of movements) set.add(SOURCE_LABELS[m.source] ?? m.source);
    return Array.from(set).sort();
  }, [movements]);

  const accounts = useMemo(() => {
    const set = new Set<string>();
    for (const m of movements) {
      if (m.category) set.add(m.category);
    }
    return Array.from(set).sort();
  }, [movements]);

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (filterDate && m.date !== filterDate) return false;
      if (filterConcept && !m.concept.toLowerCase().includes(filterConcept.toLowerCase()))
        return false;
      const src = SOURCE_LABELS[m.source] ?? m.source;
      if (filterSource && src !== filterSource) return false;
      if (filterAccount && (m.category ?? "") !== filterAccount) return false;
      if (filterType && m.type !== filterType) return false;
      return true;
    });
  }, [movements, filterDate, filterConcept, filterSource, filterAccount, filterType]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "concept") cmp = a.concept.localeCompare(b.concept);
      else if (sortKey === "source")
        cmp = (SOURCE_LABELS[a.source] ?? a.source).localeCompare(
          SOURCE_LABELS[b.source] ?? b.source,
        );
      else if (sortKey === "category")
        cmp = (a.category ?? "").localeCompare(b.category ?? "");
      else cmp = a.amount - b.amount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
    setPage(0);
  }

  const sortMark = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate2">
          Los totales e historial detallado están en{" "}
          <a href="/admin/ganancias" className="font-semibold text-brand hover:underline">
            Ganancias
          </a>
          .
        </p>
        <Button
          onClick={() => {
            setEditingMovement(null);
            setFormOpen(true);
          }}
          className="gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => { setFilterDate(e.target.value); setPage(0); }}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          aria-label="Filtrar por fecha"
        />
        <input
          type="text"
          value={filterConcept}
          onChange={(e) => { setFilterConcept(e.target.value); setPage(0); }}
          placeholder="Concepto"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        />
        <select
          value={filterSource}
          onChange={(e) => { setFilterSource(e.target.value); setPage(0); }}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          aria-label="Filtrar por origen"
        >
          <option value="">Todos los orígenes</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterAccount}
          onChange={(e) => { setFilterAccount(e.target.value); setPage(0); }}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          aria-label="Filtrar por cuenta"
        >
          <option value="">Todas las cuentas</option>
          {accounts.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value as "" | "income" | "expense"); setPage(0); }}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          aria-label="Filtrar por tipo"
        >
          <option value="">Ingreso y egreso</option>
          <option value="income">Solo ingresos</option>
          <option value="expense">Solo egresos</option>
        </select>
        {(filterDate || filterConcept || filterSource || filterAccount || filterType) && (
          <button
            type="button"
            className="text-xs text-slate2 underline-offset-2 hover:underline"
            onClick={() => {
              setFilterDate("");
              setFilterConcept("");
              setFilterSource("");
              setFilterAccount("");
              setFilterType("");
              setPage(0);
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {isLoading && (
        <div role="status" className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}

      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Error al cargar la caja. Intentá de nuevo.
        </p>
      )}

      {!isLoading && !isError && movements.length === 0 && (
        <div className="rounded-md border border-dashed border-mist py-16 text-center text-sm text-slate2">
          Todavía no hay movimientos. Los cobros generan ingresos automáticamente.
        </div>
      )}

      {!isLoading && !isError && sorted.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => toggleSort("date")}>
                    Fecha{sortMark("date")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => toggleSort("concept")}>
                    Concepto{sortMark("concept")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => toggleSort("source")}>
                    Origen{sortMark("source")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => toggleSort("category")}>
                    Cuenta{sortMark("category")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" className="font-semibold" onClick={() => toggleSort("amount")}>
                    Monto{sortMark("amount")}
                  </button>
                </TableHead>
                <TableHead className="w-28 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDate(m.date)}</TableCell>
                  <TableCell className="font-medium">{m.concept}</TableCell>
                  <TableCell className="text-slate2">
                    {SOURCE_LABELS[m.source] ?? m.source}
                  </TableCell>
                  <TableCell className="text-slate2">{m.category ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        m.type === "income" ? "text-green-700" : "text-destructive",
                      )}
                    >
                      {m.type === "income" ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      {m.type === "income" ? "+" : "−"}
                      {formatMoney(m.amount, m.currency)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {m.source === "manual" ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Editar ${m.concept}`}
                          className="h-8 w-8 p-0 text-slate2 hover:text-navy"
                          onClick={() => {
                            setEditingMovement(m);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Eliminar ${m.concept}`}
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          disabled={deleteMovement.isPending}
                          onClick={() => setDeleteTarget(m)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate2">—</span>
                    )}
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
        total={sorted.length}
        pageSize={PAGE_SIZE}
        itemLabel="movimientos"
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      <MovementFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingMovement(null);
        }}
        movement={editingMovement}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="mx-4 w-[calc(100%-2rem)] max-w-sm sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se va a borrar &quot;{deleteTarget?.concept}&quot; del{" "}
              {deleteTarget ? formatDate(deleteTarget.date) : ""}. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMovement.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMovement.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                void deleteMovement.mutateAsync(deleteTarget.id).then(() => {
                  setDeleteTarget(null);
                });
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
