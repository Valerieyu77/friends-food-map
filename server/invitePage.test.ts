import { describe, expect, it } from "vitest";
import type { JoinPreview } from "../shared/types.js";
import { invitePageHtml, invitePreviewText } from "./invitePage.js";

const INDEX = `<html><head><title>Friends Food Map</title></head><body><div id="root"></div></body></html>`;

function preview(changes: Partial<JoinPreview> = {}): JoinPreview {
  return { groupName: "Taco Tuesday", memberNames: ["Ana"], unclaimedNames: [], placeCount: 6, ...changes };
}

describe("invitePreviewText", () => {
  it("names the group, who is in it and how many places they rated", () => {
    expect(invitePreviewText(preview())).toEqual({
      title: "Join Taco Tuesday on Food Map",
      description: "Ana rates the places they actually eat at. 6 places rated so far.",
    });
  });

  it("names two people and counts the rest", () => {
    const text = invitePreviewText(preview({ memberNames: ["Ana", "Ben", "Cleo", "Dev"], placeCount: 1 }));
    expect(text.description).toBe("Ana, Ben and 2 friends rate the places they actually eat at. 1 place rated so far.");
  });
});

describe("invitePageHtml", () => {
  it("puts the preview in the page's head, with the group's newest photo", () => {
    const html = invitePageHtml(INDEX, preview({ coverPhotoUrl: "https://photos.test/a.jpg" }), "https://food.test", "/join/abc");
    expect(html).toContain("<title>Join Taco Tuesday on Food Map</title>");
    expect(html).toContain(`<meta property="og:image" content="https://photos.test/a.jpg" />`);
    expect(html).toContain(`<meta property="og:url" content="https://food.test/join/abc" />`);
    expect(html).toContain(`<div id="root"></div>`);
  });

  it("uses the app icon when the group has no photos", () => {
    expect(invitePageHtml(INDEX, preview(), "https://food.test", "/join/abc")).toContain("https://food.test/icons/icon-512.png");
  });

  it("escapes a group name, so it cannot add its own tags to the page", () => {
    const html = invitePageHtml(INDEX, preview({ groupName: `"><script>alert(1)</script>` }), "https://food.test", "/join/abc");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });
});
