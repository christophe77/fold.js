// Turns results.json into the data used by the study page (apps/demo/public/study/).
//
//   node scripts/study/analyze.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../apps/demo/public/study");
mkdirSync(join(out, "shots"), { recursive: true });

const results = JSON.parse(readFileSync(join(here, "results.json"), "utf8"));
// Pages that showed a bot check or an error instead of the real site (checked by hand on the screenshots).
const excluded = existsSync(join(here, "excluded.json")) ? JSON.parse(readFileSync(join(here, "excluded.json"), "utf8")) : {};

const CATEGORIES = {
  "Search & portals": ["google.com", "bing.com", "yahoo.com", "duckduckgo.com", "en.m.wikipedia.org", "orange.fr", "free.fr"],
  "Social & messaging": ["facebook.com", "instagram.com", "x.com", "reddit.com", "linkedin.com", "tiktok.com", "pinterest.com", "quora.com", "discord.com", "whatsapp.com", "medium.com"],
  "Shopping": ["amazon.com", "ebay.com", "walmart.com", "etsy.com", "target.com", "bestbuy.com", "aliexpress.com", "shein.com", "temu.com", "ikea.com", "nike.com", "adidas.com", "zara.com", "hm.com", "samsung.com", "apple.com", "leboncoin.fr", "cdiscount.com", "fnac.com", "vinted.fr", "decathlon.fr", "carrefour.fr", "leroymerlin.fr"],
  "News & media": ["nytimes.com", "theguardian.com", "bbc.com", "edition.cnn.com", "washingtonpost.com", "reuters.com", "bloomberg.com", "forbes.com", "theverge.com", "techcrunch.com", "wired.com", "espn.com", "cnet.com", "huffpost.com", "foxnews.com", "usatoday.com", "nbcnews.com", "dailymail.co.uk", "lemonde.fr", "lefigaro.fr", "ouest-france.fr", "20minutes.fr", "francetvinfo.fr", "weather.com"],
  "Video, music & entertainment": ["youtube.com", "netflix.com", "twitch.tv", "open.spotify.com", "imdb.com", "deezer.com", "allocine.fr", "marmiton.org", "duolingo.com"],
  "Travel & mobility": ["airbnb.com", "booking.com", "expedia.com", "tripadvisor.com", "uber.com", "sncf-connect.com", "airfrance.fr", "blablacar.fr", "zillow.com"],
  "Tech & productivity": ["microsoft.com", "github.com", "stackoverflow.com", "canva.com", "figma.com", "notion.com", "slack.com", "zoom.us", "dropbox.com", "wordpress.com", "shopify.com", "stripe.com"],
  "Finance & services": ["paypal.com", "boursorama.com", "laposte.fr", "doctolib.fr", "service-public.fr"],
};
const categoryOf = (name) => Object.entries(CATEGORIES).find(([, hosts]) => hosts.includes(name))?.[0] ?? "Other";

const sites = [];
const failed = [];
// The CLI "rendered" flag is a hint for the run (it triggers a longer retry); blank, still-loading
// and bot-check pages are confirmed on the screenshots and listed in excluded.json.
for (const [name, r] of Object.entries(results)) {
  if (r.error || excluded[name]) {
    failed.push({ name, reason: excluded[name] ?? r.error });
    continue;
  }
  const book = r.scenarios.find((s) => s.posture === "book");
  const tabletop = r.scenarios.find((s) => s.posture === "tabletop");
  const all = r.scenarios.flatMap((s) => s.issues);
  const kinds = [...new Set(all.map((i) => i.kind))];
  sites.push({
    name,
    label: name.replace(/^(wwws|edition|en.m|open)./, ""),
    url: r.url,
    category: categoryOf(name),
    score: r.score,
    book: book.score,
    tabletop: tabletop.score,
    critical: all.filter((i) => i.severity === "critical").length,
    warnings: all.filter((i) => i.severity === "warning").length,
    kinds,
    consent: r.scenarios.some((sc) => sc.consentDismissed),
    // The most severe issue in book posture, for the table.
    top: book.issues[0] ? { message: book.issues[0].message, text: book.issues[0].text } : null,
  });

  const shot = join(here, "shots", `${name}.book.jpg`);
  if (existsSync(shot)) {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", shot, "-vf", "scale=360:-1", "-q:v", "6", join(out, "shots", `${name}.jpg`)]);
  }
}

sites.sort((a, b) => a.score - b.score);
const scores = sites.map((s) => s.score);
const pct = (n) => Math.round((n / sites.length) * 100);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

const KIND_LABELS = {
  interactive: "Button, link or field split by the hinge",
  text: "Text crossing the hinge",
  modal: "Modal or banner centered on the hinge",
  fixed: "Floating element over the hinge",
  media: "Video or image cut in half",
  scroller: "Carousel crossing the hinge",
};

// First pass, without closing consent banners: how often does the banner itself sit on the hinge?
const rawFile = join(here, "results-with-banners.json");
const BANNER = /cookie|consent|privacy|confidentialit|vie priv|données|accepter|refuser|accept all|reject/i;
let bannerOnHinge = null;
if (existsSync(rawFile)) {
  const raw = JSON.parse(readFileSync(rawFile, "utf8"));
  const audited = sites.filter((x) => raw[x.name] && !raw[x.name].error);
  const hit = audited.filter((x) => raw[x.name].scenarios.find((sc) => sc.posture === "book").issues.some((i) => BANNER.test(i.text)));
  bannerOnHinge = { percent: Math.round((hit.length / audited.length) * 100), sites: hit.length, of: audited.length };
}

const summary = {
  date: new Date().toISOString().slice(0, 10),
  device: "Samsung Galaxy Z Fold (690×829 CSS px, book and tabletop)",
  tested: sites.length,
  failed: failed.length,
  average: Math.round(scores.reduce((a, b) => a + b, 0) / sites.length),
  median: median(scores),
  averageBook: Math.round(sites.reduce((a, s) => a + s.book, 0) / sites.length),
  averageTabletop: Math.round(sites.reduce((a, s) => a + s.tabletop, 0) / sites.length),
  ready: pct(sites.filter((s) => s.score >= 90).length),
  withCritical: pct(sites.filter((s) => s.critical > 0).length),
  perfect: sites.filter((s) => s.score === 100).length,
  consentBanners: pct(sites.filter((s) => s.consent).length),
  bannerOnHinge,
  buckets: [0, 50, 60, 70, 80, 90].map((min, i, a) => {
    const max = a[i + 1] ?? 101;
    return { label: max === 101 ? "90-100" : `${min}-${max - 1}`, count: sites.filter((s) => s.score >= min && s.score < max).length };
  }),
  kinds: Object.entries(KIND_LABELS)
    .map(([kind, label]) => ({ kind, label, percent: pct(sites.filter((s) => s.kinds.includes(kind)).length) }))
    .sort((a, b) => b.percent - a.percent),
  categories: Object.keys(CATEGORIES)
    .map((name) => {
      const list = sites.filter((s) => s.category === name);
      return { name, count: list.length, average: list.length ? Math.round(list.reduce((a, s) => a + s.score, 0) / list.length) : null };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => a.average - b.average),
};

// Same sites at the leaked iPhone Fold size (904×640 CSS px, iPhone user agent).
const iphoneFile = join(here, "results-iphone-fold.json");
if (existsSync(iphoneFile)) {
  const ip = JSON.parse(readFileSync(iphoneFile, "utf8"));
  const ipExcluded = JSON.parse(readFileSync(join(here, "excluded-iphone-fold.json"), "utf8"));
  const both = sites.filter((x) => ip[x.name] && !ip[x.name].error && !ipExcluded[x.name]);
  for (const x of both) {
    const r = ip[x.name];
    x.iphone = { score: r.score, book: r.scenarios.find((sc) => sc.posture === "book").score };
  }
  // Flat value for sorting the results table (-1: not audited on iPhone).
  for (const x of sites) x.iphoneScore = x.iphone?.score ?? -1;
  const n = both.length;
  const critical = both.filter((x) => ip[x.name].scenarios.some((sc) => sc.issues.some((i) => i.severity === "critical")));
  summary.iphone = {
    device: "iPhone Fold, leaked specs (904×640 CSS px, iPhone user agent)",
    tested: n,
    average: Math.round(both.reduce((a, x) => a + x.iphone.score, 0) / n),
    averageBook: Math.round(both.reduce((a, x) => a + x.iphone.book, 0) / n),
    ready: Math.round((both.filter((x) => x.iphone.score >= 90).length / n) * 100),
    withCritical: Math.round((critical.length / n) * 100),
    worse: Math.round((both.filter((x) => x.iphone.score < x.score).length / n) * 100),
  };
}

writeFileSync(join(out, "data.json"), JSON.stringify({ summary, sites, failed }, null, 1));
console.log(JSON.stringify(summary, null, 2));
console.log("failed:", failed.map((f) => `${f.name} (${f.reason})`).join(", "));
