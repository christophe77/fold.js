import { afterEach, describe, expect, it } from "vitest";
import { findHingeCollisions, foldScore, simulate } from "../src/index";

// jsdom has no layout: give elements fake boxes.
function box(el: Element, x: number, y: number, width: number, height: number) {
  el.getBoundingClientRect = () => ({ x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON() {} }) as DOMRect;
}

const hinge = { x: 490, y: 0, width: 20, height: 800 };

afterEach(() => {
  simulate(null);
  document.body.innerHTML = "";
});

describe("findHingeCollisions", () => {
  it("returns nothing without a hinge", () => {
    document.body.innerHTML = `<button>Buy</button>`;
    box(document.querySelector("button")!, 400, 10, 200, 40);
    expect(findHingeCollisions()).toEqual([]);
  });

  it("flags split buttons as critical and text as warning, most severe first", () => {
    document.body.innerHTML = `<p id="intro">Long text <button class="cta">Buy</button></p><p id="left">Short</p>`;
    box(document.getElementById("intro")!, 0, 0, 1000, 60);
    box(document.querySelector(".cta")!, 450, 20, 100, 30);
    box(document.getElementById("left")!, 0, 100, 200, 20);

    const found = findHingeCollisions({ hinge });
    expect(found.map((c) => [c.kind, c.severity])).toEqual([
      ["interactive", "critical"],
      ["text", "warning"],
    ]);
    expect(found[0].selector).toBe("#intro > button.cta");
    expect(foldScore(found)).toBe(91);
  });

  it("reports a modal once and skips its content", () => {
    document.body.innerHTML = `<div role="dialog"><button>OK</button></div>`;
    box(document.querySelector('[role="dialog"]')!, 300, 200, 400, 300);
    box(document.querySelector("button")!, 450, 400, 100, 40);
    expect(findHingeCollisions({ hinge }).map((c) => c.kind)).toEqual(["modal"]);
  });

  it("ignores [data-fold-ignore] subtrees and uses the simulated hinge by default", () => {
    document.body.innerHTML = `<div data-fold-ignore><button>A</button></div><button id="b">B</button>`;
    for (const b of document.querySelectorAll("button")) box(b, 0, 0, 2000, 40);
    simulate({ posture: "book" });
    expect(findHingeCollisions().map((c) => c.selector)).toEqual(["#b"]);
  });

  it("flags content crossing a zero-width fold line, and near it with minZone", () => {
    document.body.innerHTML = `<button>Tap</button>`;
    box(document.querySelector("button")!, 480, 0, 15, 40); // ends 5px before the fold line
    const line = { x: 500, y: 0, width: 0, height: 800 };
    expect(findHingeCollisions({ hinge: line })).toHaveLength(0);
    expect(findHingeCollisions({ hinge: line, minZone: 12 })).toHaveLength(1);
    box(document.querySelector("button")!, 495, 0, 10, 40); // straddles the line
    expect(findHingeCollisions({ hinge: line })).toHaveLength(1);
  });

  it("ignores the part of an element clipped by a scrolling ancestor", () => {
    document.body.innerHTML = `<div id="pane" style="overflow: auto"><button>Below the fold</button></div>`;
    box(document.getElementById("pane")!, 0, 0, 1000, 400);
    box(document.querySelector("button")!, 0, 380, 1000, 60);
    const fold = { x: 0, y: 400, width: 1000, height: 0 };
    expect(findHingeCollisions({ hinge: fold })).toHaveLength(0);
    document.getElementById("pane")!.style.overflow = "visible";
    expect(findHingeCollisions({ hinge: fold })).toHaveLength(1);
  });
});
