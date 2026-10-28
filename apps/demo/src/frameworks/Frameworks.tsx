import { useEffect, useRef } from "react";
import { mount, unmount } from "svelte";
import { useFold } from "@foldjs/react";
import { getFold, subscribe } from "foldjs";
import "foldjs/elements";
import { mountVue } from "./mountVue";
import SvelteCard from "./SvelteCard.svelte";

function ReactCard() {
  const { posture, hinge } = useFold();
  return (
    <div className="fw-card">
      <div className="fw-name"><span className="fw-dot react" />React</div>
      <div className="fw-posture">{posture}</div>
      <div className="fw-meta">hinge {hinge ? `${hinge.width}×${hinge.height}` : "none"}</div>
      <code>useFold().posture</code>
    </div>
  );
}

function VueCard() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => mountVue(ref.current!), []);
  return <div ref={ref} className="fw-host" />;
}

function SvelteHost() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const app = mount(SvelteCard, { target: ref.current! });
    return () => {
      unmount(app);
    };
  }, []);
  return <div ref={ref} className="fw-host" />;
}

// Plain DOM: no framework at all, only the core store and a Web Component.
function VanillaCard() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.innerHTML = `
      <div class="fw-card">
        <div class="fw-name"><span class="fw-dot vanilla"></span>Vanilla + Web Components</div>
        <div class="fw-posture"></div>
        <div class="fw-meta"><fold-when posture="book tabletop">split screen ✓</fold-when><fold-when posture="flat folded">single screen</fold-when></div>
        <code>&lt;fold-when posture="book"&gt;</code>
      </div>`;
    const posture = el.querySelector(".fw-posture")!;
    const paint = () => (posture.textContent = getFold().posture);
    paint();
    return subscribe(paint);
  }, []);
  return <div ref={ref} className="fw-host" />;
}

export function FrameworkCards() {
  return (
    <div className="fw-grid">
      <ReactCard />
      <VueCard />
      <SvelteHost />
      <VanillaCard />
    </div>
  );
}

export const FRAMEWORK_SNIPPET = `// React
const { posture } = useFold();

// Vue
const fold = useFold(); // fold.value.posture

// Svelte
import { fold } from "@foldjs/svelte"; // $fold.posture

// Anything else
<fold-two-pane>…</fold-two-pane>`;
