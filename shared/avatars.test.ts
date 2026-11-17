import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STICKER_GROUPS, avatarText, parseAvatar } from "./avatars.js";

describe("avatars", () => {
  it("has an image in public/stickers for every sticker offered", () => {
    const missing = STICKER_GROUPS.flatMap((group) => group.stickers).filter(
      (sticker) => !existsSync(new URL(`../public/stickers/${sticker}.png`, import.meta.url)),
    );
    expect(missing).toEqual([]);
  });

  it("reads back what it stores, and ignores anything it does not know", () => {
    expect(parseAvatar("sticker:bubble_tea")).toEqual({ kind: "sticker", sticker: "bubble_tea" });
    expect(avatarText(parseAvatar("color:sage")!)).toBe("color:sage");
    for (const unknown of ["sticker:not_a_sticker", "color:black", "bubble_tea", "", null, 7]) {
      expect(parseAvatar(unknown)).toBeUndefined();
    }
  });
});
