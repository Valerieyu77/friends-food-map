import { describe, expect, it } from "vitest";
import type { Entry } from "../shared/types.js";
import { latestRatings, previousRating, scoreChange, tasteMatch, topRated } from "./friends.js";

function rating(id: string, memberId: string, placeId: string, score: number, createdAt: string): Entry {
  return {
    id,
    createdAt,
    rating: score,
    place: { id: placeId, name: `Place ${placeId}` },
    member: { id: memberId, name: memberId },
    dishes: [],
    photoUrls: [],
    reactions: [],
  };
}

// Entries arrive newest first, as the server sends them.
const entries = [
  rating("e5", "ana", "tacos", 9, "2026-11-05T00:00:00Z"),
  rating("e4", "ben", "noodles", 6, "2026-11-04T00:00:00Z"),
  rating("e3", "ana", "noodles", 7, "2026-11-03T00:00:00Z"),
  rating("e2", "ben", "tacos", 8, "2026-11-02T00:00:00Z"),
  rating("e1", "ana", "tacos", 4, "2026-11-01T00:00:00Z"),
];

describe("latestRatings", () => {
  it("lists each place a friend rated once, with their newest score, newest first", () => {
    expect(latestRatings(entries, "ana").map((entry) => [entry.place.id, entry.rating])).toEqual([
      ["tacos", 9],
      ["noodles", 7],
    ]);
  });

  it("is empty for someone who has not rated anything", () => {
    expect(latestRatings(entries, "cleo")).toEqual([]);
  });
});

describe("previousRating", () => {
  it("is the same friend's score from their visit before this one", () => {
    expect(previousRating(entries, entries[0])).toBe(4);
  });

  it("is missing for a first visit, and ignores other friends' scores", () => {
    expect(previousRating(entries, entries[4])).toBeUndefined();
    expect(previousRating(entries, entries[3])).toBeUndefined();
  });
});

describe("scoreChange", () => {
  it("says how a repeat visit's score moved, or that it stayed the same", () => {
    expect(scoreChange(entries, entries[0])).toBe("Was 4 → now 9");
    expect(scoreChange([entries[0], { ...entries[4], rating: 9 }], entries[0])).toBe("Same 9 as last visit");
    expect(scoreChange(entries, entries[4])).toBeUndefined();
  });
});

describe("topRated", () => {
  it("takes the best scores first, ties to the newer rating", () => {
    const list = [
      rating("a", "ana", "p1", 8, "2026-11-01T00:00:00Z"),
      rating("b", "ana", "p2", 9, "2026-11-02T00:00:00Z"),
      rating("c", "ana", "p3", 8, "2026-11-03T00:00:00Z"),
    ];
    expect(topRated(list, 2).map((entry) => entry.place.id)).toEqual(["p2", "p3"]);
  });
});

describe("tasteMatch", () => {
  it("compares the places both rated, using each person's newest score", () => {
    // Tacos: 9 vs 8, noodles: 7 vs 6, so they are 1 point apart on average.
    expect(tasteMatch(entries, "ana", "ben")).toEqual({ shared: 2, percent: 90 });
  });

  it("has no percent until two places are shared", () => {
    expect(tasteMatch(entries.slice(0, 2), "ana", "ben")).toEqual({ shared: 0, percent: undefined });
    expect(tasteMatch([entries[0], entries[3]], "ana", "ben")).toEqual({ shared: 1, percent: undefined });
  });
});
