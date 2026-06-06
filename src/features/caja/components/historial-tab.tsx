import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useSettledSettlements } from "@/features/caja/hooks/use-settled-settlements";
import { SealedSettlementActions } from "@/features/caja/components/sealed-settlement-actions";
import {
  formatMoney,
  formatDate,
} from "@/features/contracts/lib/contract-labels";
import { cn } from "@/shared/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SealedGroup } from "@/features/caja/lib/caja-math";

/**
 * History table showing all sealed rendiciones, one row per settlement_group.
 * Each row is expandable to reveal the full frozen breakdown (REQ-05, REQ-06).
 * Self-fetching via useSettledSettlements — no props needed (design D3).
 */
export function HistorialTab() {
  const { groups, isLoading, isError } = useSettledSettlements();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Cargando historial"
        className="flex items-center justify-center py-16"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <span className="sr-only">Cargando…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        Error al cargar el historial. Intentá de nuevo.
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
        <p className="text-sm font-medium text-slate2">
          No hay rendiciones liquidadas aún
        </p>
        <p className="text-xs text-slate2-300">
          Las rendiciones que liquides aparecerán acá.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Propietario</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Moneda</TableHead>
            <TableHead className="text-right">Cobros</TableHead>
            <TableHead className="text-right">Neto</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <HistorialRow
              key={g.settlement_group}
              group={g}
              expanded={expandedId === g.settlement_group}
              onToggle={() => toggleExpand(g.settlement_group)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Row (collapsed + expanded panel) ─────────────────────────────────────────

function HistorialRow({
  group: g,
  expanded,
  onToggle,
}: {
  group: SealedGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  const b = g.breakdown;
  const panelId = `panel-${g.settlement_group}`;

  return (
    <>
      {/* Collapsed headline row */}
      <TableRow
        className={cn("cursor-pointer hover:bg-mist/40", expanded && "bg-mist/40")}
        onClick={onToggle}
      >
        <TableCell className="font-medium">{g.owner_name}</TableCell>
        <TableCell>{formatDate(g.settled_date)}</TableCell>
        <TableCell>{g.currency}</TableCell>
        <TableCell className="text-right">{g.cobro_count}</TableCell>
        <TableCell className="text-right font-medium">
          {formatMoney(b.net, g.currency)}
        </TableCell>
        <TableCell className="text-right">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={`expandir ${g.settlement_group}`}
            className="inline-flex items-center justify-center rounded p-1 text-slate2 hover:bg-mist"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </TableCell>
      </TableRow>

      {/* Expanded breakdown panel */}
      {expanded ? (
        <TableRow id={panelId}>
          <TableCell colSpan={6} className="bg-mist/20 px-6 py-4">
            <BreakdownPanel group={g} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

// ── Breakdown detail panel ────────────────────────────────────────────────────

function BreakdownPanel({ group: g }: { group: SealedGroup }) {
  const b = g.breakdown;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 max-w-sm">
        <span className="text-slate2">Bruto</span>
        <span className="text-right font-medium">{formatMoney(b.gross, g.currency)}</span>

        <span className="text-slate2">
          Comisión ({b.commission_rate}%)
        </span>
        <span className="text-right font-medium text-destructive">
          − {formatMoney(b.commission, g.currency)}
        </span>

        <span className="text-slate2">Subtotal propietario</span>
        <span className="text-right font-medium">{formatMoney(b.owner_share, g.currency)}</span>
      </div>

      {b.deductions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate2">
            Deducciones
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 max-w-sm">
            {b.deductions.map((d) => (
              <div key={d.id} className="contents">
                <span className="text-slate2">
                  {d.description} · {formatDate(d.expense_date)}
                </span>
                <span className="text-right font-medium text-destructive">
                  − {formatMoney(d.amount, g.currency)}
                </span>
              </div>
            ))}
            <span className="text-slate2 font-medium">Total deducciones</span>
            <span className="text-right font-medium text-destructive">
              − {formatMoney(b.deduction_total, g.currency)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-x-8 max-w-sm border-t border-border pt-2">
        <span className="font-semibold">Neto liquidado</span>
        <span className="text-right font-bold">{formatMoney(b.net, g.currency)}</span>
      </div>

      <div className="pt-1">
        <SealedSettlementActions group={g} />
      </div>
    </div>
  );
}
