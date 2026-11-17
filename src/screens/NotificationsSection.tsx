import { useEffect, useState } from "react";
import type { NotificationSettings } from "../../shared/types.js";
import * as api from "../api.js";
import type { NotificationState } from "../api.js";
import { deviceSubscription, thisDevicePushSupport, turnOffHere, turnOnHere } from "../push.js";

type DeviceState = "checking" | "off" | "on" | "blocked";

/** Turns phone notifications on or off for this device, and picks which kinds the account gets. */
export function NotificationsSection() {
  const support = thisDevicePushSupport();
  const [state, setState] = useState<NotificationState | null>(null);
  const [device, setDevice] = useState<DeviceState>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (support !== "supported") return;
    api.fetchNotificationState().then(setState, (failure: unknown) => {
      setError(failure instanceof Error ? failure.message : "Could not load your notification settings.");
    });
    void deviceSubscription().then((subscription) => {
      if (subscription) {
        setDevice("on");
        // Tells the server again, in case it forgot this device (for example after it was offline for long).
        void api.addNotificationDevice(subscription.toJSON()).catch(() => undefined);
      } else {
        setDevice(Notification.permission === "denied" ? "blocked" : "off");
      }
    });
  }, [support]);

  async function turnOn() {
    if (!state?.publicKey) return;
    setBusy(true);
    setError(null);
    try {
      const result = await turnOnHere(state.publicKey);
      setDevice(result === "on" ? "on" : "blocked");
      if (result === "on") setMessage("Notifications are on. You'll get one when a friend posts or reacts.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not turn on notifications.");
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      await turnOffHere();
      setDevice("off");
      setMessage("Notifications are off on this device.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not turn off notifications.");
    }
    setBusy(false);
  }

  async function change(settings: NotificationSettings) {
    if (!state) return;
    const before = state;
    setState({ ...state, ...settings });
    setError(null);
    try {
      await api.saveNotificationSettings(settings);
      setMessage("Saved.");
    } catch (failure) {
      setState(before);
      setError(failure instanceof Error ? failure.message : "Could not save that.");
    }
  }

  return (
    <section className="notifications-section" aria-labelledby="notifications-title">
      <h2 id="notifications-title" className="section-title">Notifications</h2>
      {support === "needs-home-screen" ? (
        <p>
          On iPhone, notifications work in the app on your Home Screen. In Safari, tap Share, then <b>Add to Home Screen</b>; open
          Food Map from there and turn notifications on here.
        </p>
      ) : support === "unsupported" ? (
        <p>This browser can't show notifications. Try Chrome, Safari, or the app on your Home Screen.</p>
      ) : state === null || device === "checking" ? (
        error ? <p className="error" role="alert">{error}</p> : <p className="muted">Checking…</p>
      ) : state.publicKey === null ? (
        <p>Notifications aren't set up on the server yet.</p>
      ) : device === "blocked" ? (
        <p>
          Notifications are blocked for Food Map. To allow them on iPhone, open Settings → Notifications → Food Map; in a browser, allow
          them in the site settings next to the address. Then come back here.
        </p>
      ) : device === "off" ? (
        <>
          <p>Get a notification when a friend posts a review or reacts to yours.</p>
          <button type="button" disabled={busy} onClick={() => void turnOn()}>{busy ? "Turning on…" : "Turn on notifications"}</button>
        </>
      ) : (
        <>
          <p className="notifications-on">✓ Notifications are on for this device.</p>
          <label className="check-row">
            <input type="checkbox" checked={state.newReviews} onChange={(event) => void change({ newReviews: event.target.checked, reactions: state.reactions })} />
            Friends' new reviews
          </label>
          <label className="check-row">
            <input type="checkbox" checked={state.reactions} onChange={(event) => void change({ newReviews: state.newReviews, reactions: event.target.checked })} />
            Reactions to my reviews
          </label>
          <button type="button" className="link" disabled={busy} onClick={() => void turnOff()}>Turn off on this device</button>
        </>
      )}
      {message && !error && <p className="muted" role="status">{message}</p>}
      {error && state !== null && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
