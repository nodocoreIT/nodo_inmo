import { useMemo } from "react";
import { useAuth } from "@/app/auth/use-auth";
import { useTasks } from "@/features/agenda/hooks/use-tasks";
import { useDashboardMetrics } from "./use-dashboard-metrics";
import { buildNotifications, type AppNotification } from "../lib/build-notifications";

export interface NotificationsState {
  items: AppNotification[];
  count: number;
  loading: boolean;
  error: unknown;
}

export function useNotifications(today: Date = new Date()): NotificationsState {
  const { role } = useAuth();
  const tasks = useTasks();
  const metrics = useDashboardMetrics(today);

  const loading = tasks.isLoading || metrics.loading;
  const error = tasks.error ?? metrics.error ?? null;

  const items = useMemo(() => {
    if (loading || error) return [];
    return buildNotifications(tasks.data ?? [], metrics, {
      isAdmin: role === "admin",
      today,
    });
  }, [tasks.data, metrics, role, today, loading, error]);

  return {
    items,
    count: items.length,
    loading,
    error,
  };
}
