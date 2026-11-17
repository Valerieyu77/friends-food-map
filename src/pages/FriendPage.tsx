import { Link, useParams } from "react-router";
import { CardGrid } from "../feed/CardGrid.js";
import { PickCard, PlaceArt, pickCardHeight } from "../feed/PickCard.js";
import { latestRatings, tasteMatch, topRated } from "../friends.js";
import { useGroupData } from "../groupData.js";
import { Avatar } from "../screens/Avatar.js";
import { BackButton } from "../shell/BackButton.js";

const TOP_COUNT = 5;
// Pictures in the top 5 row are all this tall, in pixels, so the row lines up.
const TOP_ART_HEIGHT = 130;

/** A friend's page: who they are and how alike your tastes are, their top 5 to swipe through, then everything they rated. */
export function FriendPage() {
  const { memberId } = useParams();
  const { entries, loadError, reloadEntries, session } = useGroupData();

  if (loadError || entries === null) {
    return (
      <div className="page-narrow">
        <BackButton />
        {loadError ? (
          <div className="state-card" role="alert">
            <p>{loadError}</p>
            <button type="button" className="button secondary" onClick={reloadEntries}>Try again</button>
          </div>
        ) : (
          <div className="review-card skeleton" aria-label="Loading" />
        )}
      </div>
    );
  }

  // Someone who left is no longer a member but their ratings stay, so look in both.
  const friend =
    session.members.find((member) => member.id === memberId) ?? entries.find((entry) => entry.member.id === memberId)?.member;
  if (!friend) {
    return (
      <div className="page-narrow">
        <BackButton />
        <div className="state-card">
          <p className="state-title">Person not found</p>
          <p>They are not in {session.group.name}.</p>
          <Link to="/" className="button primary dark">Back to the feed</Link>
        </div>
      </div>
    );
  }

  const isMe = friend.id === session.member.id;
  const rated = latestRatings(entries, friend.id);
  const top = topRated(rated, TOP_COUNT);
  const match = isMe ? undefined : tasteMatch(entries, session.member.id, friend.id);

  return (
    <div className="page-narrow friend-page">
      <BackButton />
      <header className="friend-header">
        <Avatar name={friend.name} avatar={friend.avatar} size={88} />
        <div>
          <h1 className="display">{isMe ? `${friend.name} (you)` : friend.name}</h1>
          <p className="friend-stats">
            <span><b>{rated.length}</b> {rated.length === 1 ? "place" : "places"}</span>
            {match?.percent !== undefined && <span><b>{match.percent}%</b> taste match</span>}
          </p>
        </div>
      </header>

      {match && match.percent === undefined && (
        <p className="friend-note">
          {match.shared === 0
            ? `You and ${friend.name} haven't rated the same place yet. Rate two of the same places to see how alike your tastes are.`
            : `You've both rated 1 place. Once you share two, you'll see how alike your tastes are.`}
        </p>
      )}
      {match?.percent !== undefined && <p className="friend-note">Taste match comes from the {match.shared} places you both rated.</p>}

      {rated.length === 0 ? (
        <div className="state-card">
          <p className="state-title">No ratings yet</p>
          <p>{isMe ? "Places you rate show up here." : `When ${friend.name} rates a place, it shows up here.`}</p>
          {isMe && <Link to="/add" className="button primary dark">Add a review</Link>}
        </div>
      ) : (
        <>
          <section className="friend-section" aria-labelledby="friend-top">
            <h2 id="friend-top" className="section-title">{isMe ? "Your" : `${friend.name}'s`} top {top.length}</h2>
            <ol className="top-strip">
              {top.map((entry, index) => (
                <li key={entry.id}>
                  <Link to={`/places/${entry.place.id}`} className="pick-card top-card">
                    <PlaceArt photo={entry.photoUrls[0]} photoAlt={`${friend.name}'s photo at ${entry.place.name}`} cuisine={entry.place.cuisine} score={entry.rating} height={TOP_ART_HEIGHT}>
                      <span className="top-rank" aria-label={`Number ${index + 1}`}>{index + 1}</span>
                    </PlaceArt>
                    <span className="pick-text"><strong>{entry.place.name}</strong></span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
          <section className="friend-section" aria-labelledby="friend-all">
            <h2 id="friend-all" className="section-title">Everything {isMe ? "you" : friend.name} rated</h2>
            <CardGrid
              items={rated}
              keyOf={(entry) => entry.id}
              heightOf={pickCardHeight}
              render={(entry) => <PickCard entry={entry} myMemberId={session.member.id} showWho={false} />}
            />
          </section>
        </>
      )}
    </div>
  );
}
