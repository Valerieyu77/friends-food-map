import type { JoinPreview } from "../shared/types.js";

// The most names spelled out in a link's preview; the rest are counted.
const NAMES_SHOWN = 2;

/** Makes text safe to put inside an HTML attribute or element. */
function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/** "Ana", "Ana and Ben", "Ana, Ben and 3 friends". */
function whoIsHere(names: string[]): string {
  if (names.length <= NAMES_SHOWN) return names.join(" and ");
  const others = names.length - NAMES_SHOWN;
  return `${names.slice(0, NAMES_SHOWN).join(", ")} and ${others} ${others === 1 ? "friend" : "friends"}`;
}

/** What a chat app shows for an invite link: a title, a line about the group, and a picture. */
export function invitePreviewText(preview: JoinPreview): { title: string; description: string } {
  const places = `${preview.placeCount} ${preview.placeCount === 1 ? "place" : "places"} rated so far.`;
  const verb = preview.memberNames.length === 1 ? "rates" : "rate";
  const people = preview.memberNames.length > 0 ? `${whoIsHere(preview.memberNames)} ${verb} the places they actually eat at. ` : "";
  return { title: `Join ${preview.groupName} on Food Map`, description: people + places };
}

/**
 * The app's page with the invite's preview in it, for the chat apps that read a link before anyone opens it.
 * People who open the link get the same app as always.
 */
export function invitePageHtml(indexHtml: string, preview: JoinPreview, origin: string, path: string): string {
  const { title, description } = invitePreviewText(preview);
  const image = preview.coverPhotoUrl ?? `${origin}/icons/icon-512.png`;
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Food Map" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:url" content="${escapeHtml(origin + path)}" />`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join("\n    ");
  return indexHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace("</head>", `    ${tags}\n  </head>`);
}
