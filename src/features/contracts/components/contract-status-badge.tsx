/**
 * Reusable StatusBadge for contract status.
 * Consumed by contracts-list.tsx and documentos-page.tsx.
 */
import { CONTRACT_STATUS_LABELS } from "@/features/contracts/lib/contract-labels";

export function ContractStatusBadge({ status }: { status: string }) {
  const label = CONTRACT_STATUS_LABELS[status] ?? status;

  const colorMap: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    active: "bg-green-100 text-green-800",
    terminated: "bg-red-100 text-red-700",
    expired: "bg-yellow-100 text-yellow-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium ${
        colorMap[status] ?? "bg-mist text-slate2"
      }`}
    >
      {label}
    </span>
  );
}
