import type { Entry, Reaction } from "../shared/types.js";

/** How far back Activity looks, so the list stays short. */
export const ACTIVITY_DAYS = 30;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

/** Something that happened in the group that concerns you: a friend's new rating, or a reaction to yours. */
export type ActivityItem =
  | { kind: "rating"; id: string; at: string; entry: Entry }
  | { kind: "reaction"; id: string; at: string; entry: Entry; reaction: Reaction };

/** Friends' ratings and the reactions to your ratings from the last 30 days, newest first. */
export function buildActivity(entries: Entry[], myMemberId: string, now = Date.now()): ActivityItem[] {
  const since = now - ACTIVITY_DAYS * DAY_MILLISECONDS;
  const items: ActivityItem[] = [];
  for (const entry of entries) {
    if (entry.member.id !== myMemberId) {
      items.push({ kind: "rating", id: `rating-${entry.id}`, at: entry.createdAt, entry });
      continue;
    }
    for (const reaction of entry.reactions) {
      if (reaction.member.id === myMemberId) continue;
      items.push({ kind: "reaction", id: `reaction-${entry.id}-${reaction.member.id}-${reaction.reaction}`, at: reaction.createdAt, entry, reaction });
    }
  }
  return items
    .filter((item) => Date.parse(item.at) >= since)
    .sort((first, second) => Date.parse(second.at) - Date.parse(first.at));
}

/** Whether it happened after you last opened Activity; everything is new if you never have. */
export function isNew(item: ActivityItem, seenAt: string | undefined): boolean {
  return seenAt === undefined || Date.parse(item.at) > Date.parse(seenAt);
}

export function countNew(items: ActivityItem[], seenAt: string | undefined): number {
  return items.filter((item) => isNew(item, seenAt)).length;
}
