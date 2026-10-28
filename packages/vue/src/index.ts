import { computed, defineComponent, getCurrentScope, h, onMounted, onScopeDispose, onUnmounted, shallowReadonly, shallowRef } from "vue";
import type { PropType, ShallowRef } from "vue";
import { getFold, subscribe, twoPaneLayout } from "foldjs";
import type { FoldState, Posture } from "foldjs";
import type { DevtoolsOptions } from "foldjs/devtools";

export type { FoldState, Posture, Rect, Spanning } from "foldjs";
export { simulate } from "foldjs";

/** Live foldable state as a readonly ref. */
export function useFold(): Readonly<ShallowRef<FoldState>> {
  const state = shallowRef(getFold());
  const stop = subscribe((next) => (state.value = next));
  if (getCurrentScope()) onScopeDispose(stop);
  return shallowReadonly(state);
}

/**
 * <TwoPane fallback="stack">
 *   <template #primary>…</template>
 *   <template #secondary>…</template>
 * </TwoPane>
 */
export const TwoPane = defineComponent({
  name: "TwoPane",
  props: {
    fallback: { type: String as PropType<"stack" | "primary" | "secondary">, default: "stack" },
  },
  setup(props, { slots }) {
    const fold = useFold();
    const layout = computed(() => twoPaneLayout(fold.value, { fallback: props.fallback }));
    return () => {
      const l = layout.value;
      return h("div", { "data-fold-mode": l.mode, style: l.container }, [
        h("div", { "data-pane": "primary", style: l.primary }, slots.primary?.()),
        l.hinge && slots.hinge ? h("div", { "data-pane": "hinge", style: l.hinge }, slots.hinge()) : null,
        h("div", { "data-pane": "secondary", style: l.secondary }, slots.secondary?.()),
      ]);
    };
  },
});

/** Renders its default slot only for the given posture(s); `#fallback` otherwise. */
export const FoldWhen = defineComponent({
  name: "FoldWhen",
  props: {
    posture: { type: [String, Array] as PropType<Posture | Posture[]>, required: true },
  },
  setup(props, { slots }) {
    const fold = useFold();
    return () => {
      const wanted = Array.isArray(props.posture) ? props.posture : [props.posture];
      return wanted.includes(fold.value.posture) ? slots.default?.() : slots.fallback?.();
    };
  },
});

/** Mounts the foldable simulator. Use it in development only. */
export const FoldDevtools = defineComponent({
  name: "FoldDevtools",
  props: {
    position: String as PropType<DevtoolsOptions["position"]>,
    initial: String as PropType<Posture>,
    hingeSize: Number,
    highlight: { type: Boolean, default: undefined },
  },
  setup(props) {
    let unmount: (() => void) | undefined;
    let alive = true;
    onMounted(async () => {
      const { mountDevtools } = await import("foldjs/devtools");
      if (alive) unmount = mountDevtools({ ...props });
    });
    onUnmounted(() => {
      alive = false;
      unmount?.();
    });
    return () => null;
  },
});
