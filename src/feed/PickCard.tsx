import type { ReactNode } from "react";
import { Link } from "react-router";
import { stickerUrl } from "../../shared/avatars.js";
import { cuisineById } from "../../shared/cuisines.js";
import type { Entry } from "../../shared/types.js";
import { cuisineSticker, cuisineTint } from "../cuisineArt.js";
import { groupReactions } from "../reactionSummary.js";
import { Avatar } from "../screens/Avatar.js";
import { timeAgo } from "../time.js";
import { ScoreBadge } from "./ScoreBadge.js";

// Heights of the top part of a card, in pixels; the grid also uses them to keep its columns level.
const PHOTO_HEIGHT = 210;
const TILE_HEIGHT = 150;
// Roughly how tall the text under the picture is, with and without a note.
const TEXT_HEIGHT = 78;
const NOTE_HEIGHT = 22;

/** About how tall a card will be, so the grid can put the next one under the shorter column. */
export function pickCardHeight(entry: Entry): number {
  return (entry.photoUrls.length > 0 ? PHOTO_HEIGHT : TILE_HEIGHT) + TEXT_HEIGHT + (entry.note ? NOTE_HEIGHT : 0);
}

interface PlaceArtProps {
  photo: string | undefined;
  photoAlt: string;
  cuisine: string | undefined;
  score: number;
  scoreLabel?: string;
  /** The same height with or without a photo, for a row of small cards; otherwise photos get more room. */
  height?: number;
  /** Drawn on top of the picture, such as a button in its corner. */
  children?: ReactNode;
}

/** The top of a card: a photo, or the cuisine's sticker on its tint, with the score in a white pill. */
export function PlaceArt({ photo, photoAlt, cuisine, score, scoreLabel, height, children }: PlaceArtProps) {
  const sticker = cuisineSticker(cuisine);
  return (
    <div className="pick-art" style={photo ? { height: height ?? PHOTO_HEIGHT } : { height: height ?? TILE_HEIGHT, background: cuisineTint(cuisine) }}>
      {photo ? (
        <img src={photo} alt={photoAlt} className="pick-photo" loading="lazy" />
      ) : sticker ? (
        <img src={stickerUrl(sticker)} alt="" width={72} height={72} />
      ) : (
        <span className="pick-emoji" aria-hidden="true">{cuisineById(cuisine)?.emoji ?? "🍽️"}</span>
      )}
      <ScoreBadge score={score} label={scoreLabel} size="small" />
      {children}
    </div>
  );
}

interface PickCardProps {
  entry: Entry;
  myMemberId: string;
  /** False on a friend's own page, where every card is theirs. */
  showWho?: boolean;
}

/** One friend's rating as a card: the photo (or a cuisine sticker), the score, where, and who. Opens the place's page. */
export function PickCard({ entry, myMemberId, showWho = true }: PickCardProps) {
  const { place, member } = entry;
  const firstLine = entry.note?.split("\n")[0].trim();
  const reactions = groupReactions(entry.reactions, myMemberId).filter((group) => group.members.length > 0);

  return (
    <Link to={`/places/${place.id}`} className="pick-card">
      <PlaceArt photo={entry.photoUrls[0]} photoAlt={`${member.name}'s photo at ${place.name}`} cuisine={place.cuisine} score={entry.rating} />
      <div className="pick-text">
        <strong>{place.name}</strong>
        {firstLine ? <span className="pick-note">“{firstLine}”</span> : place.city && <span className="meta">{place.city}</span>}
        {showWho ? (
          <span className="pick-by">
            <Avatar name={member.name} avatar={member.avatar} size={20} />
            <span className="pick-by-name">{member.id === myMemberId ? "You" : member.name}</span>
            <span>· {timeAgo(entry.createdAt)}</span>
          </span>
        ) : (
          <span className="pick-by">{timeAgo(entry.createdAt)}</span>
        )}
        {reactions.length > 0 && (
          <span className="pick-reactions" aria-label={`${entry.reactions.length} ${entry.reactions.length === 1 ? "reaction" : "reactions"}`}>
            {reactions.map((group) => <img key={group.id} src={stickerUrl(group.sticker)} alt="" width={18} height={18} />)}
            <span aria-hidden="true">{entry.reactions.length}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
