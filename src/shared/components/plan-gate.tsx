import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth, type PlanTier } from "@/app/auth/use-auth";

interface PlanGateProps {
  /** Minimum plan required to access this content. */
  requiredPlan: PlanTier;
  children: ReactNode;
  /**
   * When true, renders a full-page gate instead of an inline overlay.
   * Use this at route level (wrapping an entire page).
   */
  fullPage?: boolean;
}

const PLAN_ORDER: Record<PlanTier, number> = { starter: 0, pro: 1 };

function hasPlan(userPlan: PlanTier | null, required: PlanTier): boolean {
  if (!userPlan) return false;
  return PLAN_ORDER[userPlan] >= PLAN_ORDER[required];
}

export function PlanGate({ requiredPlan, children, fullPage = false }: PlanGateProps) {
  const { plan } = useAuth();
  const allowed = hasPlan(plan, requiredPlan);

  if (allowed) return <>{children}</>;

  const overlay = (
    <div
      className={
        fullPage
          ? "flex flex-1 flex-col items-center justify-center gap-4 p-8"
          : "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/70 backdrop-blur-[3px]"
      }
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Lock className="h-5 w-5 text-slate-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700">Disponible en Plan Pro</p>
        <p className="mt-1 text-xs text-slate-400">
          Contactá a NodoCore para actualizar tu plan.
        </p>
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex flex-1 flex-col">
        {overlay}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40">
        {children}
      </div>
      {overlay}
    </div>
  );
}
