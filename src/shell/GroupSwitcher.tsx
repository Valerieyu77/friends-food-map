import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useGroupData } from "../groupData.js";
import { Icon } from "./Icon.js";

/** The open group's name; tap to switch groups, start one, or open its settings. */
export function GroupSwitcher() {
  const { account, session, switchGroup, newGroup } = useGroupData();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const count = session.members.length;
  return (
    <div className="group-switcher" ref={container}>
      <button type="button" className="group-switcher-button" aria-expanded={open} aria-label={`${session.group.name}, switch group`} onClick={() => setOpen((shown) => !shown)}>
        <span className="group-switcher-text">
          <strong>{session.group.name}</strong>
          <small>{count} {count === 1 ? "member" : "members"}</small>
        </span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="popover" role="menu">
          <p className="popover-label">Your groups</p>
          {account.groups.map((group) => {
            const isCurrent = group.id === session.group.id;
            return (
              <button
                key={group.id}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                className={isCurrent ? "popover-item current" : "popover-item"}
                onClick={() => (isCurrent ? setOpen(false) : switchGroup(group.id))}
              >
                <span>{group.name}</span>
                {isCurrent && <span aria-hidden="true">✓</span>}
              </button>
            );
          })}
          <div className="popover-divider" />
          <Link to="/group" role="menuitem" className="popover-item" onClick={() => setOpen(false)}>Group settings</Link>
          <button type="button" role="menuitem" className="popover-item" onClick={newGroup}>New group</button>
        </div>
      )}
    </div>
  );
}
