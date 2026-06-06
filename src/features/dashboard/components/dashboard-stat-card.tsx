import type { CurrencyTotals } from "../hooks/use-dashboard-metrics";
import { formatMoney } from "@/features/contracts/lib/contract-labels";
import { cn } from "@/shared/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = "default" | "danger" | "success";

export interface DashboardStatCardProps {
  label: string;
  count: number;
  totalByCurrency?: CurrencyTotals;
  severity?: Severity;
  icon?: React.ElementType;
  children?: React.ReactNode;
}

// ── Severity maps (hoisted to module scope — rendering-hoist-jsx) ─────────────

const SEVERITY_LABEL_CLASS: Record<Severity, string> = {
  default: "text-slate2",
  danger: "text-destructive",
  success: "text-green-700",
};

const SEVERITY_VALUE_CLASS: Record<Severity, string> = {
  default: "text-navy",
  danger: "text-destructive",
  success: "text-green-700",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardStatCard({
  label,
  count,
  totalByCurrency,
  severity = "default",
  icon: Icon,
  children,
}: DashboardStatCardProps) {
  const labelClass = SEVERITY_LABEL_CLASS[severity];
  const valueClass = SEVERITY_VALUE_CLASS[severity];

  const currencyEntries =
    totalByCurrency && Object.keys(totalByCurrency).length > 0
      ? Object.entries(totalByCurrency).slice().sort(([a], [b]) =>
          a.localeCompare(b),
        )
      : null;

  return (
    <div
      className="rounded-md border border-border bg-card px-5 py-4 shadow-sm"
      data-severity={severity}
    >
      {/* Label row */}
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide",
          labelClass,
        )}
      >
        {Icon ? <Icon className="h-3.5 w-3.5 flex-shrink-0" /> : null}
        {label}
      </p>

      {/* Headline count */}
      <p className={cn("mt-1 text-2xl font-bold", valueClass)}>{count}</p>

      {/* Per-currency breakdown */}
      {currencyEntries ? (
        <ul className="mt-2 space-y-0.5">
          {currencyEntries.map(([currency, total]) => (
            <li key={currency} className="text-sm text-slate2">
              {formatMoney(total, currency)}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Slot for list rows passed by parent */}
      {children ? (
        <div className="mt-3 border-t border-border pt-3">{children}</div>
      ) : null}
    </div>
  );
}
