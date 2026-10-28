import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

// Point straight at the sources so the demo hot-reloads while working on the library.
export default defineConfig({
  // Served from https://christophe77.github.io/foldjs/ on GitHub Pages.
  base: process.env.DEMO_BASE ?? "/",
  plugins: [react(), svelte()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        legacy: fileURLToPath(new URL("legacy.html", import.meta.url)),
      },
    },
  },
  resolve: {
    alias: [
      { find: /^foldjs\/devtools$/, replacement: src("core/src/devtools.ts") },
      { find: /^foldjs\/auto$/, replacement: src("core/src/auto.ts") },
      { find: /^foldjs\/elements$/, replacement: src("core/src/elements.ts") },
      { find: /^foldjs\/css$/, replacement: src("core/css/fold.css") },
      { find: /^foldjs$/, replacement: src("core/src/index.ts") },
      { find: /^@foldjs\/react$/, replacement: src("react/src/index.tsx") },
      { find: /^@foldjs\/vue$/, replacement: src("vue/src/index.ts") },
      { find: /^@foldjs\/svelte$/, replacement: src("svelte/src/index.ts") },
    ],
  },
});
