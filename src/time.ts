const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(isoTime: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(isoTime).getTime());
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)} d ago`;
  return new Date(isoTime).toLocaleDateString();
}
