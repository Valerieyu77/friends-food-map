import { describe, expect, it } from "vitest";
import { priceLevelFor, priceText } from "./prices.js";

describe("priceLevelFor", () => {
  it("puts a typed price in the level whose range it falls in", () => {
    expect([1, 14, 15, 30, 31, 60, 61, 999].map(priceLevelFor)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("priceText", () => {
  it("prefers the typed price to the level", () => {
    expect(priceText({ price: 2, priceAmount: 23 })).toBe("$23");
    expect(priceText({ price: 2 })).toBe("$$");
    expect(priceText({})).toBeUndefined();
  });
});
