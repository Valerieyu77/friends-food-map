import { useState } from "react";
import { CUISINES, cuisineById } from "../../shared/cuisines.js";
import type { CuisineId } from "../../shared/cuisines.js";
import { formatRating, rankPlaces } from "../places.js";
import type { PlaceSummary } from "../places.js";

interface RankingsProps {
  places: PlaceSummary[];
  onOpen: (placeId: string) => void;
}

/** The group's places, best first, with a row of cuisines to rank just one kind of food. */
export function Rankings({ places, onOpen }: RankingsProps) {
  const [cuisine, setCuisine] = useState<CuisineId | null>(null);
  const cuisinesRated = CUISINES.filter((option) => places.some((summary) => summary.place.cuisine === option.id));
  const ranked = rankPlaces(places, cuisine);
  const chip = (id: CuisineId | null, label: string) => (
    <button key={id ?? "all"} type="button" className={id === cuisine ? "filter-chip selected" : "filter-chip"} aria-pressed={id === cuisine} onClick={() => setCuisine(id)}>
      {label}
    </button>
  );

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Your group's favorites</p>
        <h1 className="display">Rankings</h1>
      </header>
      {places.length === 0 ? (
        <p className="empty">Nothing here yet. Rate a place and it shows up here.</p>
      ) : (
        <>
          {cuisinesRated.length > 0 && (
            <div className="filter-chips" role="group" aria-label="Cuisine">
              {chip(null, "All")}
              {cuisinesRated.map((option) => chip(option.id, `${option.emoji} ${option.label}`))}
            </div>
          )}
          <ol className="ranking">
            {ranked.map((summary, index) => {
              const placeCuisine = cuisineById(summary.place.cuisine);
              const count = summary.entries.length;
              return (
                <li key={summary.place.id}>
                  <button type="button" onClick={() => onOpen(summary.place.id)}>
                    <span className="rank">{index + 1}</span>
                    <span className="ranking-name">
                      <strong>{summary.place.name}</strong>
                      <span>
                        {placeCuisine ? `${placeCuisine.emoji} ${placeCuisine.label} · ` : ""}
                        {count} {count === 1 ? "rating" : "ratings"}
                      </span>
                    </span>
                    <span className="average" aria-label={`Average score ${formatRating(summary.averageRating)} out of 10`}>
                      {formatRating(summary.averageRating)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
