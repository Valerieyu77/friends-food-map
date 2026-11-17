import { useGroupData } from "../groupData.js";
import { Icon } from "../shell/Icon.js";

const LOOKS = {
  text: "text-action save-button",
  button: "button secondary save-button",
  icon: "icon-button save-button",
  round: "hero-button save-button",
};

/**
 * Adds a place to your want-to-go list, or takes it off. It reads "Been there" once you have rated a
 * place you saved. The icon look is for lists of saved places; the round look sits on a card's picture.
 */
export function SaveButton({ placeId, look = "text" }: { placeId: string; look?: keyof typeof LOOKS }) {
  const { isSaved, toggleSaved, wantToGoBy, session } = useGroupData();
  const saved = isSaved(placeId);
  const beenThere = saved && !wantToGoBy(placeId).some((member) => member.id === session.member.id);
  const label = beenThere ? "Been there" : saved ? "Saved" : "Want to go";
  const iconOnly = look === "icon" || look === "round";
  return (
    <button
      type="button"
      className={saved ? `${LOOKS[look]} saved` : LOOKS[look]}
      aria-pressed={saved}
      aria-label={iconOnly ? (saved ? `${label}. Tap to remove from your list` : "Want to go") : undefined}
      title={iconOnly ? (saved ? "Remove from your list" : "Want to go") : undefined}
      onClick={() => toggleSaved(placeId)}
    >
      <Icon name="bookmark" size={iconOnly ? 18 : 16} />
      {!iconOnly && label}
    </button>
  );
}
