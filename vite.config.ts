/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    // Vitest owns the unit/component tests under src only. Database (pgTAP)
    // and Storage integration tests live under supabase/ and run via their
    // own runners (`supabase test db` / `npm run test:integration`).
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
