import { useState } from "react";
import { Link } from "react-router";
import { cuisineById } from "../../shared/cuisines.js";
import type { Entry } from "../../shared/types.js";
import { Avatar } from "../screens/Avatar.js";
import { Icon } from "../shell/Icon.js";
import { scoreChange } from "../friends.js";
import { useGroupData } from "../groupData.js";
import { entryFacts } from "../places.js";
import { timeAgo } from "../time.js";
import { DishList } from "./DishList.js";
import { EditEntryForm } from "./EditEntryForm.js";
import { PhotoStrip } from "./PhotoStrip.js";
import { ReactionBar } from "./ReactionBar.js";
import { SaveButton } from "./SaveButton.js";
import { ScoreBadge } from "./ScoreBadge.js";

interface ReviewCardProps {
  entry: Entry;
  isMine: boolean;
  onDelete: (entry: Entry) => void;
  /** False on the place's own page, where the place is already the heading. */
  showPlace?: boolean;
  /** False when the photo is already shown bigger above, on the place's page. */
  showPhoto?: boolean;
}

/** One friend's rating: who, where, the score, and the photo when there is one. */
export function ReviewCard({ entry, isMine, onDelete, showPlace = true, showPhoto = true }: ReviewCardProps) {
  const { place, member } = entry;
  const cuisine = cuisineById(place.cuisine);
  const where = [place.address, place.city].filter(Boolean).join(", ");
  // Places typed by hand have no coordinates, so they are not on the map.
  const mapLink = place.lat !== undefined && place.lon !== undefined ? `/explore?place=${place.id}` : undefined;
  const [editing, setEditing] = useState(false);
  const facts = entryFacts(entry);
  const { entries } = useGroupData();
  const change = scoreChange(entries ?? [], entry);

  return (
    <article className="review-card">
      <header className="review-head">
        <Link to={`/friends/${member.id}`} className="avatar-link" aria-label={`${member.name}'s page`}>
          <Avatar name={member.name} avatar={member.avatar} size={40} />
        </Link>
        <div className="review-who">
          <Link to={`/friends/${member.id}`} className="person-link"><strong>{member.name}</strong></Link>
          <span className="meta">
            {timeAgo(entry.createdAt)}
            {entry.editedAt && " · edited"}
            {cuisine && ` · ${cuisine.label}`}
          </span>
        </div>
        <ScoreBadge score={entry.rating} />
      </header>

      {showPhoto && <PhotoStrip urls={entry.photoUrls} alt={`${member.name}'s photo at ${place.name}`} className="review-photo" />}

      {showPlace && (
        <div className="review-place-row">
          {entry.photoUrls.length === 0 && (
            <span className="cuisine-tile" aria-hidden="true">{cuisine?.emoji ?? "🍽️"}</span>
          )}
          <div className="review-place">
            <h2><Link to={`/places/${place.id}`}>{place.name}</Link></h2>
            {where && <p className="meta">{where}</p>}
          </div>
        </div>
      )}

      {editing ? (
        <EditEntryForm entry={entry} onDone={() => setEditing(false)} />
      ) : (
        <>
          {change && <p className="score-change">{change}</p>}
          {facts && <p className="review-facts">{facts}</p>}
          <DishList dishes={entry.dishes} />
          {entry.note && <p className="review-note">{entry.note}</p>}
          <ReactionBar entry={entry} />
        </>
      )}

      {!editing && (showPlace || isMine) && (
        <footer className="review-actions">
          {showPlace && !isMine && <SaveButton placeId={place.id} />}
          {showPlace && mapLink && (
            <Link to={mapLink} className="text-action">
              <Icon name="pin" size={16} />
              View on map
            </Link>
          )}
          {isMine && (
            <>
              <button type="button" className="text-action subtle" onClick={() => setEditing(true)}>Edit</button>
              <button type="button" className="text-action subtle" onClick={() => onDelete(entry)}>Delete</button>
            </>
          )}
        </footer>
      )}
    </article>
  );
}
