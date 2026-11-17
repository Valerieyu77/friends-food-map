import { describe, expect, it } from "vitest";
import { normalizeResults, sortByDistance } from "./placeSearch.js";

const feature = (properties: object, coordinates: [number, number] = [-87.64, 41.88]) => ({
  geometry: { coordinates },
  properties,
});

describe("normalizeResults", () => {
  it("turns a search result into a place with address and coordinates", () => {
    const places = normalizeResults({
      features: [
        feature({ osm_id: 5, osm_type: "N", osm_key: "amenity", name: "Girl & The Goat", street: "West Randolph Street", housenumber: "809", city: "Chicago" }),
      ],
    });
    expect(places).toEqual([
      { osmKey: "N5", name: "Girl & The Goat", address: "809 West Randolph Street", city: "Chicago", lat: 41.88, lon: -87.64 },
    ]);
  });

  it("drops cities, counties and results without a name", () => {
    const places = normalizeResults({
      features: [
        feature({ osm_id: 1, osm_type: "R", osm_key: "place", name: "Champaign" }),
        feature({ osm_id: 2, osm_type: "N", osm_key: "amenity" }),
        feature({ osm_id: 3, osm_type: "N", osm_key: "amenity", name: "Sam's Cafe" }),
      ],
    });
    expect(places.map((place) => place.name)).toEqual(["Sam's Cafe"]);
  });

  it("drops a second listing of the same place that has no address", () => {
    const places = normalizeResults({
      features: [
        feature({ osm_id: 1, osm_type: "N", osm_key: "amenity", name: "Girl & The Goat", street: "West Randolph Street", housenumber: "809" }),
        feature({ osm_id: 2, osm_type: "N", osm_key: "amenity", name: "Girl & The Goat" }),
      ],
    });
    expect(places.map((place) => place.osmKey)).toEqual(["N1"]);
  });

  it("returns nothing when the service sends no results", () => {
    expect(normalizeResults({})).toEqual([]);
  });
});

describe("sortByDistance", () => {
  it("puts the closest place first and places without coordinates last", () => {
    const champaign = { lat: 40.1164, lon: -88.2434 };
    const sorted = sortByDistance(
      [
        { name: "Starbucks Chicago", lat: 41.88, lon: -87.63 },
        { name: "Typed by hand" },
        { name: "Starbucks Green Street", lat: 40.11, lon: -88.22 },
      ],
      champaign,
    );
    expect(sorted.map((place) => place.name)).toEqual(["Starbucks Green Street", "Starbucks Chicago", "Typed by hand"]);
  });
});
