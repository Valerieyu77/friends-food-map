import { describe, expect, it } from "vitest";
import { barShift } from "./viewportShift.js";

describe("barShift", () => {
  it("moves the bars down by as much as the page was left shifted", () => {
    expect(barShift({ offsetTop: 287.4, scale: 1 }, false)).toBe(287);
  });

  it("leaves the bars alone when the page is where it should be", () => {
    expect(barShift({ offsetTop: 0, scale: 1 }, false)).toBe(0);
    expect(barShift({ offsetTop: 0.3, scale: 1 }, false)).toBe(0);
  });

  it("leaves the bars alone while someone types or has zoomed in", () => {
    expect(barShift({ offsetTop: 287, scale: 1 }, true)).toBe(0);
    expect(barShift({ offsetTop: 120, scale: 2 }, false)).toBe(0);
  });
});
