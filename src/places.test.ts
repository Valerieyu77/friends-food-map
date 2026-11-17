import { describe, expect, it } from "vitest";
import type { CuisineId } from "../shared/cuisines.js";
import type { Entry } from "../shared/types.js";
import {
  CAMPUS,
  formatRating,
  friendFavorites,
  entryFacts,
  friendScores,
  pinsFromPlaces,
  placeDetails,
  placeDishes,
  rankPlaces,
  searchCenter,
  summarizePlaces,
} from "./places.js";

const pinsFromEntries = (entries: Entry[]) => pinsFromPlaces(summarizePlaces(entries));

function entry(id: string, placeId: string, rating: number, coordinates = true, cuisine?: CuisineId): Entry {
  return {
    id,
    createdAt: "2026-10-27T12:00:00.000Z",
    rating,
    place: { id: placeId, name: `Place ${placeId}`, cuisine, ...(coordinates ? { lat: 41.88, lon: -87.63 } : {}) },
    member: { id: `member-${id}`, name: `Friend ${id}` },
    dishes: [],
    photoUrls: [],
    reactions: [],
  };
}

describe("pinsFromPlaces", () => {
  it("puts two friends' entries for the same place on one pin with their average", () => {
    const pins = pinsFromEntries([entry("a", "goat", 9), entry("b", "goat", 6), entry("c", "pequods", 8)]);
    expect(pins).toHaveLength(2);
    expect(pins[0]).toMatchObject({ place: { id: "goat" }, averageRating: 7.5 });
    expect(pins[0].entries.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("leaves places typed by hand off the map", () => {
    expect(pinsFromEntries([entry("a", "zorbas", 7, false)])).toEqual([]);
  });

  it("returns no pins when the group has no entries yet", () => {
    expect(pinsFromEntries([])).toEqual([]);
  });
});

describe("friendScores", () => {
  it("lists each friend who rated a place once, with their own score, in the order they rated", () => {
    const [summary] = summarizePlaces([entry("a", "goat", 9), entry("b", "goat", 6)]);
    expect(friendScores(summary)).toEqual([
      { member: { id: "member-a", name: "Friend a" }, rating: 9 },
      { member: { id: "member-b", name: "Friend b" }, rating: 6 },
    ]);
  });

  it("averages a friend who rated the same place twice into one score", () => {
    const again = { ...entry("a2", "goat", 8), member: { id: "member-a", name: "Friend a" } };
    const [summary] = summarizePlaces([entry("a", "goat", 9), entry("b", "goat", 6), again]);
    expect(friendScores(summary)).toEqual([
      { member: { id: "member-a", name: "Friend a" }, rating: 8.5 },
      { member: { id: "member-b", name: "Friend b" }, rating: 6 },
    ]);
  });
});

describe("entryFacts", () => {
  it("shows the price and the go-again answer, whichever were given", () => {
    expect(entryFacts({ ...entry("a", "goat", 8), price: 2, wouldReturn: true })).toBe("$$ · Would go again");
    expect(entryFacts({ ...entry("a", "goat", 8), wouldReturn: false })).toBe("Wouldn't go again");
    expect(entryFacts({ ...entry("a", "goat", 8), price: 4 })).toBe("$$$$");
    expect(entryFacts(entry("a", "goat", 8))).toBeUndefined();
  });

  it("shows the exact price when they typed one", () => {
    expect(entryFacts({ ...entry("a", "goat", 8), price: 2, priceAmount: 23, wouldReturn: true })).toBe("$23 per person · Would go again");
  });
});

describe("placeDetails", () => {
  const answered = (id: string, memberId: string, price?: number, wouldReturn?: boolean): Entry => ({
    ...entry(id, "goat", 8),
    member: { id: memberId, name: memberId },
    price,
    wouldReturn,
  });

  it("gives the price friends picked most, and how many friends would go again", () => {
    const [summary] = summarizePlaces([
      answered("a", "ana", 2, true),
      answered("b", "ben", 3, false),
      answered("c", "cleo", 2, true),
      answered("d", "dev"),
    ]);
    expect(placeDetails(summary)).toEqual({ price: 2, wouldReturn: 2, answered: 3 });
  });

  it("breaks a price tie with the newest pick, and counts a friend's newest answer once", () => {
    // Entries come newest first.
    const [summary] = summarizePlaces([
      answered("new", "ana", 4, false),
      answered("b", "ben", 1),
      answered("old", "ana", undefined, true),
    ]);
    expect(placeDetails(summary)).toEqual({ price: 4, wouldReturn: 0, answered: 1 });
  });

  it("averages the prices friends typed, leaving out friends who only picked a level", () => {
    const typed = (id: string, memberId: string, priceAmount: number): Entry => ({ ...answered(id, memberId, 2), priceAmount });
    const [summary] = summarizePlaces([typed("a", "ana", 20), typed("b", "ben", 25), answered("c", "cleo", 3)]);
    expect(placeDetails(summary).averageAmount).toBe(23);
  });

  it("has nothing to say when nobody gave a price or answered", () => {
    const [summary] = summarizePlaces([answered("a", "ana")]);
    expect(placeDetails(summary)).toEqual({ price: undefined, wouldReturn: 0, answered: 0 });
  });
});

describe("placeDishes", () => {
  const withDishes = (id: string, memberId: string, dishes: Entry["dishes"]): Entry => ({
    ...entry(id, "goat", 8),
    member: { id: memberId, name: memberId },
    dishes,
  });

  it("lists every dish friends tried with its average, best first, the same dish spelled differently counted once", () => {
    const [summary] = summarizePlaces([
      withDishes("a", "ana", [{ name: "Mapo Tofu", rating: 9 }, { name: "Rice", rating: 5 }]),
      withDishes("b", "ben", [{ name: " mapo tofu", rating: 7 }]),
      withDishes("c", "cleo", [{ name: "Dumplings", rating: 8 }]),
      withDishes("d", "dev", []),
    ]);
    expect(placeDishes(summary)).toEqual([
      { name: "Mapo Tofu", averageRating: 8, members: [{ id: "ana", name: "ana" }, { id: "ben", name: "ben" }] },
      { name: "Dumplings", averageRating: 8, members: [{ id: "cleo", name: "cleo" }] },
      { name: "Rice", averageRating: 5, members: [{ id: "ana", name: "ana" }] },
    ]);
  });

  it("is empty when nobody added dishes", () => {
    const [summary] = summarizePlaces([withDishes("a", "ana", [])]);
    expect(placeDishes(summary)).toEqual([]);
  });
});

describe("rankPlaces", () => {
  const places = summarizePlaces([
    entry("a", "goat", 7, true, "american"),
    entry("b", "dumplings", 9, true, "chinese"),
    entry("c", "au-cheval", 9, true, "american"),
    entry("d", "au-cheval", 9, true, "american"),
    entry("e", "zorbas", 8, false),
  ]);
  const ids = (ranked: ReturnType<typeof rankPlaces>) => ranked.map((summary) => summary.place.id);

  it("ranks every place, typed-by-hand ones too, best average first, ties to the place more friends rated", () => {
    expect(ids(rankPlaces(places, null))).toEqual(["au-cheval", "dumplings", "zorbas", "goat"]);
  });

  it("ranks only one cuisine when one is chosen", () => {
    expect(ids(rankPlaces(places, "american"))).toEqual(["au-cheval", "goat"]);
    expect(rankPlaces(places, "korean")).toEqual([]);
  });
});

describe("searchCenter", () => {
  it("is the middle of the group's places, so search without location still looks near them", () => {
    const pins = pinsFromEntries([
      { ...entry("a", "champaign", 8), place: { id: "champaign", name: "Champaign spot", lat: 40.1, lon: -88.2 } },
      { ...entry("b", "chicago", 9), place: { id: "chicago", name: "Chicago spot", lat: 41.9, lon: -87.6 } },
    ]);
    const center = searchCenter(pins);
    expect(center.lat).toBeCloseTo(41.0);
    expect(center.lon).toBeCloseTo(-87.9);
  });

  it("is the University of Illinois campus when the group has no places yet", () => {
    expect(searchCenter([])).toEqual(CAMPUS);
  });
});

describe("friendFavorites", () => {
  const by = (id: string, placeId: string, rating: number, memberId: string): Entry => ({
    ...entry(id, placeId, rating),
    member: { id: memberId, name: memberId },
  });

  it("lists places friends rated highly that you have not rated, best first", () => {
    const places = summarizePlaces([
      by("a", "dumplings", 9, "mia"),
      by("b", "tacos", 8, "ana"),
      by("c", "tacos", 9, "mia"),
      by("d", "burgers", 6, "mia"),
      by("e", "noodles", 10, "mia"),
      by("f", "noodles", 7, "me"),
    ]);
    expect(friendFavorites(places, "me").map((summary) => summary.place.id)).toEqual(["dumplings", "tacos"]);
  });

  it("is empty when friends have not rated anything highly yet", () => {
    expect(friendFavorites(summarizePlaces([by("a", "burgers", 6, "mia")]), "me")).toEqual([]);
  });
});

describe("formatRating", () => {
  it("shows whole scores plainly and averages with one decimal", () => {
    expect(formatRating(8)).toBe("8");
    expect(formatRating(7.5)).toBe("7.5");
    expect(formatRating(23 / 3)).toBe("7.7");
  });
});
