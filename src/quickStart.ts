import type { Entry } from "../shared/types.js";

/** How many places the quick start asks a new member to rate. */
export const QUICK_START_PLACES = 3;

const DISMISSED_PREFIX = "friends-food-map.quick-start-dismissed.";

/**
 * Offer "Rate 3 places you love" on Home to someone with no ratings in a group where friends have rated,
 * unless they closed it here before. A group with no ratings at all has its own empty page that offers it.
 */
export function shouldOfferQuickStart(entries: Entry[] | null, myMemberId: string, dismissed: boolean): boolean {
  if (dismissed || entries === null || entries.length === 0) return false;
  return !entries.some((entry) => entry.member.id === myMemberId);
}

// Browser storage can be blocked (private windows); the card then just shows again next visit.
export function quickStartDismissed(groupId: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_PREFIX + groupId) === "yes";
  } catch {
    return false;
  }
}

export function dismissQuickStart(groupId: string): void {
  try {
    localStorage.setItem(DISMISSED_PREFIX + groupId, "yes");
  } catch {
    // Nothing to do: the card is hidden for now and may show again next visit.
  }
}
