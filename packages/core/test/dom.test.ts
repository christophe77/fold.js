import { afterEach, describe, expect, it } from "vitest";
import { bindTwoPane, simulate } from "../src/index";
import "../src/elements";

afterEach(() => simulate(null));

describe("bindTwoPane", () => {
  it("lays out marked children and keeps user styles", () => {
    document.body.innerHTML = `<div id="c" style="color: red"><div data-pane="primary"></div><div data-pane="secondary"></div></div>`;
    const c = document.getElementById("c")!;
    const binding = bindTwoPane(c, { fallback: "primary" });
    const secondary = c.querySelector<HTMLElement>('[data-pane="secondary"]')!;
    expect(c.dataset.foldMode).toBe("single");
    expect(secondary.style.display).toBe("none");

    simulate({ posture: "book", hingeSize: 20 });
    expect(c.dataset.foldMode).toBe("columns");
    expect(secondary.style.display).toBe("");
    expect(secondary.style.gridColumn).toBe("3");
    expect(c.style.color).toBe("red");
    binding.destroy();
  });
});

describe("web components", () => {
  it("<fold-two-pane> and <fold-when> follow the posture", () => {
    document.body.innerHTML = `
      <fold-two-pane><div slot="primary">A</div><div slot="secondary">B</div></fold-two-pane>
      <fold-when posture="tabletop">T</fold-when>`;
    const pane = document.querySelector<HTMLElement>("fold-two-pane")!;
    const when = document.querySelector<HTMLElement>("fold-when")!;
    expect(pane.dataset.mode).toBe("single");
    expect(when.hidden).toBe(true);

    simulate({ posture: "tabletop" });
    expect(pane.dataset.mode).toBe("rows");
    expect(when.hidden).toBe(false);
  });
});
