import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "foldjs"],
  // Hooks and effects: mark the bundle as a client module for the Next.js App Router.
  banner: { js: '"use client";' },
});
