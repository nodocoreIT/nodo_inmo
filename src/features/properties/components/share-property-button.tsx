import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/lib/supabase";
import type { PropertyRow } from "@/features/properties/hooks/use-properties";
import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  formatPrice,
} from "@/features/properties/lib/property-labels";

function buildShareText(property: PropertyRow): string {
  const op = OPERATION_LABELS[property.operation] ?? property.operation;
  const type = PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type;
  const price = formatPrice(property.sale_price, property.currency);
  const lines = [`🏠 ${property.address}`, `${type} en ${op} · ${price}`];
  if (property.rooms) lines.push(`${property.rooms} amb.`);
  return lines.join("\n");
}

async function fetchCoverPhotoFile(path: string): Promise<File | null> {
  try {
    const { data, error } = await supabase.storage
      .from("property-photos")
      .createSignedUrl(path, 60);
    if (error || !data) return null;

    const res = await fetch(data.signedUrl);
    if (!res.ok) return null;

    const blob = await res.blob();
    const ext = path.split(".").pop() ?? "jpg";
    return new File([blob], `portada.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}

interface SharePropertyButtonProps {
  property: PropertyRow;
}

export function SharePropertyButton({ property }: SharePropertyButtonProps) {
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      const text = buildShareText(property);
      const title = property.address;
      const photos = (property as unknown as { photos?: string[] }).photos;
      const coverPath = photos?.[0] ?? property.main_photo ?? null;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      // Mobile: try native share sheet with cover photo
      if (isMobile && coverPath) {
        const file = await fetchCoverPhotoFile(coverPath);
        if (
          file &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({ files: [file], title, text });
          return;
        }
      }

      // Mobile without file support: text-only native share
      if (isMobile && typeof navigator.share === "function") {
        await navigator.share({ title, text });
        return;
      }

      // Desktop: WhatsApp web with text (images not supported via URL)
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text)}`,
        "_blank",
        "noreferrer",
      );
    } catch {
      // User cancelled — do nothing
    } finally {
      setSharing(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Compartir propiedad"
      disabled={sharing}
      onClick={() => void handleShare()}
    >
      {sharing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      <span className="sr-only">Compartir</span>
    </Button>
  );
}
