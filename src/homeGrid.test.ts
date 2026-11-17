import { describe, expect, it } from "vitest";
import type { Entry, GroupMember } from "../shared/types.js";
import { friendBubbles, intoColumns } from "./homeGrid.js";

function member(id: string): GroupMember {
  return { id, name: id, joinedAt: "2026-10-01T00:00:00Z" };
}

function rating(memberId: string, createdAt: string): Entry {
  return {
    id: `${memberId}-${createdAt}`,
    createdAt,
    rating: 8,
    place: { id: "tacos", name: "Tacos" },
    member: { id: memberId, name: memberId },
    dishes: [],
    photoUrls: [],
    reactions: [],
  };
}

const NOW = Date.parse("2026-11-16T12:00:00Z");
const members = [member("me"), member("ana"), member("ben"), member("cleo"), member("dev")];
const entries = [
  rating("ben", "2026-11-15T00:00:00Z"),
  rating("me", "2026-11-14T00:00:00Z"),
  rating("dev", "2026-10-20T00:00:00Z"),
  rating("ben", "2026-10-01T00:00:00Z"),
];

describe("friendBubbles", () => {
  it("leaves you out and puts whoever rated most recently first, then the rest in join order", () => {
    expect(friendBubbles(members, entries, "me", NOW).map((bubble) => bubble.member.id)).toEqual(["ben", "dev", "ana", "cleo"]);
  });

  it("rings only friends who rated in the last week", () => {
    const rings = friendBubbles(members, entries, "me", NOW).map((bubble) => [bubble.member.id, bubble.postedRecently]);
    expect(rings).toEqual([["ben", true], ["dev", false], ["ana", false], ["cleo", false]]);
  });

  it("is empty when you are the only one in the group", () => {
    expect(friendBubbles([member("me")], entries, "me", NOW)).toEqual([]);
  });
});

describe("intoColumns", () => {
  it("puts each card under the shortest column so far, the left one on a tie", () => {
    const heights = { a: 300, b: 150, c: 150, d: 150, e: 150 };
    const columns = intoColumns(Object.keys(heights), 2, (key) => heights[key as keyof typeof heights]);
    expect(columns).toEqual([["a", "d"], ["b", "c", "e"]]);
  });

  it("gives empty columns when there is nothing to show", () => {
    expect(intoColumns([], 2, () => 1)).toEqual([[], []]);
  });
});
