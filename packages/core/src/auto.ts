import { getFold, init, subscribe } from "./store";
import type { FoldState, Rect } from "./types";

export interface AutoFixOptions {
  /** Move open dialogs and modals to a single screen segment. Defaults to true. */
  modals?: boolean;
  /** Move elements marked `data-fold-avoid` off the hinge. Defaults to true. */
  avoid?: boolean;
  /** Lay out elements marked `data-fold-columns` as two columns around the hinge (book posture). Defaults to true. */
  columns?: boolean;
  /** Keep videos and iframes on one screen (top half in tabletop). Defaults to true. */
  media?: boolean;
  /** Open a gap at the hinge in fixed navigation bars (bottom tabs, toolbars). Defaults to true. */
  bars?: boolean;
  /** Space kept between moved content and the hinge or screen edges, in px. Defaults to 16. */
  gutter?: number;
}

const MODAL = 'dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]';
const WATCHED = ["open", "class", "hidden", "role", "aria-modal", "data-fold-avoid", "data-fold-columns"];

/**
 * Retrofits an existing (mobile) site for foldables without touching its code.
 * Every change is an inline style that is reverted as soon as the posture changes,
 * so the original layout is untouched on regular phones.
 * Elements inside `[data-fold-ignore]` are never modified. Returns a function that undoes everything.
 */
export function autoFix(options: AutoFixOptions = {}): () => void {
  if (typeof document === "undefined") return () => {};
  const opts = { modals: true, avoid: true, columns: true, media: true, bars: true, gutter: 16, ...options };
  const g = opts.gutter;
  const originals = new Map<HTMLElement, Record<string, string>>();

  const set = (el: HTMLElement, prop: string, value: string) => {
    const saved = originals.get(el) ?? {};
    if (!(prop in saved)) saved[prop] = el.style.getPropertyValue(prop);
    originals.set(el, saved);
    el.style.setProperty(prop, value);
  };

  const restore = () => {
    originals.forEach((saved, el) => {
      for (const [prop, value] of Object.entries(saved)) el.style.setProperty(prop, value);
    });
    originals.clear();
  };

  const ignored = (el: Element) => el.closest("[data-fold-ignore]") !== null;

  // Shifts an element (with the `translate` property, which composes with any
  // existing `transform`) so it sits entirely inside one segment.
  const moveToSegment = (el: HTMLElement, state: FoldState, centered: boolean) => {
    const h = state.hinge!;
    const [a, b] = state.segments;
    const columns = state.spanning === "columns";
    let r = el.getBoundingClientRect();
    if (r.width < 1 || !crosses(r, h)) return;

    const before = columns ? Math.max(0, Math.min(r.right, h.x) - r.left) : Math.max(0, Math.min(r.bottom, h.y) - r.top);
    const after = columns ? Math.max(0, r.right - (h.x + h.width)) : Math.max(0, r.bottom - (h.y + h.height));
    // Modals go to the right screen in book posture and to the top half in tabletop.
    const seg = centered ? (columns ? b : a) : before > after ? a : b;

    if (columns && r.width > seg.width - 2 * g) set(el, "max-width", `${seg.width - 2 * g}px`);
    if (!columns && r.height > seg.height - 2 * g) {
      set(el, "max-height", `${seg.height - 2 * g}px`);
      set(el, "overflow", "auto");
    }
    r = el.getBoundingClientRect();
    // The measured box already includes any translate the site set; add to it.
    const [tx, ty] = currentTranslate(el);

    if (columns) {
      const dx = centered ? seg.x + seg.width / 2 - (r.left + r.width / 2) : seg === a ? seg.x + seg.width - g - r.right : seg.x + g - r.left;
      set(el, "translate", `${Math.round(tx + dx)}px ${ty}px`);
    } else {
      const dy = centered ? seg.y + seg.height / 2 - (r.top + r.height / 2) : seg === a ? seg.y + seg.height - g - r.bottom : seg.y + g - r.top;
      set(el, "translate", `${tx}px ${Math.round(ty + dy)}px`);
    }
  };

  // Two columns whose gap is centered on the hinge, even if the element is offset.
  const splitColumns = (el: HTMLElement, h: Rect) => {
    const r = el.getBoundingClientRect();
    if (r.width < window.innerWidth * 0.9 || !crosses(r, h)) return;
    const center = h.x + h.width / 2;
    const shift = 2 * (center - r.left) - r.width; // padding-left minus padding-right
    set(el, "column-count", "2");
    set(el, "column-gap", `${h.width + 2 * g}px`);
    set(el, "padding-left", `${Math.max(0, shift)}px`);
    set(el, "padding-right", `${Math.max(0, -shift)}px`);
  };

  const fitMedia = (el: HTMLElement, state: FoldState) => {
    const h = state.hinge!;
    const r = el.getBoundingClientRect();
    if (r.height < 1 || !crosses(r, h)) return;
    const room = state.segments[0].height - 2 * g;
    if (r.height > room) {
      set(el, "max-height", `${room}px`);
      if (el.tagName === "VIDEO") set(el, "object-fit", "contain");
    }
  };

  // Tab bars: N items, flexed across the screen. Re-flow them on a grid with an empty
  // column under the hinge so no item is split.
  const splitBar = (el: HTMLElement, h: Rect) => {
    const r = el.getBoundingClientRect();
    const items = Array.from(el.children).filter((c): c is HTMLElement => c instanceof HTMLElement && getComputedStyle(c).position !== "absolute");
    if (items.length < 2 || r.width < window.innerWidth * 0.9 || !crosses(r, h)) return;
    const left = Math.ceil(items.length / 2);
    const leftWidth = Math.max(0, h.x - r.left);
    set(el, "display", "grid");
    set(el, "grid-template-columns", `repeat(${left}, ${leftWidth / left}px) ${h.width}px repeat(${items.length - left}, minmax(0, 1fr))`);
    items.forEach((item, i) => set(item, "grid-column", String(i < left ? i + 1 : i + 2)));
  };

  const isBar = (el: HTMLElement) => {
    const s = getComputedStyle(el);
    return (s.position === "fixed" || s.position === "sticky") && (s.display === "flex" || s.display === "inline-flex");
  };

  const apply = () => {
    restore();
    const state = getFold();
    const h = state.hinge;
    if (!h) return;
    const all = (selector: string) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => !ignored(el));

    if (opts.columns && state.spanning === "columns") all("[data-fold-columns]").forEach((el) => splitColumns(el, h));
    if (opts.media && state.spanning === "rows") all("video, iframe").forEach((el) => fitMedia(el, state));
    if (opts.media && state.spanning === "columns") all("video, iframe").forEach((el) => moveToSegment(el, state, false));
    if (opts.bars && state.spanning === "columns") all('nav, [role="navigation"], [role="tablist"]').filter(isBar).forEach((el) => splitBar(el, h));
    if (opts.modals) all(MODAL).forEach((el) => moveToSegment(el, state, true));
    if (opts.avoid) all("[data-fold-avoid]").forEach((el) => moveToSegment(el, state, false));
  };

  let timer = 0;
  const schedule = () => {
    if (!timer) timer = window.setTimeout(() => ((timer = 0), apply()), 50);
  };

  // In tabletop, bring a video that starts playing into the top half.
  const onPlay = (e: Event) => {
    const state = getFold();
    const el = e.target as HTMLElement;
    if (!opts.media || state.spanning !== "rows" || !state.hinge || ignored(el)) return;
    const r = el.getBoundingClientRect();
    if (crosses(r, state.hinge) && r.height <= state.segments[0].height) {
      window.scrollBy({ top: r.bottom - (state.hinge.y - g), behavior: "smooth" });
    }
  };

  const stopInit = init();
  const unsubscribe = subscribe(schedule);
  // Our own inline styles are not watched, so applying fixes never re-triggers itself.
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: WATCHED });
  window.addEventListener("resize", schedule);
  document.addEventListener("play", onPlay, true);
  apply();

  return () => {
    clearTimeout(timer);
    observer.disconnect();
    unsubscribe();
    stopInit();
    window.removeEventListener("resize", schedule);
    document.removeEventListener("play", onPlay, true);
    restore();
  };
}

function currentTranslate(el: HTMLElement): [number, number] {
  const value = el.style.translate || getComputedStyle(el).translate || "";
  const [x = "0px", y = "0px"] = value === "none" ? [] : value.split(/s+/);
  const px = (v: string) => (v.endsWith("px") ? parseFloat(v) : 0);
  return [px(x), px(y)];
}

function crosses(r: DOMRect, h: Rect): boolean {
  // Treat a zero-width hinge as a fold line.
  const vertical = h.height > h.width;
  const x = vertical ? h.x - 1 : h.x;
  const y = vertical ? h.y : h.y - 1;
  const w = vertical ? h.width + 2 : h.width;
  const ht = vertical ? h.height : h.height + 2;
  return r.left < x + w && r.right > x && r.top < y + ht && r.bottom > y;
}
