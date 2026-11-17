import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { LngLatBoundsLike } from "maplibre-gl";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import statesTopology from "us-atlas/states-10m.json";

export type StateShape = Polygon | MultiPolygon;
export type StatesCollection = FeatureCollection<StateShape, { name: string }>;

// U.S. Census Bureau state outlines, simplified, packaged by us-atlas.
const topology = statesTopology as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>;

export const US_STATES = feature(topology, topology.objects.states) as StatesCollection;

/**
 * The smallest box around a state, as [[west, south], [east, north]].
 * Alaska's last islands sit just past the 180th meridian, so eastern longitudes are counted
 * as far west instead; otherwise its box would wrap around the whole world.
 */
export function boundsOf(shape: StateShape): LngLatBoundsLike {
  const rings: Position[][] = shape.type === "Polygon" ? shape.coordinates : shape.coordinates.flat();
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [rawLon, lat] of rings.flat()) {
    const lon = rawLon > 0 ? rawLon - 360 : rawLon;
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}
