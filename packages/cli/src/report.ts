import type { AuditResult, Issue } from "./audit.js";

export function badgeUrl(score: number): string {
  const color = score >= 90 ? "brightgreen" : score >= 60 ? "yellow" : "red";
  return `https://img.shields.io/badge/foldable--ready-${score}%2F100-${color}`;
}

export function badgeMarkdown(score: number): string {
  return `[![foldable-ready ${score}/100](${badgeUrl(score)})](https://github.com/christophe77/foldjs)`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const level = (score: number) => (score >= 90 ? "good" : score >= 60 ? "fair" : "poor");

function issueRow(i: Issue): string {
  return `<li class="issue">
    <span class="sev ${i.severity}">${i.severity}</span>
    <div>
      <strong>${esc(i.message)}</strong>
      <code>${esc(i.selector || i.kind)}</code>
      ${i.text ? `<q>${esc(i.text)}</q>` : ""}
      <p>${esc(i.suggestion)}</p>
    </div>
  </li>`;
}

/** Self-contained HTML report (screenshots inlined). */
export function renderReport(result: AuditResult): string {
  const scenarios = result.scenarios
    .map(
      (s) => `<section class="scenario">
      <header>
        <h2>${esc(s.device.name)} · ${s.posture === "book" ? "Book" : "Tabletop"}</h2>
        <span class="score ${level(s.score)}">${s.score}<small>/100</small></span>
      </header>
      <div class="body">
        <img src="data:image/jpeg;base64,${s.screenshot}" alt="${esc(s.device.name)} ${s.posture} screenshot with issues outlined" width="${s.viewport.width}" height="${s.viewport.height}">
        ${s.issues.length ? `<ol>${s.issues.map(issueRow).join("")}</ol>` : `<p class="clean">No element under the hinge. 🎉</p>`}
      </div>
    </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Foldable audit · ${esc(result.url)}</title>
<style>
:root{--bg:#f6f5f2;--card:#fff;--text:#16151a;--muted:#6b6976;--line:#e4e2dc;--accent:#5b4bff;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0f0f13;--card:#18181f;--text:#f1f0f5;--muted:#9a98a6;--line:#2a2933;--accent:#8c80ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:32px 16px}
.top{display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin-bottom:28px}
.big{font-size:64px;font-weight:800;letter-spacing:-.04em;line-height:1}.big small{font-size:24px;color:var(--muted)}
h1{margin:0 0 4px;font-size:22px}h1 a{color:inherit}
.meta{color:var(--muted);font-size:14px}
.good{color:#16a34a}.fair{color:#d97706}.poor{color:#dc2626}
.badge{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 28px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.badge code{font-size:12px;word-break:break-all;flex:1;min-width:200px}
.scenario{background:var(--card);border:1px solid var(--line);border-radius:16px;margin-bottom:20px;overflow:hidden}
.scenario header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line)}
.scenario h2{margin:0;font-size:17px}.score{font-size:28px;font-weight:800}.score small{font-size:14px;color:var(--muted)}
.body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:18px;padding:18px}
@media (max-width:760px){.body{grid-template-columns:1fr}}
img{width:100%;height:auto;border-radius:10px;border:1px solid var(--line)}
ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;max-height:640px;overflow:auto}
.issue{display:flex;gap:10px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:10px}
.issue strong{display:block}.issue code{font-size:12px;color:var(--muted);word-break:break-all}.issue q{display:block;font-size:13px;color:var(--muted);margin-top:2px}
.issue p{margin:4px 0 0;font-size:13px}
.sev{flex:none;font-size:11px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:999px;color:#fff;margin-top:2px}
.sev.critical{background:#e11d48}.sev.warning{background:#ea8a00}.sev.minor{background:#a3a3a3}
.clean{font-size:18px}
footer{color:var(--muted);font-size:13px;margin-top:32px}footer a{color:var(--accent)}
</style>
</head>
<body>
<main>
  <div class="top">
    <div class="big ${level(result.score)}">${result.score}<small>/100</small></div>
    <div>
      <h1>Foldable audit of <a href="${esc(result.url)}">${esc(result.url)}</a></h1>
      <div class="meta">${new Date(result.date).toUTCString()} · ${result.scenarios.length} scenario(s) · ${result.usesFoldjs ? "uses fold.js" : "does not use fold.js yet"}</div>
    </div>
  </div>
  <div class="badge"><img src="${badgeUrl(result.score)}" alt="foldable-ready ${result.score}/100" style="width:auto;border:0"><code>${esc(badgeMarkdown(result.score))}</code></div>
  ${scenarios}
  <footer>Generated by <a href="https://github.com/christophe77/foldjs">fold.js</a> · Fix issues with <a href="https://christophe77.github.io/foldjs/">&lt;TwoPane&gt;, the CSS layer or foldjs/auto</a>.</footer>
</main>
</body>
</html>`;
}
