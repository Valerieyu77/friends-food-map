import type { CuisineId } from "../shared/cuisines.js";
import type { PlaceSummary } from "./places.js";

/** What narrows the places on Explore. Every filter that is set must match. */
export interface MapFilters {
  cuisine: CuisineId | null;
  /** The lowest score to show: the group average, or the chosen friend's own score. */
  minScore: number | null;
  /** Only places this friend rated, each scored by their newest rating. */
  friendId: string | null;
  /** Hide places you have rated. */
  notBeenOnly: boolean;
}

export const NO_FILTERS: MapFilters = { cuisine: null, minScore: null, friendId: null, notBeenOnly: false };

export const SCORE_STEPS = [7, 8, 9];

export function hasFilters(filters: MapFilters): boolean {
  return filters.cuisine !== null || filters.minScore !== null || filters.friendId !== null || filters.notBeenOnly;
}

/** How many filters behind the Filters button are set (score, friend, not been); cuisines have their own buttons. */
export function hiddenFilterCount(filters: MapFilters): number {
  return Number(filters.minScore !== null) + Number(filters.friendId !== null) + Number(filters.notBeenOnly);
}

/** The places that match, in the order given. With a friend chosen, each place carries only that friend's newest rating. */
export function filterPlaces(places: PlaceSummary[], filters: MapFilters, myMemberId: string): PlaceSummary[] {
  const shown: PlaceSummary[] = [];
  for (const summary of places) {
    if (filters.cuisine !== null && summary.place.cuisine !== filters.cuisine) continue;
    if (filters.notBeenOnly && summary.entries.some((entry) => entry.member.id === myMemberId)) continue;
    let candidate = summary;
    if (filters.friendId !== null) {
      // Entries are newest first, so the first one is the friend's newest rating.
      const newest = summary.entries.find((entry) => entry.member.id === filters.friendId);
      if (!newest) continue;
      candidate = { place: summary.place, entries: [newest], averageRating: newest.rating };
    }
    if (filters.minScore !== null && candidate.averageRating < filters.minScore) continue;
    shown.push(candidate);
  }
  return shown;
}
