import { useState } from "react";
import type { FormEvent } from "react";
import * as api from "../api.js";
import { oldSignIns } from "../session.js";

type Mode = "login" | "signup" | "forgot";

interface AuthScreenProps {
  onSignedIn: (token: string) => void;
  /** Shown when someone opened an invite link before logging in. */
  joiningGroupName?: string;
}

export function AuthScreen({ onSignedIn, joiningGroupName }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setResetSent(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "forgot") {
        await api.sendPasswordReset(email);
        setResetSent(true);
      } else if (mode === "signup") {
        onSignedIn((await api.signUp({ name, email, password, oldTokens: oldSignIns() })).token);
      } else {
        onSignedIn((await api.logIn({ email, password, oldTokens: oldSignIns() })).token);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const heading = { signup: "Create your account", login: "Log in", forgot: "Reset your password" }[mode];
  const submitLabel = { signup: "Create account", login: "Log in", forgot: "Email me a reset link" }[mode];

  return (
    <main className="page">
      <h1>{heading}</h1>
      <p className="lead">
        {joiningGroupName
          ? `Log in or create an account to join “${joiningGroupName}”.`
          : "Rate restaurants with your friends. Only people you invite can see your ratings."}
      </p>
      <form onSubmit={submit} className="stack">
        {mode === "signup" && (
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="What your friends call you" maxLength={40} autoComplete="nickname" />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" />
        </label>
        {mode !== "forgot" && (
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : undefined}
            />
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {resetSent && (
          <p className="notice" role="status">If that email has an account, a reset link is on its way. Check your spam folder too.</p>
        )}
        <button type="submit" disabled={busy}>{busy ? "One moment…" : submitLabel}</button>
      </form>
      <div className="auth-links">
        {mode === "signup" && <button type="button" className="link" onClick={() => switchTo("login")}>Already have an account? Log in</button>}
        {mode === "login" && (
          <>
            <button type="button" className="link" onClick={() => switchTo("signup")}>New here? Create an account</button>
            <button type="button" className="link" onClick={() => switchTo("forgot")}>Forgot password?</button>
          </>
        )}
        {mode === "forgot" && <button type="button" className="link" onClick={() => switchTo("login")}>Back to log in</button>}
      </div>
    </main>
  );
}
