import { describe, expect, it } from "vitest";
import { groupNearby } from "./clusters.js";

describe("groupNearby", () => {
  it("merges places that would overlap and keeps faraway ones apart", () => {
    const groups = groupNearby(
      [
        { x: 100, y: 100, item: "Chicago A" },
        { x: 600, y: 300, item: "Los Angeles" },
        { x: 110, y: 95, item: "Chicago B" },
        { x: 104, y: 120, item: "Chicago C" },
      ],
      40,
    );
    expect(groups).toEqual([["Chicago A", "Chicago B", "Chicago C"], ["Los Angeles"]]);
  });

  it("returns no groups for no points", () => {
    expect(groupNearby([], 40)).toEqual([]);
  });
});
