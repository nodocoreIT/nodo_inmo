import { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, ImagePlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/shared/components/ui/dialog";
import { usePropertyPhotos, type ResolvedPhoto } from "../hooks/use-property-photos";
import { useUploadPropertyPhoto } from "../hooks/use-upload-property-photo";
import { useDeletePropertyPhoto } from "../hooks/use-delete-property-photo";
import { cn } from "@/shared/lib/utils";

interface PhotoGalleryProps {
  paths: string[];
  propertyId: string;
  orgId: string;
}

export function PhotoGallery({ paths, propertyId, orgId }: PhotoGalleryProps) {
  const { data: photos = [] as ResolvedPhoto[] } = usePropertyPhotos(paths);
  const upload = useUploadPropertyPhoto();
  const deletePhoto = useDeletePropertyPhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    let current = [...paths];
    for (const file of files) {
      const newPath = await upload.mutateAsync({ propertyId, orgId, file, currentPhotos: current });
      current = [...current, newPath];
    }
  }

  function handleDelete(path: string, e: React.MouseEvent) {
    e.stopPropagation();
    deletePhoto.mutate({ propertyId, path, currentPhotos: paths });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        Fotos {photos.length > 0 && <span className="text-slate2 font-normal">({photos.length})</span>}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {photos.map(({ path, url }, i) => (
          <div
            key={path}
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-md border border-border bg-mist"
            onClick={() => setCarouselIndex(i)}
          >
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
            />
            <button
              type="button"
              onClick={(e) => handleDelete(path, e)}
              disabled={deletePhoto.isPending}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
              aria-label="Eliminar foto"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Upload tile */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
          className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border bg-mist transition-colors hover:bg-mist/70"
          aria-label="Agregar foto"
        >
          {upload.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate2" />
          ) : (
            <ImagePlus className="h-6 w-6 text-slate2" />
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {carouselIndex !== null && photos.length > 0 && (
        <CarouselModal
          photos={photos}
          initialIndex={carouselIndex}
          onClose={() => setCarouselIndex(null)}
        />
      )}
    </div>
  );
}

// ── Carousel ──────────────────────────────────────────────────────────────────

interface CarouselModalProps {
  photos: { path: string; url: string }[];
  initialIndex: number;
  onClose: () => void;
}

function CarouselModal({ photos, initialIndex, onClose }: CarouselModalProps) {
  const [current, setCurrent] = useState(initialIndex);

  function prev() {
    setCurrent((i) => (i - 1 + photos.length) % photos.length);
  }

  function next() {
    setCurrent((i) => (i + 1) % photos.length);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const photo = photos[current];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        {/* Image */}
        <div className="relative flex items-center justify-center bg-black">
          <img
            src={photo.url}
            alt=""
            className="max-h-[80vh] w-full object-contain"
          />

          {/* Counter */}
          <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            {current + 1} / {photos.length}
          </span>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label="Siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Dots */}
        {photos.length > 1 && (
          <div className="flex justify-center gap-1.5 bg-black py-2">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === current ? "bg-white" : "bg-white/40 hover:bg-white/70",
                )}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
