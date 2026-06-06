import { useEffect } from "react";
import { create } from "zustand";

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  sidebarTextColor: string;
  fontColor: string;
  buttonFontColor: string;
  borderRadius: "none" | "md" | "full";
  fontFamily: "Inter" | "Roboto" | "Montserrat";
  logoType: "default" | "custom" | "text";
  brandText: string;
}

export const DEFAULT_SETTINGS: ThemeSettings = {
  primaryColor: "#da5a0e",
  secondaryColor: "#121e2f",
  sidebarTextColor: "#9dacbe",
  fontColor: "#16202e",
  buttonFontColor: "#ffffff",
  borderRadius: "md",
  fontFamily: "Inter",
  logoType: "default",
  brandText: "nodo inmo",
};

interface ThemeStore {
  settings: ThemeSettings;
  setSettings: (newSettings: Partial<ThemeSettings>) => void;
  resetSettings: () => void;
}

const getInitialSettings = (): ThemeSettings => {
  try {
    const stored = localStorage.getItem("nodo-theme-settings");
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignored
  }
  return DEFAULT_SETTINGS;
};

export const useThemeStore = create<ThemeStore>((set) => ({
  settings: getInitialSettings(),
  setSettings: (newSettings) =>
    set((state) => {
      const next = { ...state.settings, ...newSettings };
      try {
        localStorage.setItem("nodo-theme-settings", JSON.stringify(next));
      } catch {
        // Ignored
      }
      return { settings: next };
    }),
  resetSettings: () => {
    try {
      localStorage.removeItem("nodo-theme-settings");
    } catch {
      // Ignored
    }
    set({ settings: DEFAULT_SETTINGS });
  },
}));

export function useThemeSettings() {
  const { settings, setSettings, resetSettings } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

    // Apply primary color
    root.style.setProperty("--color-brand", settings.primaryColor);
    // Darker/lighter variants computed simple style
    root.style.setProperty("--color-brand-600", settings.primaryColor + "e0");
    root.style.setProperty("--color-brand-300", settings.primaryColor + "60");
    root.style.setProperty("--color-ring", settings.primaryColor);
    root.style.setProperty("--color-primary-foreground", settings.buttonFontColor);
    root.style.setProperty("--color-primary", settings.primaryColor);

    // Keep standard navy colors stable for main app headers and titles
    root.style.setProperty("--color-navy", "#121e2f");
    root.style.setProperty("--color-navy-700", "#1b2c45");
    root.style.setProperty("--color-navy-900", "#0b131e");

    // Apply sidebar custom colors
    root.style.setProperty("--color-sidebar-bg", settings.secondaryColor);
    root.style.setProperty("--color-sidebar-hover", settings.secondaryColor + "dd");
    root.style.setProperty("--color-sidebar-border", settings.secondaryColor + "40");

    // Apply sidebar unselected text color
    root.style.setProperty("--color-sidebar-text", settings.sidebarTextColor);

    // Apply font color (body text)
    root.style.setProperty("--color-ink", settings.fontColor);
    root.style.setProperty("--color-foreground", settings.fontColor);

    // Apply border radius
    let radiusValue = "14px"; // md / default
    if (settings.borderRadius === "none") {
      radiusValue = "0px";
    } else if (settings.borderRadius === "full") {
      radiusValue = "22px";
    }
    root.style.setProperty("--radius", radiusValue);
    root.style.setProperty("--radius-sm", radiusValue === "0px" ? "0px" : "8px");
    root.style.setProperty("--radius-md", radiusValue);

    // Apply font family
    root.style.setProperty("--font-sans", `"${settings.fontFamily}", system-ui, sans-serif`);
    
    // Inject google fonts dynamically if not loaded
    const fontId = `google-font-${settings.fontFamily}`;
    if (!document.getElementById(fontId)) {
      const link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${settings.fontFamily}:wght@300;400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }
  }, [settings]);

  return { settings, setSettings, resetSettings };
}
