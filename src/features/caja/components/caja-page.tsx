import { useState } from "react";
import { Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useCashMovements } from "@/features/caja/hooks/use-cash-movements";
import { useOwnerSettlements } from "@/features/caja/hooks/use-owner-settlements";
import { useSettleOwner } from "@/features/caja/hooks/use-settle-owner";
import { MovementFormDialog } from "./movement-form-dialog";
import { HistorialTab } from "./historial-tab";
import {
  computeTotals,
  groupPendingByOwner,
} from "@/features/caja/lib/caja-math";
import {
  formatMoney,
  formatDate,
} from "@/features/contracts/lib/contract-labels";
import { cn } from "@/shared/lib/utils";

type Tab = "movimientos" | "liquidaciones" | "historial";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  commission: "Comisión",
  owner_payout: "Liquidación",
};

export function CajaPage() {
  const [tab, setTab] = useState<Tab>("movimientos");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <TabButton
          active={tab === "movimientos"}
          onClick={() => setTab("movimientos")}
        >
          Movimientos
        </TabButton>
        <TabButton
          active={tab === "liquidaciones"}
          onClick={() => setTab("liquidaciones")}
        >
          Liquidaciones
        </TabButton>
        <TabButton
          active={tab === "historial"}
          onClick={() => setTab("historial")}
        >
          Historial
        </TabButton>
      </div>

      {tab === "movimientos" && <MovementsTab />}
      {tab === "liquidaciones" && <SettlementsTab />}
      {tab === "historial" && <HistorialTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-navy text-white" : "bg-mist text-slate2 hover:bg-mist/70",
      )}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  valueClass,
  labelClass,
}: {
  label: string;
  value: string;
  valueClass: string;
  labelClass?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-5 py-4 shadow-sm">
      <p
        className={cn(
          "text-xs font-bold uppercase tracking-wide",
          labelClass ?? "text-slate2",
        )}
      >
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold", valueClass)}>{value}</p>
    </div>
  );
}

// ── Movimientos ───────────────────────────────────────────────────────────────

function MovementsTab() {
  const { data, isLoading, isError } = useCashMovements();
  const [createOpen, setCreateOpen] = useState(false);

  const movements = data ?? [];
  const { income, expense, balance } = computeTotals(movements);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Ingresos"
          value={formatMoney(income, "ARS")}
          valueClass="text-green-700"
          labelClass="text-green-700"
        />
        <StatCard
          label="Egresos"
          value={formatMoney(expense, "ARS")}
          valueClass="text-destructive"
          labelClass="text-destructive"
        />
        <StatCard
          label="Saldo de caja"
          value={formatMoney(balance, "ARS")}
          valueClass={balance >= 0 ? "text-navy" : "text-destructive"}
        />
      </div>

      {isLoading && (
        <div
          role="status"
          aria-label="Cargando caja"
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
          Error al cargar la caja. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && movements.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            Todavía no hay movimientos
          </p>
          <p className="text-xs text-slate2-300">
            Los cobros generan ingresos automáticamente, o cargá uno manual.
          </p>
        </div>
      )}

      {!isLoading && !isError && movements.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDate(m.date)}</TableCell>
                  <TableCell className="font-medium">{m.concept}</TableCell>
                  <TableCell className="text-slate2">
                    {SOURCE_LABELS[m.source] ?? m.source}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        m.type === "income"
                          ? "text-green-700"
                          : "text-destructive",
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MovementFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => setCreateOpen(false)}
      />
    </div>
  );
}

// ── Liquidaciones ─────────────────────────────────────────────────────────────

function SettlementsTab() {
  const { data, isLoading, isError } = useOwnerSettlements();
  const settleOwner = useSettleOwner();

  const allSettlements = data ?? [];
  const pendingGroups = groupPendingByOwner(allSettlements);

  const hasPending = pendingGroups.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {isLoading && (
        <div
          role="status"
          aria-label="Cargando liquidaciones"
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
          Error al cargar las liquidaciones. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && !hasPending && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            No hay liquidaciones pendientes
          </p>
          <p className="text-xs text-slate2-300">
            Cuando cobres alquileres de propiedades con dueño, acá vas a ver
            cuánto liquidarle.
          </p>
        </div>
      )}

      {/* ── Pending settlements — Liquidar action ──────────────────────────── */}
      {!isLoading && !isError && hasPending && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propietario</TableHead>
                <TableHead>Cuotas</TableHead>
                <TableHead className="text-right">A liquidar</TableHead>
                <TableHead className="w-28 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingGroups.map((g) => (
                <TableRow key={`${g.owner_id}:${g.currency}`}>
                  <TableCell className="font-medium">{g.owner_name}</TableCell>
                  <TableCell>{g.settlement_ids.length}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(g.total, g.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={settleOwner.isPending}
                      onClick={() =>
                        settleOwner.mutate({
                          owner_id: g.owner_id,
                          owner_name: g.owner_name,
                          settlement_ids: g.settlement_ids,
                          total: g.total,
                          currency: g.currency,
                        })
                      }
                    >
                      Liquidar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
