import { describe, expect, it } from "vitest";
import { timeAgo } from "./time.js";

const now = new Date("2026-10-16T12:00:00Z").getTime();

describe("timeAgo", () => {
  it("says just now for the last minute", () => {
    expect(timeAgo("2026-10-16T11:59:40Z", now)).toBe("just now");
  });

  it("counts minutes, hours and days", () => {
    expect(timeAgo("2026-10-16T11:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo("2026-10-16T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-10-14T12:00:00Z", now)).toBe("2 d ago");
  });
});
