import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Share2, Wallet } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useCashMovements } from "@/features/caja/hooks/use-cash-movements";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { formatMoney } from "@/features/contracts/lib/contract-labels";
import {
  buildMonthlyBalance,
  formatPeriodTitle,
} from "../lib/monthly-balance";
import {
  downloadMonthlyReport,
  shareMonthlyReport,
} from "../lib/monthly-report-pdf";
import { cn } from "@/shared/lib/utils";

function currentPeriodYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function GananciasPage() {
  const { data: movements = [], isLoading, isError } = useCashMovements();
  const { data: agency } = useOrgProfile();
  const [periodYm, setPeriodYm] = useState(currentPeriodYm);
  const [pdfLoading, setPdfLoading] = useState(false);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const m of movements) set.add(m.date.slice(0, 7));
    set.add(currentPeriodYm());
    return Array.from(set).sort().reverse();
  }, [movements]);

  const summary = useMemo(
    () => buildMonthlyBalance(movements, periodYm),
    [movements, periodYm],
  );

  async function handlePdf(download: boolean) {
    setPdfLoading(true);
    try {
      const data = {
        agencyName: agency?.legal_name ?? "NODO INMO",
        address: agency?.address ?? "",
        periodLabel: formatPeriodTitle(periodYm),
        periodYm,
        summary,
      };
      if (download) await downloadMonthlyReport(data);
      else await shareMonthlyReport(data);
    } finally {
      setPdfLoading(false);
    }
  }

  const cards = [
    { label: "Adm. Alquileres", value: summary.admAlquileres, color: "border-green-500" },
    { label: "Contratos / Renov.", value: summary.contratos, color: "border-blue-500" },
    { label: "Ventas Inmob.", value: summary.ventas, color: "border-amber-500" },
    { label: "Dirección Obra", value: summary.direccionObra, color: "border-slate-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-brand" />
          <div>
            <p className="text-2xs font-bold uppercase tracking-wide text-slate2">
              Balance mensual
            </p>
            <h1 className="font-display text-xl font-bold text-navy">
              {formatPeriodTitle(periodYm)}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periodYm}
            onChange={(e) => setPeriodYm(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            aria-label="Período visualizado"
          >
            {months.map((ym) => (
              <option key={ym} value={ym}>
                {formatPeriodTitle(ym)}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={pdfLoading}
            onClick={() => void handlePdf(true)}
          >
            <FileText className="h-4 w-4 text-destructive" />
            PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={pdfLoading}
            onClick={() => void handlePdf(false)}
          >
            <Share2 className="h-4 w-4" />
            Enviar
          </Button>
          <Link
            to="/admin/dashboard"
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-4 py-1.5 text-xs font-semibold text-slate2 hover:bg-mist"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Link>
        </div>
      </div>

      {isLoading && (
        <div role="status" className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}

      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Error al cargar movimientos de caja.
        </p>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className={cn(
                    "rounded-md border-t-4 bg-card px-4 py-3 shadow-sm border border-border",
                    card.color,
                  )}
                >
                  <p className="text-2xs font-bold uppercase text-slate2">
                    {card.label}
                  </p>
                  <p className="mt-1 text-lg font-bold text-navy">
                    {formatMoney(card.value, "ARS")}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-border bg-card px-5 py-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate2">
                Resultado neto mensual
              </p>
              <div className="mt-2 flex flex-wrap gap-6">
                <div>
                  <p className="text-2xs text-slate2">Pesos</p>
                  <p className="text-2xl font-bold text-navy">
                    {formatMoney(summary.netoArs, "ARS")}
                  </p>
                </div>
                <div>
                  <p className="text-2xs text-slate2">Dólares</p>
                  <p className="text-2xl font-bold text-brand">
                    {formatMoney(summary.netoUsd, "USD")}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-3">
                <h2 className="font-display text-sm font-bold text-navy">
                  Historial de movimientos
                </h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Detalle / Concepto</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead className="text-right">Monto ARS</TableHead>
                    <TableHead className="text-right">Monto U$S</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate2">
                        Sin movimientos en este período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.date.split("-").reverse().join("/").slice(0, 5)}</TableCell>
                        <TableCell className="max-w-xs truncate font-medium">
                          {m.detail}
                        </TableCell>
                        <TableCell>
                          <span className="rounded-pill bg-green-100 px-2 py-0.5 text-2xs font-semibold text-green-800">
                            {m.origin}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {m.amountArs != null
                            ? formatMoney(m.amountArs, "ARS")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.amountUsd != null
                            ? formatMoney(m.amountUsd, "USD")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-md border border-border bg-card p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase text-slate2">
                Saldos en cuenta
              </h3>
              <div className="mt-3 space-y-2">
                {summary.accountBalances.map((a) => (
                  <div
                    key={`${a.label}-${a.currency}`}
                    className="rounded-md border border-border bg-mist/30 px-3 py-2"
                  >
                    <p className="text-2xs font-bold uppercase text-slate2">
                      {a.label}
                    </p>
                    <p
                      className={cn(
                        "text-base font-bold",
                        a.currency === "USD" ? "text-brand" : "text-navy",
                      )}
                    >
                      {formatMoney(a.balance, a.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-brand/30 bg-brand/5 p-4">
              <h3 className="text-xs font-bold uppercase text-navy">
                Disponibilidad acumulada
              </h3>
              <p className="mt-2 text-sm text-slate2">Total en pesos</p>
              <p className="text-xl font-bold text-navy">
                {formatMoney(summary.totalArs, "ARS")}
              </p>
              <p className="mt-3 text-sm text-slate2">Total en dólares</p>
              <p className="text-xl font-bold text-brand">
                {formatMoney(summary.totalUsd, "USD")}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
