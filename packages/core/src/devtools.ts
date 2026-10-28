import { getFold, getSimulation, simulate, subscribe } from "./store";
import { findHingeCollisions, foldScore, paintCollisions } from "./collisions";
import type { Posture } from "./types";

export interface DevtoolsOptions {
  /** Corner where the panel is shown. Defaults to `bottom-right`. */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Posture to start with. Defaults to the real device. */
  initial?: Posture;
  /** Hinge size in px. Defaults to 24. */
  hingeSize?: number;
  /** Outline elements that collide with the hinge. Defaults to true. */
  highlight?: boolean;
}

const POSTURES: Array<{ id: Posture | "device"; label: string; icon: string }> = [
  { id: "device", label: "Device", icon: "◎" },
  { id: "flat", label: "Flat", icon: "▯" },
  { id: "book", label: "Book", icon: "▯▯" },
  { id: "tabletop", label: "Tabletop", icon: "⌐" },
];

const CSS = `
:host{all:initial;font:12px/1.3 system-ui,-apple-system,sans-serif;color-scheme:light dark}
.hinge{position:fixed;pointer-events:none;z-index:2147483646;
  background:repeating-linear-gradient(45deg,#1118 0 6px,#2228 6px 12px);
  box-shadow:0 0 0 1px #0006 inset,0 0 24px #0005;display:none}
.panel{position:fixed;z-index:2147483647;display:flex;gap:4px;align-items:center;padding:6px;
  border-radius:12px;background:#111c;backdrop-filter:blur(8px);color:#fff;box-shadow:0 4px 20px #0004}
.panel[data-pos^=bottom]{bottom:12px}.panel[data-pos^=top]{top:12px}
.panel[data-pos$=right]{right:12px}.panel[data-pos$=left]{left:12px}
.brand{font-weight:700;padding:0 6px;letter-spacing:.02em}
button{all:unset;cursor:pointer;padding:5px 8px;border-radius:8px;white-space:nowrap}
button:hover{background:#fff2}button[aria-pressed=true]{background:#fff;color:#111}
button:focus-visible{outline:2px solid #6cf}
.layer{position:fixed;inset:0;pointer-events:none;z-index:2147483645}
.issues{display:none;font-weight:600}.issues[data-level]{display:inline-block}
.issues[data-level=ok]{color:#4ade80}.issues[data-level=warn]{color:#ffb547}.issues[data-level=bad]{color:#ff6b81}
.issues[aria-pressed=true]{background:#fff2;color:inherit}
.info{opacity:.7;padding:0 6px;font-variant-numeric:tabular-nums}
@media (max-width:480px){.label{display:none}}
`;

/**
 * Mounts a foldable simulator on the page: switch between flat, book and tabletop
 * postures on any desktop browser. Shortcut: Alt+Shift+F cycles postures.
 * Returns a function that removes it.
 */
export function mountDevtools(options: DevtoolsOptions = {}): () => void {
  if (typeof document === "undefined") return () => {};
  const hingeSize = options.hingeSize ?? 24;

  const host = document.createElement("foldjs-devtools");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${CSS}</style><div class="layer"></div><div class="hinge"></div>
    <div class="panel" role="toolbar" aria-label="Fold.js simulator" data-pos="${options.position ?? "bottom-right"}">
      <span class="brand">fold.js</span>
      ${POSTURES.map((p) => `<button data-id="${p.id}" title="${p.label}"><span aria-hidden="true">${p.icon}</span> <span class="label">${p.label}</span></button>`).join("")}
      <button class="issues" title="Elements under the hinge (click to toggle outlines, details in the console)"></button>
      <span class="info"></span>
    </div>`;
  document.body.appendChild(host);

  const hinge = root.querySelector(".hinge") as HTMLElement;
  const info = root.querySelector(".info") as HTMLElement;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button[data-id]"));
  const layer = root.querySelector(".layer") as HTMLElement;
  const issues = root.querySelector(".issues") as HTMLButtonElement;
  let outline = options.highlight ?? true;
  let frame = 0;

  // Throttled re-scan: layout changes, scrolling and posture switches all land here.
  // A timer rather than requestAnimationFrame so it also runs in background tabs and previews.
  const scan = () => {
    if (frame) return;
    frame = window.setTimeout(() => {
      frame = 0;
      const state = getFold();
      if (!state.hinge) {
        issues.removeAttribute("data-level");
        layer.replaceChildren();
        return;
      }
      const found = findHingeCollisions();
      const score = foldScore(found);
      issues.dataset.level = score >= 90 ? "ok" : score >= 60 ? "warn" : "bad";
      issues.textContent = found.length ? `⚠ ${found.length} · ${score}/100` : "✓ 100/100";
      issues.setAttribute("aria-pressed", String(outline));
      paintCollisions(layer, outline ? found : []);
    }, 60);
  };

  issues.addEventListener("click", () => {
    outline = !outline;
    if (outline) {
      const found = findHingeCollisions();
      console.groupCollapsed(`[fold.js] ${found.length} element(s) under the hinge, score ${foldScore(found)}/100`);
      found.forEach((c) => console.log(`${c.severity.toUpperCase()} ${c.message}: ${c.selector}
→ ${c.suggestion}`, c.element));
      console.groupEnd();
    }
    scan();
  });

  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "open", "hidden"] });
  window.addEventListener("scroll", scan, { capture: true, passive: true });
  window.addEventListener("resize", scan);

  const choose = (id: string) => simulate(id === "device" ? null : { posture: id as Posture, hingeSize });
  buttons.forEach((b) => b.addEventListener("click", () => choose(b.dataset.id!)));

  const onKey = (e: KeyboardEvent) => {
    if (!(e.altKey && e.shiftKey && e.code === "KeyF")) return;
    const current = getSimulation()?.posture ?? "device";
    const i = POSTURES.findIndex((p) => p.id === current);
    choose(POSTURES[(i + 1) % POSTURES.length].id);
  };
  window.addEventListener("keydown", onKey);

  const render = () => {
    const state = getFold();
    const active = getSimulation()?.posture ?? "device";
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === active)));
    info.textContent = `${state.posture}${state.simulated ? "" : state.virtual ? " (virtual fold)" : " (device)"}`;
    const h = state.simulated ? state.hinge : null;
    hinge.style.display = h ? "block" : "none";
    if (h) Object.assign(hinge.style, { left: `${h.x}px`, top: `${h.y}px`, width: `${h.width}px`, height: `${h.height}px` });
    scan();
  };

  const unsubscribe = subscribe(render);
  if (options.initial) choose(options.initial);
  render();

  return () => {
    unsubscribe();
    observer.disconnect();
    clearTimeout(frame);
    window.removeEventListener("scroll", scan, { capture: true });
    window.removeEventListener("resize", scan);
    window.removeEventListener("keydown", onKey);
    host.remove();
  };
}
