import { deriveState, readDevice, simulatedSegments, wantsVirtualFold } from "./state";
import type { FoldConfig, FoldState, SimulateOptions } from "./types";

type Listener = (state: FoldState) => void;

interface Store {
  listeners: Set<Listener>;
  simulation: SimulateOptions | null;
  config: Required<FoldConfig>;
  snapshot: FoldState;
  detach: (() => void) | null;
}

// One store per page, even if several bundles (or copies of foldjs) are loaded:
// the devtools bundle must drive the same state as the app's adapters.
const store: Store = ((globalThis as any).__foldjs ??= {
  listeners: new Set<Listener>(),
  simulation: null,
  config: { virtualFold: "auto" },
  snapshot: deriveState(readDevice()),
  detach: null,
});
// A store created by an older copy of foldjs on the same page has no config yet.
store.config ??= { virtualFold: "auto" };

function compute(): FoldState {
  const device = readDevice();
  const sim = store.simulation;
  if (!sim) {
    // Browsers with the Viewport Segments API report one segment when the screen is not split.
    const split = (device.segments?.length ?? 0) > 1;
    if (!split && typeof window !== "undefined" && wantsVirtualFold(store.config.virtualFold, {
      viewport: device.viewport,
      screen: window.screen ?? device.viewport,
      userAgent: navigator.userAgent,
      touchPoints: navigator.maxTouchPoints,
    })) {
      return deriveState({ ...device, segments: simulatedSegments(device.viewport, { posture: "book", hingeSize: 0 }), virtual: true });
    }
    return deriveState(device);
  }
  return deriveState({
    ...device,
    segments: simulatedSegments(device.viewport, sim),
    devicePosture: sim.posture === "flat" ? "continuous" : "folded",
    simulated: true,
  });
}

/** Recomputes the state and notifies subscribers if it changed. */
export function refresh(): void {
  const next = compute();
  if (JSON.stringify(next) === JSON.stringify(store.snapshot)) return;
  store.snapshot = next;
  syncDocument(next);
  store.listeners.forEach((l) => l(next));
}

/** Current state. The same object is returned until something changes. */
export function getFold(): FoldState {
  return store.snapshot;
}

/** State used during server rendering: a flat, unsplit screen. */
export const serverFold: FoldState = deriveState({
  segments: null,
  devicePosture: "continuous",
  viewport: { width: 0, height: 0 },
});

/** Calls `listener` on every change. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  store.listeners.add(listener);
  if (!store.detach) attach();
  return () => {
    store.listeners.delete(listener);
    if (store.listeners.size === 0 && store.detach) {
      store.detach();
      store.detach = null;
    }
  };
}

/**
 * Starts watching the device and keeps the `data-fold-*` attributes and
 * `--fold-*` CSS variables on <html> up to date. Use it when you only need the CSS layer.
 */
export function init(): () => void {
  return subscribe(() => {});
}

/** Changes global options, such as the virtual fold. */
export function configure(config: FoldConfig): void {
  store.config = { ...store.config, ...config };
  refresh();
}

/** Fakes a foldable posture (for development and demos). Pass `null` to go back to the real device. */
export function simulate(options: SimulateOptions | null): void {
  store.simulation = options;
  refresh();
}

export function getSimulation(): SimulateOptions | null {
  return store.simulation;
}

function attach() {
  if (typeof window === "undefined") return;
  const onChange = () => refresh();
  window.addEventListener("resize", onChange);
  const posture = (navigator as any).devicePosture;
  posture?.addEventListener?.("change", onChange);
  const queries = ["(horizontal-viewport-segments: 2)", "(vertical-viewport-segments: 2)"]
    .map((q) => window.matchMedia?.(q))
    .filter(Boolean) as MediaQueryList[];
  queries.forEach((mq) => mq.addEventListener?.("change", onChange));

  store.detach = () => {
    window.removeEventListener("resize", onChange);
    posture?.removeEventListener?.("change", onChange);
    queries.forEach((mq) => mq.removeEventListener?.("change", onChange));
  };
  store.snapshot = compute();
  syncDocument(store.snapshot);
}

function syncDocument(state: FoldState) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.foldPosture = state.posture;
  root.dataset.foldSpanning = state.spanning;
  const [a, b] = state.segments;
  const h = state.hinge;
  const vars: Record<string, number> = {
    "--fold-hinge-x": h?.x ?? 0,
    "--fold-hinge-y": h?.y ?? 0,
    "--fold-hinge-width": h?.width ?? 0,
    "--fold-hinge-height": h?.height ?? 0,
    "--fold-segment-0-width": a?.width ?? state.viewport.width,
    "--fold-segment-0-height": a?.height ?? state.viewport.height,
    "--fold-segment-1-width": b?.width ?? 0,
    "--fold-segment-1-height": b?.height ?? 0,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, `${v}px`);
}
