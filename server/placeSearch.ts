import { milesBetween } from "../shared/distance.js";
import type { Coordinates } from "../shared/distance.js";
import type { PlaceInput } from "../shared/types.js";

const SEARCH_URL = "https://photon.komoot.io/api/";
const CACHE_MILLISECONDS = 10 * 60 * 1000;
const MAX_RESULTS = 6;
// Photon marks cities, roads and boundaries with these keys; none of them is somewhere you would rate.
const SKIPPED_KEYS = new Set(["place", "boundary", "highway", "railway", "waterway", "natural"]);

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
  };
}

export function normalizeResults(body: { features?: PhotonFeature[] }): PlaceInput[] {
  const places: PlaceInput[] = [];
  for (const feature of body.features ?? []) {
    const properties = feature.properties;
    const coordinates = feature.geometry?.coordinates;
    if (!properties?.name || !coordinates || !properties.osm_id || !properties.osm_type) continue;
    if (properties.osm_key && SKIPPED_KEYS.has(properties.osm_key)) continue;
    const street = [properties.housenumber, properties.street].filter(Boolean).join(" ");
    places.push({
      osmKey: `${properties.osm_type}${properties.osm_id}`,
      name: properties.name,
      address: street || undefined,
      city: properties.city ?? properties.district,
      lat: coordinates[1],
      lon: coordinates[0],
    });
  }
  // The same restaurant is often mapped twice (the building and its outdoor seating); keep the one with an address.
  const distinct = places.filter(
    (place, index) =>
      place.address || !places.some((other, otherIndex) => otherIndex < index && other.name.toLowerCase() === place.name.toLowerCase()),
  );
  return distinct.slice(0, MAX_RESULTS);
}

const cache = new Map<string, { savedAt: number; places: PlaceInput[] }>();

/** Closest first; places without coordinates go last. */
export function sortByDistance(places: PlaceInput[], near: Coordinates): PlaceInput[] {
  const distance = (place: PlaceInput) =>
    place.lat === undefined || place.lon === undefined ? Infinity : milesBetween(near, { lat: place.lat, lon: place.lon });
  return [...places].sort((first, second) => distance(first) - distance(second));
}

/** Searches by name; with `near`, the service prefers places around that point and results come closest first. */
export async function searchPlaces(query: string, near?: Coordinates): Promise<PlaceInput[]> {
  // Rounded to about a kilometre so a phone moving slightly still reuses the cache.
  const key = [query.toLowerCase(), near?.lat.toFixed(2), near?.lon.toFixed(2)].join("|");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_MILLISECONDS) return cached.places;

  const parameters = new URLSearchParams({ q: query, limit: "12" });
  if (near) {
    parameters.set("lat", String(near.lat));
    parameters.set("lon", String(near.lon));
  }
  const url = `${SEARCH_URL}?${parameters}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "friends-food-map (https://friends-food-map.vercel.app)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Place search failed with status ${response.status}`);
  const found = normalizeResults((await response.json()) as { features?: PhotonFeature[] });
  const places = near ? sortByDistance(found, near) : found;
  cache.set(key, { savedAt: Date.now(), places });
  return places;
}
