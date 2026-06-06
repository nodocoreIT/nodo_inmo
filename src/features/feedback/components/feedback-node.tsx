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
  const [isExpanded, setIsExpanded] = useState(false); // starts collapsed
  const [activeIcon, setActiveIcon] = useState<"logo" | "mic" | "lightbulb">(
    "logo",
  );
  const [logoBlinkCount, setLogoBlinkCount] = useState(0);

  // Logo blinking first 3 times, then cycle logo -> mic -> lightbulb
  useEffect(() => {
    const timer = setInterval(() => {
      if (logoBlinkCount < 6) {
        // Blinks = toggle logo opacity / visibility state
        setActiveIcon((prev) => (prev === "logo" ? "logo" : "logo")); // keeps logo
        setLogoBlinkCount((prev) => prev + 1);
      } else {
        // After blinking, cycle icons
        setActiveIcon((prev) => {
          if (prev === "logo") return "mic";
          if (prev === "mic") return "lightbulb";
          return "logo";
        });
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [logoBlinkCount]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex h-14 items-center rounded-full bg-gradient-to-r from-brand to-brand-600 text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 justify-center",
          isExpanded ? "px-4 gap-2 w-auto" : "w-14 px-0 gap-0"
        )}
        style={{
          boxShadow: "0 0 15px rgba(218, 90, 14, 0.4)",
        }}
      >
        {/* Pulsing ambient indicator ring */}
        <span className="absolute inset-0 rounded-full border-2 border-brand/30 animate-ping pointer-events-none" />

        <div className="relative h-6 w-6 flex items-center justify-center">
          {/* Logo element with blinking effect in the first cycles */}
          <img
            src="/brand/nodo-mark-white.png"
            alt="Nodo"
            className={cn(
              "absolute top-0 left-0 h-6 w-6 transition-all duration-500 transform",
              activeIcon === "logo"
                ? "scale-100 rotate-0 opacity-100"
                : "scale-0 rotate-90 opacity-0",
              logoBlinkCount < 6 && logoBlinkCount % 2 === 0
                ? "animate-pulse"
                : "",
            )}
          />
          <Mic
            className={cn(
              "absolute top-0 left-0 h-6 w-6 transition-all duration-500 transform",
              activeIcon === "mic"
                ? "scale-100 rotate-0 opacity-100"
                : "scale-0 rotate-90 opacity-0",
            )}
          />
          <Lightbulb
            className={cn(
              "absolute top-0 left-0 h-6 w-6 transition-all duration-500 transform",
              activeIcon === "lightbulb"
                ? "scale-100 rotate-0 opacity-100"
                : "scale-0 -rotate-90 opacity-0",
            )}
          />
        </div>

        <span
          className={cn(
            "overflow-hidden font-display text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-500 ease-in-out",
            isExpanded ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0",
          )}
        >
          ¿Cómo mejorar este Nodo?
        </span>
      </button>

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
      <DialogContent className="sm:max-w-[460px] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-lg">
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
