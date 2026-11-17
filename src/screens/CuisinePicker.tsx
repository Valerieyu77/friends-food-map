import { CUISINES } from "../../shared/cuisines.js";
import type { CuisineId } from "../../shared/cuisines.js";

export function CuisinePicker({ value, onChange }: { value: CuisineId | null; onChange: (cuisine: CuisineId) => void }) {
  return (
    <div className="cuisines">
      {CUISINES.map((cuisine) => (
        <button
          key={cuisine.id}
          type="button"
          className={cuisine.id === value ? "cuisine-option selected" : "cuisine-option"}
          aria-pressed={cuisine.id === value}
          onClick={() => onChange(cuisine.id)}
        >
          <span className="cuisine-emoji" aria-hidden="true">{cuisine.emoji}</span>
          {cuisine.label}
        </button>
      ))}
    </div>
  );
}
