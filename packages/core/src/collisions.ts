import { getFold } from "./store";
import type { Rect } from "./types";

export type Severity = "critical" | "warning" | "minor";
export type CollisionKind = "interactive" | "text" | "modal" | "fixed" | "media" | "scroller";

export interface Collision {
  element: Element;
  kind: CollisionKind;
  severity: Severity;
  message: string;
  suggestion: string;
  /** Element box in viewport coordinates. */
  rect: Rect;
  /** Short CSS selector, handy for reports and logs. */
  selector: string;
}

export interface FindCollisionsOptions {
  /** Where to look. Defaults to `document.body`. */
  root?: Element;
  /** Hinge to test against. Defaults to the current (real or simulated) hinge. */
  hinge?: Rect | null;
  /**
   * Widens the hinge to at least this thickness, in px, to also flag content that
   * merely touches the fold. Defaults to 0: only content crossing the fold line
   * (or overlapping a physical hinge) is reported.
   */
  minZone?: number;
  /** Stop after this many elements to keep large pages fast. Defaults to 8000. */
  maxElements?: number;
}

const INTERACTIVE =
  'a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="switch"],[role="menuitem"],[contenteditable=""],[contenteditable="true"]';
const MODAL = 'dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]';
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "META", "LINK", "FOLDJS-DEVTOOLS"]);

const WEIGHT: Record<Severity, number> = { critical: 6, warning: 3, minor: 1 };

/**
 * Lists the elements that sit under the hinge: split buttons, text crossing the
 * fold, modals centered on it, cut videos… Ordered from most to least severe.
 * Elements inside `[data-fold-ignore]` are skipped.
 */
export function findHingeCollisions(options: FindCollisionsOptions = {}): Collision[] {
  if (typeof document === "undefined") return [];
  const hinge = options.hinge === undefined ? getFold().hinge : options.hinge;
  if (!hinge) return [];

  const zone = foldZone(hinge, options.minZone ?? 0);
  const vertical = hinge.height > hinge.width;
  const root = options.root ?? document.body;
  const max = options.maxElements ?? 8000;
  const viewportArea = window.innerWidth * window.innerHeight;
  const found: Collision[] = [];
  const reported = new Set<Element>();

  // The document, then every open shadow root met on the way (web components).
  const roots: Node[] = [root];
  let n = 0;

  for (let current = roots.shift(); current && n < max; current = roots.shift()) {
    const walker = document.createTreeWalker(current, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const el = node as Element;
        if (SKIP.has(el.tagName) || el.hasAttribute("data-fold-ignore")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    // Subtrees already covered by a single issue (a split button, a modal).
    let covered: Element | null = null;

    for (let node = walker.nextNode(); node && n < max; n++, node = walker.nextNode()) {
      const el = node as Element;
      if (el.shadowRoot) roots.push(el.shadowRoot);
      if (covered && covered.contains(el)) continue;
      covered = null;

      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1 || !intersects(box, zone)) continue;
      // Only the part left visible by scrolling / overflow-hidden ancestors counts.
      const r = clipToAncestors(el, box);
      if (!r || !intersects(r, zone)) continue;

      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.opacity === "0") continue;
      if (hiddenByAncestor(el) || isOccluded(el, r, zone)) continue;

      const add = (kind: CollisionKind, severity: Severity, message: string, suggestion: string) => {
        if (reported.has(el)) return;
        reported.add(el);
        found.push({ element: el, kind, severity, message, suggestion, rect: toRect(r), selector: selectorFor(el) });
      };

      // Some apps mark their whole page as a dialog: treat a near-full-screen "modal" as a plain container.
      if (el.matches(MODAL) && r.width * r.height < viewportArea * 0.8) {
        add("modal", "warning", "Modal is centered on the hinge", "Show it on one screen: wrap the page in <TwoPane> or load foldjs/auto, which moves open dialogs to a single segment.");
        covered = el;
        continue;
      }

      if (el.matches(INTERACTIVE) || isClickable(el, style, r, viewportArea)) {
        add("interactive", "critical", `${label(el)} is split by the hinge`, "Keep controls inside one segment: use <TwoPane> or give this element data-fold-avoid with foldjs/auto.");
        covered = el;
        continue;
      }

      // Full-width bars are fine: only their content matters, and it is checked on its own.
      const spansAxis = vertical ? r.width >= window.innerWidth * 0.9 : r.height >= window.innerHeight * 0.9;
      if ((style.position === "fixed" || style.position === "sticky") && !spansAxis) {
        add("fixed", "warning", `${style.position === "fixed" ? "Fixed" : "Sticky"} element overlaps the hinge`, vertical
          ? "Center its content within one segment or split it with the --fold-hinge-width variable."
          : "Move it to the top or bottom edge, away from the fold.");
        // Keep walking: its text and buttons are reported on their own.
      }

      if (/^(VIDEO|IFRAME|CANVAS|OBJECT|EMBED)$/.test(el.tagName)) {
        add("media", "warning", `${el.tagName.toLowerCase()} is cut in half by the hinge`, vertical
          ? "Place media in a single pane with <TwoPane>."
          : "In tabletop posture keep media in the top segment (foldjs/auto does it for <video> and <iframe>).");
        continue;
      }

      if (/^(IMG|SVG|PICTURE)$/i.test(el.tagName)) {
        if (r.width * r.height > viewportArea * 0.05) add("media", "minor", "Image crosses the hinge", "Usually fine for backgrounds; keep faces and text in images away from the fold.");
        continue;
      }

      if (vertical && /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) {
        add("scroller", "warning", "Horizontal carousel crosses the hinge", "Snap items to segment widths (--fold-segment-0-width) or keep the carousel in one pane.");
      }

      if (textCrosses(el, zone, r)) {
        add("text", "warning", "Text crosses the hinge", vertical
          ? "Lay content out in two columns around the hinge: <TwoPane>, the fold-two-pane class, or data-fold-columns with foldjs/auto."
          : "Avoid text on the fold line in tabletop posture; split content between the two halves.");
      }
    }
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, minor: 2 };
  return found.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** 0 to 100: how foldable-ready the page is for the tested posture. */
export function foldScore(collisions: Collision[]): number {
  const penalty = collisions.reduce((sum, c) => sum + WEIGHT[c.severity], 0);
  return Math.max(0, Math.round(100 - penalty));
}

const COLORS: Record<Severity, string> = { critical: "#ff3b5c", warning: "#ff9f1a", minor: "#ffd60a" };

/** Draws an outline around each collision inside `container` (positioned fixed, full viewport). */
export function paintCollisions(container: HTMLElement, collisions: Collision[]): void {
  container.replaceChildren(
    ...collisions.map((c) => {
      const box = document.createElement("div");
      const color = COLORS[c.severity];
      Object.assign(box.style, {
        position: "fixed",
        left: `${c.rect.x}px`,
        top: `${c.rect.y}px`,
        width: `${c.rect.width}px`,
        height: `${c.rect.height}px`,
        outline: `2px solid ${color}`,
        outlineOffset: "-1px",
        background: `${color}22`,
        borderRadius: "3px",
        pointerEvents: "none",
      });
      box.title = c.message;
      return box;
    }),
  );
}

/** Outlines the given collisions on the page. Returns a function that removes the overlay. */
export function highlightCollisions(collisions: Collision[]): () => void {
  const layer = document.createElement("div");
  layer.setAttribute("data-fold-ignore", "");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "2147483645" });
  paintCollisions(layer, collisions);
  document.body.appendChild(layer);
  return () => layer.remove();
}

function foldZone(h: Rect, min: number): Rect {
  if (h.height > h.width) {
    const w = Math.max(h.width, min);
    return { x: h.x + h.width / 2 - w / 2, y: h.y, width: w, height: h.height };
  }
  const t = Math.max(h.height, min);
  return { x: h.x, y: h.y + h.height / 2 - t / 2, width: h.width, height: t };
}

// Sub-pixel layout (fractional grid tracks, zoom) must not turn "touching" into "overlapping".
const EPS = 0.5;

function intersects(r: { left: number; top: number; right: number; bottom: number }, z: Rect): boolean {
  return r.left < z.x + z.width - EPS && r.right > z.x + EPS && r.top < z.y + z.height - EPS && r.bottom > z.y + EPS;
}

// Checks the actual line boxes of the element's own text, not its whole box:
// a paragraph whose lines stop before the hinge is fine.
function textCrosses(el: Element, zone: Rect, clip: Box): boolean {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(child);
    const rects = typeof range.getClientRects === "function" ? Array.from(range.getClientRects()) : [];
    if (rects.length === 0) return true; // no layout info (e.g. jsdom): the element box already crosses
    if (rects.some((line) => { const v = intersection(line, clip); return v !== null && intersects(v, zone); })) return true;
  }
  return false;
}

interface Box {
  x: number;
  y: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function intersection(a: Box, b: Box): Box | null {
  const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right), bottom = Math.min(a.bottom, b.bottom);
  if (right - left < 1 || bottom - top < 1) return null;
  return { x: left, y: top, left, top, right, bottom, width: right - left, height: bottom - top };
}

function clipToAncestors(el: Element, box: Box): Box | null {
  let visible: Box | null = box;
  for (let p = el.parentElement; p && visible && p !== document.documentElement; p = p.parentElement) {
    const { overflow, overflowX, overflowY } = getComputedStyle(p);
    const clips = (v: string) => v !== "" && v !== "visible";
    if (![overflow, overflowX, overflowY].some(clips)) continue;
    visible = intersection(visible, p.getBoundingClientRect());
  }
  return visible;
}

// Tooltips and menus are often kept in the page but faded out on a parent.
function hiddenByAncestor(el: Element): boolean {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (s.opacity === "0" || s.clipPath === "inset(50%)") return true;
  }
  return false;
}

// Something else is drawn on top at the fold (an overlay, a sticky bar, another layer of
// stacked hidden cards): the element is not what the user sees there.
function isOccluded(el: Element, r: Box, zone: Rect): boolean {
  const root = el.getRootNode() as Document | ShadowRoot;
  if (typeof root.elementFromPoint !== "function") return false;
  const x = Math.min(Math.max(zone.x + zone.width / 2, r.left + 1), r.right - 1);
  const y = Math.min(Math.max(r.top + r.height / 2, zone.y), zone.y + zone.height);
  const top = root.elementFromPoint(x, y);
  if (!top) return false;
  return top !== el && !el.contains(top) && !top.contains(el);
}

// A div or span wired up with a click handler: the browser shows a pointer cursor on it.
// Only the outermost element counts (the cursor is inherited by its children), and
// large clickable areas such as whole cards are left to the text and media checks.
function isClickable(el: Element, style: CSSStyleDeclaration, r: Box, viewportArea: number): boolean {
  if (style.cursor !== "pointer" || r.width * r.height > viewportArea * 0.25) return false;
  const parent = el.parentElement;
  if (parent && getComputedStyle(parent).cursor === "pointer") return false;
  return !!el.textContent?.trim() || !!el.querySelector("svg, img");
}

function label(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  if (tag === "a" || role === "link") return "Link";
  if (tag === "input" || tag === "select" || tag === "textarea") return "Form field";
  return "Button";
}

function toRect(r: Box): Rect {
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
}

const esc = (s: string) =>
  typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, (c) => `\\${c}`);

function selectorFor(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body && parts.length < 4) {
    if (cur.id) {
      parts.unshift(`#${esc(cur.id)}`);
      break;
    }
    let part = cur.tagName.toLowerCase();
    const cls = Array.from(cur.classList).slice(0, 2).map((c) => `.${esc(c)}`).join("");
    part += cls;
    const parent: Element | null = cur.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    cur = parent;
  }
  return parts.join(" > ");
}
