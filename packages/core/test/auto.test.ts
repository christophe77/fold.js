import { afterEach, describe, expect, it } from "vitest";
import { simulate } from "../src/index";
import { autoFix } from "../src/auto";

// jsdom has no layout: boxes follow the inline `translate` / `max-width` set by autoFix.
function layout(el: HTMLElement, x: number, y: number, width: number, height: number) {
  el.getBoundingClientRect = () => {
    const [dx = 0, dy = 0] = (el.style.translate || "0px 0px").split(" ").map(parseFloat);
    const w = el.style.maxWidth ? Math.min(width, parseFloat(el.style.maxWidth)) : width;
    const left = x + dx + (width - w) / 2;
    return { x: left, y: y + dy, width: w, height, left, top: y + dy, right: left + w, bottom: y + dy + height, toJSON() {} } as DOMRect;
  };
}

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  simulate(null);
  document.body.innerHTML = "";
});

describe("autoFix", () => {
  it("moves a centered modal to the right screen in book posture and restores it when flat", () => {
    Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    document.body.innerHTML = `<div role="dialog">Hi</div>`;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]')!;
    layout(modal, 300, 300, 400, 200);

    simulate({ posture: "book", hingeSize: 20 });
    stop = autoFix();
    // Right segment: x 510..1000, center 755. Modal center was 500.
    expect(modal.style.translate).toBe("255px 0px");

    simulate({ posture: "flat" });
    stop(); // undoes every change synchronously
    expect(modal.style.translate).toBe("");
  });

  it("splits a fixed tab bar around the hinge", () => {
    document.body.innerHTML = `<nav style="position: fixed; display: flex"><a>1</a><a>2</a><a>3</a></nav>`;
    const nav = document.querySelector<HTMLElement>("nav")!;
    layout(nav, 0, 740, 1000, 60);

    simulate({ posture: "book", hingeSize: 20 });
    stop = autoFix();
    expect(nav.style.display).toBe("grid");
    expect(nav.style.gridTemplateColumns).toBe("repeat(2, 245px) 20px repeat(1, minmax(0, 1fr))");
    expect(Array.from(nav.children).map((a) => (a as HTMLElement).style.gridColumn)).toEqual(["1", "2", "4"]);
  });

  it("leaves [data-fold-ignore] content alone", () => {
    document.body.innerHTML = `<div data-fold-ignore><div role="dialog">Hi</div></div>`;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]')!;
    layout(modal, 300, 300, 400, 200);
    simulate({ posture: "book", hingeSize: 20 });
    stop = autoFix();
    expect(modal.style.translate).toBe("");
  });
});
