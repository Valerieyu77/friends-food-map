import { describe, expect, it } from "vitest";
import { keyBytes, pushSupport } from "./push.js";

describe("pushSupport", () => {
  it("needs the home-screen app on iPhone, even where Safari could otherwise", () => {
    expect(pushSupport({ hasPush: false, isIos: true, isStandalone: false })).toBe("needs-home-screen");
    expect(pushSupport({ hasPush: true, isIos: true, isStandalone: false })).toBe("needs-home-screen");
    expect(pushSupport({ hasPush: true, isIos: true, isStandalone: true })).toBe("supported");
  });

  it("works in browsers that have push, and says so when one does not", () => {
    expect(pushSupport({ hasPush: true, isIos: false, isStandalone: false })).toBe("supported");
    expect(pushSupport({ hasPush: false, isIos: false, isStandalone: false })).toBe("unsupported");
  });
});

describe("keyBytes", () => {
  it("reads URL-safe base64 without padding", () => {
    // "-_8" is URL-safe for "+/8"; 0xfb 0xff 0xfc in standard base64 is "+//8".
    expect([...keyBytes("-__8")]).toEqual([0xfb, 0xff, 0xfc]);
    expect([...keyBytes("AQ")]).toEqual([1]);
  });
});
