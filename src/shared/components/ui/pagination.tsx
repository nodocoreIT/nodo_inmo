import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  itemLabel: string;
  onPrev: () => void;
  onNext: () => void;
}

export function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
  itemLabel,
  onPrev,
  onNext,
}: PaginationControlsProps) {
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between text-sm text-slate2">
      <span>
        Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total} {itemLabel}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={onPrev} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 tabular-nums">{page + 1} / {totalPages}</span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={onNext} aria-label="Página siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
