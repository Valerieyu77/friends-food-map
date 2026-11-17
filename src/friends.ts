import type { Entry } from "../shared/types.js";

const MIN_SHARED_PLACES = 2;

/** Each place someone rated, once, with their newest rating of it; newest first. `entries` must be newest first. */
export function latestRatings(entries: Entry[], memberId: string): Entry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (entry.member.id !== memberId || seen.has(entry.place.id)) return false;
    seen.add(entry.place.id);
    return true;
  });
}

/** The score this friend gave the same place on their visit before this one; missing for a first visit. `entries` must be newest first. */
export function previousRating(entries: Entry[], entry: Entry): number | undefined {
  const index = entries.findIndex((candidate) => candidate.id === entry.id);
  if (index === -1) return undefined;
  return entries
    .slice(index + 1)
    .find((older) => older.member.id === entry.member.id && older.place.id === entry.place.id)?.rating;
}

/** "Was 7 → now 9", or "Same 8 as last visit", for a friend's repeat visit; undefined for a first visit. */
export function scoreChange(entries: Entry[], entry: Entry): string | undefined {
  const before = previousRating(entries, entry);
  if (before === undefined) return undefined;
  return before === entry.rating ? `Same ${before} as last visit` : `Was ${before} → now ${entry.rating}`;
}

/** The best-rated places first, ties to the newer rating. */
export function topRated(ratings: Entry[], count: number): Entry[] {
  return [...ratings]
    .sort((first, second) => second.rating - first.rating || second.createdAt.localeCompare(first.createdAt))
    .slice(0, count);
}

export interface TasteMatch {
  /** How many places both people rated. */
  shared: number;
  /** 100 when they always agree, 10 points less per point they differ on average; missing until 2 places are shared. */
  percent: number | undefined;
}

export function tasteMatch(entries: Entry[], myId: string, friendId: string): TasteMatch {
  const mine = new Map(latestRatings(entries, myId).map((entry) => [entry.place.id, entry.rating]));
  const differences = latestRatings(entries, friendId)
    .filter((entry) => mine.has(entry.place.id))
    .map((entry) => Math.abs(entry.rating - mine.get(entry.place.id)!));
  if (differences.length < MIN_SHARED_PLACES) return { shared: differences.length, percent: undefined };
  const averageDifference = differences.reduce((total, difference) => total + difference, 0) / differences.length;
  return { shared: differences.length, percent: Math.round(100 - averageDifference * 10) };
}
