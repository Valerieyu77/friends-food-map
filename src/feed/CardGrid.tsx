import type { ReactNode } from "react";
import { intoColumns } from "../homeGrid.js";

const COLUMNS = 2;

interface CardGridProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  heightOf: (item: T) => number;
  render: (item: T) => ReactNode;
}

/** Two columns of cards of different heights, each card under the shorter column, newest near the top. */
export function CardGrid<T>({ items, keyOf, heightOf, render }: CardGridProps<T>) {
  return (
    <div className="pick-grid">
      {intoColumns(items, COLUMNS, heightOf).map((column, index) => (
        <div key={index} className="pick-column">
          {column.map((item) => <div key={keyOf(item)} className="pick-slot">{render(item)}</div>)}
        </div>
      ))}
    </div>
  );
}
