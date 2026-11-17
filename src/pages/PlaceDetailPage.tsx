import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { stickerUrl } from "../../shared/avatars.js";
import { cuisineById } from "../../shared/cuisines.js";
import { formatMiles, milesBetween } from "../../shared/distance.js";
import { priceLabel } from "../../shared/prices.js";
import type { Entry } from "../../shared/types.js";
import { cuisineSticker, cuisineTint } from "../cuisineArt.js";
import { PhotoStrip } from "../feed/PhotoStrip.js";
import { ReviewCard } from "../feed/ReviewCard.js";
import { SaveButton } from "../feed/SaveButton.js";
import { ScoreBadge } from "../feed/ScoreBadge.js";
import { useGroupData } from "../groupData.js";
import { previousRating } from "../friends.js";
import { placeDetails, placeDishes, pinsFromPlaces } from "../places.js";
import { Avatar } from "../screens/Avatar.js";
import { CuisinePicker } from "../screens/CuisinePicker.js";
import { FoodMap } from "../screens/FoodMap.js";
import { BackButton } from "../shell/BackButton.js";
import { Icon } from "../shell/Icon.js";

// The most photos to swipe through at the top; the rest stay with their reviews.
const HERO_PHOTOS = 10;

/** Everything the group knows about one place: photos, scores, reviews, who wants to go, and where it is. */
export function PlaceDetailPage() {
  const { placeId } = useParams();
  const { places, entries, loadError, reloadEntries, session, here, removeEntry, setPlaceCuisine, notify, wantToGoBy } = useGroupData();
  const navigate = useNavigate();
  const [pickingCuisine, setPickingCuisine] = useState(false);

  const backButton = <BackButton />;

  if (loadError || entries === null) {
    return (
      <div className="page-narrow">
        {backButton}
        {loadError ? (
          <div className="state-card" role="alert">
            <p>{loadError}</p>
            <button type="button" className="button secondary" onClick={reloadEntries}>Try again</button>
          </div>
        ) : (
          <div className="review-card skeleton" aria-label="Loading" />
        )}
      </div>
    );
  }

  const summary = places.find((candidate) => candidate.place.id === placeId);
  if (!summary) {
    return (
      <div className="page-narrow">
        {backButton}
        <div className="state-card">
          <p className="state-title">Place not found</p>
          <p>Nobody in {session.group.name} has rated this place, or its reviews were deleted.</p>
          <Link to="/" className="button primary">Back to the feed</Link>
        </div>
      </div>
    );
  }

  const { place } = summary;
  const cuisine = cuisineById(place.cuisine);
  const heroUrls = summary.entries.flatMap((entry) => entry.photoUrls).slice(0, HERO_PHOTOS);
  const sticker = cuisineSticker(place.cuisine);
  const [pin] = pinsFromPlaces([summary]);
  const distance = pin && here ? formatMiles(milesBetween(here, pin.place)) : undefined;
  const ratedByMe = summary.entries.some((entry) => entry.member.id === session.member.id);
  const wantToGo = wantToGoBy(place.id);
  const iWantToGo = wantToGo.some((member) => member.id === session.member.id);
  const count = summary.entries.length;
  const details = placeDetails(summary);
  const dishes = placeDishes(summary);
  // One row per friend in Friends' scores: their newest score, with the one before it when they came back.
  const newestPerFriend = summary.entries.filter(
    (entry, index) => summary.entries.findIndex((other) => other.member.id === entry.member.id) === index,
  );

  function remove(entry: Entry) {
    if (window.confirm(`Delete your review of ${entry.place.name}?`)) void removeEntry(entry);
  }

  return (
    <div className="detail-layout">
      <div className="detail-main">
        <div
          className={heroUrls.length > 0 ? "detail-hero" : "detail-hero tile"}
          style={heroUrls.length > 0 ? undefined : { background: cuisineTint(place.cuisine) }}
        >
          {heroUrls.length > 0 ? (
            <PhotoStrip urls={heroUrls} alt={`Friends' photo at ${place.name}`} className="detail-hero-photo" />
          ) : sticker ? (
            <img src={stickerUrl(sticker)} alt="" width={120} height={120} />
          ) : (
            <span className="detail-hero-emoji" aria-hidden="true">{cuisine?.emoji ?? "🍽️"}</span>
          )}
          <div className="hero-buttons">
            <BackButton look="round" />
          </div>
        </div>

        <header className="detail-header">
          <h1 className="display">{place.name}</h1>
          <div className="detail-score">
            <ScoreBadge score={summary.averageRating} label="Group average" size="large" />
            <small>{count} {count === 1 ? "rating" : "ratings"}</small>
          </div>
          <p className="meta detail-where">
            {[place.address, place.city].filter(Boolean).join(", ")}
            {distance && ` · ${distance} away`}
          </p>
        </header>

        <div className="detail-tags">
          <button type="button" className="chip" aria-expanded={pickingCuisine} onClick={() => setPickingCuisine((shown) => !shown)}>
            {cuisine ? `${cuisine.emoji} ${cuisine.label}` : "+ Add the kind of food"}
          </button>
          {details.averageAmount !== undefined ? (
            <span className="detail-fact" title="The average of the prices friends typed">About ${details.averageAmount} per person</span>
          ) : details.price !== undefined && (
            <span className="detail-fact" title="The price friends picked most">{priceLabel(details.price)} per person</span>
          )}
          {details.answered > 0 && (
            <span className="detail-fact">
              {details.wouldReturn} of {details.answered} would go again
            </span>
          )}
        </div>
        {pickingCuisine && (
          <CuisinePicker
            value={place.cuisine ?? null}
            onChange={(chosen) => {
              setPlaceCuisine(place.id, chosen).then(
                () => setPickingCuisine(false),
                (failure: unknown) => notify(failure instanceof Error ? failure.message : "Could not save the cuisine."),
              );
            }}
          />
        )}

        <div className="detail-actions">
          <Link to={`/add?place=${place.id}`} className="button primary dark">
            {iWantToGo ? "I went — rate it" : ratedByMe ? "Rate again" : "Add your review"}
          </Link>
          <SaveButton placeId={place.id} look="button" />
          {pin && (
            <Link to={`/explore?place=${place.id}`} className="button secondary">
              <Icon name="pin" size={16} />
              Map
            </Link>
          )}
        </div>

        <section className="detail-friends" aria-labelledby="detail-friends-title">
          <h2 id="detail-friends-title" className="section-title">Friends' scores</h2>
          <ul className="score-faces">
            {newestPerFriend.map((entry) => {
              const before = previousRating(summary.entries, entry);
              return (
                <li key={entry.id}>
                  <Link to={`/friends/${entry.member.id}`} className="score-face">
                    <Avatar name={entry.member.name} avatar={entry.member.avatar} size={50} />
                    <span className="bubble-name">{entry.member.id === session.member.id ? "You" : entry.member.name}</span>
                    <ScoreBadge score={entry.rating} size="small" />
                    {before !== undefined && <small className="was-score">was {before}</small>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {dishes.length > 0 && (
          <section className="detail-dishes" aria-labelledby="detail-dishes-title">
            <h2 id="detail-dishes-title" className="section-title">Dishes friends tried</h2>
            <ul className="place-dishes">
              {dishes.map((dish) => (
                <li key={dish.name}>
                  <span className="place-dish-text">
                    <strong>{dish.name}</strong>
                    <small>
                      {dish.members.map((member) => (member.id === session.member.id ? "You" : member.name)).join(", ")}
                    </small>
                  </span>
                  <span className="place-dish-faces" aria-hidden="true">
                    {dish.members.slice(0, 3).map((member) => (
                      <Avatar key={member.id} name={member.name} avatar={member.avatar} size={24} />
                    ))}
                  </span>
                  <ScoreBadge score={dish.averageRating} label={dish.members.length > 1 ? "Average score" : "Score"} size="small" />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="detail-reviews" aria-labelledby="detail-reviews-title">
          <h2 id="detail-reviews-title" className="section-title">What friends said</h2>
          {summary.entries.map((entry) => (
            <ReviewCard
              key={entry.id}
              entry={entry}
              isMine={entry.member.id === session.member.id}
              onDelete={remove}
              showPlace={false}
              showPhoto={entry.photoUrls.some((url) => !heroUrls.includes(url))}
            />
          ))}
        </section>
      </div>

      <aside className="detail-side" aria-label="About this place">
        <section className="panel">
          <header className="panel-head">
            <h2>Want to go</h2>
          </header>
          {wantToGo.length === 0 ? (
            <p className="panel-empty">Nobody wants to go yet. Tap Want to go to keep it on your list.</p>
          ) : (
            <ul className="avatar-stack" aria-label="People who want to go">
              {wantToGo.map((member) => (
                <li key={member.id} title={member.name}>
                  <Link to={`/friends/${member.id}`} className="avatar-stack-link">
                    <Avatar name={member.name} avatar={member.avatar} size={36} />
                    <span>{member.id === session.member.id ? "You" : member.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {pin && (
          <section className="panel map-panel">
            <header className="panel-head">
              <h2>Where it is</h2>
              <Link to={`/explore?place=${place.id}`} className="panel-link">Open map <Icon name="arrow" size={14} /></Link>
            </header>
            <div className="map-preview">
              <FoodMap pins={[pin]} here={undefined} selectedPlaceId={null} preview onSelect={() => navigate(`/explore?place=${place.id}`)} />
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
