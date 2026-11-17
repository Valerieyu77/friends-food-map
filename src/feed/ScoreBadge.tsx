import { formatRating } from "../places.js";

/** A score out of 10, or a group average. */
export function ScoreBadge({ score, label = "Score", size = "regular" }: { score: number; label?: string; size?: "regular" | "small" | "large" }) {
  return (
    <span className={`score-badge ${size}`} aria-label={`${label} ${formatRating(score)} out of 10`}>
      <b>{formatRating(score)}</b>
      <small>/10</small>
    </span>
  );
}
