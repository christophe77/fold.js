import { getFold, subscribe } from "./store";
import type { FoldState } from "./types";

export type Style = Record<string, string>;

export interface TwoPaneOptions {
  /** What to do on a single screen: stack both panes, or show only one. Defaults to `stack`. */
  fallback?: "stack" | "primary" | "secondary";
}

export interface TwoPaneLayout {
  mode: "columns" | "rows" | "single";
  container: Style;
  primary: Style;
  secondary: Style;
  /** Style for an optional element placed over the hinge, or `null` when there is none. */
  hinge: Style | null;
}

/**
 * Computes the styles of a two-pane layout for the given state.
 * Every adapter (React, Vue, Svelte, Web Components) renders from this,
 * so the layout behaves the same everywhere.
 */
export function twoPaneLayout(state: FoldState, options: TwoPaneOptions = {}): TwoPaneLayout {
  const base: Style = { display: "grid", width: "100%", height: "100%", minHeight: "0" };
  const pane: Style = { minWidth: "0", minHeight: "0", overflow: "auto" };
  const [a, b] = state.segments;
  const hinge = state.hinge;

  if (state.spanning === "columns" && a && b && hinge) {
    return {
      mode: "columns",
      container: { ...base, gridTemplateColumns: `${a.width}px ${hinge.width}px minmax(0, 1fr)`, gridTemplateRows: "100%" },
      primary: { ...pane, gridColumn: "1" },
      secondary: { ...pane, gridColumn: "3" },
      hinge: { gridColumn: "2", gridRow: "1" },
    };
  }

  if (state.spanning === "rows" && a && b && hinge) {
    return {
      mode: "rows",
      container: { ...base, gridTemplateRows: `${a.height}px ${hinge.height}px minmax(0, 1fr)`, gridTemplateColumns: "100%" },
      primary: { ...pane, gridRow: "1" },
      secondary: { ...pane, gridRow: "3" },
      hinge: { gridRow: "2", gridColumn: "1" },
    };
  }

  const fallback = options.fallback ?? "stack";
  return {
    mode: "single",
    container: { ...base, gridTemplateColumns: "100%", gridAutoRows: fallback === "stack" ? "auto" : "100%", alignContent: "start" },
    primary: fallback === "secondary" ? { display: "none" } : pane,
    secondary: fallback === "primary" ? { display: "none" } : pane,
    hinge: null,
  };
}

/**
 * Lays out an existing element as a two-pane container, for frameworks that work
 * with plain DOM nodes (Svelte actions, Solid directives, vanilla JS).
 * Children are picked by attribute: `data-pane="primary"`, `"secondary"` and optionally `"hinge"`.
 */
export function bindTwoPane(container: HTMLElement, options: TwoPaneOptions = {}) {
  let current = options;
  const paint = () => {
    const layout = twoPaneLayout(getFold(), current);
    container.dataset.foldMode = layout.mode;
    setStyle(container, layout.container);
    for (const part of ["primary", "secondary", "hinge"] as const) {
      const el = container.querySelector<HTMLElement>(`:scope > [data-pane="${part}"]`);
      if (el) setStyle(el, layout[part] ?? { display: "none" });
    }
  };
  const unsubscribe = subscribe(paint);
  paint();
  return {
    update(next: TwoPaneOptions = {}) {
      current = next;
      paint();
    },
    destroy: unsubscribe,
  };
}

const applied = new WeakMap<HTMLElement, string[]>();

// Only touches the properties the layout owns, so user styles on the element survive.
function setStyle(el: HTMLElement, style: Style) {
  for (const key of applied.get(el) ?? []) (el.style as any)[key] = "";
  Object.assign(el.style, style);
  applied.set(el, Object.keys(style));
}
