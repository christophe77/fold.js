import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import { getFold, serverFold, subscribe, twoPaneLayout } from "foldjs";
import type { FoldState, Posture, TwoPaneOptions } from "foldjs";
import type { DevtoolsOptions } from "foldjs/devtools";

export type { FoldState, Posture, Rect, Spanning } from "foldjs";
export { simulate } from "foldjs";

/** Live foldable state: posture, segments, hinge… Re-renders on change. SSR-safe. */
export function useFold(): FoldState {
  return useSyncExternalStore(subscribe, getFold, () => serverFold);
}

export interface TwoPaneProps extends TwoPaneOptions {
  primary: ReactNode;
  secondary: ReactNode;
  /** Optional content drawn over the hinge (e.g. a divider). */
  hinge?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Two panes placed on each side of the hinge; stacked (or one hidden) on a single screen. */
export function TwoPane({ primary, secondary, hinge, fallback, className, style }: TwoPaneProps) {
  const state = useFold();
  const layout = useMemo(() => twoPaneLayout(state, { fallback }), [state, fallback]);
  return (
    <div className={className} data-fold-mode={layout.mode} style={{ ...layout.container, ...style }}>
      <div data-pane="primary" style={layout.primary}>{primary}</div>
      {layout.hinge && hinge != null && <div data-pane="hinge" style={layout.hinge}>{hinge}</div>}
      <div data-pane="secondary" style={layout.secondary}>{secondary}</div>
    </div>
  );
}

export interface FoldWhenProps {
  /** One posture or a list; children render only when the current posture matches. */
  posture: Posture | Posture[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function FoldWhen({ posture, children, fallback = null }: FoldWhenProps) {
  const current = useFold().posture;
  const wanted = Array.isArray(posture) ? posture : [posture];
  return <>{wanted.includes(current) ? children : fallback}</>;
}

/** Mounts the foldable simulator. Render it in development only. */
export function FoldDevtools(props: DevtoolsOptions) {
  const { position, initial, hingeSize } = props;
  useEffect(() => {
    let unmount: (() => void) | undefined;
    let cancelled = false;
    import("foldjs/devtools").then(({ mountDevtools }) => {
      if (!cancelled) unmount = mountDevtools({ position, initial, hingeSize });
    });
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [position, initial, hingeSize]);
  return null;
}
