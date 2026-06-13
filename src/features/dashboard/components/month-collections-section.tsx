import { useNavigate } from "react-router-dom";
import { Clock, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatMoney } from "@/features/contracts/lib/contract-labels";
import type { MonthCollectionItem } from "../hooks/use-dashboard-metrics";
import { currentMonthLabel } from "../lib/dashboard-payment-utils";
import { cn } from "@/shared/lib/utils";

interface MonthCollectionsSectionProps {
  items: MonthCollectionItem[];
}

const STATUS_LABEL = {
  sin_cobrar: "Sin cobrar",
  pago_parcial: "Pago parcial",
} as const;

const STATUS_CLASS = {
  sin_cobrar: "bg-red-100 text-red-700",
  pago_parcial: "bg-yellow-100 text-yellow-800",
} as const;

export function MonthCollectionsSection({ items }: MonthCollectionsSectionProps) {
  const navigate = useNavigate();
  const monthLabel = currentMonthLabel();

  function handleCollect(item: MonthCollectionItem) {
    const firstPaymentId = item.payments[0]?.id;
    if (!firstPaymentId) return;
    navigate(`/admin/payments?collect=${firstPaymentId}&from=dashboard`);
  }

  return (
    <section className="rounded-md border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Clock className="h-4 w-4 text-brand" />
        <h2 className="font-display text-base font-bold text-navy">
          Cobros del mes de {monthLabel}
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate2">
          No hay cobros pendientes para este mes.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-2 md:px-4">Inquilino</TableHead>
              <TableHead className="px-2 md:px-4">
                <span className="hidden sm:inline">Estado de pago</span>
                <span className="inline sm:hidden">Estado</span>
              </TableHead>
              <TableHead className="px-2 md:px-4">
                <span className="hidden sm:inline">Saldo a cobrar</span>
                <span className="inline sm:hidden">Saldo</span>
              </TableHead>
              <TableHead className="w-12 sm:w-32 text-right px-2 md:px-4">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.key}>
                <TableCell className="px-2 md:px-4 py-3 max-w-[100px] sm:max-w-none">
                  <p className="font-semibold text-xs sm:text-sm text-navy truncate">{item.tenantName}</p>
                  <p className="text-[10px] sm:text-xs text-slate2 truncate">{item.propertyAddress}</p>
                </TableCell>
                <TableCell className="px-2 md:px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-pill px-2 py-0.5 text-[10px] sm:text-xs font-semibold uppercase whitespace-nowrap",
                      STATUS_CLASS[item.status],
                    )}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </TableCell>
                <TableCell className="px-2 md:px-4 py-3 font-bold text-xs sm:text-sm text-destructive whitespace-nowrap">
                  {formatMoney(item.balance, item.currency)}
                </TableCell>
                <TableCell className="px-2 md:px-4 py-3 text-right">
                  <Button
                    size="sm"
                    className="h-7 w-7 sm:h-8 sm:w-auto p-0 sm:px-3 sm:py-2 gap-1 bg-brand text-xs font-bold uppercase hover:opacity-90 flex items-center justify-center ml-auto"
                    onClick={() => handleCollect(item)}
                    title={item.status === "pago_parcial" ? "Saldar" : "Cobrar"}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">
                      {item.status === "pago_parcial" ? "Saldar" : "Cobrar"}
                    </span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
