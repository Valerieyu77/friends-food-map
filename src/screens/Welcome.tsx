import { useState } from "react";
import type { FormEvent } from "react";
import * as api from "../api.js";

interface WelcomeProps {
  onCreated: (groupId: string) => void;
  /** Set when you are already in a group and came here to start another one. */
  onCancel?: () => void;
  onLogOut: () => void;
}

export function Welcome({ onCreated, onCancel, onLogOut }: WelcomeProps) {
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated((await api.createGroup(groupName)).group.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not create the group.");
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="top">
        <h1>New group</h1>
        {onCancel ? (
          <button type="button" className="link" onClick={onCancel}>Cancel</button>
        ) : (
          <button type="button" className="link" onClick={onLogOut}>Log out</button>
        )}
      </header>
      <p className="lead">Start a group for the friends whose ratings you trust, then send them the invite link.</p>
      <form onSubmit={submit} className="stack">
        <label>
          Group name
          <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Chicago trip crew" maxLength={60} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create group"}</button>
      </form>
      <p className="hint">Got an invite link from a friend? Open that link instead.</p>
    </main>
  );
}
