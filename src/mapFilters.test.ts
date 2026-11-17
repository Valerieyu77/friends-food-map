import { describe, expect, it } from "vitest";
import type { CuisineId } from "../shared/cuisines.js";
import type { Entry } from "../shared/types.js";
import { NO_FILTERS, filterPlaces, hasFilters, hiddenFilterCount } from "./mapFilters.js";
import { summarizePlaces } from "./places.js";

function rating(id: string, memberId: string, placeId: string, score: number, createdAt: string, cuisine?: CuisineId): Entry {
  return {
    id,
    createdAt,
    rating: score,
    place: { id: placeId, name: `Place ${placeId}`, cuisine },
    member: { id: memberId, name: memberId },
    dishes: [],
    photoUrls: [],
    reactions: [],
  };
}

// Entries arrive newest first, as the server sends them.
const places = summarizePlaces([
  rating("e6", "ana", "tacos", 9, "2026-11-06T00:00:00Z", "mexican"),
  rating("e5", "me", "noodles", 8, "2026-11-05T00:00:00Z", "chinese"),
  rating("e4", "ben", "noodles", 6, "2026-11-04T00:00:00Z", "chinese"),
  rating("e3", "ana", "noodles", 9, "2026-11-03T00:00:00Z", "chinese"),
  rating("e2", "ben", "pizza", 9, "2026-11-02T00:00:00Z", "italian"),
  rating("e1", "ana", "tacos", 5, "2026-11-01T00:00:00Z", "mexican"),
]);
const ids = (shown: { place: { id: string } }[]) => shown.map((summary) => summary.place.id).sort();

describe("filterPlaces", () => {
  it("keeps every place with no filters", () => {
    expect(ids(filterPlaces(places, NO_FILTERS, "me"))).toEqual(["noodles", "pizza", "tacos"]);
  });

  it("keeps places whose group average reaches the score", () => {
    // noodles averages 7.67, tacos 7, pizza 9.
    expect(ids(filterPlaces(places, { ...NO_FILTERS, minScore: 7 }, "me"))).toEqual(["noodles", "pizza", "tacos"]);
    expect(ids(filterPlaces(places, { ...NO_FILTERS, minScore: 8 }, "me"))).toEqual(["pizza"]);
  });

  it("with a friend, keeps only their places and scores each by their newest rating", () => {
    const shown = filterPlaces(places, { ...NO_FILTERS, friendId: "ana" }, "me");
    expect(shown.map((summary) => [summary.place.id, summary.averageRating, summary.entries.map((entry) => entry.id)])).toEqual([
      ["tacos", 9, ["e6"]],
      ["noodles", 9, ["e3"]],
    ]);
  });

  it("applies the score to the friend's own score when a friend is chosen", () => {
    // Ben gave noodles 6 and pizza 9; the group average for noodles is higher than his 6.
    expect(ids(filterPlaces(places, { ...NO_FILTERS, friendId: "ben", minScore: 8 }, "me"))).toEqual(["pizza"]);
  });

  it("hides places you rated when only new places are wanted", () => {
    expect(ids(filterPlaces(places, { ...NO_FILTERS, notBeenOnly: true }, "me"))).toEqual(["pizza", "tacos"]);
  });

  it("hides places you rated even when filtering by a friend", () => {
    expect(ids(filterPlaces(places, { ...NO_FILTERS, friendId: "ana", notBeenOnly: true }, "me"))).toEqual(["tacos"]);
  });

  it("combines with the cuisine filter", () => {
    expect(ids(filterPlaces(places, { ...NO_FILTERS, cuisine: "chinese", minScore: 7 }, "me"))).toEqual(["noodles"]);
    expect(filterPlaces(places, { ...NO_FILTERS, cuisine: "italian", friendId: "ana" }, "me")).toEqual([]);
  });
});

describe("hasFilters", () => {
  it("is false with nothing chosen and true with any one filter", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, notBeenOnly: true })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, friendId: "ana" })).toBe(true);
  });
});

describe("hiddenFilterCount", () => {
  it("counts score, friend and not-been, but not the cuisine, which has its own buttons", () => {
    expect(hiddenFilterCount(NO_FILTERS)).toBe(0);
    expect(hiddenFilterCount({ ...NO_FILTERS, cuisine: "thai" })).toBe(0);
    expect(hiddenFilterCount({ cuisine: "thai", minScore: 8, friendId: "ana", notBeenOnly: true })).toBe(3);
  });
});
