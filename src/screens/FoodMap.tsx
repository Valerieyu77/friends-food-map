import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";
import type { LngLatBoundsLike, MapLayerMouseEvent, PaddingOptions, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef, useState } from "react";
import type { Coordinates } from "../../shared/distance.js";
import { groupNearby } from "../clusters.js";
import { MAP_STYLE_URL, warmStyle } from "../mapStyle.js";
import { formatRating, friendScores } from "../places.js";
import type { PlacePin } from "../places.js";
import { US_STATES, boundsOf } from "../usStates.js";
import { avatarElement } from "./Avatar.js";

// The map library finds its helper worker next to its own file, which a bundler moves; point it at the bundled copy.
setWorkerUrl(mapWorkerUrl);

// The place panel covers the right side on wide screens and the bottom on phones (see styles.css).
const PHONE_WIDTH = 760;
const PANEL_WIDTH = 416;

/** Shifts a chosen place so it stays visible beside or above the panel. */
function panelOffset(): [number, number] {
  return window.innerWidth > PHONE_WIDTH ? [-PANEL_WIDTH / 2, 0] : [0, -window.innerHeight * 0.3];
}

// The lower 48 states: the map always opens here, so friends' places far away are in view from the start.
const UNITED_STATES: LngLatBoundsLike = [
  [-124.8, 24.5],
  [-66.9, 49.4],
];
const COUNTRY_PADDING = 24;
const PREVIEW_PADDING = 6;
const NEARBY_ZOOM = 13;
const PLACE_ZOOM = 12;
// Zoomed out further than this, tapping a state zooms into it.
const STATE_PICKING_MAX_ZOOM = 5;
const STATE_PADDING = 40;
const STATE_HIGHLIGHT = "#fbeae5";
const STATE_OUTLINE = "#d5ccc0";
// Pins closer than this on screen would overlap, so they merge into one bubble with a count.
// Pins carry friends' faces now, so they are wider than the bare score they started as.
const PIN_OVERLAP_PIXELS = 60;
// A pin shows this many faces of the friends who rated the place, then "+2" for the rest.
const PIN_FACES = 3;
const PIN_FACE_SIZE = 20;

interface FoodMapProps {
  pins: PlacePin[];
  here: Coordinates | undefined;
  selectedPlaceId: string | null;
  onSelect: (placeId: string | null) => void;
  /** A small map that cannot be moved and has no buttons; tapping it calls `onSelect`. */
  preview?: boolean;
  /** A panel always covers the right side on wide screens, so the whole country is framed to its left. */
  sidePanel?: boolean;
}

function countryPaddingFor(preview: boolean, sidePanel: boolean): number | PaddingOptions {
  if (preview) return PREVIEW_PADDING;
  if (sidePanel && window.innerWidth > PHONE_WIDTH) {
    return { top: COUNTRY_PADDING, bottom: COUNTRY_PADDING, left: COUNTRY_PADDING, right: COUNTRY_PADDING + PANEL_WIDTH };
  }
  return COUNTRY_PADDING;
}

export function FoodMap({ pins, here, selectedPlaceId, onSelect, preview = false, sidePanel = false }: FoodMapProps) {
  const countryPadding = countryPaddingFor(preview, sidePanel);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const hereMarker = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  // Changes whenever the zoom does, so nearby pins are merged or split again.
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    let created: MapLibreMap | undefined;
    let cancelled = false;
    fetch(MAP_STYLE_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Map style failed with status ${response.status}`);
        return response.json() as Promise<StyleSpecification>;
      })
      .then((style) => {
        if (cancelled) return;
        created = createMap(warmStyle(style));
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
      created?.remove();
      map.current = null;
    };
  }, []);

  function createMap(style: StyleSpecification): MapLibreMap {
    const created = new MapLibreMap({
      container: container.current!,
      style,
      bounds: UNITED_STATES,
      fitBoundsOptions: { padding: countryPadding },
      attributionControl: { compact: true },
      interactive: !preview,
    });
    created.once("load", () => {
      // Start with the map credits folded into the small "i" button so they don't cover the app's buttons.
      container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      addTappableStates(created);
    });
    created.on("click", () => onSelectRef.current(null));
    // A preview cannot be dragged, so any tap on it means "open the full map".
    if (preview) container.current?.addEventListener("click", () => onSelectRef.current(null));
    created.on("zoomend", () => setZoom(created.getZoom()));
    map.current = created;
    setMapReady(true);
    return created;
  }

  // One pin per place, with the faces of friends who rated it and the group's average score; pins that would overlap merge into a count.
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    for (const marker of markers.current) marker.remove();
    const selected = pins.find((pin) => pin.place.id === selectedPlaceId);
    const others = pins.filter((pin) => pin !== selected);
    const groups =
      current.getZoom() >= NEARBY_ZOOM
        ? others.map((pin) => [pin])
        : groupNearby(
            others.map((pin) => ({ ...current.project([pin.place.lon, pin.place.lat]), item: pin })),
            PIN_OVERLAP_PIXELS,
          );
    if (selected) groups.push([selected]);
    markers.current = groups.map((group) =>
      (group.length === 1 ? placeMarker(group[0], group[0] === selected) : groupMarker(current, group)).addTo(current),
    );
  }, [pins, selectedPlaceId, mapReady, zoom]);

  function placeMarker(pin: PlacePin, isSelected: boolean): Marker {
    const element = document.createElement("button");
    element.type = "button";
    element.className = isSelected ? "pin selected" : "pin";
    const scores = friendScores(pin);
    const faces = document.createElement("span");
    faces.className = "pin-faces";
    for (const { member } of scores.slice(0, PIN_FACES)) faces.append(avatarElement(member.name, member.avatar, PIN_FACE_SIZE));
    if (scores.length > PIN_FACES) {
      const more = document.createElement("span");
      more.className = "pin-more";
      more.textContent = `+${scores.length - PIN_FACES}`;
      faces.append(more);
    }
    const average = document.createElement("span");
    average.textContent = formatRating(pin.averageRating);
    element.append(faces, average);
    const byFriend = scores.map(({ member, rating }) => `${member.name} ${formatRating(rating)}`).join(", ");
    element.title = byFriend;
    element.setAttribute("aria-label", `${pin.place.name}, average score ${formatRating(pin.averageRating)}. ${byFriend}`);
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelectRef.current(pin.place.id);
    });
    return new Marker({ element, anchor: "bottom" }).setLngLat([pin.place.lon, pin.place.lat]);
  }

  function groupMarker(current: MapLibreMap, group: PlacePin[]): Marker {
    const bounds = new LngLatBounds();
    for (const pin of group) bounds.extend([pin.place.lon, pin.place.lat]);
    const element = document.createElement("button");
    element.type = "button";
    element.className = "pin-group";
    element.textContent = String(group.length);
    element.setAttribute("aria-label", `${group.length} places here. Tap to zoom in.`);
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      current.fitBounds(bounds, { padding: STATE_PADDING * 2, maxZoom: NEARBY_ZOOM, duration: 600 });
    });
    return new Marker({ element }).setLngLat(bounds.getCenter());
  }

  // A preview frames the group's places rather than the whole country.
  const framedPreview = useRef(false);
  useEffect(() => {
    const current = map.current;
    if (!preview || !current || pins.length === 0 || framedPreview.current) return;
    const bounds = new LngLatBounds();
    for (const pin of pins) bounds.extend([pin.place.lon, pin.place.lat]);
    current.fitBounds(bounds, { padding: 36, maxZoom: PLACE_ZOOM - 1, duration: 0 });
    framedPreview.current = true;
  }, [preview, pins, mapReady]);

  // Your own blue dot.
  useEffect(() => {
    const current = map.current;
    if (!current || !here) return;
    if (!hereMarker.current) {
      const dot = document.createElement("div");
      dot.className = "here-dot";
      hereMarker.current = new Marker({ element: dot }).setLngLat([here.lon, here.lat]).addTo(current);
    } else {
      hereMarker.current.setLngLat([here.lon, here.lat]);
    }
  }, [here, mapReady]);

  // Bring a chosen place close up, clear of the place panel.
  useEffect(() => {
    const pin = pins.find((candidate) => candidate.place.id === selectedPlaceId);
    const current = map.current;
    if (pin && current) {
      current.easeTo({
        center: [pin.place.lon, pin.place.lat],
        zoom: Math.max(current.getZoom(), PLACE_ZOOM),
        offset: panelOffset(),
        duration: 600,
      });
    }
  }, [selectedPlaceId, pins, mapReady]);

  function recenter() {
    if (here) map.current?.easeTo({ center: [here.lon, here.lat], zoom: NEARBY_ZOOM, duration: 500 });
  }

  function showWholeCountry() {
    onSelectRef.current(null);
    map.current?.fitBounds(UNITED_STATES, { padding: countryPadding, duration: 700 });
  }

  return (
    <>
      <div ref={container} className="map" />
      {mapError && <p className="floating-card map-error">The map could not load. Check your connection and reopen the app.</p>}
      {mapReady && !preview && (
        <button type="button" className="round-button whole-country" aria-label="Show the whole country" onClick={showWholeCountry}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      )}
      {here && !preview && (
        <button type="button" className="round-button locate" aria-label="Back to where I am" onClick={recenter}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}
    </>
  );
}

/** Soft state outlines, and on the country view a state that lights up under the pointer and zooms in when tapped. */
function addTappableStates(target: MapLibreMap) {
  target.addSource("us-states", { type: "geojson", data: US_STATES, generateId: true });
  const firstLabelLayer = target.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
  target.addLayer(
    {
      id: "us-states",
      type: "fill",
      source: "us-states",
      maxzoom: STATE_PICKING_MAX_ZOOM,
      paint: {
        "fill-color": STATE_HIGHLIGHT,
        "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.5, 0],
      },
    },
    firstLabelLayer,
  );
  target.addLayer(
    { id: "us-state-lines", type: "line", source: "us-states", paint: { "line-color": STATE_OUTLINE, "line-width": 1.2 } },
    firstLabelLayer,
  );
  let hovered: string | number | undefined;
  const setHovered = (id: string | number | undefined) => {
    if (hovered !== undefined) target.setFeatureState({ source: "us-states", id: hovered }, { hover: false });
    hovered = id;
    if (id !== undefined) target.setFeatureState({ source: "us-states", id }, { hover: true });
    target.getCanvas().style.cursor = id === undefined ? "" : "pointer";
  };
  target.on("mousemove", "us-states", (event: MapLayerMouseEvent) => setHovered(event.features?.[0]?.id));
  target.on("mouseleave", "us-states", () => setHovered(undefined));
  target.on("click", "us-states", (event: MapLayerMouseEvent) => {
    const name: unknown = event.features?.[0]?.properties.name;
    const state = US_STATES.features.find((candidate) => candidate.properties.name === name);
    if (!state) return;
    setHovered(undefined);
    target.fitBounds(boundsOf(state.geometry), { padding: STATE_PADDING, duration: 700 });
  });
}
