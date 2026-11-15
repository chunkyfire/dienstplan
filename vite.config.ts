import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  // Relative paths so the same build works under /dienstplan/ on GitHub Pages and on a domain of its own.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // The components were written against TanStack Start; these two small files stand in for it in the browser-only app.
      { find: "@tanstack/react-router", replacement: src("shim/router.tsx") },
      { find: "@tanstack/react-start", replacement: src("shim/start.ts") },
      { find: /^@\//, replacement: src("") },
    ],
  },
});
