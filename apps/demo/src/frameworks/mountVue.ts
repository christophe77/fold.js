import { createApp, defineComponent, h } from "vue";
import { useFold } from "@foldjs/vue";

const VueCard = defineComponent({
  setup() {
    const fold = useFold();
    return () => {
      const { posture, hinge } = fold.value;
      return h("div", { class: "fw-card" }, [
        h("div", { class: "fw-name" }, [h("span", { class: "fw-dot vue" }), "Vue"]),
        h("div", { class: "fw-posture" }, posture),
        h("div", { class: "fw-meta" }, `hinge ${hinge ? `${hinge.width}×${hinge.height}` : "none"}`),
        h("code", "fold.value.posture"),
      ]);
    };
  },
});

export function mountVue(el: HTMLElement) {
  const app = createApp(VueCard);
  app.mount(el);
  return () => app.unmount();
}
