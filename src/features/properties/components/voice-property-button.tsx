import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useExtractPropertyFromVoice } from "@/features/properties/hooks/use-extract-property-from-voice";
import type { PropertyFormValues } from "@/features/properties/components/property-form-dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type VoiceState = "idle" | "listening" | "extracting" | "error";

interface VoicePropertyButtonProps {
  onExtracted: (values: Partial<PropertyFormValues>) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoicePropertyButton({ onExtracted }: VoicePropertyButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const { extract, hasApiKey } = useExtractPropertyFromVoice();

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const handleClick = useCallback(async () => {
    if (state === "listening") {
      recognitionRef.current?.stop();
      return;
    }

    if (!hasApiKey) {
      setErrorMessage("Configurá tu API key de Gemini en Configuración → Integraciones / IA");
      setState("error");
      setTimeout(() => setState("idle"), 4000);
      return;
    }

    if (!isSupported) {
      setErrorMessage("Tu navegador no soporta reconocimiento de voz. Probá en Chrome o Edge.");
      setState("error");
      setTimeout(() => setState("idle"), 4000);
      return;
    }

    setErrorMessage(null);

    const SpeechRecognitionAPI = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;
    const recognition = new SpeechRecognitionAPI() as any;
    recognitionRef.current = recognition;

    recognition.lang = "es-AR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState("listening");

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (!transcript.trim()) {
        setState("idle");
        return;
      }

      setState("extracting");
      try {
        const values = await extract(transcript);
        onExtracted(values);
        setState("idle");
      } catch (err) {
        const msg =
          err instanceof Error && err.message === "NO_API_KEY"
            ? "Configurá tu API key de Gemini en Configuración → Integraciones / IA"
            : "No se pudo interpretar el dictado. Intentá de nuevo.";
        setErrorMessage(msg);
        setState("error");
        setTimeout(() => setState("idle"), 4000);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "aborted") {
        setState("idle");
        return;
      }
      setErrorMessage("Error al escuchar. Verificá que el micrófono esté habilitado.");
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    };

    recognition.onend = () => {
      setState((curr) => {
        if (curr === "listening") return "idle";
        return curr;
      });
    };

    recognition.start();
  }, [state, hasApiKey, isSupported, extract, onExtracted]);

  // ── Render helpers ────────────────────────────────────────────────────────────

  const tooltipText: Record<VoiceState, string> = {
    idle: hasApiKey
      ? "Dictar propiedad por voz"
      : "Configurá tu API key de Gemini en Configuración → Integraciones / IA",
    listening: "Escuchando… hacé clic para detener",
    extracting: "Procesando con IA…",
    error: errorMessage ?? "Error",
  };

  const buttonVariant = state === "error" ? "destructive" : "outline";
  const isProcessing = state === "extracting";
  const isListening = state === "listening";

  return (
    <div className="relative">
      <Button
        id="voice-property-btn"
        variant={buttonVariant as any}
        size="default"
        onClick={handleClick}
        disabled={isProcessing}
        title={tooltipText[state]}
        aria-label={tooltipText[state]}
        className={`gap-2 transition-all ${
          isListening
            ? "bg-red-500 hover:bg-red-600 text-white border-red-500 animate-pulse"
            : state === "error"
              ? ""
              : ""
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando…
          </>
        ) : isListening ? (
          <>
            <MicOff className="h-4 w-4" />
            Detener
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            Dictar propiedad
          </>
        )}
      </Button>

      {/* Inline error tooltip */}
      {state === "error" && errorMessage && (
        <div
          role="alert"
          className="absolute top-full left-0 mt-1.5 z-50 w-72 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive shadow-sm"
        >
          {errorMessage}
        </div>
      )}

      {/* Listening indicator */}
      {isListening && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white animate-ping" />
      )}
    </div>
  );
}
