import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";
import type { Collision } from "foldjs";

export interface Device {
  id: string;
  name: string;
  /** CSS viewport of the inner screen held in book posture (vertical hinge). */
  width: number;
  height: number;
}

// Inner (unfolded) screens, CSS pixels, held in book posture.
export const DEVICES: Device[] = [
  { id: "galaxy-z-fold", name: "Samsung Galaxy Z Fold", width: 690, height: 829 },
  { id: "pixel-fold", name: "Google Pixel Fold", width: 841, height: 701 },
];

export type Posture = "book" | "tabletop";

export type Issue = Omit<Collision, "element"> & { text: string };

export interface ScenarioResult {
  device: Device;
  posture: Posture;
  viewport: { width: number; height: number };
  score: number;
  issues: Issue[];
  /** JPEG screenshot with outlined issues, base64. */
  screenshot: string;
}

export interface AuditResult {
  url: string;
  date: string;
  score: number;
  usesFoldjs: boolean;
  scenarios: ScenarioResult[];
}

export interface AuditOptions {
  browser: string;
  devices: Device[];
  postures: Posture[];
  /** Extra time after load and after switching posture, in ms. */
  wait: number;
  timeout: number;
  onProgress?: (message: string) => void;
}

const UA =
  "Mozilla/5.0 (Linux; Android 14; SM-F946B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const require = createRequire(import.meta.url);

export async function audit(url: string, options: AuditOptions): Promise<AuditResult> {
  const pageScript = require.resolve("foldjs/audit.global.js");
  const browser = await puppeteer.launch({ executablePath: options.browser, headless: true, args: ["--hide-scrollbars"] });
  const scenarios: ScenarioResult[] = [];
  let usesFoldjs = false;

  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);

    for (const device of options.devices) {
      for (const posture of options.postures) {
        const viewport = posture === "book" ? { width: device.width, height: device.height } : { width: device.height, height: device.width };
        options.onProgress?.(`${device.name} · ${posture} (${viewport.width}×${viewport.height})`);
        await page.setViewport({ ...viewport, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
        await page.goto(url, { waitUntil: "networkidle2", timeout: options.timeout });
        await sleep(options.wait);

        usesFoldjs ||= await page.evaluate(() => !!(globalThis as any).__foldjs);
        await page.addScriptTag({ path: pageScript });
        // Real foldables report a near-zero hinge; the audit uses a fold zone around it.
        await page.evaluate((p) => (window as any).FoldAudit.simulate({ posture: p, hingeSize: 0 }), posture);
        await sleep(options.wait);

        const { score, issues } = await page.evaluate(() => {
          const api = (window as any).FoldAudit;
          const found: Collision[] = api.findHingeCollisions();
          api.highlightCollisions(found);
          const h = api.getFold().hinge;
          const line = document.createElement("div");
          line.setAttribute("data-fold-ignore", "");
          const vertical = h.height > h.width;
          Object.assign(line.style, {
            position: "fixed", zIndex: "2147483646", pointerEvents: "none",
            left: `${vertical ? h.x - 1 : 0}px`, top: `${vertical ? 0 : h.y - 1}px`,
            width: vertical ? "2px" : "100vw", height: vertical ? "100vh" : "2px",
            background: "repeating-linear-gradient(45deg,#ff3b5c 0 6px,transparent 6px 12px)",
          });
          document.body.appendChild(line);
          return {
            score: api.foldScore(found) as number,
            issues: found.map(({ element, ...rest }) => ({ ...rest, text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80) })),
          };
        });

        const screenshot = (await page.screenshot({ type: "jpeg", quality: 70, encoding: "base64" })) as string;
        scenarios.push({ device, posture, viewport, score, issues, screenshot });
      }
    }
  } finally {
    await browser.close();
  }

  const score = Math.round(scenarios.reduce((s, r) => s + r.score, 0) / Math.max(1, scenarios.length));
  return { url, date: new Date().toISOString(), score, usesFoldjs, scenarios };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
