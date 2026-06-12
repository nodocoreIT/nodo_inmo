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
              <TableHead>Inquilino</TableHead>
              <TableHead>Estado de pago</TableHead>
              <TableHead>Saldo a cobrar</TableHead>
              <TableHead className="w-32 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.key}>
                <TableCell>
                  <p className="font-semibold text-navy">{item.tenantName}</p>
                  <p className="text-xs text-slate2">{item.propertyAddress}</p>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex rounded-pill px-2.5 py-0.5 text-xs font-semibold uppercase",
                      STATUS_CLASS[item.status],
                    )}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </TableCell>
                <TableCell className="font-bold text-destructive">
                  {formatMoney(item.balance, item.currency)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    className="gap-1 bg-brand text-xs font-bold uppercase hover:opacity-90"
                    onClick={() => handleCollect(item)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {item.status === "pago_parcial" ? "Saldar" : "Cobrar"}
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
