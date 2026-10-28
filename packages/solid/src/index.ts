import { createEffect, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import { bindTwoPane, getFold, subscribe } from "foldjs";
import type { FoldState, TwoPaneOptions } from "foldjs";

export type { FoldState, Posture, Rect, Spanning } from "foldjs";
export { simulate } from "foldjs";
export { mountDevtools } from "foldjs/devtools";

/** Live foldable state as a signal: `fold().posture`. */
export function createFold(): Accessor<FoldState> {
  const [state, setState] = createSignal(getFold(), { equals: false });
  onCleanup(subscribe(setState));
  return state;
}

/**
 * Directive: `<div use:twoPane={{ fallback: "stack" }}>` with children marked
 * `data-pane="primary"` / `"secondary"`. Declare it in your JSX namespace:
 *
 *   declare module "solid-js" { namespace JSX { interface Directives { twoPane: TwoPaneOptions } } }
 */
export function twoPane(el: HTMLElement, options: Accessor<TwoPaneOptions | true | undefined>) {
  const read = () => {
    const value = options();
    return typeof value === "object" ? value : {};
  };
  const binding = bindTwoPane(el, read());
  createEffect(() => binding.update(read()));
  onCleanup(binding.destroy);
}
