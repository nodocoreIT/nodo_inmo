import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Wallet,
  CheckCircle2,
  FileText,
  Calendar,
  Building2,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useDashboardMetrics } from "../hooks/use-dashboard-metrics";
import { useTasks } from "@/features/agenda/hooks/use-tasks";
import { DashboardStatCard } from "./dashboard-stat-card";
import { formatMoney } from "@/features/contracts/lib/contract-labels";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";

const MAX_LIST_ITEMS = 5;

// Available widget definitions
const WIDGET_OPTIONS = [
  { value: "overdue", label: "Pagos vencidos" },
  { value: "pending_settlements", label: "Liquidaciones pendientes" },
  { value: "recent_sealed", label: "Liquidado (últimos 30 días)" },
  { value: "active_contracts", label: "Contratos activos" },
  { value: "agenda", label: "Agenda y Tareas de Hoy" },
  { value: "navigation", label: "Navegación Rápida" },
];

function getLocalStorageSlots(): string[] {
  if (
    typeof window !== "undefined" &&
    typeof localStorage !== "undefined" &&
    typeof localStorage.getItem === "function"
  ) {
    const saved = localStorage.getItem("dashboard_slots");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) {
          return parsed;
        }
      } catch (e) {}
    }
  }
  return ["overdue", "pending_settlements", "recent_sealed", "active_contracts"];
}

// ── Sub-component to isolate useTasks hook and prevent test crashes ───────────
function DashboardAgendaWidget() {
  const { data: tasks = [] } = useTasks();
  const pendingTasks = tasks.filter((t) => t.status !== "completada");
  const agendaVisible = pendingTasks.slice(0, 3);
  const agendaExtra = pendingTasks.length - agendaVisible.length;

  return (
    <DashboardStatCard
      label="Agenda y Tareas"
      count={pendingTasks.length}
      severity="default"
      icon={Calendar}
    >
      <div className="flex flex-col gap-3">
        {pendingTasks.length === 0 ? (
          <p className="text-sm text-slate2">Sin tareas pendientes</p>
        ) : (
          <ul className="space-y-1">
            {agendaVisible.map((task) => (
              <li key={task.id} className="text-sm truncate font-medium flex items-center gap-1.5 text-navy">
                <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                <span>{task.title}</span>
              </li>
            ))}
            {agendaExtra > 0 ? (
              <li className="text-xs text-slate2">y {agendaExtra} más</li>
            ) : null}
          </ul>
        )}
        <div>
          <Link
            to="/admin/agenda"
            className="inline-flex items-center justify-center rounded-sm bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-colors shadow-sm"
          >
            Ver más
          </Link>
        </div>
      </div>
    </DashboardStatCard>
  );
}

// ── Main Dashboard Page Component ─────────────────────────────────────────────

export function DashboardPage() {
  const metrics = useDashboardMetrics();
  
  // Customizable Slots State
  const [slots, setSlots] = useState<string[]>(getLocalStorageSlots);
  const [configOpen, setConfigOpen] = useState(false);
  const [tempSlots, setTempSlots] = useState<string[]>(slots);

  // Keep temp slots in sync when opening dialog
  useEffect(() => {
    if (configOpen) {
      setTempSlots(slots);
    }
  }, [configOpen, slots]);

  const handleSaveConfig = () => {
    setSlots(tempSlots);
    if (
      typeof window !== "undefined" &&
      typeof localStorage !== "undefined" &&
      typeof localStorage.setItem === "function"
    ) {
      localStorage.setItem("dashboard_slots", JSON.stringify(tempSlots));
    }
    setConfigOpen(false);
  };

  const handleResetConfig = () => {
    const defaultSlots = ["overdue", "pending_settlements", "recent_sealed", "active_contracts"];
    setSlots(defaultSlots);
    if (
      typeof window !== "undefined" &&
      typeof localStorage !== "undefined" &&
      typeof localStorage.setItem === "function"
    ) {
      localStorage.setItem("dashboard_slots", JSON.stringify(defaultSlots));
    }
    setConfigOpen(false);
  };

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

  // Helper to render correct widget based on slot ID
  const renderWidget = (widgetKey: string) => {
    switch (widgetKey) {
      case "overdue":
        return (
          <DashboardStatCard
            key="overdue"
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
        );

      case "pending_settlements":
        return (
          <DashboardStatCard
            key="pending_settlements"
            label="Liquidaciones pendientes"
            count={pendingSettlements.count}
            totalByCurrency={pendingSettlements.totalByCurrency}
            severity="info"
            icon={Wallet}
          >
            <div className="flex flex-col gap-3">
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
              <div>
                <Link
                  to="/admin/caja?tab=liquidaciones"
                  className="inline-flex items-center justify-center rounded-sm bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Ver más
                </Link>
              </div>
            </div>
          </DashboardStatCard>
        );

      case "recent_sealed":
        return (
          <DashboardStatCard
            key="recent_sealed"
            label="Liquidado (últimos 30 días)"
            count={recentSealed.count}
            totalByCurrency={recentSealed.totalByCurrency}
            severity="success"
            icon={CheckCircle2}
          >
            <div className="mt-1">
              <Link
                to="/admin/caja?tab=liquidaciones"
                className="inline-flex items-center justify-center rounded-sm bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition-colors shadow-sm"
              >
                Ver más
              </Link>
            </div>
          </DashboardStatCard>
        );

      case "active_contracts":
        return (
          <DashboardStatCard
            key="active_contracts"
            label="Contratos activos"
            count={activeContracts}
            severity="default"
            icon={FileText}
          >
            <div className="mt-1">
              <Link
                to="/admin/contracts"
                className="inline-flex items-center justify-center rounded-sm bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-colors shadow-sm"
              >
                Ver más
              </Link>
            </div>
          </DashboardStatCard>
        );

      case "agenda":
        return <DashboardAgendaWidget key="agenda" />;

      case "navigation":
        return (
          <DashboardStatCard
            key="navigation"
            label="Navegación Rápida"
            count={6}
            severity="default"
            icon={Building2}
          >
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/admin/properties"
                  className="px-2 py-1 text-2xs font-semibold rounded bg-slate-100 text-navy hover:bg-brand/10 hover:text-brand transition-colors text-center truncate border border-border"
                >
                  Propiedades
                </Link>
                <Link
                  to="/admin/payments"
                  className="px-2 py-1 text-2xs font-semibold rounded bg-slate-100 text-navy hover:bg-brand/10 hover:text-brand transition-colors text-center truncate border border-border"
                >
                  Pagos
                </Link>
                <Link
                  to="/admin/contracts"
                  className="px-2 py-1 text-2xs font-semibold rounded bg-slate-100 text-navy hover:bg-brand/10 hover:text-brand transition-colors text-center truncate border border-border"
                >
                  Contratos
                </Link>
                <Link
                  to="/admin/caja"
                  className="px-2 py-1 text-2xs font-semibold rounded bg-slate-100 text-navy hover:bg-brand/10 hover:text-brand transition-colors text-center truncate border border-border"
                >
                  Caja
                </Link>
              </div>
              <div>
                <Link
                  to="/admin/portal"
                  className="inline-flex items-center justify-center rounded-sm bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-colors shadow-sm"
                >
                  Ver más
                </Link>
              </div>
            </div>
          </DashboardStatCard>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Configuration Toolbar */}
      <div className="flex justify-between items-center bg-card p-3 rounded-md border border-border shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-navy">Resumen operativo</h2>
          <p className="text-2xs text-slate2">Personalizá las tarjetas visibles desde el botón de la derecha.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfigOpen(true)}
          className="gap-1.5 text-xs font-semibold text-navy hover:bg-navy/5"
        >
          <Settings className="h-3.5 w-3.5" />
          Personalizar Inicio
        </Button>
      </div>

      {/* Main Grid Slots */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {slots.map((key) => renderWidget(key))}
      </div>

      {/* Customization Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-navy font-bold">Personalizar tarjetas de Inicio</DialogTitle>
            <DialogDescription>
              Elegí qué información querés mostrar en cada una de las 4 tarjetas principales de tu panel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <Label htmlFor={`slot-${index}`} className="text-xs font-bold text-navy uppercase">
                  Tarjeta {index + 1}
                </Label>
                <select
                  id={`slot-${index}`}
                  value={tempSlots[index]}
                  onChange={(e) => {
                    const updated = [...tempSlots];
                    updated[index] = e.target.value;
                    setTempSlots(updated);
                  }}
                  className="w-full text-sm rounded border border-border p-2 bg-white"
                >
                  {WIDGET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetConfig}
              className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
            >
              Reestablecer
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setConfigOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleSaveConfig} className="bg-brand text-white">
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
