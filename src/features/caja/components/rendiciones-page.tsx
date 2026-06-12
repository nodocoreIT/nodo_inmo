import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, CheckCheck, HandCoins, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useOwnerSettlements } from "@/features/caja/hooks/use-owner-settlements";
import { useSettleOwner } from "@/features/caja/hooks/use-settle-owner";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { useLogoUrl } from "@/features/agency-profile/hooks/use-logo-url";
import { groupPendingByOwner } from "@/features/caja/lib/caja-math";
import { buildPendingStatementData } from "@/features/caja/lib/pending-settlement-pdf";
import { handleDownload } from "@/features/caja/lib/settlement-pdf-actions";
import { formatMoney } from "@/features/contracts/lib/contract-labels";
import { cn } from "@/shared/lib/utils";

export function RendicionesPage() {
  const { data, isLoading, isError } = useOwnerSettlements();
  const settleOwner = useSettleOwner();
  const { data: agency } = useOrgProfile();
  const { data: logoUrl } = useLogoUrl(agency?.logo_path);
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null);

  const allSettlements = data ?? [];
  const pendingGroups = groupPendingByOwner(allSettlements);

  async function handlePdf(group: (typeof pendingGroups)[number]) {
    const key = `${group.owner_id}:${group.currency}`;
    setPdfLoadingKey(key);
    try {
      const statement = await buildPendingStatementData(
        group,
        allSettlements,
        agency ?? null,
        logoUrl ?? null,
      );
      await handleDownload(statement);
    } finally {
      setPdfLoadingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HandCoins className="h-6 w-6 text-brand" />
          <h1 className="font-display text-xl font-bold text-navy">
            Rendiciones pendientes a dueños
          </h1>
        </div>
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-4 py-1.5 text-xs font-semibold text-slate2 hover:bg-mist"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al inicio
        </Link>
      </div>

      {isLoading && (
        <div
          role="status"
          aria-label="Cargando rendiciones"
          className="flex items-center justify-center py-16"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Error al cargar las rendiciones. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && pendingGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            No hay rendiciones pendientes
          </p>
          <p className="text-xs text-slate2">
            Cuando cobres alquileres, acá vas a ver lo que falta entregar a cada
            propietario.
          </p>
        </div>
      )}

      {!isLoading && !isError && pendingGroups.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propietario</TableHead>
                <TableHead>Cant. pagos</TableHead>
                <TableHead className="text-right">Total neto a rendir</TableHead>
                <TableHead className="w-44 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingGroups.map((group) => {
                const rowKey = `${group.owner_id}:${group.currency}`;
                const isPdfLoading = pdfLoadingKey === rowKey;

                return (
                  <TableRow key={rowKey}>
                    <TableCell className="font-semibold text-navy">
                      {group.owner_name}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-pill bg-mist px-2.5 py-0.5 text-xs font-semibold text-slate2">
                        {group.settlement_ids.length}{" "}
                        {group.settlement_ids.length === 1 ? "cobro" : "cobros"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-lg font-bold text-navy">
                      {formatMoney(group.total, group.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          size="sm"
                          className="w-full gap-1.5 bg-brand text-xs font-bold uppercase hover:opacity-90"
                          disabled={isPdfLoading}
                          onClick={() => void handlePdf(group)}
                        >
                          {isPdfLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-full gap-1.5 border-blue-600 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50",
                          )}
                          disabled={settleOwner.isPending}
                          onClick={() =>
                            settleOwner.mutate({
                              owner_id: group.owner_id,
                              owner_name: group.owner_name,
                              settlement_ids: group.settlement_ids,
                              total: group.total,
                              currency: group.currency,
                            })
                          }
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          Finalizar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
