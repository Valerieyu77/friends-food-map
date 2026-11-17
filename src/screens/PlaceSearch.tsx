import { useEffect, useState } from "react";
import { formatMiles, milesBetween } from "../../shared/distance.js";
import type { Coordinates } from "../../shared/distance.js";
import type { PlaceInput } from "../../shared/types.js";
import * as api from "../api.js";
import { findCurrentLocation } from "../location.js";

const SEARCH_DELAY_MILLISECONDS = 350;

export function describePlace(place: PlaceInput): string {
  return [place.address, place.city].filter(Boolean).join(", ");
}

function distanceLabel(place: PlaceInput, here: Coordinates | undefined): string | undefined {
  if (!here || place.lat === undefined || place.lon === undefined) return undefined;
  return formatMiles(milesBetween(here, { lat: place.lat, lon: place.lon }));
}

interface PlaceSearchProps {
  /** Where to search when the phone's location is off. */
  searchAround: Coordinates;
  onPick: (place: PlaceInput) => void;
  /** Shown as "Can't find it? Add it by name" under the results; gets what was typed so far. */
  onTypeByHand?: (typed: string) => void;
  label?: string;
}

/** A search box for restaurants, nearest first, with the results to tap. */
export function PlaceSearch({ searchAround, onPick, onTypeByHand, label = "Where did you go?" }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceInput[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [here, setHere] = useState<Coordinates | undefined>(undefined);
  const [locating, setLocating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void findCurrentLocation().then((found) => {
      if (cancelled) return;
      setHere(found);
      setLocating(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      api.searchPlaces(trimmed, here ?? searchAround).then(
        (found) => {
          if (cancelled) return;
          setResults(found);
          setSearchError(null);
          setSearching(false);
        },
        (failure: unknown) => {
          if (cancelled) return;
          setSearchError(failure instanceof Error ? failure.message : "Search failed.");
          setSearching(false);
        },
      );
    }, SEARCH_DELAY_MILLISECONDS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, here, searchAround]);

  return (
    <div>
      <label>
        {label}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a restaurant, e.g. Lou Malnati's Chicago"
          autoComplete="off"
        />
      </label>
      {locating && <p className="hint">Finding where you are, to show nearby places first…</p>}
      {!locating && !here && (
        <p className="hint">
          Your browser did not share your location, so places near your group's ratings come first. To see places near
          you, allow location for this site in your browser or phone settings.
        </p>
      )}
      {searching && <p className="hint">Searching…</p>}
      {searchError && <p className="error">{searchError}</p>}
      {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && (
        <p className="hint">Nothing found. Check the spelling, add the city{onTypeByHand ? ", or add it by name below" : ""}.</p>
      )}
      <ul className="results">
        {results.map((result) => {
          const distance = distanceLabel(result, here);
          return (
            <li key={result.osmKey}>
              <button type="button" onClick={() => onPick(result)}>
                <span className="result-heading">
                  <strong>{result.name}</strong>
                  {distance && <span className="distance">{distance}</span>}
                </span>
                <span>{describePlace(result)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {onTypeByHand && (
        <button type="button" className="link" onClick={() => onTypeByHand(query.trim())}>
          Can't find it? Add it by name
        </button>
      )}
    </div>
  );
}
