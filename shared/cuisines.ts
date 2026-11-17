/** The cuisines a place can be sorted under, so the group can rank its favorite of each kind. */
export const CUISINES = [
  { id: "american", label: "American", emoji: "🍔" },
  { id: "chinese", label: "Chinese", emoji: "🥟" },
  { id: "japanese", label: "Japanese", emoji: "🍣" },
  { id: "korean", label: "Korean", emoji: "🍲" },
  { id: "thai", label: "Thai", emoji: "🌶️" },
  { id: "vietnamese", label: "Vietnamese", emoji: "🍜" },
  { id: "indian", label: "Indian", emoji: "🍛" },
  { id: "mexican", label: "Mexican", emoji: "🌮" },
  { id: "italian", label: "Italian", emoji: "🍝" },
  { id: "mediterranean", label: "Mediterranean", emoji: "🥙" },
  { id: "cafe", label: "Cafe & Dessert", emoji: "🧁" },
  { id: "other", label: "Other", emoji: "🍽️" },
] as const;

export type CuisineId = (typeof CUISINES)[number]["id"];

export function isCuisineId(value: unknown): value is CuisineId {
  return CUISINES.some((cuisine) => cuisine.id === value);
}

export function cuisineById(id: string | undefined) {
  return CUISINES.find((cuisine) => cuisine.id === id);
}
