import { Link } from "react-router-dom";
import { cn } from "@/shared/lib/utils";

type ActionTone = "brand" | "navy" | "amber" | "slate";

const TONE_BUTTON: Record<ActionTone, string> = {
  brand: "bg-brand text-white hover:opacity-90",
  navy: "bg-navy text-white hover:opacity-90",
  amber: "bg-amber-500 text-white hover:bg-amber-600",
  slate: "bg-mist text-navy hover:bg-mist/80",
};

export interface DashboardActionCardProps {
  badge?: string;
  title: string;
  description: string;
  buttonLabel: string;
  to: string;
  tone?: ActionTone;
  extra?: React.ReactNode;
}

export function DashboardActionCard({
  badge,
  title,
  description,
  buttonLabel,
  to,
  tone = "brand",
  extra,
}: DashboardActionCardProps) {
  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-card px-5 py-4 shadow-sm">
      {badge ? (
        <p className="text-2xs font-bold uppercase tracking-wide text-slate2">
          {badge}
        </p>
      ) : null}

      <h3 className="mt-1 font-display text-lg font-bold text-navy">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate2">{description}</p>

      {extra ? <div className="mt-3">{extra}</div> : null}

      <div className="mt-4">
        <Link
          to={to}
          className={cn(
            "inline-flex w-full items-center justify-center rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors shadow-sm",
            TONE_BUTTON[tone],
          )}
        >
          {buttonLabel}
        </Link>
      </div>
    </div>
  );
}
