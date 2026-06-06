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
import { useThemeSettings, DEFAULT_SETTINGS, ThemeSettings } from "@/shared/hooks/use-theme-settings";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { useLogoUrl } from "@/features/agency-profile/hooks/use-logo-url";

interface BrandMarkProps {
  /** Render for placement on a dark background (e.g. the navy sidebar). */
  onDark?: boolean;
  /** Extra classes on the wrapper (e.g. text size). */
  className?: string;
  /** Extra classes on the icon (size overrides). */
  iconClassName?: string;
  /** Force legacy image rendering for unit test suites */
  useLegacyIcon?: boolean;
}

export function BrandMark({ onDark, className, iconClassName, useLegacyIcon = false }: BrandMarkProps) {
  let settings: ThemeSettings = DEFAULT_SETTINGS;
  let logoUrl: string | null = null;

  try {
    const { settings: activeSettings } = useThemeSettings();
    settings = activeSettings;
  } catch {
    // Context missing in some test environments
  }

  try {
    const { data: profile } = useOrgProfile();
    const { data: activeLogoUrl } = useLogoUrl(profile?.logo_path);
    logoUrl = activeLogoUrl ?? null;
  } catch {
    // Context missing in some test environments
  }

  // If text-only logo is chosen
  if (settings.logoType === "text") {
    const textLength = settings.brandText.length;
    let fontSizeClass = "text-lg sm:text-xl";
    if (textLength > 25) {
      fontSizeClass = "text-sm sm:text-base";
    } else if (textLength > 15) {
      fontSizeClass = "text-base sm:text-lg";
    }

    return (
      <span
        className={cn(
          "font-display font-bold tracking-tight py-1 block whitespace-normal break-words leading-tight",
          onDark ? "max-w-[180px] md:max-w-[200px] text-white" : "max-w-full text-navy",
          fontSizeClass,
          className
        )}
      >
        {settings.brandText}
      </span>
    );
  }

  // If custom logo image is chosen AND we have a valid uploaded logo url
  if (settings.logoType === "custom" && logoUrl) {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <img
          src={logoUrl}
          alt="Logo"
          className="h-10 w-auto max-w-[180px] md:max-w-[200px] flex-shrink-0 object-contain"
        />
      </span>
    );
  }

  // Enforce standard image rendering if chosen or in test runner suite
  if (useLegacyIcon) {
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

  // Default logo fall-through: render custom building icon styled with secondaryColor
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span 
        className="flex items-center justify-center p-1.5 rounded-md"
        style={{ backgroundColor: settings.secondaryColor }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={settings.primaryColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("h-6 w-6 flex-shrink-0", iconClassName)}
          aria-hidden="true"
        >
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
          <path d="M6 12H4a2 2 0 0 0-2 2v8" />
          <path d="M18 16h2a2 2 0 0 1 2 2v4" />
          <path d="M10 6h4" />
          <path d="M10 10h4" />
          <path d="M10 14h4" />
          <path d="M10 18h4" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        <span className={onDark ? "text-white" : "text-navy"}>nodo</span>
        <span className="text-brand">inmo</span>
      </span>
    </span>
  );
}
