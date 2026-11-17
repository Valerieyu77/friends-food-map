import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CUISINES } from "../../shared/cuisines.js";
import { PlaceThumb, firstPhoto } from "../feed/PlaceThumb.js";
import { SaveButton } from "../feed/SaveButton.js";
import { ScoreBadge } from "../feed/ScoreBadge.js";
import { useGroupData } from "../groupData.js";
import { NO_FILTERS, SCORE_STEPS, filterPlaces, hasFilters, hiddenFilterCount } from "../mapFilters.js";
import type { MapFilters } from "../mapFilters.js";
import { pinsFromPlaces, rankPlaces } from "../places.js";
import type { PlaceSummary } from "../places.js";
import { Avatar } from "../screens/Avatar.js";
import { FoodMap } from "../screens/FoodMap.js";
import { Icon } from "../shell/Icon.js";
import { timeAgo } from "../time.js";

// The most faces shown on a place's card; the rest are counted.
const CARD_FACES = 4;

interface FilterProps {
  filters: MapFilters;
  onFilters: (filters: MapFilters) => void;
}

/** Floating over the top of the map: the Filters button, then one button per cuisine the group has rated. */
function MapChips({ filters, onFilters, filtersOpen, onToggleFilters }: FilterProps & { filtersOpen: boolean; onToggleFilters: () => void }) {
  const { places } = useGroupData();
  const rated = CUISINES.filter((option) => places.some((summary) => summary.place.cuisine === option.id));
  const hidden = hiddenFilterCount(filters);
  return (
    <div className="map-chips" role="group" aria-label="Filters">
      <button
        type="button"
        className={hidden > 0 ? "chip selected" : "chip"}
        aria-expanded={filtersOpen}
        onClick={onToggleFilters}
      >
        <Icon name="sliders" size={16} />
        {hidden > 0 ? `Filters · ${hidden}` : "Filters"}
      </button>
      {rated.map((option) => {
        const selected = filters.cuisine === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={selected ? "chip selected" : "chip"}
            aria-pressed={selected}
            onClick={() => onFilters({ ...filters, cuisine: selected ? null : option.id })}
          >
            {option.emoji} {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Score, friend and not-been: the filters behind the Filters button, shown at the top of the list. */
function MoreFilters({ filters, onFilters }: FilterProps) {
  const { places, session } = useGroupData();
  const friends = session.members.filter(
    (member) => member.id !== session.member.id && places.some((summary) => summary.entries.some((entry) => entry.member.id === member.id)),
  );
  const friend = friends.find((member) => member.id === filters.friendId);
  const change = (changes: Partial<MapFilters>) => onFilters({ ...filters, ...changes });
  const chip = (selected: boolean, label: string, onClick: () => void, key: string) => (
    <button key={key} type="button" className={selected ? "chip selected" : "chip"} aria-pressed={selected} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <div className="more-filters">
      <div className="chip-row" role="group" aria-label={friend ? `${friend.name}'s score` : "Group score"}>
        {chip(filters.minScore === null, "Any score", () => change({ minScore: null }), "any")}
        {SCORE_STEPS.map((step) => chip(filters.minScore === step, `${step}+`, () => change({ minScore: step }), String(step)))}
      </div>
      {friends.length > 0 && (
        <div className="chip-row" role="group" aria-label="Rated by">
          {friends.map((member) => {
            const selected = member.id === filters.friendId;
            return (
              <button
                key={member.id}
                type="button"
                className={selected ? "chip friend-chip selected" : "chip friend-chip"}
                aria-pressed={selected}
                onClick={() => change({ friendId: selected ? null : member.id })}
              >
                <Avatar name={member.name} avatar={member.avatar} size={20} />
                {member.name}
              </button>
            );
          })}
        </div>
      )}
      <label className="check-row">
        <input type="checkbox" checked={filters.notBeenOnly} onChange={(event) => change({ notBeenOnly: event.target.checked })} />
        Only places I haven't been
      </label>
      {friend && <p className="filter-note">Showing places {friend.name} rated, with {friend.name}'s score.</p>}
    </div>
  );
}

interface PlaceListProps extends FilterProps {
  ranked: PlaceSummary[];
  open: boolean;
  onOpen: (open: boolean) => void;
  showFilters: boolean;
  onSelect: (placeId: string) => void;
}

/** Beside the map (a sheet that pulls up on phones): the group's places, best first. */
function PlaceList({ ranked, filters, onFilters, open, onOpen, showFilters, onSelect }: PlaceListProps) {
  const { places, session } = useGroupData();
  const friend = session.members.find((member) => member.id === filters.friendId);

  return (
    <section className={open ? "place-panel explore-list open" : "place-panel explore-list"} aria-label="Places">
      <button type="button" className="explore-list-head" aria-expanded={open} onClick={() => onOpen(!open)}>
        <span className="sheet-handle" aria-hidden="true" />
        <span className="explore-list-title">
          <strong>{ranked.length} {ranked.length === 1 ? "place" : "places"}</strong>
          <span className="list-toggle">{open ? "Hide list" : "Show list"}</span>
        </span>
      </button>
      <div className="explore-list-body">
        {showFilters && <MoreFilters filters={filters} onFilters={onFilters} />}
        {hasFilters(filters) && (
          <button type="button" className="text-action subtle" onClick={() => onFilters(NO_FILTERS)}>Clear filters</button>
        )}
        {places.length === 0 ? (
          <p className="panel-empty">No places yet. Add a review and it shows up here and on the map.</p>
        ) : ranked.length === 0 ? (
          <div className="panel-empty">
            <p>No places match these filters.</p>
            <button type="button" className="button secondary small" onClick={() => onFilters(NO_FILTERS)}>Clear filters</button>
          </div>
        ) : (
          <ol className="place-rows">
            {ranked.map((summary) => {
              const count = summary.entries.length;
              const onMap = summary.place.lat !== undefined;
              const content = (
                <>
                  <PlaceThumb photo={firstPhoto(summary.entries)} cuisine={summary.place.cuisine} size={56} />
                  <span className="place-row-text">
                    <strong>{summary.place.name}</strong>
                    <small>
                      {friend ? `${friend.name} rated it ${timeAgo(summary.entries[0].createdAt)}` : `${count} ${count === 1 ? "rating" : "ratings"}`}
                      {summary.place.city && ` · ${summary.place.city}`}
                      {!onMap && " · not on the map"}
                    </small>
                  </span>
                  <ScoreBadge score={summary.averageRating} label={friend ? `${friend.name}'s score` : "Average score"} size="small" />
                </>
              );
              return (
                <li key={summary.place.id}>
                  {onMap ? (
                    <button type="button" className="place-row" onClick={() => onSelect(summary.place.id)}>{content}</button>
                  ) : (
                    <Link to={`/places/${summary.place.id}`} className="place-row">{content}</Link>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

/** The place tapped on the map: a small card with its picture, score and who rated it, and a way into its page. */
function PlaceCard({ summary, onClose }: { summary: PlaceSummary; onClose: () => void }) {
  const { place } = summary;
  const count = summary.entries.length;
  const raters = summary.entries.filter(
    (entry, index) => summary.entries.findIndex((other) => other.member.id === entry.member.id) === index,
  ).map((entry) => entry.member);
  return (
    <section className="place-panel place-card" aria-label={place.name}>
      <div className="place-card-main">
        <PlaceThumb photo={firstPhoto(summary.entries)} cuisine={place.cuisine} size={88} />
        <div className="place-card-text">
          <h1>{place.name}</h1>
          <p className="place-card-score">
            <ScoreBadge score={summary.averageRating} label="Average score" size="large" />
            <small>{count} {count === 1 ? "rating" : "ratings"}</small>
          </p>
          {(place.address || place.city) && <p className="meta">{[place.address, place.city].filter(Boolean).join(", ")}</p>}
          <span className="place-card-faces" aria-label={`Rated by ${raters.map((member) => member.name).join(", ")}`}>
            {raters.slice(0, CARD_FACES).map((member) => <Avatar key={member.id} name={member.name} avatar={member.avatar} size={24} />)}
            {raters.length > CARD_FACES && <small>+{raters.length - CARD_FACES}</small>}
          </span>
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="place-card-actions">
        <Link to={`/places/${place.id}`} className="button primary dark">Open</Link>
        <SaveButton placeId={place.id} look="button" />
      </div>
    </section>
  );
}

// Kept outside the page so the filters are still set after opening a place's full page and coming
// back. They belong to one group, since a friend filter means nothing in another.
let lastFilters: { groupId: string; filters: MapFilters } | null = null;

/** The group's places on a map, with filters along the top and a list beside it; tapping a place shows its card. */
export function ExplorePage() {
  const { pins, places, here, session } = useGroupData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [listOpen, setListOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(() =>
    lastFilters?.groupId === session.group.id ? lastFilters.filters : NO_FILTERS,
  );
  const selectedPlaceId = searchParams.get("place");
  const selected = places.find((summary) => summary.place.id === selectedPlaceId);
  const ranked = rankPlaces(filterPlaces(places, filters, session.member.id), null);
  const shownPins = pinsFromPlaces(ranked);
  // The chosen place stays on the map even when the filters would hide it.
  const selectedPin = pins.find((pin) => pin.place.id === selectedPlaceId);
  if (selectedPin && !shownPins.some((pin) => pin.place.id === selectedPlaceId)) shownPins.push(selectedPin);

  function changeFilters(chosen: MapFilters) {
    lastFilters = { groupId: session.group.id, filters: chosen };
    setFilters(chosen);
  }

  function select(placeId: string | null) {
    setSearchParams(placeId ? { place: placeId } : {}, { replace: true });
  }

  // Filters open at the top of the list, so the list opens with them (and the place card gives way).
  function toggleFilters() {
    const opening = !filtersOpen;
    setFiltersOpen(opening);
    if (opening) {
      setListOpen(true);
      select(null);
    }
  }

  return (
    <div className="explore">
      <div className="explore-map">
        <FoodMap pins={shownPins} here={here} selectedPlaceId={selectedPlaceId} onSelect={select} sidePanel />
      </div>

      <MapChips filters={filters} onFilters={changeFilters} filtersOpen={filtersOpen} onToggleFilters={toggleFilters} />

      {selected ? (
        <PlaceCard summary={selected} onClose={() => select(null)} />
      ) : (
        <PlaceList
          ranked={ranked}
          filters={filters}
          onFilters={changeFilters}
          open={listOpen}
          onOpen={setListOpen}
          showFilters={filtersOpen}
          onSelect={select}
        />
      )}
    </div>
  );
}
