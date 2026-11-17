import { REACTIONS } from "../shared/reactions.js";
import type { ReactionId } from "../shared/reactions.js";
import type { Entry } from "../shared/types.js";

const MAX_BODY_LENGTH = 120;

/** What a phone notification says, and the page it opens when tapped. */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

/** The place's page, opening the group it belongs to even if another group was open last. */
function placeUrl(entry: Entry, groupId: string): string {
  return `/places/${entry.place.id}?group=${groupId}`;
}

/** "Ana rated Tacos 8/10", with the first line of her note under it (or the group's name without one). */
export function newRatingMessage(entry: Entry, group: { id: string; name: string }): PushMessage {
  const firstLine = entry.note?.split("\n").find((line) => line.trim())?.trim();
  const body = firstLine ? (firstLine.length > MAX_BODY_LENGTH ? `${firstLine.slice(0, MAX_BODY_LENGTH - 1)}…` : firstLine) : `In ${group.name}`;
  return { title: `${entry.member.name} rated ${entry.place.name} ${entry.rating}/10`, body, url: placeUrl(entry, group.id) };
}

/** "Ben reacted 😋 to your review of Noodles". */
export function reactionMessage(entry: Entry, reactorName: string, reaction: ReactionId, group: { id: string; name: string }): PushMessage {
  const emoji = REACTIONS.find((candidate) => candidate.id === reaction)!.emoji;
  return { title: `${reactorName} reacted ${emoji} to your review of ${entry.place.name}`, body: `In ${group.name}`, url: placeUrl(entry, group.id) };
}
