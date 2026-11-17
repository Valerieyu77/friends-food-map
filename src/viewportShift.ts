/** How long after a field loses focus the keyboard has finished closing. */
const KEYBOARD_CLOSE_MILLISECONDS = 400;

/**
 * How far down to move the top bar and the tab bar so they sit where the screen really is; 0 when nothing is wrong.
 *
 * On iPhones the keyboard slides the page up, and iOS sometimes forgets to slide it back when the keyboard
 * closes (WebKit bug 297779). The browser then places the bars for a screen that starts `offsetTop` above the one
 * you see: the top bar is hidden above it and the tab bar floats in the middle.
 */
export function barShift(view: { offsetTop: number; scale: number }, typing: boolean): number {
  // While someone types the keyboard moves the page on purpose, and a zoomed-in page is the reader's choice.
  if (typing || Math.abs(view.scale - 1) > 0.01) return 0;
  return view.offsetTop >= 1 ? Math.round(view.offsetTop) : 0;
}

function isTyping(): boolean {
  const focused = document.activeElement;
  return focused instanceof HTMLElement && (focused.matches("input, textarea, select") || focused.isContentEditable);
}

/** Keeps the bars on screen when iOS leaves the page shifted; see barShift. The styles are under .viewport-shifted. */
export function keepBarsInView(): void {
  const view = window.visualViewport;
  if (!view) return;
  const root = document.documentElement;
  let current = 0;
  function update() {
    const shift = barShift(view!, isTyping());
    if (shift === current) return;
    current = shift;
    root.classList.toggle("viewport-shifted", shift > 0);
    root.style.setProperty("--viewport-shift", `${shift}px`);
  }
  view.addEventListener("resize", update);
  view.addEventListener("scroll", update);
  // iOS does not always announce the shift, so every scroll of the page checks too.
  window.addEventListener("scroll", update, { passive: true });
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", () => window.setTimeout(update, KEYBOARD_CLOSE_MILLISECONDS));
}
