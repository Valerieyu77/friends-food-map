import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useGroupData } from "../groupData.js";
import { Avatar } from "../screens/Avatar.js";
import { GroupSwitcher } from "./GroupSwitcher.js";
import { Icon } from "./Icon.js";
import type { IconName } from "./Icon.js";

const SECTIONS: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/activity", label: "Activity", icon: "bell" },
  { to: "/explore", label: "Explore", icon: "map" },
  { to: "/rankings", label: "Rankings", icon: "trophy" },
  { to: "/saved", label: "Saved", icon: "bookmark" },
  { to: "/group", label: "Group", icon: "users" },
];

/** Shown on the bell; more than this reads as "9+". */
const MAX_COUNT_SHOWN = 9;

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? "nav-item active" : "nav-item");

/** Left navigation on wide screens; a top bar and bottom tabs on phones. */
export function AppShell() {
  const { account, notice, newActivityCount } = useGroupData();
  const countText = newActivityCount > MAX_COUNT_SHOWN ? `${MAX_COUNT_SHOWN}+` : String(newActivityCount);
  const activityLabel = newActivityCount > 0 ? `Activity, ${newActivityCount} new` : "Activity";
  const { pathname } = useLocation();
  // A new page starts at its top, not where the last page was scrolled. Only the path counts, so
  // choosing a place on the Explore map (which changes ?place=) does not jump.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="shell">
      <aside className="side-nav" aria-label="Main">
        <NavLink to="/" className="brand">Friends Food Map</NavLink>
        <GroupSwitcher />
        <nav className="nav-list">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.to === "/"}
              className={navClass}
              aria-label={section.to === "/activity" ? activityLabel : undefined}
            >
              <Icon name={section.icon} />
              {section.label}
              {section.to === "/activity" && newActivityCount > 0 && <span className="nav-count">{countText}</span>}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/add" className="button primary nav-add">
          <Icon name="plus" size={18} />
          Add review
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? "nav-profile active" : "nav-profile")}>
          <Avatar name={account.user.name} avatar={account.user.avatar} size={32} />
          <span>
            <strong>{account.user.name}</strong>
            <small>Profile</small>
          </span>
        </NavLink>
      </aside>

      <header className="top-bar">
        <GroupSwitcher />
        <div className="top-bar-actions">
          <NavLink to="/activity" className="bell-link" aria-label={activityLabel}>
            <Icon name="bell" size={24} />
            {newActivityCount > 0 && <span className="bell-dot" aria-hidden="true" />}
          </NavLink>
          <NavLink to="/profile" aria-label="Profile">
            <Avatar name={account.user.name} avatar={account.user.avatar} size={34} />
          </NavLink>
        </div>
      </header>

      <main className="shell-main">
        <Outlet />
      </main>

      <nav className="tab-bar" aria-label="Main">
        <NavLink to="/" end className={navClass}><Icon name="home" /><span>Home</span></NavLink>
        <NavLink to="/explore" className={navClass}><Icon name="map" /><span>Explore</span></NavLink>
        <NavLink to="/add" className="tab-add" aria-label="Add review"><Icon name="plus" size={24} /></NavLink>
        <NavLink to="/rankings" className={navClass}><Icon name="trophy" /><span>Rankings</span></NavLink>
        {/* Phones reach the group page from the group menu at the top. */}
        <NavLink to="/saved" className={navClass}><Icon name="bookmark" /><span>Saved</span></NavLink>
      </nav>

      {notice && <p className="toast" role="status">{notice}</p>}
    </div>
  );
}
