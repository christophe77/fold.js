import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { audit, DEVICES } from "./audit.js";
import type { AuditResult, Posture } from "./audit.js";
import { findBrowser } from "./browser.js";
import { badgeMarkdown, renderReport } from "./report.js";

export { audit, DEVICES } from "./audit.js";
export type { AuditOptions, AuditResult, Device, Issue, Posture, ScenarioResult } from "./audit.js";
export { badgeMarkdown, badgeUrl, renderReport } from "./report.js";
export { findBrowser } from "./browser.js";

const HELP = `
fold.js audit: find what breaks on foldable phones

Usage
  npx foldjs audit <url> [options]

Options
  --device <id>       galaxy-z-fold, pixel-fold, iphone-fold or all (default: all)
                      iphone-fold uses leaked specs and is not part of "all"
  --posture <name>    book, tabletop or all (default: all)
  --out <dir>         report folder (default: ./foldjs-report)
  --min-score <n>     exit with code 1 if the score is below n (for CI)
  --json              print the result as JSON instead of the summary
  --dismiss-consent   close cookie banners (accepting, like most visitors) before the audit
  --browser <path>    Chrome, Edge or Chromium executable (or set CHROME_PATH)
  --wait <ms>         extra wait after load and posture change (default: 600)
  --timeout <ms>      page load timeout (default: 45000)

Examples
  npx foldjs audit https://example.com
  npx foldjs audit http://localhost:3000 --posture book --min-score 80
`;

const tty = process.stdout.isTTY;
const paint = (code: number) => (s: string | number) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = paint(1), dim = paint(2), red = paint(31), green = paint(32), yellow = paint(33);
const colorScore = (n: number) => (n >= 90 ? green : n >= 60 ? yellow : red)(n);

/** Runs the CLI with the given arguments and resolves with the exit code. */
export async function run(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return 0;
  }
  if (command !== "audit") {
    console.error(`Unknown command "${command}".\n${HELP}`);
    return 2;
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        device: { type: "string", default: "all" },
        posture: { type: "string", default: "all" },
        out: { type: "string", default: "foldjs-report" },
        "min-score": { type: "string" },
        json: { type: "boolean", default: false },
        "dismiss-consent": { type: "boolean", default: false },
        browser: { type: "string" },
        wait: { type: "string", default: "600" },
        timeout: { type: "string", default: "45000" },
      },
    });
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
  const { values: v, positionals } = parsed;

  const url = positionals[0];
  if (!url) {
    console.error(`Missing URL.\n${HELP}`);
    return 2;
  }

  const devices = v.device === "all" ? DEVICES.filter((d) => !d.estimated) : DEVICES.filter((d) => d.id === v.device);
  if (devices.length === 0) {
    console.error(`Unknown device "${v.device}". Use ${DEVICES.map((d) => d.id).join(", ")} or all.`);
    return 2;
  }
  const postures: Posture[] = v.posture === "all" ? ["book", "tabletop"] : [v.posture as Posture];
  if (!postures.every((p) => p === "book" || p === "tabletop")) {
    console.error(`Unknown posture "${v.posture}". Use book, tabletop or all.`);
    return 2;
  }

  const browser = findBrowser(v.browser);
  if (!browser) {
    console.error("No Chrome, Edge or Chromium found. Install one or pass --browser <path> (or set CHROME_PATH).");
    return 2;
  }

  let result: AuditResult;
  try {
    if (!v.json) console.log(`\n${bold("fold.js audit")} ${dim(url)}\n`);
    result = await audit(url, {
      browser,
      devices,
      postures,
      wait: Number(v.wait),
      timeout: Number(v.timeout),
      dismissConsent: v["dismiss-consent"],
      onProgress: v.json ? undefined : (m) => console.log(dim(`  … ${m}`)),
    });
  } catch (e) {
    console.error(red(`Audit failed: ${(e as Error).message}`));
    return 2;
  }

  const outDir = resolve(v.out!);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "report.html"), renderReport(result));
  writeFileSync(
    resolve(outDir, "report.json"),
    JSON.stringify({ ...result, scenarios: result.scenarios.map(({ screenshot, ...s }) => s) }, null, 2),
  );

  if (v.json) {
    console.log(JSON.stringify({ ...result, scenarios: result.scenarios.map(({ screenshot, ...s }) => s) }, null, 2));
  } else {
    printSummary(result, outDir);
  }

  const min = v["min-score"] === undefined ? null : Number(v["min-score"]);
  if (min !== null && result.score < min) {
    if (!v.json) console.log(red(`\n✖ Score ${result.score} is below --min-score ${min}`));
    return 1;
  }
  return 0;
}

function printSummary(result: AuditResult, outDir: string) {
  console.log("");
  for (const s of result.scenarios) {
    const crit = s.issues.filter((i) => i.severity === "critical").length;
    const warn = s.issues.filter((i) => i.severity === "warning").length;
    console.log(`  ${colorScore(s.score).padStart(tty ? 12 : 3)}  ${s.device.name} · ${s.posture}  ${dim(`${crit} critical, ${warn} warnings`)}`);
  }
  if (result.scenarios.some((s) => !s.rendered)) {
    console.log(yellow("\n  ⚠ The page still looked empty (blank, loading or blocked). The score may be too high: check the report screenshots, or retry with --wait 4000."));
  }

  const seen = new Map<string, { message: string; suggestion: string; severity: string }>();
  for (const s of result.scenarios) for (const i of s.issues) if (!seen.has(i.selector + i.kind)) seen.set(i.selector + i.kind, i);
  const top = [...seen.entries()].slice(0, 6);
  if (top.length) {
    console.log(`\n  ${bold("Top issues")}`);
    for (const [key, i] of top) {
      const sev = i.severity === "critical" ? red("●") : i.severity === "warning" ? yellow("●") : dim("●");
      console.log(`  ${sev} ${i.message} ${dim(key.replace(/(interactive|text|modal|fixed|media|scroller)$/, ""))}`);
    }
  }

  console.log(`\n  ${bold("Foldable score:")} ${colorScore(result.score)}/100`);
  console.log(`  ${bold("Report:")} ${resolve(outDir, "report.html")}`);
  console.log(`\n  ${dim("README badge:")}\n  ${badgeMarkdown(result.score)}\n`);
}
