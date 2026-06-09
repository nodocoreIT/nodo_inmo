import { useState, useMemo } from "react";
import { PaginationControls } from "@/shared/components/ui/pagination";
import { useSearchParams } from "react-router-dom";
import { Plus, ArrowUpRight, ArrowDownRight, Download, Share2 } from "lucide-react";
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
import { useOwnerSettlements } from "@/features/caja/hooks/use-owner-settlements";
import { useSettleOwner } from "@/features/caja/hooks/use-settle-owner";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { useLogoUrl } from "@/features/agency-profile/hooks/use-logo-url";
import { MovementFormDialog } from "./movement-form-dialog";
import {
  computeTotals,
  groupPendingByOwner,
} from "@/features/caja/lib/caja-math";
import {
  buildStatementData,
  type SealedBreakdown,
} from "@/features/caja/lib/settlement-statement-data";
import {
  handleDownload,
  handleShare,
} from "@/features/caja/lib/settlement-pdf-actions";
import {
  formatMoney,
  formatDate,
} from "@/features/contracts/lib/contract-labels";
import { cn } from "@/shared/lib/utils";
import type { SettlementWithOwner } from "@/features/caja/hooks/use-owner-settlements";

type Tab = "movimientos" | "liquidaciones";

const PAGE_SIZE = 10;

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  commission: "Comisión",
  owner_payout: "Liquidación",
};

export function CajaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get("tab");
  const initialTab: Tab = queryTab === "liquidaciones" ? "liquidaciones" : "movimientos";
  const [tab, setTabState] = useState<Tab>(initialTab);

  const setTab = (newTab: Tab) => {
    setTabState(newTab);
    setSearchParams((prev) => {
      prev.set("tab", newTab);
      return prev;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <TabButton
          active={tab === "movimientos"}
          onClick={() => setTab("movimientos")}
        >
          Movimientos
        </TabButton>
        <TabButton
          active={tab === "liquidaciones"}
          onClick={() => setTab("liquidaciones")}
        >
          Liquidaciones
        </TabButton>
      </div>

      {tab === "movimientos" ? <MovementsTab /> : <SettlementsTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-navy text-white" : "bg-mist text-slate2 hover:bg-mist/70",
      )}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  valueClass,
  labelClass,
}: {
  label: string;
  value: string;
  valueClass: string;
  labelClass?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-5 py-4 shadow-sm">
      <p
        className={cn(
          "text-xs font-bold uppercase tracking-wide",
          labelClass ?? "text-slate2",
        )}
      >
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold", valueClass)}>{value}</p>
    </div>
  );
}

// ── Movimientos ───────────────────────────────────────────────────────────────

function MovementsTab() {
  const { data, isLoading, isError } = useCashMovements();
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(0);

  const movements = data ?? [];
  const totalPages = Math.ceil(movements.length / PAGE_SIZE);
  const pagedMovements = useMemo(
    () => movements.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [movements, page],
  );
  const { income, expense, balance } = computeTotals(movements);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Ingresos"
          value={formatMoney(income, "ARS")}
          valueClass="text-green-700"
          labelClass="text-green-700"
        />
        <StatCard
          label="Egresos"
          value={formatMoney(expense, "ARS")}
          valueClass="text-destructive"
          labelClass="text-destructive"
        />
        <StatCard
          label="Saldo de caja"
          value={formatMoney(balance, "ARS")}
          valueClass={balance >= 0 ? "text-navy" : "text-destructive"}
        />
      </div>

      {isLoading && (
        <div
          role="status"
          aria-label="Cargando caja"
          className="flex items-center justify-center py-16"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="sr-only">Cargando…</span>
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Error al cargar la caja. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && movements.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            Todavía no hay movimientos
          </p>
          <p className="text-xs text-slate2-300">
            Los cobros generan ingresos automáticamente, o cargá uno manual.
          </p>
        </div>
      )}

      {!isLoading && !isError && movements.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedMovements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDate(m.date)}</TableCell>
                  <TableCell className="font-medium">{m.concept}</TableCell>
                  <TableCell className="text-slate2">
                    {SOURCE_LABELS[m.source] ?? m.source}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        m.type === "income"
                          ? "text-green-700"
                          : "text-destructive",
                      )}
                    >
                      {m.type === "income" ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      {m.type === "income" ? "+" : "−"}
                      {formatMoney(m.amount, m.currency)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={movements.length}
        pageSize={PAGE_SIZE}
        itemLabel="movimientos"
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      <MovementFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => setCreateOpen(false)}
      />
    </div>
  );
}

// ── Liquidaciones ─────────────────────────────────────────────────────────────

/** Group settled settlements by owner_id:currency for the comprobante section. */
interface SealedGroup {
  owner_id: string;
  owner_name: string;
  currency: string;
  breakdown: SealedBreakdown;
  settled_date: string;
}

function groupSealedByOwner(settlements: SettlementWithOwner[]): SealedGroup[] {
  const map = new Map<string, SealedGroup>();

  for (const s of settlements) {
    if (s.status !== "settled") continue;
    if (!s.breakdown) continue;

    const key = `${s.owner_id}:${s.currency}`;
    if (map.has(key)) continue; // use first row (all rows in a batch carry the same breakdown)

    const breakdown = s.breakdown as unknown as SealedBreakdown;
    map.set(key, {
      owner_id: s.owner_id,
      owner_name: s.owner?.name ?? "—",
      currency: s.currency,
      breakdown,
      settled_date: s.settled_date ?? "",
    });
  }

  return Array.from(map.values());
}

/** Inner component that has access to profile + logo and renders the comprobante actions. */
function SealedSettlementActions({ group }: { group: SealedGroup }) {
  const { data: agency } = useOrgProfile();
  const { data: logoUrl } = useLogoUrl(agency?.logo_path);

  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([], "test.pdf", { type: "application/pdf" })] });

  function buildData() {
    return buildStatementData({
      breakdown: group.breakdown,
      agency: agency ?? null,
      logoUrl: logoUrl ?? null,
      ownerName: group.owner_name,
      settledDate: group.settled_date,
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => void handleDownload(buildData())}
      >
        <Download className="h-3.5 w-3.5" />
        Descargar
      </Button>
      {canShare && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void handleShare(buildData())}
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartir
        </Button>
      )}
    </div>
  );
}

function SettlementsTab() {
  const { data, isLoading, isError } = useOwnerSettlements();
  const settleOwner = useSettleOwner();

  const allSettlements = data ?? [];
  const pendingGroups = groupPendingByOwner(allSettlements);
  const sealedGroups = groupSealedByOwner(allSettlements);

  const hasPending = pendingGroups.length > 0;
  const hasSealed = sealedGroups.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {isLoading && (
        <div
          role="status"
          aria-label="Cargando liquidaciones"
          className="flex items-center justify-center py-16"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="sr-only">Cargando…</span>
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Error al cargar las liquidaciones. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && !hasPending && !hasSealed && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            No hay liquidaciones pendientes
          </p>
          <p className="text-xs text-slate2-300">
            Cuando cobres alquileres de propiedades con dueño, acá vas a ver
            cuánto liquidarle.
          </p>
        </div>
      )}

      {/* ── Pending settlements — Liquidar action ──────────────────────────── */}
      {!isLoading && !isError && hasPending && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propietario</TableHead>
                <TableHead>Cuotas</TableHead>
                <TableHead className="text-right">A liquidar</TableHead>
                <TableHead className="w-28 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingGroups.map((g) => (
                <TableRow key={`${g.owner_id}:${g.currency}`}>
                  <TableCell className="font-medium">{g.owner_name}</TableCell>
                  <TableCell>{g.settlement_ids.length}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(g.total, g.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={settleOwner.isPending}
                      onClick={() =>
                        settleOwner.mutate({
                          owner_id: g.owner_id,
                          owner_name: g.owner_name,
                          settlement_ids: g.settlement_ids,
                          total: g.total,
                          currency: g.currency,
                        })
                      }
                    >
                      Liquidar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Sealed settlements — Comprobante actions ───────────────────────── */}
      {!isLoading && !isError && hasSealed && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-slate2">
              Liquidaciones realizadas
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propietario</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Neto liquidado</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
                <TableHead className="text-right">Comprobante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sealedGroups.map((g) => (
                <TableRow key={`${g.owner_id}:${g.currency}`}>
                  <TableCell className="font-medium">{g.owner_name}</TableCell>
                  <TableCell>{g.currency}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(g.breakdown.net, g.currency)}
                  </TableCell>
                  <TableCell className="text-right text-slate2">
                    {formatDate(g.settled_date)}
                  </TableCell>
                  <TableCell className="text-right">
                    <SealedSettlementActions group={g} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
