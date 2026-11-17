import { describe, expect, it } from "vitest";
import type { Entry, SavedPlace } from "../shared/types.js";
import { summarizePlaces } from "./places.js";
import { splitSaved, visitAfterSaving } from "./saved.js";

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

const save = (memberId: string, placeId: string, savedAt: string): SavedPlace => ({ memberId, placeId, savedAt });

// Entries arrive newest first, as the server sends them.
const entries = [
  rating("e4", "me", "tacos", 8, "2026-11-10T00:00:00Z"),
  rating("e3", "ben", "noodles", 6, "2026-11-04T00:00:00Z"),
  rating("e2", "me", "pizza", 5, "2026-11-03T00:00:00Z"),
  rating("e1", "ben", "tacos", 9, "2026-11-01T00:00:00Z"),
];
const places = summarizePlaces(entries);

describe("visitAfterSaving", () => {
  it("finds your rating posted after you saved the place", () => {
    expect(visitAfterSaving(entries, save("me", "tacos", "2026-11-05T00:00:00Z"))?.id).toBe("e4");
  });

  it("ignores a rating from before you saved it, so wanting to go back keeps it on the list", () => {
    expect(visitAfterSaving(entries, save("me", "pizza", "2026-11-05T00:00:00Z"))).toBeUndefined();
  });

  it("ignores friends' ratings", () => {
    expect(visitAfterSaving(entries, save("me", "noodles", "2026-11-02T00:00:00Z"))).toBeUndefined();
  });
});

describe("splitSaved", () => {
  const saved = [
    save("me", "noodles", "2026-11-06T00:00:00Z"),
    save("me", "tacos", "2026-11-05T00:00:00Z"),
    save("me", "pizza", "2026-11-05T00:00:00Z"),
    save("ben", "pizza", "2026-11-05T00:00:00Z"),
  ];

  it("moves a saved place you then rated to Been there, with your score, and keeps the rest in Want to go", () => {
    const { wantToGo, beenThere } = splitSaved(saved, places, "me");
    expect(wantToGo.map((summary) => summary.place.id)).toEqual(["noodles", "pizza"]);
    expect(beenThere.map((item) => [item.summary.place.id, item.visit.rating])).toEqual([["tacos", 8]]);
  });

  it("only uses your own list", () => {
    const { wantToGo, beenThere } = splitSaved(saved, places, "ben");
    expect(wantToGo.map((summary) => summary.place.id)).toEqual(["pizza"]);
    expect(beenThere).toEqual([]);
  });

  it("puts the place back in Want to go when you delete that rating", () => {
    const withoutVisit = summarizePlaces(entries.filter((entry) => entry.id !== "e4"));
    const { wantToGo, beenThere } = splitSaved(saved, withoutVisit, "me");
    expect(wantToGo.map((summary) => summary.place.id)).toEqual(["noodles", "tacos", "pizza"]);
    expect(beenThere).toEqual([]);
  });

  it("drops a saved place nobody has rated any more", () => {
    const { wantToGo } = splitSaved([save("me", "gone", "2026-11-01T00:00:00Z")], places, "me");
    expect(wantToGo).toEqual([]);
  });
});
