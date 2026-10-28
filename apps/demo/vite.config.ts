import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

// Point straight at the sources so the demo hot-reloads while working on the library.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^foldjs\/devtools$/, replacement: src("core/src/devtools.ts") },
      { find: /^foldjs\/css$/, replacement: src("core/css/fold.css") },
      { find: /^foldjs$/, replacement: src("core/src/index.ts") },
      { find: /^@foldjs\/react$/, replacement: src("react/src/index.tsx") },
    ],
  },
});
