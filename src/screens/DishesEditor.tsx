import { MAX_DISHES, MAX_DISH_NAME_LENGTH, MAX_RATING, MIN_RATING } from "../../shared/types.js";
import type { Dish } from "../../shared/types.js";
import { Icon } from "../shell/Icon.js";

/** A dish row being typed: the score is null until picked. */
export interface DishDraft {
  name: string;
  rating: number | null;
}

const RATINGS = Array.from({ length: MAX_RATING - MIN_RATING + 1 }, (_, index) => MIN_RATING + index);

export function draftsFrom(dishes: Dish[]): DishDraft[] {
  return dishes.map((dish) => ({ ...dish }));
}

/** The dishes to save, skipping untouched rows; throws a message to show when a row is half filled. */
export function finishDishes(drafts: DishDraft[]): Dish[] {
  const dishes: Dish[] = [];
  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name && draft.rating === null) continue;
    if (!name) throw new Error("Name each dish, or remove it.");
    if (draft.rating === null) throw new Error(`Give ${name} a score.`);
    dishes.push({ name, rating: draft.rating });
  }
  return dishes;
}

/** Optional rows of dish name and score, with a button to add another. */
export function DishesEditor({ drafts, onChange }: { drafts: DishDraft[]; onChange: (drafts: DishDraft[]) => void }) {
  const change = (index: number, update: Partial<DishDraft>) =>
    onChange(drafts.map((draft, position) => (position === index ? { ...draft, ...update } : draft)));

  return (
    <fieldset>
      <legend>Dishes <span className="optional">optional</span></legend>
      {drafts.length > 0 && (
        <ul className="dish-rows">
          {drafts.map((draft, index) => (
            <li key={index} className="dish-row">
              <input
                value={draft.name}
                onChange={(event) => change(index, { name: event.target.value })}
                maxLength={MAX_DISH_NAME_LENGTH}
                placeholder="Dish, like Mapo tofu"
                aria-label={`Dish ${index + 1} name`}
              />
              <select
                value={draft.rating ?? ""}
                onChange={(event) => change(index, { rating: event.target.value ? Number(event.target.value) : null })}
                aria-label={`Dish ${index + 1} score`}
              >
                <option value="">Score</option>
                {RATINGS.map((rating) => (
                  <option key={rating} value={rating}>{rating}/10</option>
                ))}
              </select>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove dish ${index + 1}`}
                onClick={() => onChange(drafts.filter((_, position) => position !== index))}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {drafts.length < MAX_DISHES && (
        <button type="button" className="text-action add-dish" onClick={() => onChange([...drafts, { name: "", rating: null }])}>
          <Icon name="plus" size={16} />
          Add a dish
        </button>
      )}
    </fieldset>
  );
}
