import type { Entry, SavedPlace } from "../shared/types.js";
import type { PlaceSummary } from "./places.js";

/** A saved place you have since been to, with the rating you posted after saving it. */
export interface BeenThere {
  summary: PlaceSummary;
  visit: Entry;
}

/**
 * Your newest rating of a saved place posted after you saved it. A rating from before the save
 * does not count, so saving a place to go back to keeps it on the want-to-go list.
 */
export function visitAfterSaving(entries: Entry[], item: SavedPlace): Entry | undefined {
  const savedAt = Date.parse(item.savedAt);
  // Entries are newest first, so the first match is the newest visit.
  return entries.find(
    (entry) => entry.member.id === item.memberId && entry.place.id === item.placeId && Date.parse(entry.createdAt) >= savedAt,
  );
}

/** Splits your saved places into those still to visit (in saved order) and those you have rated since (newest visit first). */
export function splitSaved(saved: SavedPlace[], places: PlaceSummary[], memberId: string) {
  const wantToGo: PlaceSummary[] = [];
  const beenThere: BeenThere[] = [];
  for (const item of saved) {
    if (item.memberId !== memberId) continue;
    // A place drops off when every review of it is deleted.
    const summary = places.find((candidate) => candidate.place.id === item.placeId);
    if (!summary) continue;
    const visit = visitAfterSaving(summary.entries, item);
    if (visit) beenThere.push({ summary, visit });
    else wantToGo.push(summary);
  }
  beenThere.sort((first, second) => Date.parse(second.visit.createdAt) - Date.parse(first.visit.createdAt));
  return { wantToGo, beenThere };
}
