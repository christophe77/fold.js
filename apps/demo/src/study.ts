import "./study.css";

interface Site {
  name: string;
  label: string;
  url: string;
  category: string;
  score: number;
  book: number;
  tabletop: number;
  critical: number;
  warnings: number;
  kinds: string[];
  top: { message: string; text: string } | null;
}

interface Data {
  summary: {
    date: string;
    device: string;
    tested: number;
    failed: number;
    average: number;
    median: number;
    averageBook: number;
    averageTabletop: number;
    ready: number;
    withCritical: number;
    perfect: number;
    consentBanners: number;
    bannerOnHinge: { percent: number; sites: number; of: number } | null;
    buckets: { label: string; count: number }[];
    kinds: { kind: string; label: string; percent: number }[];
    categories: { name: string; count: number; average: number }[];
  };
  sites: Site[];
  failed: { name: string; reason: string }[];
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const level = (n: number) => (n >= 90 ? "good" : n >= 70 ? "fair" : "poor");

// One shared tooltip for every bar.
const tip = document.createElement("div");
tip.className = "tip";
tip.setAttribute("role", "tooltip");
document.body.appendChild(tip);
function bindTooltip(root: HTMLElement) {
  root.addEventListener("pointermove", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (!target) return void (tip.style.opacity = "0");
    tip.textContent = target.dataset.tip!;
    tip.style.opacity = "1";
    tip.style.left = `${Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${e.clientY + 14}px`;
  });
  root.addEventListener("pointerleave", () => (tip.style.opacity = "0"));
}

/** Horizontal bars with the value written at the end of each bar. */
function hbars(el: HTMLElement, rows: { label: string; value: number; max: number; suffix: string; tip: string }[]) {
  el.innerHTML = rows
    .map(
      (r) => `<div class="hbar" data-tip="${esc(r.tip)}">
        <span class="hbar-label">${esc(r.label)}</span>
        <span class="hbar-track"><span class="hbar-fill" style="width:${(r.value / r.max) * 100}%"></span></span>
        <span class="hbar-value">${r.value}${r.suffix}</span>
      </div>`,
    )
    .join("");
  bindTooltip(el);
}

function histogram(el: HTMLElement, buckets: Data["summary"]["buckets"], total: number) {
  const max = Math.max(...buckets.map((b) => b.count));
  el.innerHTML = `<div class="hist">${buckets
    .map(
      (b) => `<div class="hist-col" data-tip="${b.count} site${b.count === 1 ? "" : "s"} scored ${b.label}">
        <span class="hist-value">${b.count}</span>
        <span class="hist-bar ${b.label === "90-100" ? "ready" : ""}" style="height:${(b.count / max) * 100}%;${b.count ? "" : "min-height:0"}"></span>
        <span class="hist-label">${b.label}</span>
      </div>`,
    )
    .join("")}</div><p class="note">Score out of 100, ${total} sites. Only the 90-100 column counts as foldable-ready.</p>`;
  bindTooltip(el);
}

function card(s: Site) {
  return `<figure class="site-card">
    <a href="${esc(s.url)}" rel="nofollow noopener" target="_blank"><img src="study/shots/${esc(s.name)}.jpg" alt="${esc(s.label)} on a Galaxy Z Fold, elements under the hinge outlined" loading="lazy" width="360" height="432"></a>
    <figcaption>
      <span class="score ${level(s.score)}">${s.score}</span>
      <strong>${esc(s.label)}</strong>
      <span class="muted">${s.top ? esc(s.top.message) : "No element under the hinge"}</span>
    </figcaption>
  </figure>`;
}

function table(sites: Site[]) {
  const body = $("#rows");
  const search = $<HTMLInputElement>("#search");
  let key: keyof Site = "score";
  let dir = 1;
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const list = sites
      .filter((s) => !q || s.label.includes(q) || s.category.toLowerCase().includes(q))
      .sort((a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0));
    body.innerHTML = list
      .map(
        (s) => `<tr>
        <td><a href="${esc(s.url)}" rel="nofollow noopener" target="_blank">${esc(s.label)}</a></td>
        <td class="muted">${esc(s.category)}</td>
        <td class="num"><span class="score ${level(s.score)}">${s.score}</span></td>
        <td class="num">${s.book}</td>
        <td class="num">${s.tabletop}</td>
        <td class="num">${s.critical}</td>
        <td class="muted">${s.top ? esc(s.top.message) : "None"}</td>
      </tr>`,
      )
      .join("");
  };
  document.querySelectorAll<HTMLButtonElement>("th button").forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.dataset.key as keyof Site;
      dir = k === key ? -dir : 1;
      key = k;
      document.querySelectorAll("th").forEach((th) => th.removeAttribute("aria-sort"));
      b.parentElement!.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");
      render();
    }),
  );
  search.addEventListener("input", render);
  render();
}

async function main() {
  const data: Data = await (await fetch("study/data.json")).json();
  const { summary: s, sites } = data;

  $("#kpi-failing").textContent = `${100 - s.ready}%`;
  $("#kpi-critical").textContent = `${s.withCritical}%`;
  $("#kpi-book").textContent = String(s.averageBook);
  if (s.bannerOnHinge) $("#kpi-banner").textContent = `${s.bannerOnHinge.percent}%`;
  $("#date").textContent = new Date(s.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  $("#tested").textContent = String(s.tested);

  histogram($("#chart-scores"), s.buckets, s.tested);
  hbars(
    $("#chart-kinds"),
    s.kinds.map((k) => ({ label: k.label, value: k.percent, max: 100, suffix: "%", tip: `${k.percent}% of sites have at least one: ${k.label.toLowerCase()}` })),
  );
  hbars(
    $("#chart-categories"),
    s.categories.map((c) => ({ label: c.name, value: c.average, max: 100, suffix: "", tip: `${c.name}: average ${c.average}/100 over ${c.count} sites` })),
  );

  $("#shame").innerHTML = sites.slice(0, 8).map(card).join("");
  $("#fame").innerHTML = [...sites].reverse().slice(0, 4).map(card).join("");
  $("#failed").textContent = data.failed.length
    ? `${data.failed.length} sites could not be audited (bot protection or errors) and are left out: ${data.failed.map((f) => f.name.replace(/^(wwws|edition|en.m|open)./, "")).join(", ")}.`
    : "";
  table(sites);
}

main();
