import * as api from "./api.js";
import { currentSituation } from "./installTip.js";

/** Whether this device can get notifications: yes, only once added to the home screen (iPhone), or not at all. */
export type PushSupport = "supported" | "needs-home-screen" | "unsupported";

export function pushSupport(device: { hasPush: boolean; isIos: boolean; isStandalone: boolean }): PushSupport {
  // iPhone Safari has no notifications for web pages; the home-screen app does (iOS 16.4 and later).
  if (device.isIos && !device.isStandalone) return "needs-home-screen";
  return device.hasPush ? "supported" : "unsupported";
}

export function thisDevicePushSupport(): PushSupport {
  const { isIos, isStandalone } = currentSituation();
  const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return pushSupport({ hasPush, isIos, isStandalone });
}

/** The push key as bytes; it arrives as URL-safe base64 without padding. */
export function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const text = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(text.length));
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index);
  return bytes;
}

/** Starts the background script that shows notifications. Called once at startup. */
export function registerBackgroundScript(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
    console.error("The background script could not start:", error instanceof Error ? error.message : error);
  });
}

// How long to wait for the background script before saying notifications cannot start here.
const READY_TIMEOUT_MILLISECONDS = 10_000;

/** This device's notification subscription, if notifications are on here. Answers at once, even where the background script cannot run. */
export async function deviceSubscription(): Promise<PushSubscription | null> {
  if (thisDevicePushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** The running background script, started if needed; fails instead of waiting forever where it cannot run. */
async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const cannotStart = new Error("Notifications could not start on this device. Reload the page and try again.");
  await navigator.serviceWorker.register("/sw.js").catch(() => {
    throw cannotStart;
  });
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(cannotStart), READY_TIMEOUT_MILLISECONDS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Asks to allow notifications, then subscribes this device and tells the server. Must run straight from a tap,
 * or iPhone refuses to ask. Returns "denied" when the person said no now or before.
 */
export async function turnOnHere(publicKey: string): Promise<"on" | "denied"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const registration = await readyRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await api.addNotificationDevice(subscription.toJSON());
  return "on";
}

/** Stops notifications on this device, on the server and in the browser. */
export async function turnOffHere(): Promise<void> {
  const subscription = await deviceSubscription();
  if (!subscription) return;
  await api.removeNotificationDevice(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe();
}
