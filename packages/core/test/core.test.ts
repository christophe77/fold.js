import { afterEach, describe, expect, it } from "vitest";
import { deriveState, getFold, simulate, simulatedSegments, subscribe, twoPaneLayout } from "../src/index";

const viewport = { width: 1000, height: 800 };

describe("deriveState", () => {
  it("is flat with no segments", () => {
    const s = deriveState({ segments: null, devicePosture: "continuous", viewport });
    expect(s.posture).toBe("flat");
    expect(s.isSpanned).toBe(false);
    expect(s.hinge).toBeNull();
  });

  it("reports folded when the device folds without splitting the viewport", () => {
    expect(deriveState({ segments: null, devicePosture: "folded", viewport }).posture).toBe("folded");
  });

  it("detects book posture and the vertical hinge", () => {
    const s = deriveState({
      segments: [
        { x: 510, y: 0, width: 490, height: 800 },
        { x: 0, y: 0, width: 490, height: 800 },
      ],
      devicePosture: "folded",
      viewport,
    });
    expect(s.posture).toBe("book");
    expect(s.segments[0].x).toBe(0);
    expect(s.hinge).toEqual({ x: 490, y: 0, width: 20, height: 800 });
  });

  it("detects tabletop posture and the horizontal hinge", () => {
    const s = deriveState({
      segments: [
        { x: 0, y: 0, width: 1000, height: 390 },
        { x: 0, y: 410, width: 1000, height: 390 },
      ],
      devicePosture: "folded",
      viewport,
    });
    expect(s.posture).toBe("tabletop");
    expect(s.hinge).toEqual({ x: 0, y: 390, width: 1000, height: 20 });
  });
});

describe("simulatedSegments", () => {
  it("splits the viewport around the hinge", () => {
    const [a, b] = simulatedSegments(viewport, { posture: "book", hingeSize: 20 })!;
    expect(a.width + 20 + b.width).toBe(1000);
    expect(simulatedSegments(viewport, { posture: "flat" })).toBeNull();
  });
});

describe("twoPaneLayout", () => {
  const book = deriveState({ segments: simulatedSegments(viewport, { posture: "book", hingeSize: 20 }), devicePosture: "folded", viewport });

  it("puts the panes on each side of the hinge", () => {
    const l = twoPaneLayout(book);
    expect(l.mode).toBe("columns");
    expect(l.container.gridTemplateColumns).toBe("490px 20px minmax(0, 1fr)");
    expect(l.primary.gridColumn).toBe("1");
    expect(l.secondary.gridColumn).toBe("3");
  });

  it("applies the single-screen fallback", () => {
    const flat = deriveState({ segments: null, devicePosture: "continuous", viewport });
    expect(twoPaneLayout(flat, { fallback: "primary" }).secondary.display).toBe("none");
    expect(twoPaneLayout(flat).secondary.display).toBeUndefined();
  });
});

describe("store", () => {
  afterEach(() => simulate(null));

  it("notifies subscribers and syncs <html> when simulating", () => {
    const seen: string[] = [];
    const off = subscribe((s) => seen.push(s.posture));
    simulate({ posture: "tabletop" });
    expect(getFold().posture).toBe("tabletop");
    expect(getFold().simulated).toBe(true);
    expect(document.documentElement.dataset.foldPosture).toBe("tabletop");
    expect(document.documentElement.style.getPropertyValue("--fold-hinge-height")).toBe("24px");
    simulate(null);
    expect(seen).toEqual(["tabletop", "flat"]);
    off();
  });

  it("keeps the same snapshot when nothing changed", () => {
    const a = getFold();
    simulate(null);
    expect(getFold()).toBe(a);
  });
});
