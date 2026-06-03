/**
 * BrandMark — the shared Nodo lockup for nodo-inmo.
 *
 * Pairs the Nodo node icon (the "estrella"/network mark from the shared brand)
 * with the "nodo" wordmark and an orange "inmo" product suffix → NODO|Inmo.
 *
 * Tone:
 *   - default (light): navy mark + navy "nodo", for light backgrounds (login).
 *   - onDark:          white mark + white "nodo", for the navy sidebar.
 *
 * The "inmo" suffix is always brand orange in both tones.
 */
import { cn } from "@/shared/lib/utils";

interface BrandMarkProps {
  /** Render for placement on a dark background (e.g. the navy sidebar). */
  onDark?: boolean;
  /** Extra classes on the wrapper (e.g. text size). */
  className?: string;
  /** Extra classes on the icon (size overrides). */
  iconClassName?: string;
}

export function BrandMark({ onDark, className, iconClassName }: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src={onDark ? "/brand/nodo-mark-white.png" : "/brand/nodo-mark.png"}
        alt=""
        className={cn("h-7 w-7 flex-shrink-0", iconClassName)}
      />
      <span className="font-display text-xl font-bold tracking-tight">
        <span className={onDark ? "text-white" : "text-navy"}>nodo</span>
        <span className="text-brand">inmo</span>
      </span>
    </span>
  );
}
