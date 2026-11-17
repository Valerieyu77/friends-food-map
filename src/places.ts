import type { CuisineId } from "../shared/cuisines.js";
import { priceText } from "../shared/prices.js";
import type { Coordinates } from "../shared/distance.js";
import type { Entry, Member, Place } from "../shared/types.js";

/** A place and every entry the group has posted about it. */
export interface PlaceSummary {
  place: Place;
  entries: Entry[];
  averageRating: number;
}

/** One pin on the map: a place summary whose place has coordinates. */
export interface PlacePin extends PlaceSummary {
  place: Place & { lat: number; lon: number };
}

/** Groups entries by place, newest place first. */
export function summarizePlaces(entries: Entry[]): PlaceSummary[] {
  const byPlace = new Map<string, PlaceSummary>();
  for (const entry of entries) {
    const summary = byPlace.get(entry.place.id) ?? { place: entry.place, entries: [], averageRating: 0 };
    summary.entries.push(entry);
    byPlace.set(entry.place.id, summary);
  }
  for (const summary of byPlace.values()) {
    summary.averageRating = summary.entries.reduce((total, entry) => total + entry.rating, 0) / summary.entries.length;
  }
  return [...byPlace.values()];
}

/** One friend's score for a place. */
export interface FriendScore {
  member: Member;
  rating: number;
}

/** Each friend who rated a place, once, in the order they first rated it; two ratings by one friend are averaged. */
export function friendScores(summary: PlaceSummary): FriendScore[] {
  const byMember = new Map<string, { member: Member; ratings: number[] }>();
  for (const entry of summary.entries) {
    const scores = byMember.get(entry.member.id) ?? { member: entry.member, ratings: [] };
    scores.ratings.push(entry.rating);
    byMember.set(entry.member.id, scores);
  }
  return [...byMember.values()].map(({ member, ratings }) => ({
    member,
    rating: ratings.reduce((total, rating) => total + rating, 0) / ratings.length,
  }));
}

/** "$$ · Would go again" or "$23 per person · Would go again" from one review, or undefined when neither was given. */
export function entryFacts(entry: Entry): string | undefined {
  const price = priceText(entry);
  const facts = [
    entry.priceAmount !== undefined ? `${price} per person` : price,
    entry.wouldReturn === undefined ? undefined : entry.wouldReturn ? "Would go again" : "Wouldn't go again",
  ].filter(Boolean);
  return facts.length > 0 ? facts.join(" · ") : undefined;
}

/** What friends said about a place beyond the score. */
export interface PlaceDetails {
  /** The price level friends picked most; ties go to the newest pick. */
  price: number | undefined;
  /** The average of the prices friends typed, in whole dollars; missing when everyone picked a level instead. */
  averageAmount?: number;
  /** Of the friends who answered (each friend's newest answer), how many would go again. */
  wouldReturn: number;
  answered: number;
}

export function placeDetails(summary: PlaceSummary): PlaceDetails {
  const priceCounts = new Map<number, number>();
  const amounts: number[] = [];
  const answers = new Map<string, boolean>();
  // Entries are newest first, so the first answer seen from a friend is their newest.
  for (const entry of summary.entries) {
    if (entry.price !== undefined) priceCounts.set(entry.price, (priceCounts.get(entry.price) ?? 0) + 1);
    if (entry.priceAmount !== undefined) amounts.push(entry.priceAmount);
    if (entry.wouldReturn !== undefined && !answers.has(entry.member.id)) answers.set(entry.member.id, entry.wouldReturn);
  }
  let price: number | undefined;
  for (const [level, count] of priceCounts) {
    if (price === undefined || count > priceCounts.get(price)!) price = level;
  }
  const yes = [...answers.values()].filter(Boolean).length;
  const details: PlaceDetails = { price, wouldReturn: yes, answered: answers.size };
  if (amounts.length > 0) details.averageAmount = Math.round(amounts.reduce((total, amount) => total + amount, 0) / amounts.length);
  return details;
}

/** A dish friends tried at a place: its name, their average score for it, and who had it. */
export interface PlaceDish {
  name: string;
  averageRating: number;
  members: Member[];
}

/**
 * Every dish friends listed at a place, best average first, ties to the dish more friends had. The same dish
 * typed with different capitals or spaces counts once, under its newest spelling.
 */
export function placeDishes(summary: PlaceSummary): PlaceDish[] {
  const byName = new Map<string, { name: string; ratings: number[]; members: Map<string, Member> }>();
  for (const entry of summary.entries) {
    for (const dish of entry.dishes) {
      const key = dish.name.trim().toLowerCase();
      const found = byName.get(key) ?? { name: dish.name.trim(), ratings: [], members: new Map<string, Member>() };
      found.ratings.push(dish.rating);
      found.members.set(entry.member.id, entry.member);
      byName.set(key, found);
    }
  }
  return [...byName.values()]
    .map((dish) => ({
      name: dish.name,
      averageRating: dish.ratings.reduce((total, rating) => total + rating, 0) / dish.ratings.length,
      members: [...dish.members.values()],
    }))
    .sort(
      (first, second) =>
        second.averageRating - first.averageRating ||
        second.members.length - first.members.length ||
        first.name.localeCompare(second.name),
    );
}

function isPin(summary: PlaceSummary): summary is PlacePin {
  return summary.place.lat !== undefined && summary.place.lon !== undefined;
}

/** The places that go on the map. Places typed by hand have no coordinates and are left off. */
export function pinsFromPlaces(places: PlaceSummary[]): PlacePin[] {
  return places.filter(isPin);
}

/**
 * The group's ranking, best average first; with a cuisine, only places of that cuisine.
 * Ties go to the place more friends rated, then alphabetically.
 */
export function rankPlaces(places: PlaceSummary[], cuisine: CuisineId | null): PlaceSummary[] {
  return places
    .filter((summary) => cuisine === null || summary.place.cuisine === cuisine)
    .sort(
      (first, second) =>
        second.averageRating - first.averageRating ||
        second.entries.length - first.entries.length ||
        first.place.name.localeCompare(second.place.name),
    );
}

const FAVORITE_SCORE = 8;

/**
 * Places your friends love and you have not rated yet: every friend who rated it gave it
 * `minimum` or more on average. Best average first.
 */
export function friendFavorites(places: PlaceSummary[], myMemberId: string, minimum = FAVORITE_SCORE): PlaceSummary[] {
  return rankPlaces(
    places.filter(
      (summary) => summary.averageRating >= minimum && summary.entries.every((entry) => entry.member.id !== myMemberId),
    ),
    null,
  );
}

// The University of Illinois campus, where the app's people are: centering on the middle of the
// country instead (rural Kansas) let search fill up with same-named places around the world.
export const CAMPUS: Coordinates = { lat: 40.11, lon: -88.23 };

/** Where search looks when the phone's location is off: the middle of the group's places. */
export function searchCenter(pins: PlacePin[]): Coordinates {
  if (pins.length === 0) return CAMPUS;
  const total = pins.reduce((sum, pin) => ({ lat: sum.lat + pin.place.lat, lon: sum.lon + pin.place.lon }), { lat: 0, lon: 0 });
  return { lat: total.lat / pins.length, lon: total.lon / pins.length };
}

/** "8" for whole numbers, "7.5" otherwise. */
export function formatRating(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}
