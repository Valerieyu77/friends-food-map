export interface Coordinates {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_MILES = 3958.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Straight-line distance between two points on the earth, in miles. */
export function milesBetween(from: Coordinates, to: Coordinates): number {
  const latChange = toRadians(to.lat - from.lat);
  const lonChange = toRadians(to.lon - from.lon);
  const a =
    Math.sin(latChange / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lonChange / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

/** "0.3 mi" close by, whole miles further out. */
export function formatMiles(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles).toLocaleString("en-US")} mi`;
}
