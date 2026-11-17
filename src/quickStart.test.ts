import { describe, expect, it } from "vitest";
import type { Entry } from "../shared/types.js";
import { shouldOfferQuickStart } from "./quickStart.js";

function rating(memberId: string): Entry {
  return {
    id: `${memberId}-entry`,
    createdAt: "2026-11-16T00:00:00Z",
    rating: 8,
    place: { id: "tacos", name: "Tacos" },
    member: { id: memberId, name: memberId },
    dishes: [],
    photoUrls: [],
    reactions: [],
  };
}

describe("shouldOfferQuickStart", () => {
  it("offers it to a new member whose friends have rated places", () => {
    expect(shouldOfferQuickStart([rating("ana")], "me", false)).toBe(true);
  });

  it("leaves a brand new group with no ratings to its own empty page", () => {
    expect(shouldOfferQuickStart([], "me", false)).toBe(false);
  });

  it("stops once you have rated something, or closed it", () => {
    expect(shouldOfferQuickStart([rating("ana"), rating("me")], "me", false)).toBe(false);
    expect(shouldOfferQuickStart([rating("ana")], "me", true)).toBe(false);
  });

  it("waits while the ratings are loading", () => {
    expect(shouldOfferQuickStart(null, "me", false)).toBe(false);
  });
});
