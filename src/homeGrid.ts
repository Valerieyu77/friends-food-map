import type { Entry, GroupMember } from "../shared/types.js";

const DAY = 24 * 60 * 60 * 1000;
/** A friend who rated something within this many days gets a coral ring in the row at the top of Home. */
export const RECENT_DAYS = 7;

export interface FriendBubble {
  member: GroupMember;
  postedRecently: boolean;
}

/** Everyone else in the group, for the row at the top of Home: whoever rated most recently first, then the rest in join order. */
export function friendBubbles(members: GroupMember[], entries: Entry[], myMemberId: string, now: number = Date.now()): FriendBubble[] {
  const lastRated = new Map<string, number>();
  for (const entry of entries) {
    const time = Date.parse(entry.createdAt);
    if (time > (lastRated.get(entry.member.id) ?? -Infinity)) lastRated.set(entry.member.id, time);
  }
  return members
    .filter((member) => member.id !== myMemberId)
    .map((member, joinOrder) => ({ member, joinOrder, last: lastRated.get(member.id) ?? -Infinity }))
    // Two people who never rated compare as NaN, which falls through to join order.
    .sort((first, second) => second.last - first.last || first.joinOrder - second.joinOrder)
    .map(({ member, last }) => ({ member, postedRecently: now - last < RECENT_DAYS * DAY }));
}

/**
 * Deals items into columns, each to whichever column is shortest so far, so the columns end about level
 * and the newest items stay near the top.
 */
export function intoColumns<T>(items: T[], columnCount: number, heightOf: (item: T) => number): T[][] {
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  const heights: number[] = Array.from({ length: columnCount }, () => 0);
  for (const item of items) {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest].push(item);
    heights[shortest] += heightOf(item);
  }
  return columns;
}
