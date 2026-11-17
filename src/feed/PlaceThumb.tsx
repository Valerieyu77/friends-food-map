import { stickerUrl } from "../../shared/avatars.js";
import { cuisineById } from "../../shared/cuisines.js";
import type { Entry } from "../../shared/types.js";
import { cuisineSticker, cuisineTint } from "../cuisineArt.js";

/** The first photo among some ratings, if any has one. */
export function firstPhoto(entries: Entry[]): string | undefined {
  return entries.find((entry) => entry.photoUrls.length > 0)?.photoUrls[0];
}

/** A small square for a place in a list: a friend's photo, or its cuisine's sticker on the same tint as its home card. */
export function PlaceThumb({ photo, cuisine, size }: { photo: string | undefined; cuisine: string | undefined; size: number }) {
  if (photo) return <img className="place-thumb" src={photo} alt="" width={size} height={size} loading="lazy" />;
  const sticker = cuisineSticker(cuisine);
  return (
    <span className="place-thumb" style={{ width: size, height: size, background: cuisineTint(cuisine) }} aria-hidden="true">
      {sticker ? (
        <img src={stickerUrl(sticker)} alt="" width={size * 0.62} height={size * 0.62} />
      ) : (
        <span style={{ fontSize: size * 0.45 }}>{cuisineById(cuisine)?.emoji ?? "🍽️"}</span>
      )}
    </span>
  );
}
