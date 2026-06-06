import { AlertTriangle, Wallet, CheckCircle2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { useDashboardMetrics } from "../hooks/use-dashboard-metrics";
import { DashboardStatCard } from "./dashboard-stat-card";
import { formatMoney } from "@/features/contracts/lib/contract-labels";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_LIST_ITEMS = 5;

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const metrics = useDashboardMetrics();

  if (metrics.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          role="status"
          aria-label="Cargando panel"
          className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent"
        />
      </div>
    );
  }

  if (metrics.error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive bg-destructive/10 px-5 py-4 text-sm text-destructive"
      >
        Error al cargar el panel. Intentá de nuevo.
      </div>
    );
  }

  const { overduePayments, pendingSettlements, recentSealed, activeContracts } =
    metrics;

  // Overdue list (capped)
  const overdueVisible = overduePayments.items.slice(0, MAX_LIST_ITEMS);
  const overdueExtra = overduePayments.items.length - overdueVisible.length;

  // Pending settlements list (capped)
  const pendingVisible = pendingSettlements.items.slice(0, MAX_LIST_ITEMS);
  const pendingExtra = pendingSettlements.items.length - pendingVisible.length;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Card 1 — Pagos vencidos */}
      <DashboardStatCard
        label="Pagos vencidos"
        count={overduePayments.count}
        totalByCurrency={overduePayments.totalByCurrency}
        severity="danger"
        icon={AlertTriangle}
      >
        <div className="flex flex-col gap-3">
          {overduePayments.count === 0 ? (
            <p className="text-sm text-slate2">Sin pagos vencidos</p>
          ) : (
            <ul className="space-y-1">
              {overdueVisible.map((item) => (
                <li key={item.id} className="text-sm">
                  <span className="font-medium">{item.tenantName}</span>
                  {" · "}
                  <span className="text-slate2">{item.propertyAddress}</span>
                  {" · "}
                  <span>{formatMoney(item.amount, item.currency)}</span>
                </li>
              ))}
              {overdueExtra > 0 ? (
                <li className="text-xs text-slate2">y {overdueExtra} más</li>
              ) : null}
            </ul>
          )}
          <div>
            <Link
              to="/admin/payments?status=overdue"
              className="inline-flex items-center justify-center rounded-sm bg-[var(--color-destructive)] px-3 py-1.5 text-xs font-semibold text-[var(--color-destructive-foreground)] hover:opacity-90 transition-colors shadow-sm"
            >
              Ver más
            </Link>
          </div>
        </div>
      </DashboardStatCard>

      {/* Card 2 — Liquidaciones pendientes */}
      <DashboardStatCard
        label="Liquidaciones pendientes"
        count={pendingSettlements.count}
        totalByCurrency={pendingSettlements.totalByCurrency}
        severity="default"
        icon={Wallet}
      >
        {pendingSettlements.count === 0 ? (
          <p className="text-sm text-slate2">Sin liquidaciones pendientes</p>
        ) : (
          <ul className="space-y-1">
            {pendingVisible.map((item) => (
              <li key={`${item.ownerId}-${item.currency}`} className="text-sm">
                <span className="font-medium">{item.ownerName}</span>
                {" · "}
                <span>{formatMoney(item.total, item.currency)}</span>
              </li>
            ))}
            {pendingExtra > 0 ? (
              <li className="text-xs text-slate2">y {pendingExtra} más</li>
            ) : null}
          </ul>
        )}
      </DashboardStatCard>

      {/* Card 3 — Liquidado (últimos 30 días) */}
      <DashboardStatCard
        label="Liquidado (últimos 30 días)"
        count={recentSealed.count}
        totalByCurrency={recentSealed.totalByCurrency}
        severity="success"
        icon={CheckCircle2}
      />

      {/* Card 4 — Contratos activos */}
      <DashboardStatCard
        label="Contratos activos"
        count={activeContracts}
        severity="default"
        icon={FileText}
      />
    </div>
  );
}
