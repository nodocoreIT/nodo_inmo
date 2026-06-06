import { useAiStore } from "@/shared/hooks/use-ai-settings";
import type { PropertyFormValues } from "@/features/properties/components/property-form-dialog";
import { formatCurrencyInput } from "@/shared/lib/format-money";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message: string };
}

type ExtractedValues = Partial<PropertyFormValues>;

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un asistente de una inmobiliaria argentina.
Extraé los datos de la propiedad del texto y devolvé SOLO un objeto JSON válido (sin markdown, sin backticks) con estas claves cuando puedas inferirlas:
- address: string (dirección completa, ej: "Levenson 3980")
- operation: "rent" o "sale" (alquiler → rent, venta → sale)
- property_type: "apartment" | "house" | "commercial" | "land" | "other" (departamento→apartment, casa→house, local/comercial→commercial, terreno→land)
- status: "available" | "reserved" | "rented" | "sold" | "inactive" (disponible por defecto si no se indica)
- currency: "ARS" o "USD" (pesos→ARS, dólares/dolares→USD, por defecto ARS si no se indica)
- sale_price: number (solo el número entero, sin símbolos ni puntos, ej: 35000)
- rooms: number (cantidad de ambientes)
- total_sqm: number (metros cuadrados)
- description: string (descripción libre si hubiera)
Omití las claves que no puedas inferir. No devuelvas absolutamente nada más que el JSON puro.`;

// ── API call ──────────────────────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  transcript: string,
): Promise<ExtractedValues> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `Texto dictado: "${transcript}"` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data: GeminiResponse = await res.json();

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Gemini API error: ${msg}`);
  }

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Strip any accidental markdown fences
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  // Map parsed values to PropertyFormValues shape
  const result: ExtractedValues = {};

  if (typeof parsed.address === "string") result.address = parsed.address;
  if (parsed.operation === "rent" || parsed.operation === "sale")
    result.operation = parsed.operation;
  if (
    ["apartment", "house", "commercial", "land", "other"].includes(
      parsed.property_type as string,
    )
  )
    result.property_type = parsed.property_type as PropertyFormValues["property_type"];
  if (
    ["available", "reserved", "rented", "sold", "inactive"].includes(
      parsed.status as string,
    )
  )
    result.status = parsed.status as PropertyFormValues["status"];
  if (parsed.currency === "ARS" || parsed.currency === "USD")
    result.currency = parsed.currency;
  if (typeof parsed.sale_price === "number" && parsed.sale_price > 0) {
    const currency = result.currency ?? "ARS";
    result.sale_price = formatCurrencyInput(
      String(Math.round(parsed.sale_price)),
      currency,
    );
  }
  if (typeof parsed.rooms === "number")
    result.rooms = String(parsed.rooms);
  if (typeof parsed.total_sqm === "number")
    result.total_sqm = String(parsed.total_sqm);
  if (typeof parsed.description === "string" && parsed.description)
    result.description = parsed.description;

  return result;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExtractPropertyFromVoice() {
  const apiKey = useAiStore((s) => s.aiSettings.geminiApiKey);

  const extract = async (transcript: string): Promise<ExtractedValues> => {
    if (!apiKey) {
      throw new Error("NO_API_KEY");
    }
    if (!transcript.trim()) {
      throw new Error("EMPTY_TRANSCRIPT");
    }
    return callGemini(apiKey, transcript);
  };

  return { extract, hasApiKey: !!apiKey };
}
