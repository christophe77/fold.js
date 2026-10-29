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
  /**
   * `false` when the first screen still looked empty (blank page, loading skeleton, blocked):
   * the score is then meaningless.
   */
  rendered: boolean;
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
    for (const device of options.devices) {
      for (const posture of options.postures) {
        // A fresh tab per scenario: an ad-heavy page can stay frozen after the first one.
        // Cookies are shared, so a banner closed in the first scenario stays closed.
        const page = await browser.newPage();
        // Sites with a Content-Security-Policy would otherwise block the injected audit script.
        await page.setBypassCSP(true);
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
        const trace = (m: string) => process.env.FOLDJS_DEBUG && console.error("stage:", m);
        trace("loaded");
        const consentDismissed = options.dismissConsent ? await dismissConsent(page) : false;
        if (consentDismissed) {
          await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
          // A second banner can show up seconds after the first one is closed (Utiq on French media).
          const lateUntil = Date.now() + 12000;
          for (let i = 0; i < 5 && Date.now() < lateUntil; i++) {
            await sleep(1500);
            if (await clickConsent(page, lateUntil)) {
              await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
              break;
            }
          }
        }
        trace("consent done");
        // Single-page apps can still be blank or showing skeletons: give them a few more seconds.
        let rendered = await looksRendered(page);
        for (let i = 0; !rendered && i < 8; i++) {
          await sleep(1000);
          rendered = await looksRendered(page);
        }

        trace("rendered " + rendered);
        usesFoldjs ||= await page.evaluate(() => !!(globalThis as any).__foldjs);
        trace("inject");
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

        trace("screenshot");
        const screenshot = (await page.screenshot({ type: "jpeg", quality: 70, encoding: "base64" })) as string;
        scenarios.push({ device, posture, viewport, score, issues, consentDismissed, rendered, screenshot });
        await within(page.close(), 5000, undefined);
      }
    }
  } finally {
    await browser.close();
  }

  const score = Math.round(scenarios.reduce((s, r) => s + r.score, 0) / Math.max(1, scenarios.length));
  return { url, date: new Date().toISOString(), score, usesFoldjs, scenarios };
}

// Well-known consent platforms first, then any short button whose label looks like a consent
// choice inside a cookie / privacy banner. Accept comes first, as most visitors do: on
// "pay or accept" sites, rejecting only leads to a subscription wall.
const CONSENT_SELECTORS = [
  "#onetrust-accept-btn-handler", "#didomi-notice-agree-button", "button[onclick*=setUserAgreeToAll]", "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll", "#axeptio_btn_acceptAll",
  "#L2AGLb", "#truste-consent-button", "#sp-cc-accept", ".qc-cmp2-summary-buttons button[mode=primary]",
  "#onetrust-reject-all-handler", "#didomi-notice-disagree-button", "#CybotCookiebotDialogBodyButtonDecline", "#axeptio_btn_dismiss", "#W0wltc",
];
const REJECT = "^((tout )?(reject|decline|refuse|refuser|rejeter|décliner)( (all|tout|tous|optional|non|les|the|cookies)\\b.*)?|continuer sans accepter|only allow essential cookies|necessary only|use necessary cookies only|essential cookies only)$";
const ACCEPT = "^((tout )?(accept|accepter|autoriser|allow)( (all|tout|tous|cookies|les|and|et|&)\\b.*)?|i agree|agree|agree and continue|j'accepte|consent|j'ai compris|got it|ok|okay|continuer)$";

// Enough visible text (or text plus images) on the first screen to be a real page.
async function looksRendered(page: Page): Promise<boolean> {
  return within(page.evaluate(() => {
      const inView = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && getComputedStyle(el).visibility !== "hidden";
      };
      let chars = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t && chars < 120; t = walker.nextNode()) {
        const text = t.textContent?.trim();
        if (text && t.parentElement && inView(t.parentElement)) chars += text.length;
      }
      const images = Array.from(document.images).filter((i) => i.complete && i.naturalWidth > 0 && inView(i)).length;
      return chars >= 120 || (chars >= 40 && images >= 1);
    }), 5000, false);
}

// Banners often show up a few seconds after load: keep looking for a while.
// Some come in two steps (a notice, then a wall), so keep clicking while something answers.
async function dismissConsent(page: Page): Promise<boolean> {
  // Ad-heavy pages can stop answering after a click: never spend more than 25 seconds here.
  const until = Date.now() + 25000;
  let dismissed = false;
  let misses = 0;
  for (let attempt = 0; attempt < 10 && Date.now() < until; attempt++) {
    if (await clickConsent(page, until)) {
      dismissed = true;
      misses = 0;
    } else if (dismissed && ++misses > 2) break;
    else await sleep(700);
  }
  return dismissed;
}

async function clickConsent(page: Page, until: number): Promise<boolean> {
  for (const pattern of [null, ACCEPT, REJECT]) {
    // Frames can detach while we loop (a banner reloading the page): skip them.
    for (const frame of page.frames().filter((f) => !f.detached)) {
      if (Date.now() > until) return false;
      const clicked = await within(Promise.resolve()
        .then(() => frame
        .evaluate(
          (selectors: string[], source: string | null) => {
            const visible = (el: Element) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
            };
            // A button that stays on screen after a click (an "OK" in some widget) is not tried twice.
            const DONE = "data-foldjs-clicked";
            // Consent platforms like Usercentrics render inside an open shadow root.
            const roots: (Document | ShadowRoot)[] = [document];
            for (const el of document.querySelectorAll("*")) if (el.shadowRoot) roots.push(el.shadowRoot);
            const all = (s: string) => roots.flatMap((r) => Array.from(r.querySelectorAll<HTMLElement>(s)));
            if (source === null) {
              const el = selectors.flatMap(all).find((e) => visible(e) && !e.hasAttribute(DONE));
              el?.setAttribute(DONE, "");
              el?.click();
              return el ? `${el.tagName}${el.id ? "#" + el.id : ""}` : "";
            }
            const re = new RegExp(source, "i");
            const inBanner = (el: Element) => {
              // Stop before page-sized containers: the whole body always mentions cookies somewhere.
              // A consent class or id on an ancestor is enough, even on a large wall (Le Monde).
              for (let p: Element | null = el, i = 0; p && i < 8 && p !== document.body; p = p.parentElement, i++) {
                if (/gdpr|rgpd|consent|cookie|didomi|onetrust|\bcmp/i.test(`${p.id} ${p.getAttribute("class") ?? ""}`)) return true;
                if ((p.textContent?.length ?? 0) < 8000 && /cookie|consent|privacy|confidentialit|vie priv|données|tracking|gdpr|rgpd|partenaires|partners/i.test(p.textContent ?? "")) return true;
              }
              return false;
            };
            const NATIVE = "button, [role=button], a, input[type=button], input[type=submit]";
            const label = (b: HTMLElement) => (b.textContent || (b as HTMLInputElement).value || "").trim().replace(/\s+/g, " ").replace(/[’‘]/g, "'");
            // Some banners use plain divs as buttons: an exact consent label is enough.
            const matches = (b: HTMLElement) => {
              const text = label(b);
              return text.length < 45 && re.test(text) && visible(b) && !b.hasAttribute(DONE);
            };
            let el = all(`${NATIVE}, div, span`).find((b) => matches(b) && inBanner(b));
            // Click the innermost match so handlers on inner elements fire too.
            for (let inner = el; inner; inner = Array.from(inner.children as HTMLCollectionOf<HTMLElement>).find(matches)) el = inner;
            el?.setAttribute(DONE, "");
            el?.click();
            return el ? `${el.tagName} "${label(el)}"` : "";
          },
          CONSENT_SELECTORS,
          pattern,
        )), Math.min(3000, until - Date.now()), "");
      if (clicked) {
        if (process.env.FOLDJS_DEBUG) console.error("consent click:", clicked, "in", frame.url().slice(0, 60));
        await sleep(1000);
        return true;
      }
    }
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A frame that reloads after a consent click can leave an evaluate call unanswered forever.
const within = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([promise.catch(() => fallback), sleep(ms).then(() => fallback)]);
