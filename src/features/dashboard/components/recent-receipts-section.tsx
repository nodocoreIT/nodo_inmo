import { Link } from "react-router-dom";
import { useState } from "react";
import { FileText, Receipt } from "lucide-react";
import { usePayments } from "@/features/payments/hooks/use-payments";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { PaymentReceiptViewer } from "@/features/payments/components/payment-receipt-viewer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { formatMoney, formatDate } from "@/features/contracts/lib/contract-labels";
import type { RecentReceiptItem } from "../hooks/use-dashboard-metrics";

interface RecentReceiptsSectionProps {
  items: RecentReceiptItem[];
}

export function RecentReceiptsSection({ items }: RecentReceiptsSectionProps) {
  const { data: payments = [] } = usePayments();
  const { data: agency } = useOrgProfile();
  const [viewPayment, setViewPayment] = useState<any | null>(null);

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
              <TableHead className="px-2 md:px-4">Inquilino</TableHead>
              <TableHead className="px-2 md:px-4">Monto</TableHead>
              <TableHead className="px-2 md:px-4">
                <span className="hidden sm:inline">Fecha de cobro</span>
                <span className="inline sm:hidden">Fecha</span>
              </TableHead>
              <TableHead className="w-12 sm:w-28 text-right px-2 md:px-4">
                <span className="hidden sm:inline">Documento</span>
                <span className="inline sm:hidden">PDF</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="px-2 md:px-4 py-3 font-medium text-xs sm:text-sm text-navy max-w-[100px] sm:max-w-none truncate">
                  {item.tenantName}
                </TableCell>
                <TableCell className="px-2 md:px-4 py-3 font-semibold text-xs sm:text-sm whitespace-nowrap">
                  {formatMoney(item.amount, item.currency)}
                </TableCell>
                <TableCell className="px-2 md:px-4 py-3 text-xs sm:text-sm whitespace-nowrap">
                  {formatDate(item.paidDate)}
                </TableCell>
                <TableCell className="px-2 md:px-4 py-3 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-sm p-1.5 text-slate2 hover:bg-mist hover:text-navy hover:scale-105 active:scale-95"
                    aria-label={`Ver recibo de ${item.tenantName}`}
                    onClick={() => {
                      const payment = payments.find((p) => p.id === item.id);
                      if (payment) setViewPayment(payment);
                    }}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* PDF receipt viewer dialog */}
      <Dialog
        open={!!viewPayment}
        onOpenChange={(open) => {
          if (!open) setViewPayment(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Recibo de Cobro</DialogTitle>
            <DialogDescription>
              {viewPayment?.contract?.tenant?.name ?? "—"} ·{" "}
              {viewPayment?.contract?.property?.address ?? "—"} ·{" "}
              Periodo: {viewPayment?.period ?? "—"}
            </DialogDescription>
          </DialogHeader>
          {viewPayment && <PaymentReceiptViewer payment={viewPayment} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
