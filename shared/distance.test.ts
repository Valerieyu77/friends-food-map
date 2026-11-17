import { describe, expect, it } from "vitest";
import { formatMiles, milesBetween } from "./distance.js";

const champaign = { lat: 40.1164, lon: -88.2434 };
const chicago = { lat: 41.8781, lon: -87.6298 };

describe("milesBetween", () => {
  it("measures Champaign to Chicago as about 126 miles", () => {
    expect(milesBetween(champaign, chicago)).toBeCloseTo(126, -1);
  });

  it("is zero for the same point", () => {
    expect(milesBetween(chicago, chicago)).toBe(0);
  });
});

describe("formatMiles", () => {
  it("shows tenths close by and whole miles far away", () => {
    expect(formatMiles(0.04)).toBe("< 0.1 mi");
    expect(formatMiles(0.34)).toBe("0.3 mi");
    expect(formatMiles(126.4)).toBe("126 mi");
    expect(formatMiles(1987)).toBe("1,987 mi");
  });
});
