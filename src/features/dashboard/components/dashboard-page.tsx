import { History, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/use-auth";
import { useDashboardMetrics } from "../hooks/use-dashboard-metrics";
import { useTasks } from "@/features/agenda/hooks/use-tasks";
import { DashboardActionCard } from "./dashboard-action-card";
import { MonthCollectionsSection } from "./month-collections-section";
import { RecentReceiptsSection } from "./recent-receipts-section";
import { formatMoney } from "@/features/contracts/lib/contract-labels";

function greetingName(user: ReturnType<typeof useAuth>["user"]): string {
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  if (fullName) return fullName.split(" ")[0];
  const email = user?.email ?? "";
  return email.split("@")[0] || "Usuario";
}

function todayLabel(): string {
  const formatted = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function DashboardPage() {
  const { user } = useAuth();
  const metrics = useDashboardMetrics();
  const { data: tasks = [] } = useTasks();
  const pendingTasks = tasks.filter((t) => t.status !== "completada");

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

  const { pendingSettlements, pastMonthDebts, currentMonthCollections, recentReceipts } =
    metrics;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-navy">
            Hola, {greetingName(user)}
          </h1>
          <p className="mt-1 text-sm text-slate2">Hoy es {todayLabel()}</p>
        </div>
        <Link
          to="/admin/agenda"
          className="inline-flex items-center gap-2 rounded-pill border border-border bg-card px-4 py-2 text-xs font-semibold text-navy shadow-sm hover:bg-mist"
        >
          <Calendar className="h-4 w-4 text-brand" />
          Ir a agenda
        </Link>
      </div>

      {/* Action cubes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardActionCard
          badge="Pendientes"
          title="Rendiciones"
          description={
            pendingSettlements.count > 0
              ? `${pendingSettlements.count} liquidación${pendingSettlements.count === 1 ? "" : "es"} lista${pendingSettlements.count === 1 ? "" : "s"} para dueños.`
              : "Pagos listos para dueños."
          }
          buttonLabel="Ver listado"
          to="/admin/rendiciones"
          tone="brand"
        />

        <DashboardActionCard
          badge="Caja"
          title="Ganancias"
          description="Comisiones y movimientos del mes."
          buttonLabel="Ver reporte"
          to="/admin/ganancias"
          tone="navy"
        />

        <DashboardActionCard
          badge="Comercial"
          title="Ventas"
          description="Catálogo de disponibilidad en portales."
          buttonLabel="Ver catálogo"
          to="/admin/portal"
          tone="amber"
        />

        <DashboardActionCard
          badge="Gestión"
          title="Tareas agenda"
          description={
            pendingTasks.length === 0
              ? "No hay tareas programadas con horario."
              : `${pendingTasks.length} tarea${pendingTasks.length === 1 ? "" : "s"} pendiente${pendingTasks.length === 1 ? "" : "s"}.`
          }
          buttonLabel="Ver agenda"
          to="/admin/agenda"
          tone="slate"
          extra={
            pendingTasks.length > 0 ? (
              <span className="inline-flex rounded-pill bg-amber-100 px-2 py-0.5 text-2xs font-bold text-amber-800">
                {pendingTasks.length} pendiente{pendingTasks.length === 1 ? "" : "s"}
              </span>
            ) : null
          }
        />
      </div>

      {pastMonthDebts.length > 0 ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-2">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900">
                Deudas de meses anteriores
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {pastMonthDebts.map((debt) => (
                  <li key={debt.id}>
                    <span className="font-semibold">{debt.tenantName}</span> debe del
                    mes {debt.monthLabel}:{" "}
                    <span className="font-bold">
                      {formatMoney(debt.amount, debt.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {/* Current month collections */}
      <MonthCollectionsSection items={currentMonthCollections} />

      {/* Recent receipts */}
      <RecentReceiptsSection items={recentReceipts} />
    </div>
  );
}
