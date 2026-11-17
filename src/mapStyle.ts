import type { StyleSpecification } from "maplibre-gl";

/** Free OpenStreetMap-based map style (no key needed); recolored below to the app's warm palette. */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// The app's warm neutrals: stone land, muted water, quiet greens, so the coral pins stand out.
const COLORS = {
  land: "#f6f3ee",
  water: "#dde3e4",
  waterLine: "#cfd8da",
  green: "#e9e9dd",
  residential: "#f2eee8",
  building: "#efeae3",
  roadCasing: "#e7e0d6",
  road: "#ffffff",
  roadSubtle: "#ede7df",
  border: "#d5ccc0",
  label: "#6f655e",
  halo: "#f8f6f2",
};

// The whole-country view shows state names only; city names wait until you zoom into a state.
const LABEL_MIN_ZOOM: Record<string, number> = { label_state: 2, label_city: 4, label_city_capital: 4 };

// English names first, so labels read the same everywhere.
const ENGLISH_NAME = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]];

function fillColorFor(id: string): string | undefined {
  if (id === "water") return COLORS.water;
  if (id === "park" || id.startsWith("landcover")) return COLORS.green;
  if (id === "landuse_residential") return COLORS.residential;
  if (id === "building") return COLORS.building;
  return undefined;
}

function lineColorFor(id: string): string | undefined {
  if (id === "waterway") return COLORS.waterLine;
  if (id.startsWith("boundary")) return COLORS.border;
  if (!id.startsWith("highway") && !id.startsWith("tunnel")) return undefined;
  if (id.includes("casing")) return COLORS.roadCasing;
  if (id.includes("subtle")) return COLORS.roadSubtle;
  return COLORS.road;
}

/**
 * Repaints the gray base map in the app's warm neutrals, with English labels and a calm country view.
 * Done on the style before the map draws, so it never flashes gray first.
 */
export function warmStyle(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.map((layer) => {
    const paint: Record<string, unknown> = { ...("paint" in layer ? layer.paint : {}) };
    const layout: Record<string, unknown> = { ...("layout" in layer ? layer.layout : {}) };
    const { id } = layer;
    if (layer.type === "background") paint["background-color"] = COLORS.land;
    if (layer.type === "fill") {
      const color = fillColorFor(id);
      if (color) paint["fill-color"] = color;
      // Buildings stay faint so the map reads as calm streets rather than a grid of blocks.
      if (id === "building") paint["fill-outline-color"] = COLORS.building;
    }
    if (layer.type === "line") {
      const color = lineColorFor(id);
      if (color) paint["line-color"] = color;
    }
    if (layer.type === "symbol" && JSON.stringify(layout["text-field"] ?? "").includes("name")) {
      layout["text-field"] = ENGLISH_NAME;
      paint["text-color"] = COLORS.label;
      paint["text-halo-color"] = COLORS.halo;
    }
    const minzoom = LABEL_MIN_ZOOM[id] ?? layer.minzoom;
    return { ...layer, paint, layout, ...(minzoom === undefined ? {} : { minzoom }) } as typeof layer;
  });
  return { ...style, layers };
}
