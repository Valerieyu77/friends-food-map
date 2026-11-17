/**
 * Avatars: a Fluent Emoji 3D sticker (Microsoft, MIT license; images in public/stickers),
 * or the first letter of your name on a colored circle.
 * Stored on the account as "sticker:<id>" or "color:<id>".
 */
export const STICKER_GROUPS = [
  {
    id: "food",
    label: "Food",
    stickers: [
      "steaming_bowl", "sushi", "dumpling", "hamburger", "pizza", "taco", "spaghetti", "dango", "rice_ball",
      "curry_rice", "bento_box", "fried_shrimp", "croissant", "pancakes", "doughnut", "shortcake", "cupcake",
      "soft_ice_cream", "cookie", "strawberry", "peach", "avocado", "hot_pepper", "watermelon",
    ],
  },
  {
    id: "drinks",
    label: "Drinks",
    stickers: [
      "bubble_tea", "hot_beverage", "teacup_without_handle", "tropical_drink", "glass_of_milk", "beer_mug",
      "cocktail_glass", "wine_glass",
    ],
  },
  {
    id: "animals",
    label: "Animals",
    stickers: [
      "cat_face", "dog_face", "panda", "fox", "frog", "penguin", "rabbit_face", "hamster", "bear", "koala",
      "tiger_face", "monkey_face", "baby_chick", "unicorn", "octopus", "spouting_whale", "turtle", "hedgehog",
    ],
  },
  {
    id: "faces",
    label: "Faces",
    stickers: [
      "smiling_face_with_heart_eyes", "face_savoring_food", "partying_face", "smiling_face_with_sunglasses",
      "star_struck", "grinning_squinting_face", "winking_face_with_tongue", "ghost", "alien", "robot",
    ],
  },
  {
    id: "more",
    label: "More",
    stickers: [
      "cherry_blossom", "sunflower", "four_leaf_clover", "cactus", "rainbow", "glowing_star", "sun_with_face",
      "crescent_moon", "fire", "sparkles", "balloon", "crown", "red_heart", "airplane",
    ],
  },
] as const;

// Soft tones that sit with the app's warm neutrals; ids are stored on accounts, so they stay fixed.
export const AVATAR_COLORS = [
  { id: "orange", hex: "#f4c3b5" },
  { id: "sage", hex: "#d7dcc4" },
  { id: "sky", hex: "#cfdbe3" },
  { id: "peach", hex: "#f3dccb" },
  { id: "pink", hex: "#efccd3" },
  { id: "lavender", hex: "#dcd3e6" },
  { id: "mint", hex: "#cfe0d6" },
  { id: "butter", hex: "#efe2bf" },
] as const;

export type StickerId = (typeof STICKER_GROUPS)[number]["stickers"][number];
export type AvatarColorId = (typeof AVATAR_COLORS)[number]["id"];
export type Avatar = { kind: "sticker"; sticker: StickerId } | { kind: "color"; color: AvatarColorId };

const STICKER_IDS: ReadonlySet<string> = new Set(STICKER_GROUPS.flatMap((group) => group.stickers));
const COLOR_IDS: ReadonlySet<string> = new Set(AVATAR_COLORS.map((color) => color.id));

/** Reads a stored avatar; anything unknown counts as no avatar. */
export function parseAvatar(value: unknown): Avatar | undefined {
  if (typeof value !== "string") return undefined;
  const [kind, id] = value.split(":");
  if (kind === "sticker" && STICKER_IDS.has(id)) return { kind, sticker: id as StickerId };
  if (kind === "color" && COLOR_IDS.has(id)) return { kind, color: id as AvatarColorId };
  return undefined;
}

export function avatarText(avatar: Avatar): string {
  return avatar.kind === "sticker" ? `sticker:${avatar.sticker}` : `color:${avatar.color}`;
}

export function stickerUrl(sticker: StickerId): string {
  return `/stickers/${sticker}.png`;
}

export function colorHex(color: AvatarColorId): string {
  return AVATAR_COLORS.find((candidate) => candidate.id === color)!.hex;
}
