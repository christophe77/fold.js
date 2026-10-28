export type { DevicePosture, FoldState, Posture, Rect, SimulateOptions, Spanning } from "./types";
export { deriveState, simulatedSegments } from "./state";
export { getFold, getSimulation, init, refresh, serverFold, simulate, subscribe } from "./store";
export { bindTwoPane, twoPaneLayout } from "./layout";
export type { Style, TwoPaneLayout, TwoPaneOptions } from "./layout";
