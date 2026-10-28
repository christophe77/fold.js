#!/usr/bin/env node
// `npx foldjs audit <url>`: keeps the core package free of browser dependencies
// by delegating to @foldjs/cli, which is installed on demand.
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
let cli;
try {
  cli = (await import("@foldjs/cli")).run;
} catch {
  cli = null;
}

if (cli) {
  process.exitCode = await cli(args);
} else {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["-y", "@foldjs/cli", ...args], { stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code) => process.exit(code ?? 1));
}
