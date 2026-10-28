import { readable } from "svelte/store";
import type { Readable } from "svelte/store";
import { bindTwoPane, getFold, subscribe } from "foldjs";
import type { FoldState, Posture, TwoPaneOptions } from "foldjs";

export type { FoldState, Posture, Rect, Spanning } from "foldjs";
export { simulate } from "foldjs";
export { mountDevtools } from "foldjs/devtools";

/** Live foldable state: `$fold.posture`, `$fold.hinge`… */
export const fold: Readable<FoldState> = readable(getFold(), (set) => {
  set(getFold());
  return subscribe(set);
});

/**
 * <div use:twoPane={{ fallback: "stack" }}>
 *   <div data-pane="primary">…</div>
 *   <div data-pane="secondary">…</div>
 * </div>
 */
export function twoPane(node: HTMLElement, options: TwoPaneOptions = {}) {
  return bindTwoPane(node, options);
}

/** <div use:foldWhen={"tabletop"}>…</div> — hidden unless the posture matches. */
export function foldWhen(node: HTMLElement, posture: Posture | Posture[]) {
  let wanted = posture;
  const paint = () => {
    const list = Array.isArray(wanted) ? wanted : [wanted];
    node.hidden = !list.includes(getFold().posture);
  };
  const unsubscribe = subscribe(paint);
  paint();
  return {
    update(next: Posture | Posture[]) {
      wanted = next;
      paint();
    },
    destroy: unsubscribe,
  };
}
