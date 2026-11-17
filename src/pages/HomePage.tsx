import { Link } from "react-router";
import { CardGrid } from "../feed/CardGrid.js";
import { DiscoverySidebar } from "../feed/Discovery.js";
import { FriendsRow } from "../feed/FriendsRow.js";
import { InstallTip } from "../feed/InstallTip.js";
import { PickCard, pickCardHeight } from "../feed/PickCard.js";
import { QuickStartCard } from "../feed/QuickStartCard.js";
import { useGroupData } from "../groupData.js";

// Placeholder heights while loading, in pixels, so the two columns look uneven like the real grid.
const SKELETON_COLUMNS = [[260, 220], [220, 260]];

export function HomePage() {
  const { session, entries, loadError, reloadEntries } = useGroupData();

  return (
    <div className="home-layout">
      <section className="feed" aria-label="Friends' reviews">
        <FriendsRow />

        <InstallTip />

        <QuickStartCard />

        <header className="feed-head">
          <h1>Friends' picks</h1>
          <Link to="/explore" className="panel-link">See map</Link>
        </header>

        {loadError ? (
          <div className="state-card" role="alert">
            <p>{loadError}</p>
            <button type="button" className="button secondary" onClick={reloadEntries}>Try again</button>
          </div>
        ) : entries === null ? (
          <div className="pick-grid" aria-hidden="true">
            {SKELETON_COLUMNS.map((heights, column) => (
              <div key={column} className="pick-column">
                {heights.map((height, index) => <div key={index} className="pick-card skeleton" style={{ height }} />)}
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="state-card">
            <p className="state-title">No reviews yet</p>
            <p>Rate a few places you love, then invite friends so their reviews show up here.</p>
            <div className="state-actions">
              <Link to="/quick-rate" className="button primary dark">Rate 3 places you love</Link>
              <Link to="/group" className="button secondary">Invite friends</Link>
            </div>
          </div>
        ) : (
          <CardGrid
            items={entries}
            keyOf={(entry) => entry.id}
            heightOf={pickCardHeight}
            render={(entry) => <PickCard entry={entry} myMemberId={session.member.id} />}
          />
        )}
      </section>

      <aside className="discovery" aria-label="Discover">
        <DiscoverySidebar />
      </aside>
    </div>
  );
}
