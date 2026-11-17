import { CUISINES } from "../shared/cuisines.js";
import type { CuisineId } from "../shared/cuisines.js";
import type { StickerId } from "../shared/avatars.js";

// The 3D sticker for each cuisine that has one in public/stickers; the rest show their plain emoji.
const CUISINE_STICKERS: Partial<Record<CuisineId, StickerId>> = {
  american: "hamburger",
  chinese: "dumpling",
  japanese: "sushi",
  thai: "hot_pepper",
  vietnamese: "steaming_bowl",
  indian: "curry_rice",
  mexican: "taco",
  italian: "spaghetti",
  cafe: "cupcake",
};

// Soft backgrounds for cards without a photo, taken in turn by cuisine.
const TINTS = ["#fce3d9", "#e4eedb", "#fde7c8", "#d9e8f5", "#eee3f5"];

export function cuisineSticker(cuisine: string | undefined): StickerId | undefined {
  return CUISINE_STICKERS[cuisine as CuisineId];
}

/** The same cuisine always gets the same tint; places with no cuisine are tinted as "Other". */
export function cuisineTint(cuisine: string | undefined): string {
  const index = CUISINES.findIndex((option) => option.id === (cuisine ?? "other"));
  return TINTS[Math.max(index, 0) % TINTS.length];
}
