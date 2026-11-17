import { describe, expect, it } from "vitest";
import { installTipKind } from "./installTip.js";
import type { InstallSituation } from "./installTip.js";

const iphoneSafari: InstallSituation = { isIos: true, isStandalone: false, canPrompt: false, isTouch: true, dismissed: false };
const androidChrome: InstallSituation = { isIos: false, isStandalone: false, canPrompt: true, isTouch: true, dismissed: false };

describe("installTipKind", () => {
  it("shows the Share steps in iPhone Safari and the install button in Android Chrome", () => {
    expect(installTipKind(iphoneSafari)).toBe("ios");
    expect(installTipKind(androidChrome)).toBe("android");
  });

  it("hides the tip once the app is opened from the home screen", () => {
    expect(installTipKind({ ...iphoneSafari, isStandalone: true })).toBeNull();
    expect(installTipKind({ ...androidChrome, isStandalone: true })).toBeNull();
  });

  it("hides the tip for good after it is closed", () => {
    expect(installTipKind({ ...iphoneSafari, dismissed: true })).toBeNull();
  });

  it("shows nothing on laptops, or on Android when the browser cannot install the app", () => {
    expect(installTipKind({ ...androidChrome, isTouch: false })).toBeNull();
    expect(installTipKind({ ...androidChrome, canPrompt: false })).toBeNull();
  });
});
