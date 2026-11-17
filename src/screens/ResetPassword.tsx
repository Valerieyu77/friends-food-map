import { useState } from "react";
import type { FormEvent } from "react";
import * as api from "../api.js";

/** The reset email link lands here, with a one-time sign-in in the part of the address after "#". */
function linkDetails(): { accessToken: string | null; problem: string | null } {
  const parameters = new URLSearchParams(window.location.hash.slice(1));
  return { accessToken: parameters.get("access_token"), problem: parameters.get("error_description") };
}

export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [{ accessToken, problem }] = useState(linkDetails);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(accessToken, password);
      setChanged(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not change your password.");
    } finally {
      setBusy(false);
    }
  }

  if (changed) {
    return (
      <main className="page stack">
        <h1>Password changed</h1>
        <p className="lead">Log in with your new password.</p>
        <button type="button" onClick={onDone}>Go to log in</button>
      </main>
    );
  }
  if (!accessToken) {
    return (
      <main className="page stack">
        <h1>Reset your password</h1>
        <p className="error">{problem ?? "This reset link is not complete."} Ask for a new link from the log in page.</p>
        <button type="button" onClick={onDone}>Go to log in</button>
      </main>
    );
  }
  return (
    <main className="page">
      <h1>Choose a new password</h1>
      <form onSubmit={submit} className="stack">
        <label>
          New password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
      </form>
    </main>
  );
}
