import { useState, useMemo, useEffect } from "react";
import { PAGE_SIZE } from "@/shared/lib/constants";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { usePayments } from "@/features/payments/hooks/use-payments";
import {
  PAYMENT_STATUS_LABELS,
  effectiveStatus,
  formatPeriod,
  type EffectiveStatus,
} from "@/features/payments/lib/payment-labels";
import {
  formatMoney,
  formatDate,
} from "@/features/contracts/lib/contract-labels";
import { useSearchStore } from "@/shared/search/use-search-store";
import { matchesQuery } from "@/shared/search/matches-query";
import { cn } from "@/shared/lib/utils";
import { PaymentCollectDialog } from "./payment-collect-dialog";
import { useDeletePayments, useAnnulPayment } from "../hooks/use-delete-payment";

type Filter = "all" | "pending" | "overdue" | "paid";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "overdue", label: "Vencidas" },
  { value: "paid", label: "Cobradas" },
];

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export function PaymentsList() {
  const { data, isLoading, isError } = usePayments();
  const query = useSearchStore((s) => s.query);
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const collectPaymentId = searchParams.get("collect");
  const statusParam = searchParams.get("status");
  const initialFilter: Filter =
    statusParam === "overdue" || statusParam === "pending" || statusParam === "paid"
      ? statusParam
      : "all";

  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const deletePayments = useDeletePayments();
  const annulPayment = useAnnulPayment();

  useEffect(() => {
    const next: Filter =
      statusParam === "overdue" || statusParam === "pending" || statusParam === "paid"
        ? statusParam
        : "all";
    setFilter(next);
  }, [statusParam]);

  function isDeletable(status: EffectiveStatus): boolean {
    return status === "pending" || status === "overdue";
  }

  function resetPage() {
    setPage(0);
  }

  // Derive unique owners + months for selects (from full dataset)
  const owners = useMemo(() => {
    const names = new Set<string>();
    for (const p of data ?? []) {
      const name = p.contract?.property?.owner?.name;
      if (name) names.add(name);
    }
    return Array.from(names).sort();
  }, [data]);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const p of data ?? []) {
      if (p.due_date) set.add(p.due_date.slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, [data]);

  const filteredRows = useMemo(() => {
    return (data ?? []).filter((p) => {
      const eff = effectiveStatus(p);
      if (filter !== "all" && eff !== filter) return false;
      if (ownerFilter && p.contract?.property?.owner?.name !== ownerFilter) return false;
      if (monthFilter && p.due_date?.slice(0, 7) !== monthFilter) return false;
      return matchesQuery(
        [
          p.contract?.property?.address,
          p.contract?.tenant?.name,
          p.contract?.property?.owner?.name,
          formatPeriod(p.period),
        ],
        query,
      );
    });
  }, [data, filter, ownerFilter, monthFilter, query]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pagedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const deletableOnPage = pagedRows.filter((p) => isDeletable(effectiveStatus(p)));
  const allPageSelected =
    deletableOnPage.length > 0 &&
    deletableOnPage.every((p) => selectedIds.has(p.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const p of deletableOnPage) next.delete(p.id);
      } else {
        for (const p of deletableOnPage) next.add(p.id);
      }
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await deletePayments.mutateAsync(ids);
    setSelectedIds(new Set());
  }

  function openCollectDialog(id: string) {
    setSearchParams((prev) => {
      prev.set("collect", id);
      return prev;
    });
  }

  function closeCollectDialog() {
    setSearchParams((prev) => {
      prev.delete("collect");
      return prev;
    });
  }

  const hasActiveAdvancedFilter = !!ownerFilter || !!monthFilter;

  return (
    <div className="flex flex-col gap-4">
      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => { setFilter(f.value); resetPage(); }}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "bg-navy text-white"
                : "bg-mist text-slate2 hover:bg-mist/70",
            )}
          >
            {f.label}
          </button>
        )        )}
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2">
          <span className="text-sm text-navy">
            {selectedIds.size} cuota{selectedIds.size === 1 ? "" : "s"} seleccionada
            {selectedIds.size === 1 ? "" : "s"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={deletePayments.isPending}
            onClick={() => void handleBulkDelete()}
          >
            <Trash2 className="h-4 w-4" />
            {deletePayments.isPending ? "Eliminando…" : "Eliminar seleccionadas"}
          </Button>
          <button
            type="button"
            className="text-xs text-slate2 underline-offset-2 hover:underline"
            onClick={() => setSelectedIds(new Set())}
          >
            Deseleccionar
          </button>
        </div>
      ) : null}

      {/* Advanced filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={ownerFilter}
          onChange={(e) => { setOwnerFilter(e.target.value); resetPage(); }}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm text-slate2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30",
            ownerFilter ? "border-brand bg-brand/5 font-medium" : "border-border bg-card",
          )}
          aria-label="Filtrar por propietario"
        >
          <option value="">Todos los propietarios</option>
          {owners.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={monthFilter}
          onChange={(e) => { setMonthFilter(e.target.value); resetPage(); }}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm text-slate2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30",
            monthFilter ? "border-brand bg-brand/5 font-medium" : "border-border bg-card",
          )}
          aria-label="Filtrar por mes de vencimiento"
        >
          <option value="">Todos los meses</option>
          {months.map((ym) => (
            <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
          ))}
        </select>

        {hasActiveAdvancedFilter && (
          <button
            type="button"
            onClick={() => { setOwnerFilter(""); setMonthFilter(""); resetPage(); }}
            className="text-xs text-slate2 underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {isLoading && (
        <div
          role="status"
          aria-label="Cargando pagos"
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
          Error al cargar los pagos. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">Todavía no hay cuotas generadas</p>
          <p className="text-xs text-slate2-300">
            Generá las cuotas desde un contrato en la sección Contratos.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && filteredRows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-mist py-12 text-center">
          <p className="text-sm font-medium text-slate2">Sin resultados para este filtro</p>
        </div>
      )}

      {!isLoading && !isError && pagedRows.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-mist text-brand"
                    checked={allPageSelected}
                    disabled={deletableOnPage.length === 0}
                    aria-label="Seleccionar cuotas de esta página"
                    onChange={toggleSelectPage}
                  />
                </TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead>Inquilino</TableHead>
                <TableHead>Propietario</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-44 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((p) => {
                const eff = effectiveStatus(p);
                const canDelete = isDeletable(eff);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      {canDelete ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-mist text-brand"
                          checked={selectedIds.has(p.id)}
                          aria-label={`Seleccionar cuota ${formatPeriod(p.period)}`}
                          onChange={() => toggleSelect(p.id)}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">{formatPeriod(p.period)}</TableCell>
                    <TableCell>{p.contract?.property?.address ?? "—"}</TableCell>
                    <TableCell>{p.contract?.tenant?.name ?? "—"}</TableCell>
                    <TableCell>{p.contract?.property?.owner?.name ?? "—"}</TableCell>
                    <TableCell>{formatDate(p.due_date)}</TableCell>
                    <TableCell>{formatMoney(p.amount, p.currency)}</TableCell>
                    <TableCell><StatusBadge status={eff} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {eff === "cancelled" ? (
                          <span className="text-xs text-slate2">—</span>
                        ) : eff === "paid" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Modificar cobro"
                              onClick={() => openCollectDialog(p.id)}
                              className="gap-1 text-slate2 hover:text-navy"
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Anular cobro"
                              disabled={annulPayment.isPending}
                              onClick={() => openCollectDialog(p.id)}
                              className="gap-1 text-destructive hover:bg-destructive/10"
                            >
                              <Undo2 className="h-4 w-4" />
                              Anular
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Registrar cobro"
                              onClick={() => openCollectDialog(p.id)}
                              className="gap-1 text-green-700 hover:bg-green-50 hover:text-green-800"
                            >
                              <Check className="h-4 w-4" />
                              Cobrar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Eliminar cuota"
                              disabled={deletePayments.isPending}
                              onClick={() => void deletePayments.mutateAsync([p.id])}
                              className="gap-1 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !isError && filteredRows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate2">
          <span>
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} de {filteredRows.length} cuotas
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
            <span className="px-2 tabular-nums">
              {page + 1} / {totalPages}
            </span>
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

      <PaymentCollectDialog
        paymentId={collectPaymentId}
        open={!!collectPaymentId}
        onOpenChange={(open) => {
          if (!open) closeCollectDialog();
        }}
        onSuccess={() => {
          if (searchParams.get("from") === "dashboard") {
            navigate("/admin/dashboard");
          }
        }}
      />
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EffectiveStatus }) {
  const colorMap: Record<EffectiveStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium ${colorMap[status]}`}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
