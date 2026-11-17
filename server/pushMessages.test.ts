import { describe, expect, it } from "vitest";
import type { Entry } from "../shared/types.js";
import { newRatingMessage, reactionMessage } from "./pushMessages.js";

const group = { id: "g1", name: "Chicago trip" };

function rating(note?: string): Entry {
  return {
    id: "e1",
    createdAt: "2026-11-16T00:00:00Z",
    rating: 8,
    note,
    place: { id: "tacos", name: "Tacos" },
    member: { id: "ana", name: "Ana" },
    dishes: [],
    photoUrls: [],
    reactions: [],
  };
}

describe("newRatingMessage", () => {
  it("names the friend, the place and the score, with the note's first line, and opens the place in that group", () => {
    expect(newRatingMessage(rating("\nBest al pastor\nGo early"), group)).toEqual({
      title: "Ana rated Tacos 8/10",
      body: "Best al pastor",
      url: "/places/tacos?group=g1",
    });
  });

  it("names the group when there is no note, and shortens a long note", () => {
    expect(newRatingMessage(rating(), group).body).toBe("In Chicago trip");
    const body = newRatingMessage(rating("a".repeat(300)), group).body;
    expect(body).toHaveLength(120);
    expect(body.endsWith("…")).toBe(true);
  });
});

describe("reactionMessage", () => {
  it("says who reacted with which emoji to which review", () => {
    expect(reactionMessage(rating(), "Ben", "yum", group)).toEqual({
      title: "Ben reacted 😋 to your review of Tacos",
      body: "In Chicago trip",
      url: "/places/tacos?group=g1",
    });
  });
});
