export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How the screen should be used.
 * - `flat`: a single continuous screen (regular phone, or foldable fully open and not spanned).
 * - `book`: two segments side by side, hinge is vertical.
 * - `tabletop`: two segments stacked, hinge is horizontal (laptop-like).
 * - `folded`: the device reports being folded but the viewport is not split.
 */
export type Posture = "flat" | "book" | "tabletop" | "folded";

/** How the viewport is split: not at all, into columns, or into rows. */
export type Spanning = "none" | "columns" | "rows";

/** Raw value of the Device Posture API. */
export type DevicePosture = "continuous" | "folded";

export interface FoldState {
  /** Viewport segments, in CSS pixels, ordered left-to-right / top-to-bottom. */
  segments: Rect[];
  spanning: Spanning;
  isSpanned: boolean;
  /** The area covered by the hinge, or `null` when the viewport is not split. */
  hinge: Rect | null;
  posture: Posture;
  devicePosture: DevicePosture;
  viewport: { width: number; height: number };
  /** `true` when the state comes from `simulate()` rather than the device. */
  simulated: boolean;
}

export interface SimulateOptions {
  posture: Posture;
  /** Width (book) or height (tabletop) of the simulated hinge, in px. Defaults to 24. */
  hingeSize?: number;
}
