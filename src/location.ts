import type { Coordinates } from "../shared/distance.js";

const LOCATION_TIMEOUT_MILLISECONDS = 10_000;
const REUSE_LOCATION_MILLISECONDS = 5 * 60 * 1000;

/**
 * Asks the browser where the phone is. Resolves to undefined when location is off,
 * denied, or unavailable (iPhone only allows it on https pages), so search still works without it.
 */
export function findCurrentLocation(): Promise<Coordinates | undefined> {
  if (!window.isSecureContext || !("geolocation" in navigator)) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MILLISECONDS, maximumAge: REUSE_LOCATION_MILLISECONDS },
    );
  });
}
