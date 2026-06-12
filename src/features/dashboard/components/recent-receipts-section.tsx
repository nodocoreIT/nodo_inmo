import { Link } from "react-router-dom";
import { FileText, Receipt } from "lucide-react";
import { usePayments } from "@/features/payments/hooks/use-payments";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { downloadPaymentReceipt } from "@/features/payments/lib/payment-receipt-pdf";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatMoney, formatDate } from "@/features/contracts/lib/contract-labels";
import type { RecentReceiptItem } from "../hooks/use-dashboard-metrics";

interface RecentReceiptsSectionProps {
  items: RecentReceiptItem[];
}

export function RecentReceiptsSection({ items }: RecentReceiptsSectionProps) {
  const { data: payments = [] } = usePayments();
  const { data: agency } = useOrgProfile();

  return (
    <section className="rounded-md border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-brand" />
          <h2 className="font-display text-base font-bold text-navy">
            Recibos recientes
          </h2>
        </div>
        <Link
          to="/admin/payments"
          className="text-xs font-semibold text-brand hover:underline"
        >
          Ver historial completo
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate2">
          Todavía no hay recibos cobrados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inquilino</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Fecha de cobro</TableHead>
              <TableHead className="w-28 text-right">Documentos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-navy">
                  {item.tenantName}
                </TableCell>
                <TableCell className="font-semibold">
                  {formatMoney(item.amount, item.currency)}
                </TableCell>
                <TableCell>{formatDate(item.paidDate)}</TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-sm p-1.5 text-slate2 hover:bg-mist hover:text-navy"
                    aria-label={`Descargar recibo de ${item.tenantName}`}
                    onClick={() => {
                      const payment = payments.find((p) => p.id === item.id);
                      if (payment) void downloadPaymentReceipt(payment, agency ?? null);
                    }}
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
