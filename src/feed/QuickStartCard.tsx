import { useState } from "react";
import { Link } from "react-router";
import { stickerUrl } from "../../shared/avatars.js";
import { useGroupData } from "../groupData.js";
import { QUICK_START_PLACES, dismissQuickStart, quickStartDismissed, shouldOfferQuickStart } from "../quickStart.js";
import { Icon } from "../shell/Icon.js";

/** On Home, for someone who has not rated anything in this group yet: a way to rate a few favorites in a minute. */
export function QuickStartCard() {
  const { entries, session } = useGroupData();
  const [dismissed, setDismissed] = useState(() => quickStartDismissed(session.group.id));
  if (!shouldOfferQuickStart(entries, session.member.id, dismissed)) return null;

  function close() {
    dismissQuickStart(session.group.id);
    setDismissed(true);
  }

  return (
    <section className="quick-start-card" aria-label="Get started">
      <img src={stickerUrl("smiling_face_with_heart_eyes")} alt="" width={52} height={52} />
      <div className="quick-start-text">
        <strong>Rate {QUICK_START_PLACES} places you love</strong>
        <span>Your friends in {session.group.name} see your taste right away. Takes about a minute.</span>
        <Link to="/quick-rate" className="button primary dark small">Start</Link>
      </div>
      <button type="button" className="icon-button quick-start-close" aria-label="Not now" onClick={close}>
        <Icon name="close" size={16} />
      </button>
    </section>
  );
}
