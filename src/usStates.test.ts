import { describe, expect, it } from "vitest";
import { US_STATES, boundsOf } from "./usStates.js";

const stateNamed = (name: string) => US_STATES.features.find((state) => state.properties.name === name)!;

describe("US_STATES", () => {
  it("has every state, so any one can be tapped", () => {
    const names = US_STATES.features.map((state) => state.properties.name);
    expect(names).toEqual(expect.arrayContaining(["Illinois", "California", "New York", "Alaska", "Hawaii"]));
  });
});

describe("boundsOf", () => {
  it("boxes Illinois around Chicago and Champaign", () => {
    const [[west, south], [east, north]] = boundsOf(stateNamed("Illinois").geometry) as number[][];
    expect(west).toBeCloseTo(-91.5, 0);
    expect(east).toBeCloseTo(-87.5, 0);
    expect(south).toBeCloseTo(37, 0);
    expect(north).toBeCloseTo(42.5, 0);
  });

  it("keeps Alaska's box in one piece across the 180th meridian", () => {
    const [[west], [east]] = boundsOf(stateNamed("Alaska").geometry) as number[][];
    expect(east - west).toBeLessThan(60);
  });
});
