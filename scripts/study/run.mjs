// Audits the first screen of 100 popular websites on a Samsung Galaxy Z Fold
// (book and tabletop postures) with the fold.js CLI engine.
//
//   npm run build -w @foldjs/cli && node scripts/study/run.mjs [--only host,host]
//
// Writes scripts/study/results.json and one screenshot per site in scripts/study/shots/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { audit, DEVICES, findBrowser } from "../../packages/cli/dist/index.js";

// A stray CDP timeout in some iframe must not kill a long run.
process.on("unhandledRejection", (e) => console.log("ignored:", String(e).split("\n")[0]));

const here = dirname(fileURLToPath(import.meta.url));
const sites = JSON.parse(readFileSync(join(here, "sites.json"), "utf8"));
const resultsFile = join(here, "results.json");
const shots = join(here, "shots");
mkdirSync(shots, { recursive: true });

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, "utf8")) : {};
const browser = findBrowser();
const device = DEVICES.find((d) => d.id === "galaxy-z-fold");
const host = (url) => new URL(url).hostname.replace(/^www\./, "");

const queue = sites.filter((url) => (only ? only.includes(host(url)) : !results[host(url)]));
let done = 0;

async function worker() {
  for (let url = queue.shift(); url; url = queue.shift()) {
    const name = host(url);
    try {
      const run = () => audit(url, { browser, devices: [device], postures: ["book", "tabletop"], wait: 1500, timeout: 25000, dismissConsent: true });
      // Some sites redirect right after load (consent, geo): one retry.
      const r = await run().catch(run);
      for (const s of r.scenarios) writeFileSync(join(shots, `${name}.${s.posture}.jpg`), Buffer.from(s.screenshot, "base64"));
      results[name] = {
        url,
        score: r.score,
        scenarios: r.scenarios.map((s) => ({
          posture: s.posture,
          score: s.score,
          consentDismissed: s.consentDismissed,
          issues: s.issues.map(({ kind, severity, message, selector, text }) => ({ kind, severity, message, selector, text })),
        })),
      };
    } catch (e) {
      results[name] = { url, error: e.message.split("\n")[0] };
    }
    writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`[${++done}] ${name}: ${results[name].error ? "ERROR " + results[name].error : results[name].score}`);
  }
}

await Promise.all(Array.from({ length: 4 }, worker));
console.log("done");
