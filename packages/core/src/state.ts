import type { DevicePosture, FoldConfig, FoldState, Posture, Rect, SimulateOptions, Spanning } from "./types";

export interface StateInput {
  segments: Rect[] | null;
  devicePosture: DevicePosture;
  viewport: { width: number; height: number };
  simulated?: boolean;
  virtual?: boolean;
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
    virtual: input.virtual ?? false,
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

/**
 * Whether to split this screen with a virtual fold. Only used when the browser
 * reports no segments of its own.
 */
export function wantsVirtualFold(
  mode: FoldConfig["virtualFold"],
  env: { viewport: { width: number; height: number }; screen: { width: number; height: number }; userAgent: string; touchPoints?: number },
): boolean {
  const { width, height } = env.viewport;
  const landscape = width > height && height >= 600;
  if (mode === false || !landscape) return false;
  if (mode === true) return true;
  // An Apple touch screen whose short side is 600 to 720px can only be an unfolded iPhone Fold:
  // regular iPhones are under 450px and iPads at least 744px. Safari may present itself as a Mac
  // on large screens (as on iPad), so a touch-enabled "Macintosh" counts too.
  const apple = /\biPhone\b/.test(env.userAgent) || (/\bMacintosh\b/.test(env.userAgent) && (env.touchPoints ?? 0) > 1);
  const short = Math.min(env.screen.width, env.screen.height);
  return apple && short >= 600 && short <= 720;
}

function toRect(r: Rect): Rect {
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}
