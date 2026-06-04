import { useState } from "react";
import { Check } from "lucide-react";
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
import { useUpdatePayment } from "@/features/payments/hooks/use-update-payment";
import {
  PAYMENT_STATUS_LABELS,
  effectiveStatus,
  formatPeriod,
  type EffectiveStatus,
} from "@/features/payments/lib/payment-labels";
import { formatMoney, formatDate } from "@/features/contracts/lib/contract-labels";
import { useSearchStore } from "@/shared/search/use-search-store";
import { matchesQuery } from "@/shared/search/matches-query";
import { cn } from "@/shared/lib/utils";

type Filter = "all" | "pending" | "overdue" | "paid";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "overdue", label: "Vencidas" },
  { value: "paid", label: "Cobradas" },
];

export function PaymentsList() {
  const { data, isLoading, isError } = usePayments();
  const updatePayment = useUpdatePayment();
  const query = useSearchStore((s) => s.query);
  const [filter, setFilter] = useState<Filter>("all");

  const rows = (data ?? []).filter((p) => {
    const eff = effectiveStatus(p);
    if (filter !== "all" && eff !== filter) return false;
    return matchesQuery(
      [p.contract?.property?.address, p.contract?.tenant?.name, formatPeriod(p.period)],
      query,
    );
  });

  function markPaid(id: string, amount: number) {
    const today = new Date().toISOString().slice(0, 10);
    updatePayment.mutate({
      id,
      status: "paid",
      paid_date: today,
      paid_amount: amount,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "bg-navy text-white"
                : "bg-mist text-slate2 hover:bg-mist/70",
            )}
          >
            {f.label}
          </button>
        ))}
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
          <p className="text-sm font-medium text-slate2">
            Todavía no hay cuotas generadas
          </p>
          <p className="text-xs text-slate2-300">
            Generá las cuotas desde un contrato en la sección Contratos.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-mist py-12 text-center">
          <p className="text-sm font-medium text-slate2">
            Sin resultados para este filtro
          </p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead>Inquilino</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-28 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const eff = effectiveStatus(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {formatPeriod(p.period)}
                    </TableCell>
                    <TableCell>{p.contract?.property?.address ?? "—"}</TableCell>
                    <TableCell>{p.contract?.tenant?.name ?? "—"}</TableCell>
                    <TableCell>{formatDate(p.due_date)}</TableCell>
                    <TableCell>{formatMoney(p.amount, p.currency)}</TableCell>
                    <TableCell>
                      <StatusBadge status={eff} />
                    </TableCell>
                    <TableCell className="text-right">
                      {eff === "paid" ? (
                        <span className="text-xs text-slate2">
                          {formatDate(p.paid_date)}
                        </span>
                      ) : eff === "cancelled" ? (
                        <span className="text-xs text-slate2">—</span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Marcar cobrada"
                          onClick={() => markPaid(p.id, p.amount)}
                          className="gap-1 text-green-700 hover:bg-green-50 hover:text-green-800"
                        >
                          <Check className="h-4 w-4" />
                          Cobrar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
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
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium ${colorMap[status]}`}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
