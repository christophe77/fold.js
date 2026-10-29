// Audits the first screen of 100 popular websites on a Samsung Galaxy Z Fold
// (book and tabletop postures) with the fold.js CLI engine.
//
//   npm run build -w @foldjs/cli && node scripts/study/run.mjs [--device iphone-fold] [--only host,host]
//
// Writes scripts/study/results.json and one screenshot per site in scripts/study/shots/
// (results-<device>.json and shots-<device>/ for another device).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { audit, DEVICES, findBrowser } from "../../packages/cli/dist/index.js";

// A stray CDP timeout in some iframe must not kill a long run.
process.on("unhandledRejection", (e) => console.log("ignored:", String(e).split("\n")[0]));

const here = dirname(fileURLToPath(import.meta.url));
const sites = JSON.parse(readFileSync(join(here, "sites.json"), "utf8"));
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const deviceId = arg("--device") ?? "galaxy-z-fold";
// --no-dismiss: visit as a normal first-time visitor, cookie banners included.
const dismissConsent = !process.argv.includes("--no-dismiss");
const suffix = (deviceId === "galaxy-z-fold" ? "" : `-${deviceId}`) + (dismissConsent ? "" : "-with-banners");
const resultsFile = join(here, `results${suffix}.json`);
const shots = join(here, `shots${suffix}`);
mkdirSync(shots, { recursive: true });

const only = arg("--only")?.split(",") ?? null;
// Other devices only re-test the sites that were really audited in the main study.
const excluded = suffix ? JSON.parse(readFileSync(join(here, "excluded.json"), "utf8")) : {};
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, "utf8")) : {};
const browser = findBrowser();
const device = DEVICES.find((d) => d.id === deviceId);
const host = (url) => new URL(url).hostname.replace(/^www\./, "");

const queue = sites.filter((url) => !excluded[host(url)] && (only ? only.includes(host(url)) : !results[host(url)]));
let done = 0;

async function worker() {
  for (let url = queue.shift(); url; url = queue.shift()) {
    const name = host(url);
    try {
      // A hung browser (no CDP answer) must not block the whole run: give up after 5 minutes.
      const run = (wait) => () =>
        Promise.race([
          audit(url, { browser, devices: [device], postures: ["book", "tabletop"], wait, timeout: 25000, dismissConsent }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("hung for 5 minutes")), 300000)),
        ]);
      // Some sites redirect right after load (consent, geo): one retry.
      let r = await run(1500)().catch(run(2500)).catch(run(2500));
      // Slow single-page apps: one more try with a longer wait before giving up.
      if (r.scenarios.some((s) => !s.rendered)) r = await run(4000)().catch(() => r);
      for (const s of r.scenarios) writeFileSync(join(shots, `${name}.${s.posture}.jpg`), Buffer.from(s.screenshot, "base64"));
      results[name] = {
        url,
        score: r.score,
        scenarios: r.scenarios.map((s) => ({
          posture: s.posture,
          score: s.score,
          consentDismissed: s.consentDismissed,
          rendered: s.rendered,
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
// A hung browser keeps the event loop alive: exit so a chained run can start.
process.exit(0);
