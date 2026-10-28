import { defineConfig } from "tsup";

// Script-tag bundles, each with its own global.
const iife = (name: string, file: string, globalName: string) => ({
  entry: { [name]: file },
  format: ["iife" as const],
  globalName,
  minify: true,
});

export default defineConfig([
  {
    entry: ["src/index.ts", "src/elements.ts", "src/devtools.ts", "src/auto.ts"],
    format: ["esm", "cjs"],
    dts: true,
  },
  // <script src="…/dist/auto.global.js">: retrofit a site with no build step.
  iife("auto", "src/auto-global.ts", "FoldAuto"),
  // Injected into pages by `foldjs audit`.
  iife("audit", "src/audit-global.ts", "FoldAudit"),
]);
