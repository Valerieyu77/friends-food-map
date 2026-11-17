import webpush from "web-push";
import type { PushSubscriptionInput } from "../shared/types.js";
import type { PushMessage } from "./pushMessages.js";

// A notification nobody's phone picked up within a day is old news.
const TIME_TO_LIVE_SECONDS = 24 * 60 * 60;
// Sending happens before the request answers (Vercel may stop the function after), so a slow phone service must not hold it up.
const SEND_TIMEOUT_MILLISECONDS = 5000;

/** Sends phone notifications. */
export interface Notifier {
  /** The key browsers need to subscribe; undefined when notifications are not set up. */
  publicKey: string | undefined;
  /** Sends to each device and returns the devices that no longer exist (turned off, app deleted), to forget them. */
  send(subscriptions: PushSubscriptionInput[], message: PushMessage): Promise<string[]>;
}

/** Used when the push keys are not set, such as in tests: nothing is sent. */
export const silentNotifier: Notifier = { publicKey: undefined, send: async () => [] };

/** Sends through each browser's own push service (Apple, Google, Mozilla), signed with this app's keys. */
export function createWebPushNotifier(publicKey: string, privateKey: string, contact: string): Notifier {
  webpush.setVapidDetails(contact, publicKey, privateKey);
  return {
    publicKey,
    async send(subscriptions, message) {
      const results = await Promise.allSettled(
        subscriptions.map((subscription) =>
          webpush.sendNotification(subscription, JSON.stringify(message), { TTL: TIME_TO_LIVE_SECONDS, timeout: SEND_TIMEOUT_MILLISECONDS }),
        ),
      );
      const gone: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") return;
        const statusCode = (result.reason as { statusCode?: number }).statusCode;
        // 404 and 410 mean the device unsubscribed; anything else may be temporary, so the device is kept.
        if (statusCode === 404 || statusCode === 410) gone.push(subscriptions[index].endpoint);
        else console.error("A notification could not be sent:", statusCode ?? (result.reason instanceof Error ? result.reason.message : result.reason));
      });
      return gone;
    },
  };
}
