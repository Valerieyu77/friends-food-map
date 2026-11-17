import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { warmStyle } from "./mapStyle.js";

const grayStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "rgb(242,243,240)" } },
    { id: "water", type: "fill", source: "openmaptiles", paint: { "fill-color": "rgb(194,200,202)" } },
    { id: "label_city", type: "symbol", source: "openmaptiles", minzoom: 3, layout: { "text-field": ["get", "name"] }, paint: { "text-color": "#000" } },
    { id: "label_state", type: "symbol", source: "openmaptiles", minzoom: 5, layout: { "text-field": ["get", "name"] } },
    { id: "road_shield_us", type: "symbol", source: "openmaptiles", layout: { "text-field": ["to-string", ["get", "ref"]] } },
  ],
};

describe("warmStyle", () => {
  const warm = warmStyle(grayStyle);
  const layer = (id: string) => warm.layers.find((candidate) => candidate.id === id) as { paint?: object; layout?: object; minzoom?: number };

  it("paints land and water in the app's warm neutrals", () => {
    expect(layer("background").paint).toMatchObject({ "background-color": "#f6f3ee" });
    expect(layer("water").paint).toMatchObject({ "fill-color": "#dde3e4" });
  });

  it("shows English place names in warm brown", () => {
    expect(layer("label_city").layout).toMatchObject({ "text-field": ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]] });
    expect(layer("label_city").paint).toMatchObject({ "text-color": "#6f655e" });
  });

  it("shows state names on the whole-country view and keeps city names for closer in", () => {
    expect(layer("label_state")).toMatchObject({ minzoom: 2 });
    expect(layer("label_city")).toMatchObject({ minzoom: 4 });
  });

  it("leaves highway number shields alone and does not change the original style", () => {
    expect(layer("road_shield_us").layout).toMatchObject({ "text-field": ["to-string", ["get", "ref"]] });
    expect(grayStyle.layers[0]).toMatchObject({ paint: { "background-color": "rgb(242,243,240)" } });
  });
});
