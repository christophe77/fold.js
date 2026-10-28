import { afterEach, describe, expect, it } from "vitest";
import { configure, getFold, refresh, wantsVirtualFold } from "../src/index";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const env = (width: number, height: number, userAgent: string, touchPoints = 5) => ({ viewport: { width, height }, screen: { width, height }, userAgent, touchPoints });

describe("wantsVirtualFold", () => {
  it("auto: splits an unfolded iPhone Fold in landscape only", () => {
    expect(wantsVirtualFold("auto", env(904, 640, IPHONE))).toBe(true);
    expect(wantsVirtualFold("auto", env(640, 904, IPHONE))).toBe(false); // portrait: one screen
    expect(wantsVirtualFold("auto", env(932, 430, IPHONE))).toBe(false); // regular iPhone in landscape
    expect(wantsVirtualFold("auto", env(1180, 820, IPAD))).toBe(false); // iPad
    expect(wantsVirtualFold("auto", env(904, 640, IPAD))).toBe(true); // unfolded iPhone Fold asking for desktop sites
    expect(wantsVirtualFold("auto", env(904, 640, IPAD, 0))).toBe(false); // a small Mac window
  });

  it("true: any large landscape viewport; false: never", () => {
    expect(wantsVirtualFold(true, env(1180, 820, IPAD))).toBe(true);
    expect(wantsVirtualFold(true, env(800, 500, IPAD))).toBe(false);
    expect(wantsVirtualFold(false, env(904, 640, IPHONE))).toBe(false);
  });
});

describe("virtual fold in the store", () => {
  afterEach(() => configure({ virtualFold: "auto" }));

  it("splits the viewport at its center with a zero-width fold", () => {
    Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 700, configurable: true });
    configure({ virtualFold: true });
    const s = getFold();
    expect(s.posture).toBe("book");
    expect(s.virtual).toBe(true);
    expect(s.hinge).toEqual({ x: 500, y: 0, width: 0, height: 700 });

    configure({ virtualFold: false });
    expect(getFold().posture).toBe("flat");
    expect(getFold().virtual).toBe(false);
    refresh();
  });
});
