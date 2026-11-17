import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import type { GroupMember, Session } from "../../shared/types.js";
import * as api from "../api.js";
import { Avatar } from "./Avatar.js";
import { InviteLink } from "./InviteLink.js";

interface GroupSettingsProps {
  session: Session;
  onClose: () => void;
  /** Something about the group changed; reload it and show `notice`. */
  onChanged: (notice: string) => void;
  onLeft: (notice: string) => void;
}

const joinedOn = (member: GroupMember) =>
  new Date(member.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function GroupSettings({ session, onClose, onChanged, onLeft }: GroupSettingsProps) {
  const { group, member: me, members, ownerMemberId } = session;
  const isOwner = me.id === ownerMemberId;
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  function rename(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await api.renameGroup(newName);
      onChanged(`Renamed to ${newName.trim()}.`);
    });
  }

  function remove(member: GroupMember) {
    if (!window.confirm(`Remove ${member.name} from ${group.name}? Their ratings stay in the group.`)) return;
    void run(async () => {
      await api.removeMember(member.id);
      onChanged(`${member.name} was removed.`);
    });
  }

  function replaceInvite() {
    if (!window.confirm("Make a new invite link? The current link will stop working.")) return;
    void run(async () => {
      await api.newInviteLink();
      onChanged("New invite link ready. The old one no longer works.");
    });
  }

  function leave() {
    const nextOwner = isOwner ? members.find((member) => member.id !== me.id) : undefined;
    const message = [
      `Leave ${group.name}? Your ratings stay in the group, and you can come back with the invite link.`,
      nextOwner ? `${nextOwner.name} will become the owner.` : "",
    ].join(" ");
    if (!window.confirm(message.trim())) return;
    void run(async () => {
      await api.leaveGroup();
      onLeft(`You left ${group.name}.`);
    });
  }

  return (
    <div className="page stack">
      <header className="top">
        <h1>Group settings</h1>
        <button type="button" className="secondary" onClick={onClose}>Done</button>
      </header>

      {renaming ? (
        <form onSubmit={rename} className="stack">
          <label>
            Group name
            <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={60} />
          </label>
          <div className="row-buttons">
            <button type="submit" disabled={busy}>Save</button>
            <button type="button" className="secondary" onClick={() => setRenaming(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="settings-name">
          <h2>{group.name}</h2>
          {isOwner && <button type="button" className="link" onClick={() => setRenaming(true)}>Rename</button>}
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <section className="settings-card">
        <h2 className="menu-heading">{members.length} {members.length === 1 ? "person" : "people"}</h2>
        <ul className="settings-members">
          {members.map((member) => (
            <li key={member.id}>
              <Avatar name={member.name} avatar={member.avatar} size={36} />
              <span className="settings-member-name">
                <strong>
                  <Link to={`/friends/${member.id}`} className="person-link">{member.name}</Link>
                  {member.id === me.id && " (you)"}
                </strong>
                <small>
                  {member.id === ownerMemberId ? "Owner · " : ""}Joined {joinedOn(member)}
                </small>
              </span>
              {isOwner && member.id !== me.id && (
                <button type="button" className="link" disabled={busy} onClick={() => remove(member)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h2 className="menu-heading">Invite link</h2>
        <InviteLink inviteCode={group.inviteCode} groupName={group.name} />
        {isOwner && (
          <button type="button" className="link" disabled={busy} onClick={replaceInvite}>New invite link</button>
        )}
      </section>

      <button type="button" className="danger" disabled={busy} onClick={leave}>Leave group</button>
    </div>
  );
}
