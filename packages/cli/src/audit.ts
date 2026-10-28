import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";
import type { Page } from "puppeteer-core";
import type { Collision } from "foldjs";

export interface Device {
  id: string;
  name: string;
  /** CSS viewport of the inner screen held in book posture (vertical hinge). */
  width: number;
  height: number;
  /** User agent sent to the site, so it serves the layout it would serve this phone. */
  userAgent: string;
  /** Dimensions come from leaks, not from the manufacturer. */
  estimated?: boolean;
}

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-F946B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

// Inner (unfolded) screens, CSS pixels, held in book posture.
export const DEVICES: Device[] = [
  { id: "galaxy-z-fold", name: "Samsung Galaxy Z Fold", width: 690, height: 829, userAgent: ANDROID_UA },
  { id: "pixel-fold", name: "Google Pixel Fold", width: 841, height: 701, userAgent: ANDROID_UA },
  // Leaked inner screen: 7.76", 2713×1920 px, assumed @3x like other iPhones. Not in "all" until Apple confirms it.
  { id: "iphone-fold", name: "iPhone Fold (leaked specs)", width: 904, height: 640, userAgent: IPHONE_UA, estimated: true },
];

export type Posture = "book" | "tabletop";

export type Issue = Omit<Collision, "element"> & { text: string };

export interface ScenarioResult {
  device: Device;
  posture: Posture;
  viewport: { width: number; height: number };
  score: number;
  issues: Issue[];
  /** A cookie / consent banner was found and closed before the audit. */
  consentDismissed: boolean;
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
  /** Close cookie / consent banners (rejecting when possible) before auditing. */
  dismissConsent?: boolean;
  onProgress?: (message: string) => void;
}

const require = createRequire(import.meta.url);

export async function audit(url: string, options: AuditOptions): Promise<AuditResult> {
  const pageScript = require.resolve("foldjs/audit.global.js");
  const browser = await puppeteer.launch({ executablePath: options.browser, headless: true, args: ["--hide-scrollbars"] });
  const scenarios: ScenarioResult[] = [];
  let usesFoldjs = false;

  try {
    const page = await browser.newPage();
    // Sites with a Content-Security-Policy would otherwise block the injected audit script.
    await page.setBypassCSP(true);

    for (const device of options.devices) {
      for (const posture of options.postures) {
        const viewport = posture === "book" ? { width: device.width, height: device.height } : { width: device.height, height: device.width };
        options.onProgress?.(`${device.name} · ${posture} (${viewport.width}×${viewport.height})`);
        await page.setUserAgent(device.userAgent);
        await page.setViewport({ ...viewport, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
        try {
          await page.goto(url, { waitUntil: "networkidle2", timeout: options.timeout });
        } catch (e) {
          // Ad-heavy pages may never go network-idle: audit what has rendered so far.
          if ((e as Error).name !== "TimeoutError") throw e;
        }
        await sleep(options.wait);
        const consentDismissed = options.dismissConsent ? await dismissConsent(page) : false;
        if (consentDismissed) await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});

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
        scenarios.push({ device, posture, viewport, score, issues, consentDismissed, screenshot });
      }
    }
  } finally {
    await browser.close();
  }

  const score = Math.round(scenarios.reduce((s, r) => s + r.score, 0) / Math.max(1, scenarios.length));
  return { url, date: new Date().toISOString(), score, usesFoldjs, scenarios };
}

// Well-known consent platforms first (reject buttons before accept buttons), then any
// short button whose label looks like a consent choice inside a cookie / privacy banner.
const CONSENT_SELECTORS = [
  "#onetrust-reject-all-handler", "#didomi-notice-disagree-button", "#CybotCookiebotDialogBodyButtonDecline", "#axeptio_btn_dismiss", "#W0wltc",
  "#onetrust-accept-btn-handler", "#didomi-notice-agree-button", "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll", "#axeptio_btn_acceptAll",
  "#L2AGLb", "#truste-consent-button", "#sp-cc-accept", ".qc-cmp2-summary-buttons button[mode=primary]",
];
const REJECT = "^(reject all|reject|decline|decline optional cookies|refuse|refuser|tout refuser|refuser tout|continuer sans accepter|only allow essential cookies|necessary only|use necessary cookies only|refuser les cookies optionnels)$";
const ACCEPT = "^(accept all|accept|accept cookies|accept all cookies|allow all|allow all cookies|i agree|agree|tout accepter|accepter|accepter tout|accepter et fermer|j'accepte|autoriser|autoriser tous les cookies|autoriser tout|consent|accepter et continuer|accept and continue|accept & continue|agree and continue|accept and close|accepter les cookies|allow cookies|j'ai compris|got it|ok|okay|continuer)$";

async function dismissConsent(page: Page): Promise<boolean> {
  for (const pattern of [null, REJECT, ACCEPT]) {
    for (const frame of page.frames()) {
      const clicked = await frame
        .evaluate(
          (selectors: string[], source: string | null) => {
            const visible = (el: Element) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
            };
            if (source === null) {
              const el = selectors.map((s) => document.querySelector(s)).find((e) => e && visible(e)) as HTMLElement | undefined;
              el?.click();
              return !!el;
            }
            const re = new RegExp(source, "i");
            const inBanner = (el: Element) => {
              for (let p: Element | null = el, i = 0; p && i < 8; p = p.parentElement, i++) {
                if (/cookie|consent|privacy|confidentialit|vie priv|données|tracking|gdpr|rgpd/i.test(p.textContent ?? "")) return true;
              }
              return false;
            };
            const el = Array.from(document.querySelectorAll<HTMLElement>("button, [role=button], a, input[type=button], input[type=submit]")).find((b) => {
              const label = (b.textContent || (b as HTMLInputElement).value || "").trim().replace(/s+/g, " ");
              return label.length < 45 && re.test(label) && visible(b) && inBanner(b);
            });
            el?.click();
            return !!el;
          },
          CONSENT_SELECTORS,
          pattern,
        )
        .catch(() => false);
      if (clicked) {
        await sleep(1000);
        return true;
      }
    }
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
