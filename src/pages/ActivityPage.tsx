import { useEffect, useState } from "react";
import { Link } from "react-router";
import { stickerUrl } from "../../shared/avatars.js";
import { REACTIONS } from "../../shared/reactions.js";
import { ACTIVITY_DAYS, isNew } from "../activity.js";
import { PlaceThumb } from "../feed/PlaceThumb.js";
import type { ActivityItem } from "../activity.js";
import { useGroupData } from "../groupData.js";
import { formatRating } from "../places.js";
import { Avatar } from "../screens/Avatar.js";
import { timeAgo } from "../time.js";

const SKELETON_ROWS = 4;

function ActivityRow({ item, fresh }: { item: ActivityItem; fresh: boolean }) {
  const { entry } = item;
  const who = item.kind === "rating" ? entry.member : item.reaction.member;
  const reaction = item.kind === "reaction" ? REACTIONS.find((candidate) => candidate.id === item.reaction.reaction) : undefined;
  return (
    <li>
      <Link to={`/places/${entry.place.id}`} className={fresh ? "activity-row new" : "activity-row"}>
        <span className="activity-dot" aria-hidden="true" />
        <Avatar name={who.name} avatar={who.avatar} size={44} />
        <span className="activity-text">
          {item.kind === "rating" ? (
            <span>
              <strong>{who.name}</strong> rated <strong>{entry.place.name}</strong> {formatRating(entry.rating)}/10
            </span>
          ) : (
            <span>
              <strong>{who.name}</strong> reacted{" "}
              {reaction && <img className="activity-sticker" src={stickerUrl(reaction.sticker)} alt={reaction.label} title={reaction.label} width={22} height={22} />}{" "}
              to your review of <strong>{entry.place.name}</strong>
            </span>
          )}
          <small>
            {fresh && <span className="new-label">New · </span>}
            {timeAgo(item.at)}
          </small>
        </span>
        <PlaceThumb photo={entry.photoUrls[0]} cuisine={entry.place.cuisine} size={48} />
      </Link>
    </li>
  );
}

function ActivityList({ items, seenAt }: { items: ActivityItem[]; seenAt: string | undefined }) {
  return (
    <ul className="activity-list">
      {items.map((item) => <ActivityRow key={item.id} item={item} fresh={isNew(item, seenAt)} />)}
    </ul>
  );
}

/** Friends' new ratings and reactions to your ratings. Opening it clears the bell's red dot. */
export function ActivityPage() {
  const { activity, activitySeenAt, newActivityCount, markActivitySeen, entries, loadError, reloadEntries } = useGroupData();
  // What counts as new is fixed when the page opens, so items stay marked while you read them.
  const [seenBefore] = useState(activitySeenAt);
  useEffect(() => {
    if (newActivityCount > 0) markActivitySeen();
  }, [newActivityCount, markActivitySeen]);

  const fresh = activity.filter((item) => isNew(item, seenBefore));
  const earlier = activity.filter((item) => !isNew(item, seenBefore));

  return (
    <div className="page-narrow">
      <header className="page-header">
        <h1 className="display">Activity</h1>
      </header>
      {loadError ? (
        <div className="state-card" role="alert">
          <p>{loadError}</p>
          <button type="button" className="button secondary" onClick={reloadEntries}>Try again</button>
        </div>
      ) : entries === null ? (
        <ul className="activity-list" aria-label="Loading">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => <li key={index} className="activity-row skeleton" />)}
        </ul>
      ) : activity.length === 0 ? (
        <div className="state-card">
          <img src={stickerUrl("glowing_star")} alt="" width={88} height={88} />
          <p className="state-title">Nothing yet</p>
          <p>When friends post a review or react to yours, it shows up here.</p>
          <Link to="/" className="button primary dark">Browse friends' picks</Link>
        </div>
      ) : (
        <>
          {fresh.length > 0 ? (
            <section className="activity-section" aria-labelledby="activity-new">
              <h2 id="activity-new" className="section-title">New</h2>
              <ActivityList items={fresh} seenAt={seenBefore} />
            </section>
          ) : (
            <p className="panel-empty">You're all caught up.</p>
          )}
          {earlier.length > 0 && (
            <section className="activity-section" aria-labelledby="activity-earlier">
              <h2 id="activity-earlier" className="section-title">Earlier</h2>
              <ActivityList items={earlier} seenAt={seenBefore} />
            </section>
          )}
          <p className="panel-empty">Showing the last {ACTIVITY_DAYS} days.</p>
        </>
      )}
    </div>
  );
}
