// Renders the share images of the study from data.json and the Google screenshots.
//
//   node scripts/study/og.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findBrowser } from "../../packages/cli/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const puppeteer = createRequire(join(here, "../../packages/cli/package.json"))("puppeteer-core");
const { summary } = JSON.parse(readFileSync(join(here, "../../apps/demo/public/study/data.json"), "utf8"));
const img = (file) => `data:image/jpeg;base64,${readFileSync(join(here, file)).toString("base64")}`;

const page = (o) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: "Segoe UI", system-ui, sans-serif; color: #fff;
    background: radial-gradient(circle at 85% 0%, #3a1630 0%, transparent 55%), #0f0f13; display: flex; align-items: center; padding: 0 64px; gap: 40px; }
  .text { flex: 1; }
  b { display: block; font-size: 150px; line-height: 1; font-weight: 900; color: #ff6b81; letter-spacing: -4px; }
  h1 { font-size: 44px; line-height: 1.15; font-weight: 800; margin: 20px 0 22px; }
  p { font-size: 22px; color: #a3a3b2; }
  .brand { margin-top: 44px; font-size: 26px; font-weight: 800; }
  .brand span { color: #8b7cff; }
  .device { flex: none; border: 10px solid #26262e; border-radius: 26px; overflow: hidden; box-shadow: 0 30px 80px #000a; transform: rotate(${o.rotate}deg); }
  .device img { display: block; width: ${o.width}px; }
</style></head><body>
  <div class="text"><b>${o.big}</b><h1>${o.title}</h1><p>${o.sub}</p><div class="brand">${o.brand}</div></div>
  <div class="device"><img src="${o.shot}"></div>
</body></html>`;

const images = [
  {
    out: "../../apps/demo/public/study/og.png",
    big: `${summary.withCritical}%`,
    title: "of popular websites split a button across a foldable's hinge",
    sub: `${summary.tested} sites audited on a Galaxy Z Fold · even Google's search box`,
    brand: "fold<span>.js</span> study",
    shot: img("shots/google.com.book.jpg"), width: 330, rotate: 3,
  },
  {
    out: "../../docs/linkedin-iphone.png",
    big: `${summary.iphone.withCritical}%`,
    title: "des plus gros sites mettent un bouton sur la pliure de l'iPhone pliable",
    sub: `${summary.iphone.tested} sites testés au format iPhone pliable · même Google`,
    brand: "étude fold<span>.js</span>",
    shot: img("shots-iphone-fold/google.com.book.jpg"), width: 500, rotate: 3,
  },
];

const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true });
const tab = await browser.newPage();
await tab.setViewport({ width: 1200, height: 630 });
for (const o of images) {
  await tab.setContent(page(o));
  await tab.screenshot({ path: join(here, o.out) });
  console.log("wrote", o.out);
}
await browser.close();
