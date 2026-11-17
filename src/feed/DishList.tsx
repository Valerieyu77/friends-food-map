import type { Dish } from "../../shared/types.js";

/** The dishes in one review, each with its score. */
export function DishList({ dishes }: { dishes: Dish[] }) {
  if (dishes.length === 0) return null;
  return (
    <ul className="dish-list" aria-label="Dishes">
      {dishes.map((dish, index) => (
        <li key={index}>
          <span className="dish-name">{dish.name}</span>
          <span className="dish-score">{dish.rating}<small>/10</small></span>
        </li>
      ))}
    </ul>
  );
}
