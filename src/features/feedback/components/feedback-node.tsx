import { useState, useEffect, useRef } from "react";
import {
  Lightbulb,
  Trash2,
  ShieldAlert,
  Mic,
  Square,
  CheckCircle2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/auth/use-auth";
import { cn } from "@/shared/lib/utils";

// --- Types ---
type FeedbackCategory = "bug" | "idea" | "bloat";

// Web Speech API Types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: (event: Event) => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const touchActive = useRef(false);
  const wasDragging = useRef(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
    setIsExpanded(true);
  }

  function handleMouseLeave() {
    collapseTimer.current = setTimeout(() => setIsExpanded(false), 200);
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    dragOffset.current = { ...position };
    touchActive.current = true;
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchActive.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStart.current.x;
    const deltaY = touch.clientY - dragStart.current.y;
    
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      setIsDragging(true);
      wasDragging.current = true;
    }
    
    setPosition({
      x: dragOffset.current.x + deltaX,
      y: dragOffset.current.y + deltaY
    });
  };

  const handleTouchEnd = () => {
    touchActive.current = false;
    setTimeout(() => {
      setIsDragging(false);
      wasDragging.current = false;
    }, 100);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { ...position };
    setIsDragging(false);
    wasDragging.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - dragStart.current.x;
      const deltaY = moveEvent.clientY - dragStart.current.y;

      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        setIsDragging(true);
        wasDragging.current = true;
      }

      setPosition({
        x: dragOffset.current.x + deltaX,
        y: dragOffset.current.y + deltaY
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setTimeout(() => {
        setIsDragging(false);
        wasDragging.current = false;
      }, 100);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (wasDragging.current || isDragging) {
      e.preventDefault();
      return;
    }
    setIsOpen(true);
  };

  if (isDismissed) return null;

  return (
    <>
      <div
        className="fixed bottom-6 right-6 z-40 touch-none flex items-center justify-center"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
      >
        {/* Dismiss button visible on all viewport sizes */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
          className="absolute -top-1.5 -right-1.5 z-50 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 active:scale-90"
          title="Ocultar sugerencia"
        >
          <span className="text-sm font-bold leading-none">×</span>
        </button>

        <button
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "flex h-14 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 hover:brightness-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#111E2F]",
            isExpanded ? "w-auto gap-3 px-6" : "w-14 gap-0 px-0",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{ backgroundColor: "#111E2F" }}
        >
          <img
            src="/brand/nodo-mark-white.png"
            alt="Nodo"
            className="h-8 w-8 shrink-0 select-none pointer-events-none"
          />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap font-display text-sm font-semibold tracking-wide transition-all duration-300 ease-in-out select-none pointer-events-none",
              isExpanded ? "max-w-xs opacity-100 pr-1" : "max-w-0 opacity-0",
            )}
          >
            ¿Cómo mejorar este Nodo?
          </span>
        </button>
      </div>

      <FeedbackDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [pendingCategory, setPendingCategory] = useState<FeedbackCategory | null>(null);
  const [content, setContent] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  function handleCategoryClick(next: FeedbackCategory) {
    if (next === category) return;
    if (content.trim()) {
      setPendingCategory(next);
    } else {
      setCategory(next);
    }
  }

  function confirmCategorySwitch() {
    if (!pendingCategory) return;
    if (isDictating && recognitionRef.current) recognitionRef.current.stop();
    setContent("");
    setCategory(pendingCategory);
    setPendingCategory(null);
  }

  function cancelCategorySwitch() {
    setPendingCategory(null);
  }

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Setup Webkit Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "es-AR"; // Argentina spanish locale for voseo context

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setContent((prev) => prev + (prev ? " " : "") + finalTranscript);
        }
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error", event);
        setRecognitionError(event.error);
        setIsDictating(false);
      };

      rec.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const handleToggleDictation = () => {
    if (!recognitionRef.current) {
      setRecognitionError("No soportado");
      alert(
        "El dictado por voz no es compatible con este navegador. Probá usando Chrome o Safari.",
      );
      return;
    }

    if (isDictating) {
      recognitionRef.current.stop();
      setIsDictating(false);
    } else {
      setRecognitionError(null);
      try {
        recognitionRef.current.start();
        setIsDictating(true);
      } catch (err) {
        console.error("Failed to start speech recognition", err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (isDictating && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setIsSubmitting(true);
    try {
      const { data: memberData } = await supabase
        .schema("shared")
        .from("org_members")
        .select("org_id")
        .eq("user_id", user?.id)
        .limit(1)
        .maybeSingle();

      const metadata = {
        route: window.location.pathname,
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        dictated: true,
      };

      await supabase
        .schema("shared")
        .from("feedback")
        .insert({
          org_id: memberData?.org_id || null,
          user_id: user?.id || null,
          category,
          content: content.trim(),
          metadata,
        });

      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setContent("");
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Error submitting feedback:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px] rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-lg">
        {submitSuccess ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 animate-bounce" />
            <h3 className="mt-4 font-display text-xl font-bold text-navy">
              ¡Muchas gracias, por tu Feedback!
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Recibimos tu feedback para seguir evolucionando este Nodo.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-lg font-bold text-navy">
                💡 Mejora tu Nodo
              </DialogTitle>
              <DialogDescription className="text-sm text-[var(--color-muted-foreground)]">
                Contanos qué le falta, qué está fallando, o qué sentís que está
                de más.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="mt-4 space-y-5">
              {/* Category Tags Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate2">
                  ¿De qué se trata?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCategoryClick("bug")}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-sm border p-3 text-xs font-medium transition-all hover:bg-[var(--color-accent)]",
                      category === "bug"
                        ? "border-rose-500/30 bg-rose-500/5 text-rose-600 font-semibold"
                        : "border-[var(--color-border)] text-[var(--color-foreground)]",
                    )}
                  >
                    <ShieldAlert
                      className={cn(
                        "h-4 w-4",
                        category === "bug" ? "text-rose-500" : "text-slate2",
                      )}
                    />
                    <span>Un error</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCategoryClick("idea")}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-sm border p-3 text-xs font-medium transition-all hover:bg-[var(--color-accent)]",
                      category === "idea"
                        ? "border-brand/30 bg-brand/5 text-brand font-semibold"
                        : "border-[var(--color-border)] text-[var(--color-foreground)]",
                    )}
                  >
                    <Lightbulb
                      className={cn(
                        "h-4 w-4",
                        category === "idea" ? "text-brand" : "text-slate2",
                      )}
                    />
                    <span>Una idea</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCategoryClick("bloat")}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-sm border p-3 text-xs font-medium transition-all hover:bg-[var(--color-accent)]",
                      category === "bloat"
                        ? "border-amber-500/30 bg-amber-500/5 text-amber-600 font-semibold"
                        : "border-[var(--color-border)] text-[var(--color-foreground)]",
                    )}
                  >
                    <Trash2
                      className={cn(
                        "h-4 w-4",
                        category === "bloat" ? "text-amber-500" : "text-slate2",
                      )}
                    />
                    <span>Está de más</span>
                  </button>
                </div>
              </div>

              {/* Confirmation banner — shown when switching category with unsent content */}
              {pendingCategory !== null && (
                <div className="flex flex-col gap-2 rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
                  <p className="font-medium text-amber-800">
                    Ya tenés un mensaje grabado. ¿Cancelarlo y grabar uno nuevo?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={confirmCategorySwitch}
                      className="rounded px-3 py-1 text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                    >
                      Sí, cancelar y grabar nuevo
                    </button>
                    <button
                      type="button"
                      onClick={cancelCategorySwitch}
                      className="rounded px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                    >
                      Seguir editando
                    </button>
                  </div>
                </div>
              )}

              {/* Speech to Text Section ("El Micrófono Gigante") */}
              <div className="flex flex-col items-center justify-center rounded-sm bg-[var(--color-muted)] p-5 border border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={handleToggleDictation}
                  className={cn(
                    "relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 shadow-md",
                    isDictating
                      ? "bg-rose-500 hover:bg-rose-600 animate-pulse text-white"
                      : "bg-gradient-to-r from-brand to-brand-600 text-white hover:scale-105",
                  )}
                >
                  {isDictating ? (
                    <Square className="h-8 w-8" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                  {isDictating && (
                    <span className="absolute -inset-2 rounded-full border-2 border-rose-500 animate-ping opacity-75" />
                  )}
                </button>

                <p className="mt-3 text-xs font-medium text-navy">
                  {isDictating ? (
                    <span className="text-rose-500 font-semibold animate-pulse">
                      Te escucho... Hablá ahora
                    </span>
                  ) : (
                    "Dictar mensaje por voz"
                  )}
                </p>
                <p className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                  {isDictating
                    ? "Hacé clic para detener el dictado"
                    : "Hacé clic para empezar a dictar"}
                </p>
                {recognitionError && (
                  <p className="text-[10px] text-rose-500 mt-1">
                    Error de dictado o permiso denegado.
                  </p>
                )}
              </div>

              {/* Text Area Input containing the dictated text */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate2">
                  Mensaje escrito
                </label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="El texto dictado aparecerá acá, también podés editarlo o escribir directamente..."
                  className="min-h-[100px]"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !content.trim()}
                  className="bg-brand text-white hover:bg-brand-600"
                >
                  {isSubmitting ? "Enviando..." : "Enviar feedback"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
