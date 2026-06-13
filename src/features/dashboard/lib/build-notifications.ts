import type { TaskRow } from "@/features/agenda/hooks/use-tasks";
import type { DashboardMetrics } from "../hooks/use-dashboard-metrics";
import { formatMoney, formatDate } from "@/features/contracts/lib/contract-labels";

export type NotificationKind =
  | "overdue_payment"
  | "pending_collection"
  | "overdue_task"
  | "today_task"
  | "upcoming_task"
  | "pending_settlement";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  href: string;
  priority: number;
}

const TASK_CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  visita: "Visita/Muestra",
  firma: "Firma de Contrato",
  cobro: "Cobro/Alquiler",
  mantenimiento: "Mantenimiento",
  tramite: "Trámite/Papelería",
};

function todayStr(today: Date): string {
  return today.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function taskCategoryLabel(category: string): string {
  return TASK_CATEGORY_LABELS[category] ?? category;
}

export function buildNotifications(
  tasks: TaskRow[],
  metrics: DashboardMetrics | null,
  options: { isAdmin?: boolean; today?: Date } = {},
): AppNotification[] {
  const today = options.today ?? new Date();
  const todayKey = todayStr(today);
  const horizon = addDays(todayKey, 7);
  const isAdmin = options.isAdmin ?? false;
  const list: AppNotification[] = [];

  if (metrics) {
    for (const item of metrics.overduePayments.items) {
      list.push({
        id: `overdue-payment-${item.id}`,
        kind: "overdue_payment",
        title: "Cobro vencido",
        description: `${item.tenantName} — ${formatMoney(item.amount, item.currency)} · ${item.propertyAddress} · venció ${formatDate(item.dueDate)}`,
        href: `/admin/payments?collect=${item.id}`,
        priority: 10,
      });
    }

    for (const item of metrics.currentMonthCollections) {
      const paymentId = item.payments[0]?.id;
      if (!paymentId) continue;
      list.push({
        id: `collection-${item.key}`,
        kind: "pending_collection",
        title: "Cobro pendiente del mes",
        description: `${item.tenantName} — saldo ${formatMoney(item.balance, item.currency)} · ${item.propertyAddress}`,
        href: `/admin/payments?collect=${paymentId}`,
        priority: 20,
      });
    }

    if (isAdmin) {
      for (const item of metrics.pendingSettlements.items) {
        list.push({
          id: `settlement-${item.ownerId}-${item.currency}`,
          kind: "pending_settlement",
          title: "Rendición pendiente",
          description: `Liquidar ${formatMoney(item.total, item.currency)} a ${item.ownerName}`,
          href: "/admin/rendiciones",
          priority: 50,
        });
      }
    }
  }

  const pendingTasks = tasks.filter((t) => t.status !== "completada");

  for (const task of pendingTasks) {
    if (task.due_date < todayKey) {
      list.push({
        id: `task-overdue-${task.id}`,
        kind: "overdue_task",
        title: "Tarea vencida",
        description: `${taskCategoryLabel(task.category)} — ${task.title} · venció ${formatDate(task.due_date)}`,
        href: `/admin/agenda?task=${task.id}`,
        priority: 15,
      });
      continue;
    }

    if (task.due_date === todayKey) {
      list.push({
        id: `task-today-${task.id}`,
        kind: "today_task",
        title: "Tarea para hoy",
        description: `${taskCategoryLabel(task.category)} — ${task.title}`,
        href: `/admin/agenda?task=${task.id}`,
        priority: 25,
      });
      continue;
    }

    if (task.due_date <= horizon) {
      list.push({
        id: `task-upcoming-${task.id}`,
        kind: "upcoming_task",
        title: "Tarea próxima",
        description: `${taskCategoryLabel(task.category)} — ${task.title} · ${formatDate(task.due_date)}`,
        href: `/admin/agenda?task=${task.id}`,
        priority: 40,
      });
    }
  }

  return list.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}
