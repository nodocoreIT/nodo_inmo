import { useState, useRef, useEffect } from "react";
import { Bell, AlertTriangle, Calendar, Info } from "lucide-react";
import { useDashboardMetrics } from "@/features/dashboard/hooks/use-dashboard-metrics";
import { formatMoney } from "@/features/contracts/lib/contract-labels";
import { cn } from "@/shared/lib/utils";

export function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Reuse existing dashboard metrics to pull real overdue payments and pending settlements
  const metrics = useDashboardMetrics();
  
  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (metrics.loading || metrics.error) {
    return (
      <button className="relative p-2 text-slate2 hover:text-navy transition-colors rounded-full hover:bg-slate-100">
        <Bell className="h-5 w-5" />
      </button>
    );
  }

  const { overduePayments, pendingSettlements } = metrics;

  // Build notifications dynamically
  const notificationsList = [];

  // Overdue payment notifications
  overduePayments.items.forEach((item) => {
    notificationsList.push({
      id: `overdue-${item.id}`,
      type: "overdue",
      title: "Vencimiento de pago pendiente",
      description: `El inquilino ${item.tenantName} tiene un pago vencido por ${formatMoney(item.amount, item.currency)} (${item.propertyAddress}).`,
      icon: AlertTriangle,
      iconColor: "text-rose-500 bg-rose-50",
    });
  });

  // Pending settlements to owners notifications
  pendingSettlements.items.forEach((item) => {
    notificationsList.push({
      id: `settlement-${item.ownerId}-${item.currency}`,
      type: "settlement",
      title: "Liquidación pendiente a Propietario",
      description: `Falta liquidar un saldo de ${formatMoney(item.total, item.currency)} a ${item.ownerName}.`,
      icon: Info,
      iconColor: "text-amber-500 bg-amber-50",
    });
  });

  // Simulated calendar items for agenda notification
  notificationsList.push({
    id: "agenda-today-1",
    type: "agenda",
    title: "Hoy en tu agenda",
    description: "Reunión de firma de contrato en Av. Corrientes 1234 a las 17:30 hs.",
    icon: Calendar,
    iconColor: "text-brand bg-brand-300/10",
  });

  const count = notificationsList.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell trigger */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 text-navy hover:text-brand transition-colors rounded-full hover:bg-navy/5 focus:outline-none"
        aria-label={`${count} notificaciones`}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white ring-2 ring-[#EEF3F8]">
            {count}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 w-80 sm:w-96 rounded-md border border-border bg-card shadow-lg overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-slate-50 px-4 py-3">
            <h3 className="font-display text-sm font-bold text-navy">Notificaciones</h3>
            <span className="rounded-pill bg-brand/10 px-2 py-0.5 text-2xs font-semibold text-brand">
              {count} pendientes
            </span>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {notificationsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Bell className="h-8 w-8 text-slate2-300" />
                <p className="mt-2 text-sm text-slate2">No tenés novedades por el momento</p>
              </div>
            ) : (
              notificationsList.map((notif) => {
                const Icon = notif.icon;
                return (
                  <div
                    key={notif.id}
                    className="flex gap-3 p-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", notif.iconColor)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-navy leading-none mb-1">
                        {notif.title}
                      </p>
                      <p className="text-2xs text-slate2 leading-relaxed">
                        {notif.description}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
