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
  const child = spawn(...delegate(args));
  child.on("exit", (code) => process.exit(code ?? 1));
}

// Prefer running npm's own script with node: no shell, so URLs with `&` or `?` reach
// the CLI intact on every platform. npm sets npm_execpath when it runs this bin.
function delegate(cliArgs) {
  const npm = process.env.npm_execpath;
  if (npm && /np[mx]-cli\.js$/.test(npm)) {
    const npmCli = npm.replace(/npx-cli\.js$/, "npm-cli.js");
    return [process.execPath, [npmCli, "exec", "--yes", "--package=@foldjs/cli", "--", "foldjs-cli", ...cliArgs], { stdio: "inherit" }];
  }
  if (process.platform === "win32") {
    const quote = (a) => `"${a.replace(/"/g, '\\"')}"`;
    return ["npx.cmd", ["--yes", "@foldjs/cli", ...cliArgs.map(quote)], { stdio: "inherit", shell: true }];
  }
  return ["npx", ["--yes", "@foldjs/cli", ...cliArgs], { stdio: "inherit" }];
}
