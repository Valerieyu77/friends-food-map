/** How much a meal costs per person, from $ to $$$$. */
export const PRICE_LEVELS = [
  { level: 1, label: "$", range: "Under $15" },
  { level: 2, label: "$$", range: "$15–30" },
  { level: 3, label: "$$$", range: "$30–60" },
  { level: 4, label: "$$$$", range: "Over $60" },
] as const;

export const MIN_PRICE = 1;
export const MAX_PRICE = PRICE_LEVELS.length;

/** The most a typed price per person can be, in whole dollars. */
export const MAX_PRICE_AMOUNT = 999;

/** "$$" for 2. */
export function priceLabel(level: number): string {
  return "$".repeat(level);
}

/** The level a typed price falls in: $15 and $30 are "$$", $60 is "$$$". */
export function priceLevelFor(amount: number): number {
  if (amount < 15) return 1;
  if (amount <= 30) return 2;
  if (amount <= 60) return 3;
  return 4;
}

/** What a review says it cost: the typed price when there is one ("$23"), else the level ("$$"). */
export function priceText(entry: { price?: number; priceAmount?: number }): string | undefined {
  if (entry.priceAmount !== undefined) return `$${entry.priceAmount}`;
  return entry.price !== undefined ? priceLabel(entry.price) : undefined;
}
