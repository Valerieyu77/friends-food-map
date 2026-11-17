import { describe, expect, it } from "vitest";
import type { Reaction } from "../shared/types.js";
import { groupReactions, reactorNames } from "./reactionSummary.js";

const ana = { id: "ana", name: "Ana" };
const ben = { id: "ben", name: "Ben" };
const me = { id: "me", name: "Valerie" };
const at = "2026-11-16T00:00:00Z";
const reactions: Reaction[] = [
  { reaction: "fire", createdAt: at, member: ana },
  { reaction: "yum", createdAt: at, member: ben },
  { reaction: "yum", createdAt: at, member: me },
  { reaction: "yum", createdAt: at, member: ana },
];

describe("groupReactions", () => {
  it("lists every reaction in the menu's order with who left it and whether you did", () => {
    const grouped = groupReactions(reactions, "me");
    expect(grouped.map((item) => [item.id, item.members.map((member) => member.name), item.mine])).toEqual([
      ["yum", ["Ben", "Valerie", "Ana"], true],
      ["fire", ["Ana"], false],
      ["love", [], false],
      ["wow", [], false],
      ["haha", [], false],
    ]);
  });
});

describe("reactorNames", () => {
  it("names each person once, you first as You", () => {
    expect(reactorNames(reactions, "me")).toBe("You, Ana and Ben");
  });

  it("handles one person and nobody", () => {
    expect(reactorNames([{ reaction: "wow", createdAt: at, member: ben }], "me")).toBe("Ben");
    expect(reactorNames([], "me")).toBe("");
  });
});
