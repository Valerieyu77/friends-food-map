import type { StickerId } from "./avatars.js";

/**
 * The reactions a friend can leave on a rating, each shown as a Fluent Emoji 3D sticker in the app,
 * and as the plain emoji in phone notifications, which cannot show pictures inline.
 */
export const REACTIONS = [
  { id: "yum", sticker: "face_savoring_food", emoji: "😋", label: "Looks delicious" },
  { id: "fire", sticker: "fire", emoji: "🔥", label: "Must try" },
  { id: "love", sticker: "smiling_face_with_heart_eyes", emoji: "😍", label: "Love it" },
  { id: "wow", sticker: "star_struck", emoji: "🤩", label: "Wow" },
  { id: "haha", sticker: "grinning_squinting_face", emoji: "😆", label: "Haha" },
] as const satisfies readonly { id: string; sticker: StickerId; emoji: string; label: string }[];

export type ReactionId = (typeof REACTIONS)[number]["id"];

export function isReactionId(value: unknown): value is ReactionId {
  return REACTIONS.some((reaction) => reaction.id === value);
}
