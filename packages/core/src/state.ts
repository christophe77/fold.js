import type { DevicePosture, FoldState, Posture, Rect, SimulateOptions, Spanning } from "./types";

export interface StateInput {
  segments: Rect[] | null;
  devicePosture: DevicePosture;
  viewport: { width: number; height: number };
  simulated?: boolean;
}

/** Pure function: turns raw device readings into a FoldState. */
export function deriveState(input: StateInput): FoldState {
  const { viewport, devicePosture } = input;
  const segments = (input.segments ?? [])
    .map(toRect)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  let spanning: Spanning = "none";
  let hinge: Rect | null = null;

  if (segments.length >= 2) {
    const [a, b] = segments;
    if (b.x >= a.x + a.width - 1) {
      spanning = "columns";
      const x = a.x + a.width;
      hinge = { x, y: 0, width: Math.max(0, b.x - x), height: viewport.height };
    } else {
      spanning = "rows";
      const y = a.y + a.height;
      hinge = { x: 0, y, width: viewport.width, height: Math.max(0, b.y - y) };
    }
  }

  const posture: Posture =
    spanning === "columns" ? "book"
    : spanning === "rows" ? "tabletop"
    : devicePosture === "folded" ? "folded"
    : "flat";

  return {
    segments: spanning === "none" ? [] : segments,
    spanning,
    isSpanned: spanning !== "none",
    hinge,
    posture,
    devicePosture,
    viewport: { width: viewport.width, height: viewport.height },
    simulated: input.simulated ?? false,
  };
}

/** Builds the segments a real device would report for the requested posture. */
export function simulatedSegments(
  viewport: { width: number; height: number },
  { posture, hingeSize = 24 }: SimulateOptions,
): Rect[] | null {
  const { width: w, height: h } = viewport;
  if (posture === "book") {
    const half = Math.round((w - hingeSize) / 2);
    return [
      { x: 0, y: 0, width: half, height: h },
      { x: half + hingeSize, y: 0, width: w - half - hingeSize, height: h },
    ];
  }
  if (posture === "tabletop") {
    const half = Math.round((h - hingeSize) / 2);
    return [
      { x: 0, y: 0, width: w, height: half },
      { x: 0, y: half + hingeSize, width: w, height: h - half - hingeSize },
    ];
  }
  return null;
}

/** Reads the current device state from browser APIs. Safe to call during SSR. */
export function readDevice(): StateInput {
  if (typeof window === "undefined") {
    return { segments: null, devicePosture: "continuous", viewport: { width: 0, height: 0 } };
  }
  const w = window as any;
  // Current spec: window.viewport.segments. Legacy Edge/Duo: window.getWindowSegments().
  const raw: ArrayLike<Rect> | null | undefined =
    w.viewport?.segments ?? (typeof w.getWindowSegments === "function" ? w.getWindowSegments() : null);

  return {
    segments: raw ? Array.from(raw) : null,
    devicePosture: (navigator as any).devicePosture?.type === "folded" ? "folded" : "continuous",
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
}

function toRect(r: Rect): Rect {
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}
