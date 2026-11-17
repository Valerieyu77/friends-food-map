import { useEffect, useState } from "react";
import type { JoinPreview, User } from "../../shared/types.js";
import * as api from "../api.js";

interface JoinGroupProps {
  code: string;
  user: User;
  onJoined: (groupId: string) => void;
}

export function JoinGroup({ code, user, onJoined }: JoinGroupProps) {
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.previewInvite(code).then(setPreview, (failure: unknown) => {
      setLoadError(failure instanceof Error ? failure.message : "Could not open this invite.");
    });
  }, [code]);

  async function run(action: () => Promise<{ group: { id: string } }>) {
    setBusy(true);
    setError(null);
    try {
      onJoined((await action()).group.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not join.");
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <main className="page stack">
        <h1>Friends Food Map</h1>
        <p className="error">{loadError} Ask your friend for a new link.</p>
        <a className="button-link" href="/">Open the app</a>
      </main>
    );
  }
  if (!preview) return <main className="page"><p>Loading…</p></main>;
  return (
    <main className="page stack">
      <h1>Join “{preview.groupName}”</h1>
      {preview.memberNames.length > 0 && <p className="lead">{preview.memberNames.join(", ")} {preview.memberNames.length === 1 ? "is" : "are"} already here.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void run(() => api.joinGroup(code))}>
        {busy ? "Joining…" : `Join as ${user.name}`}
      </button>
      {preview.unclaimedNames.length > 0 && (
        <section className="members-back">
          <p className="hint">Joined this group before accounts existed? Tap your old name to keep your ratings.</p>
          <div className="name-chips">
            {preview.unclaimedNames.map((name) => (
              <button key={name} type="button" className="secondary chip-button" disabled={busy} onClick={() => void run(() => api.claimName(code, name))}>
                I'm {name}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
