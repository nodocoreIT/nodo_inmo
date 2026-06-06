import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiSettings {
  geminiApiKey: string;
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  geminiApiKey: "",
};

const STORAGE_KEY = "nodo-ai-settings";

// ── Store ─────────────────────────────────────────────────────────────────────

interface AiStore {
  aiSettings: AiSettings;
  setAiSettings: (next: Partial<AiSettings>) => void;
}

const getInitialAiSettings = (): AiSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(stored) };
  } catch {
    // Ignored
  }
  return DEFAULT_AI_SETTINGS;
};

export const useAiStore = create<AiStore>((set) => ({
  aiSettings: getInitialAiSettings(),
  setAiSettings: (next) =>
    set((state) => {
      const updated = { ...state.aiSettings, ...next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignored
      }
      return { aiSettings: updated };
    }),
}));

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAiSettings() {
  const { aiSettings, setAiSettings } = useAiStore();
  return { aiSettings, setAiSettings };
}
