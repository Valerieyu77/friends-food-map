import { describe, expect, it } from "vitest";
import type { ReactionId } from "../shared/reactions.js";
import type { Entry, Reaction } from "../shared/types.js";
import { buildActivity, countNew, isNew } from "./activity.js";

const now = Date.parse("2026-11-16T12:00:00Z");

function rating(id: string, memberId: string, createdAt: string, reactions: Reaction[] = []): Entry {
  return {
    id,
    createdAt,
    rating: 8,
    place: { id: `place-${id}`, name: `Place ${id}` },
    member: { id: memberId, name: memberId },
    dishes: [],
    photoUrls: [],
    reactions,
  };
}

const reaction = (memberId: string, kind: ReactionId, createdAt: string): Reaction => ({
  reaction: kind,
  createdAt,
  member: { id: memberId, name: memberId },
});

// Entries arrive newest first, as the server sends them.
const entries = [
  rating("e3", "ana", "2026-11-16T10:00:00Z"),
  rating("e2", "me", "2026-11-15T09:00:00Z", [reaction("ben", "yum", "2026-11-16T11:00:00Z"), reaction("ana", "fire", "2026-11-15T12:00:00Z")]),
  rating("e1", "ben", "2026-11-14T08:00:00Z", [reaction("me", "love", "2026-11-14T09:00:00Z")]),
  rating("old", "ben", "2026-10-01T08:00:00Z"),
];

describe("buildActivity", () => {
  it("lists friends' ratings and reactions to your ratings, newest first, from the last 30 days", () => {
    expect(buildActivity(entries, "me", now).map((item) => item.id)).toEqual([
      "reaction-e2-ben-yum",
      "rating-e3",
      "reaction-e2-ana-fire",
      "rating-e1",
    ]);
  });

  it("leaves out your own ratings and the reactions you gave", () => {
    const items = buildActivity(entries, "me", now);
    expect(items.some((item) => item.entry.member.id === "me" && item.kind === "rating")).toBe(false);
    expect(items.some((item) => item.kind === "reaction" && item.reaction.member.id === "me")).toBe(false);
  });

  it("is empty when nothing has happened", () => {
    expect(buildActivity([], "me", now)).toEqual([]);
  });
});

describe("isNew and countNew", () => {
  const items = buildActivity(entries, "me", now);

  it("counts only what came after you last opened Activity", () => {
    expect(countNew(items, "2026-11-16T00:00:00Z")).toBe(2);
    expect(isNew(items[0], "2026-11-16T00:00:00Z")).toBe(true);
    expect(isNew(items[3], "2026-11-16T00:00:00Z")).toBe(false);
  });

  it("counts everything when you have never opened it, and nothing right after you did", () => {
    expect(countNew(items, undefined)).toBe(4);
    expect(countNew(items, "2026-11-16T12:00:00Z")).toBe(0);
  });
});
