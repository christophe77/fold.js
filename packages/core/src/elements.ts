import { getFold, subscribe } from "./store";
import { twoPaneLayout } from "./layout";
import type { Style } from "./layout";
import type { Posture } from "./types";

/**
 * Web Components: work in plain HTML and in any framework (Angular, Lit, htmx, Astro…).
 *
 *   <fold-two-pane fallback="stack">
 *     <div slot="primary">…</div>
 *     <div slot="secondary">…</div>
 *   </fold-two-pane>
 *
 *   <fold-when posture="tabletop book">Only shown on a split screen</fold-when>
 */

const HTMLElementBase: typeof HTMLElement =
  typeof HTMLElement === "undefined" ? (class {} as typeof HTMLElement) : HTMLElement;

function apply(el: HTMLElement, style: Style | null) {
  el.removeAttribute("style");
  if (style) Object.assign(el.style, style);
}

export class FoldTwoPane extends HTMLElementBase {
  static observedAttributes = ["fallback"];
  private unsubscribe?: () => void;
  private grid!: HTMLDivElement;
  private panes!: { primary: HTMLElement; secondary: HTMLElement; hinge: HTMLElement };

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>:host{display:block;height:100%}[part=hinge]{pointer-events:none}</style>
      <div part="grid">
        <div part="primary"><slot name="primary"></slot></div>
        <div part="hinge"><slot name="hinge"></slot></div>
        <div part="secondary"><slot name="secondary"></slot></div>
      </div>`;
    const q = (part: string) => root.querySelector(`[part=${part}]`) as HTMLDivElement;
    this.grid = q("grid");
    this.panes = { primary: q("primary"), secondary: q("secondary"), hinge: q("hinge") };
  }

  connectedCallback() {
    this.unsubscribe = subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const fallback = (this.getAttribute("fallback") ?? "stack") as "stack" | "primary" | "secondary";
    const layout = twoPaneLayout(getFold(), { fallback });
    this.dataset.mode = layout.mode;
    apply(this.grid, layout.container);
    apply(this.panes.primary, layout.primary);
    apply(this.panes.secondary, layout.secondary);
    apply(this.panes.hinge, layout.hinge ?? { display: "none" });
  }
}

export class FoldWhen extends HTMLElementBase {
  static observedAttributes = ["posture"];
  private unsubscribe?: () => void;

  connectedCallback() {
    this.unsubscribe = subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const wanted = (this.getAttribute("posture") ?? "").split(/\s+/).filter(Boolean) as Posture[];
    this.hidden = wanted.length > 0 && !wanted.includes(getFold().posture);
  }
}

if (typeof customElements !== "undefined") {
  if (!customElements.get("fold-two-pane")) customElements.define("fold-two-pane", FoldTwoPane);
  if (!customElements.get("fold-when")) customElements.define("fold-when", FoldWhen);
}
