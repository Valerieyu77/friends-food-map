import { describe, expect, it } from "vitest";
import { clearOldSignIns, loadOpenGroup, oldSignIns, saveOpenGroup } from "./session.js";

/** Stands in for the browser's localStorage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    keys: () => [...values.keys()],
  };
}

describe("sign-ins from before accounts", () => {
  it("collects every old group sign-in once, so logging in keeps those groups", () => {
    const storage = memoryStorage({
      "friends-food-map.token": "token-1",
      "friends-food-map.groups": JSON.stringify([
        { groupId: "g1", groupName: "Chicago trip", token: "token-1" },
        { groupId: "g2", groupName: "Roommates", token: "token-2" },
      ]),
    });
    expect(oldSignIns(storage)).toEqual(["token-1", "token-2"]);
  });

  it("has none on a new browser or when the saved list is damaged", () => {
    expect(oldSignIns(memoryStorage())).toEqual([]);
    expect(oldSignIns(memoryStorage({ "friends-food-map.groups": "not json" }))).toEqual([]);
  });

  it("forgets them once an account has taken them over", () => {
    const storage = memoryStorage({ "friends-food-map.token": "token-1", "friends-food-map.groups": "[]" });
    clearOldSignIns(storage);
    expect(storage.keys()).toEqual([]);
  });
});

describe("open group", () => {
  it("remembers which group was open last time", () => {
    const storage = memoryStorage();
    expect(loadOpenGroup(storage)).toBeNull();
    saveOpenGroup("g2", storage);
    expect(loadOpenGroup(storage)).toBe("g2");
  });
});
