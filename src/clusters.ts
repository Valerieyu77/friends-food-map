/** Something drawn on screen at pixel position x, y. */
export interface ScreenPoint<T> {
  x: number;
  y: number;
  item: T;
}

/**
 * Groups points that would overlap on screen: each point joins the first group whose first point
 * is within `radius` pixels, or starts a new group. Order is kept, so groups come out stable.
 */
export function groupNearby<T>(points: ScreenPoint<T>[], radius: number): T[][] {
  const groups: { x: number; y: number; items: T[] }[] = [];
  for (const point of points) {
    const near = groups.find((group) => Math.hypot(group.x - point.x, group.y - point.y) <= radius);
    if (near) near.items.push(point.item);
    else groups.push({ x: point.x, y: point.y, items: [point.item] });
  }
  return groups.map((group) => group.items);
}
