import { Link } from "react-router";
import { stickerUrl } from "../../shared/avatars.js";
import { cuisineById } from "../../shared/cuisines.js";
import { CardGrid } from "../feed/CardGrid.js";
import { PlaceArt } from "../feed/PickCard.js";
import { PlaceThumb, firstPhoto } from "../feed/PlaceThumb.js";
import { SaveButton } from "../feed/SaveButton.js";
import { ScoreBadge } from "../feed/ScoreBadge.js";
import { useGroupData } from "../groupData.js";
import { formatRating } from "../places.js";
import type { PlaceSummary } from "../places.js";
import { splitSaved } from "../saved.js";
import type { BeenThere } from "../saved.js";
import { timeAgo } from "../time.js";

// Placeholder heights while loading, in pixels, like the home page.
const SKELETON_COLUMNS = [[300, 250], [250, 300]];
// Roughly how tall a card is, so the grid can keep its two columns level.
const PHOTO_CARD_HEIGHT = 360;
const TILE_CARD_HEIGHT = 300;

function WantToGoCard({ summary, myMemberId }: { summary: PlaceSummary; myMemberId: string }) {
  const { place } = summary;
  const cuisine = cuisineById(place.cuisine);
  const myEntry = summary.entries.find((entry) => entry.member.id === myMemberId);
  const count = summary.entries.length;
  return (
    <div className="pick-card saved-pick">
      <Link to={`/places/${place.id}`} className="saved-pick-link">
        <PlaceArt photo={firstPhoto(summary.entries)} photoAlt={`A friend's photo at ${place.name}`} cuisine={place.cuisine} score={summary.averageRating} scoreLabel="Group average" />
        <span className="pick-text">
          <strong>{place.name}</strong>
          <span className="meta">
            {[cuisine?.label, place.city].filter(Boolean).join(" · ")}
            {cuisine || place.city ? " · " : ""}
            {count} {count === 1 ? "rating" : "ratings"}
          </span>
          {myEntry && <span className="pick-by">You've been · {formatRating(myEntry.rating)}/10</span>}
        </span>
      </Link>
      <span className="saved-pick-corner">
        <SaveButton placeId={place.id} look="round" />
      </span>
      <Link to={`/add?place=${place.id}&from=saved`} className="button secondary small saved-pick-went">I went — rate it</Link>
    </div>
  );
}

function BeenThereRow({ item }: { item: BeenThere }) {
  const { summary, visit } = item;
  return (
    <li className="been-there-row">
      <Link to={`/places/${summary.place.id}`} className="place-row">
        <PlaceThumb photo={firstPhoto(summary.entries)} cuisine={summary.place.cuisine} size={56} />
        <span className="place-row-text">
          <strong>{summary.place.name}</strong>
          <small>You gave it {formatRating(visit.rating)} · {timeAgo(visit.createdAt)}</small>
        </span>
        <ScoreBadge score={visit.rating} label="Your score" size="small" />
      </Link>
      <SaveButton placeId={summary.place.id} look="icon" />
    </li>
  );
}

/** Your want-to-go list: places you saved from friends' reviews, and below them the ones you have been to since. */
export function SavedPage() {
  const { saved, entries, places, session } = useGroupData();
  const { wantToGo, beenThere } = splitSaved(saved ?? [], places, session.member.id);
  const loading = saved === null || entries === null;

  return (
    <div className="page-narrow">
      <header className="page-header">
        <h1 className="display">Want to go</h1>
        {!loading && (wantToGo.length > 0 || beenThere.length > 0) && (
          <p className="meta">
            {wantToGo.length} {wantToGo.length === 1 ? "place" : "places"} to try
            {beenThere.length > 0 && ` · ${beenThere.length} been there`}
          </p>
        )}
      </header>

      {loading ? (
        <div className="pick-grid" aria-label="Loading">
          {SKELETON_COLUMNS.map((heights, column) => (
            <div key={column} className="pick-column">
              {heights.map((height, index) => <div key={index} className="pick-card skeleton" style={{ height }} />)}
            </div>
          ))}
        </div>
      ) : wantToGo.length === 0 && beenThere.length === 0 ? (
        <div className="state-card">
          <img src={stickerUrl("face_savoring_food")} alt="" width={88} height={88} />
          <p className="state-title">Nothing saved yet</p>
          <p>When a friend's review makes you hungry, tap Want to go. The place waits for you here.</p>
          <Link to="/" className="button primary dark">Browse friends' picks</Link>
        </div>
      ) : (
        <>
          {wantToGo.length === 0 ? (
            <p className="panel-empty">You've been to every place on your list. Tap Want to go on a friend's review to add more.</p>
          ) : (
            <CardGrid
              items={wantToGo}
              keyOf={(summary) => summary.place.id}
              heightOf={(summary) => (firstPhoto(summary.entries) ? PHOTO_CARD_HEIGHT : TILE_CARD_HEIGHT)}
              render={(summary) => <WantToGoCard summary={summary} myMemberId={session.member.id} />}
            />
          )}
          {beenThere.length > 0 && (
            <section className="been-there-section" aria-labelledby="been-there-title">
              <h2 id="been-there-title" className="section-title">Been there</h2>
              <ul className="place-rows">
                {beenThere.map((item) => <BeenThereRow key={item.summary.place.id} item={item} />)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
