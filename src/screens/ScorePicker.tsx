import { MAX_RATING, MIN_RATING } from "../../shared/types.js";

const RATINGS = Array.from({ length: MAX_RATING - MIN_RATING + 1 }, (_, index) => MIN_RATING + index);

/** The 1 to 10 buttons for picking a score. */
export function ScorePicker({ value, onChange }: { value: number | null; onChange: (rating: number) => void }) {
  return (
    <div className="scores">
      {RATINGS.map((rating) => (
        <button key={rating} type="button" className={rating === value ? "score-option selected" : "score-option"} aria-pressed={rating === value} onClick={() => onChange(rating)}>
          {rating}
        </button>
      ))}
    </div>
  );
}
