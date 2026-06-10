import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ImagePlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/shared/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { usePropertyPhotos, type ResolvedPhoto } from "../hooks/use-property-photos";
import { useUploadPropertyPhoto } from "../hooks/use-upload-property-photo";
import { useDeletePropertyPhoto } from "../hooks/use-delete-property-photo";
import { useReorderPropertyPhotos } from "../hooks/use-reorder-property-photos";
import { useDeleteAllPropertyPhotos } from "../hooks/use-delete-all-property-photos";
import { cn } from "@/shared/lib/utils";

interface PhotoGalleryProps {
  paths: string[];
  propertyId: string;
  orgId: string;
}

export function PhotoGallery({ paths, propertyId, orgId }: PhotoGalleryProps) {
  // Local paths drive the UI — optimistic updates happen here immediately.
  // The parent's `paths` prop syncs back once the server round-trip completes.
  const [localPaths, setLocalPaths] = useState<string[]>(paths);

  useEffect(() => {
    setLocalPaths(paths);
  }, [paths]);

  const { data: photos = [] as ResolvedPhoto[] } = usePropertyPhotos(localPaths);
  const upload = useUploadPropertyPhoto();
  const deletePhoto = useDeletePropertyPhoto();
  const deleteAll = useDeleteAllPropertyPhotos();
  const reorder = useReorderPropertyPhotos();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const isUpdating = deletePhoto.isPending || deleteAll.isPending || reorder.isPending;

  // Touch drag state
  const touchDrag = useRef<{ startIndex: number; targetIndex: number | null } | null>(null);

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";

    let current = [...localPaths];
    for (const file of files) {
      const newPath = await upload.mutateAsync({
        propertyId,
        orgId,
        file,
        currentPhotos: current,
      });
      current = [...current, newPath];
      setLocalPaths([...current]); // show each photo as it finishes uploading
    }
  }

  // ── Drag & drop reorder (mouse + touch) ──────────────────────────────────

  function applyReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const newPaths = [...localPaths];
    const [moved] = newPaths.splice(fromIndex, 1);
    newPaths.splice(toIndex, 0, moved);
    setLocalPaths(newPaths);
    reorder.mutate({ propertyId, newPhotos: newPaths });
  }

  // Mouse drag
  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDrop(targetIndex: number) {
    const from = draggedIndex;
    setDraggedIndex(null);
    if (from === null) return;
    applyReorder(from, targetIndex);
  }

  // Touch drag
  function handleTouchStart(index: number) {
    touchDrag.current = { startIndex: index, targetIndex: null };
    setDraggedIndex(index);
  }

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchDrag.current) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const item = el?.closest("[data-photo-index]");
    if (item) {
      touchDrag.current.targetIndex = Number(item.getAttribute("data-photo-index"));
    }
  }, []);

  function handleTouchEnd() {
    if (!touchDrag.current) return;
    const { startIndex, targetIndex } = touchDrag.current;
    touchDrag.current = null;
    setDraggedIndex(null);
    if (targetIndex !== null) applyReorder(startIndex, targetIndex);
  }

  // ── Delete all ────────────────────────────────────────────────────────────

  async function handleDeleteAllConfirm() {
    setConfirmDeleteAll(false);
    const pathsToDelete = [...localPaths];
    setLocalPaths([]);
    try {
      await deleteAll.mutateAsync({ propertyId, paths: pathsToDelete });
    } catch {
      setLocalPaths(pathsToDelete); // rollback
    }
  }

  // ── Delete single ─────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!confirmDeletePath) return;
    const pathToDelete = confirmDeletePath;
    setConfirmDeletePath(null);

    // Optimistic: remove immediately from UI
    setLocalPaths((prev) => prev.filter((p) => p !== pathToDelete));

    try {
      await deletePhoto.mutateAsync({
        propertyId,
        path: pathToDelete,
        currentPhotos: localPaths,
      });
    } catch {
      // Rollback if server fails
      setLocalPaths((prev) => [...prev, pathToDelete]);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Fotos{" "}
          {photos.length > 0 && (
            <span className="font-normal text-slate2">({photos.length} cargadas)</span>
          )}
        </p>

        <div className="flex items-center gap-3">
          {(isUpdating || upload.isPending) && (
            <span className="flex items-center gap-1.5 text-xs text-slate2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Actualizando fotos…
            </span>
          )}
          {photos.length > 1 && !isUpdating && !upload.isPending && (
            <button
              type="button"
              onClick={() => setConfirmDeleteAll(true)}
              className="text-xs text-destructive underline-offset-2 hover:underline"
            >
              Borrar todas
            </button>
          )}
        </div>
      </div>

      {photos.length > 0 && (
        <p className="text-xs text-slate2">
          Arrastrá y soltá para cambiar el orden. La primera foto es la portada.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map(({ path, url }, i) => (
          <div
            key={path}
            data-photo-index={i}
            className={cn(
              "group relative flex flex-col items-center gap-2",
              draggedIndex === i && "opacity-40",
            )}
            style={{ touchAction: "none" }}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => setDraggedIndex(null)}
            onTouchStart={() => handleTouchStart(i)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="relative w-full cursor-move">
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                draggable={false}
                className={cn(
                  "h-32 w-full rounded-lg border-2 object-cover shadow-sm transition-all",
                  i === 0
                    ? "border-brand ring-2 ring-brand/20"
                    : "border-border",
                )}
                onClick={() => setCarouselIndex(i)}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeletePath(path);
                }}
                className="absolute -right-2 -top-2 z-10 rounded-full bg-destructive p-1.5 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 hover:bg-destructive/80"
                aria-label="Eliminar foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {i === 0 && (
              <span className="rounded border border-brand/20 bg-brand/5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand shadow-sm">
                Portada
              </span>
            )}
          </div>
        ))}

        {/* Upload tile — shows spinner while uploading */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
          className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-mist transition-colors hover:bg-mist/70 disabled:cursor-not-allowed disabled:opacity-70"
          aria-label="Agregar foto"
        >
          {upload.isPending ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-slate2" />
              <span className="text-[11px] text-slate2">Subiendo…</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-6 w-6 text-slate2" />
              <span className="text-[11px] text-slate2">Agregar foto</span>
            </>
          )}
        </button>
      </div>

      {photos.length === 0 && !upload.isPending && (
        <p className="rounded-lg bg-mist py-4 text-center text-sm text-slate2">
          No hay fotos cargadas todavía
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Delete all confirm */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent className="max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar todas las fotos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán las {localPaths.length} fotos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteAllConfirm()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Borrar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete single confirm */}
      <AlertDialog
        open={!!confirmDeletePath}
        onOpenChange={(open) => { if (!open) setConfirmDeletePath(null); }}
      >
        <AlertDialogContent className="max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteConfirm()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Carousel lightbox */}
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
  photos: ResolvedPhoto[];
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
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const photo = photos[current];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <div className="relative flex items-center justify-center bg-black">
          <img
            src={photo.url}
            alt=""
            className="max-h-[80vh] w-full object-contain"
          />

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
