const DISMISSED_KEY = "friends-food-map.install-tip-dismissed";

/** Which add-to-home-screen tip to show: iPhone steps, Android's install button, or none. */
export type InstallTipKind = "ios" | "android" | null;

export interface InstallSituation {
  /** An iPhone or iPad, where only the Share menu can add a web app to the home screen. */
  isIos: boolean;
  /** Already opened from the home screen. */
  isStandalone: boolean;
  /** The browser offered to install the app (Chrome on Android). */
  canPrompt: boolean;
  /** A phone or tablet; laptops do not get the tip. */
  isTouch: boolean;
  /** Closed with × before. */
  dismissed: boolean;
}

export function installTipKind(situation: InstallSituation): InstallTipKind {
  if (situation.isStandalone || situation.dismissed || !situation.isTouch) return null;
  if (situation.isIos) return "ios";
  return situation.canPrompt ? "android" : null;
}

/** The event Chrome fires when the app can be installed; not in TypeScript's DOM types yet. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let savedPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/**
 * Keeps Chrome's install offer for the tip's button instead of Chrome's own banner. Called once at startup,
 * because the event can fire before any page is shown.
 */
export function captureInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    savedPrompt = event as InstallPromptEvent;
    listeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    savedPrompt = null;
    listeners.forEach((listener) => listener());
  });
}

export function installPrompt(): InstallPromptEvent | null {
  return savedPrompt;
}

/** Calls `listener` whenever the install offer arrives or goes away; returns a function that stops it. */
export function onInstallPromptChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentSituation(): InstallSituation {
  const userAgent = navigator.userAgent;
  // iPads ask for the desktop site and say "Macintosh", but have a touch screen.
  const isIos = /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const isStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return {
    isIos,
    isStandalone,
    canPrompt: savedPrompt !== null,
    isTouch: window.matchMedia("(pointer: coarse)").matches,
    dismissed: readDismissed(),
  };
}

// Browser storage can be blocked (private windows); the tip then just shows again next visit.
function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "yes";
  } catch {
    return false;
  }
}

export function rememberDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, "yes");
  } catch {
    // Nothing to do: the tip is hidden for now and may show again next visit.
  }
}
