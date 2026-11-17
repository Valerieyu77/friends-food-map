import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { CUISINES, cuisineById } from "../../shared/cuisines.js";
import type { CuisineId } from "../../shared/cuisines.js";
import { useGroupData } from "../groupData.js";
import { friendFavorites, rankPlaces } from "../places.js";
import type { PlaceSummary } from "../places.js";
import { Avatar } from "../screens/Avatar.js";
import { FoodMap } from "../screens/FoodMap.js";
import { Icon } from "../shell/Icon.js";
import { ScoreBadge } from "./ScoreBadge.js";

const TOP_COUNT = 5;
const FAVORITE_COUNT = 4;

const placeLink = (summary: PlaceSummary) => `/places/${summary.place.id}`;

function PlaceRow({ summary, rank }: { summary: PlaceSummary; rank?: number }) {
  const cuisine = cuisineById(summary.place.cuisine);
  const count = summary.entries.length;
  return (
    <li>
      <Link to={placeLink(summary)} className="place-row">
        {rank !== undefined && <span className="place-rank">{rank}</span>}
        <span className="place-row-emoji" aria-hidden="true">{cuisine?.emoji ?? "🍽️"}</span>
        <span className="place-row-text">
          <strong>{summary.place.name}</strong>
          <small>{count} {count === 1 ? "rating" : "ratings"}{summary.place.city && ` · ${summary.place.city}`}</small>
        </span>
        <ScoreBadge score={summary.averageRating} label="Average score" size="small" />
      </Link>
    </li>
  );
}

function TopPlaces() {
  const { places, session } = useGroupData();
  const [cuisine, setCuisine] = useState<CuisineId | null>(null);
  const rated = CUISINES.filter((option) => places.some((summary) => summary.place.cuisine === option.id));
  const top = rankPlaces(places, cuisine).slice(0, TOP_COUNT);
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Top in {session.group.name}</h2>
        <Link to="/rankings" className="panel-link">See all</Link>
      </header>
      {rated.length > 1 && (
        <div className="chip-row" role="group" aria-label="Cuisine">
          <button type="button" className={cuisine === null ? "chip selected" : "chip"} aria-pressed={cuisine === null} onClick={() => setCuisine(null)}>All</button>
          {rated.map((option) => (
            <button key={option.id} type="button" className={cuisine === option.id ? "chip selected" : "chip"} aria-pressed={cuisine === option.id} onClick={() => setCuisine(option.id)}>
              {option.emoji} {option.label}
            </button>
          ))}
        </div>
      )}
      {top.length === 0 ? (
        <p className="panel-empty">Rated places will be ranked here.</p>
      ) : (
        <ol className="place-list">{top.map((summary, index) => <PlaceRow key={summary.place.id} summary={summary} rank={index + 1} />)}</ol>
      )}
    </section>
  );
}

function FriendFavorites() {
  const { places, session } = useGroupData();
  const favorites = friendFavorites(places, session.member.id).slice(0, FAVORITE_COUNT);
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Friends love, you haven't tried</h2>
      </header>
      {favorites.length === 0 ? (
        <p className="panel-empty">When a friend rates a place 8 or higher and you haven't been, it shows up here.</p>
      ) : (
        <ul className="place-list">{favorites.map((summary) => <PlaceRow key={summary.place.id} summary={summary} />)}</ul>
      )}
    </section>
  );
}

function MapPreview() {
  const { pins, here } = useGroupData();
  const navigate = useNavigate();
  return (
    <section className="panel map-panel">
      <header className="panel-head">
        <h2>On the map</h2>
        <Link to="/explore" className="panel-link">Explore <Icon name="arrow" size={14} /></Link>
      </header>
      <div className="map-preview">
        <FoodMap pins={pins} here={here} selectedPlaceId={null} preview onSelect={(placeId) => navigate(placeId ? `/explore?place=${placeId}` : "/explore")} />
      </div>
    </section>
  );
}

function Members() {
  const { session } = useGroupData();
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{session.members.length} in this group</h2>
        <Link to="/group" className="panel-link">Invite</Link>
      </header>
      <ul className="avatar-stack" aria-label="Members">
        {session.members.map((member) => (
          <li key={member.id} title={member.name}>
            <Link to={`/friends/${member.id}`} className="avatar-stack-link">
              <Avatar name={member.name} avatar={member.avatar} size={36} />
              <span>{member.id === session.member.id ? "You" : member.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The right-hand column of the home page: rankings, friends' favorites, the map, and who is here. */
export function DiscoverySidebar() {
  return (
    <>
      <TopPlaces />
      <FriendFavorites />
      <MapPreview />
      <Members />
    </>
  );
}
