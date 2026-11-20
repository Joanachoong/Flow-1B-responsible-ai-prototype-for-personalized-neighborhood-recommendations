"use client";

// Loaded only in the browser via next/dynamic(ssr:false) — Leaflet touches `window` on import.
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { GeoJSON, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type { ScoreScale } from "@/lib/score";
import type { ZipResult } from "@/lib/types";

export interface ZipProps {
  zip: string;
  name: string;
  centroid: [number, number];
}
export type ZipGeo = FeatureCollection<Geometry, ZipProps>;

interface Props {
  geo: ZipGeo;
  results: ZipResult[];
  selectedZip: string | null;
  onSelect: (zip: string) => void;
  scale: ScoreScale;
}

const MIAMI_CENTER: [number, number] = [25.76, -80.19]; // MAP-1
const MIAMI_ZOOM = 11;

// CARTO basemaps now require an API key; default to OpenStreetMap tiles, warm-greyed in CSS
// (.warm-tiles) to sit on the cream palette. Override with NEXT_PUBLIC_MAP_TILE_URL, e.g. a keyed
// CARTO light_all URL, for production traffic (OSM's tile policy is for light use only).
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function boundsFor(geo: ZipGeo, zips: Set<string>): L.LatLngBounds | null {
  const features = geo.features.filter((f) => zips.has(f.properties.zip));
  if (!features.length) return null;
  const bounds = L.geoJSON({ type: "FeatureCollection", features } as FeatureCollection).getBounds();
  return bounds.isValid() ? bounds : null;
}

/** MAP-4: zoom to fit the plotted zips; pan to the selected zip (MAP-7). */
function ViewController({ geo, results, selectedZip }: Omit<Props, "onSelect" | "scale">) {
  const map = useMap();
  const resultKey = results.map((r) => r.zip).join(",");

  useEffect(() => {
    if (!resultKey) return;
    const bounds = boundsFor(geo, new Set(resultKey.split(",")));
    if (bounds) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
  }, [geo, map, resultKey]);

  useEffect(() => {
    if (!selectedZip) return;
    const bounds = boundsFor(geo, new Set([selectedZip]));
    if (!bounds) return;
    // Keep the zip clear of the detail panel (right side on desktop, bottom sheet on phones).
    const wide = map.getContainer().clientWidth >= 768;
    map.flyToBounds(bounds, {
      paddingTopLeft: [40, 40],
      paddingBottomRight: wide ? [420, 40] : [40, map.getContainer().clientHeight * 0.55],
      maxZoom: Math.max(map.getZoom(), 12),
      duration: 0.6,
    });
  }, [geo, map, selectedZip]);

  // Keep tiles correct when the surrounding layout changes size (detail panel, mobile stacking).
  useEffect(() => {
    const el = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export default function MapView({ geo, results, selectedZip, onSelect, scale }: Props) {
  const byZip = useMemo(() => new Map(results.map((r) => [r.zip, r])), [results]);
  // Rebuild the GeoJSON layer when results or selection change so styles + tooltips refresh.
  const layerKey = `${results.map((r) => `${r.zip}:${r.score}`).join("|")}#${selectedZip ?? ""}`;

  const style = (feature?: Feature<Geometry, ZipProps>): L.PathOptions => {
    const zip = feature?.properties.zip ?? "";
    const result = byZip.get(zip);
    const selected = zip === selectedZip;
    if (result) {
      return {
        fillColor: scale.color(result.score),
        fillOpacity: 0.8,
        color: selected ? "#a75f48" : "#3d3d3d",
        weight: selected ? 3.5 : 1.4,
      };
    }
    return {
      fillColor: "#cfc9ba",
      fillOpacity: selected ? 0.35 : 0.15,
      color: selected ? "#a75f48" : "#8f8a7e",
      weight: selected ? 3 : 1.1,
    };
  };

  const onEachFeature = (feature: Feature<Geometry, ZipProps>, layer: L.Layer) => {
    const { zip, name } = feature.properties;
    const result = byZip.get(zip);
    const path = layer as L.Path;
    const html = result
      ? `<strong>${zip}</strong> · ${escapeHtml(result.neighborhood || name)}<br/><span style="color:#66645e">Score ${Math.round(result.score)}/100 · #${result.rank}</span>`
      : `<strong>${zip}</strong> · ${escapeHtml(name)}`;
    path.bindTooltip(html, { sticky: true, className: "zip-tooltip", direction: "top", opacity: 1 });
    path.on({
      click: () => onSelect(zip),
      mouseover: () => path.setStyle({ weight: zip === selectedZip ? 3.5 : 2.5, color: "#3d3d3d" }),
      mouseout: () => path.setStyle(style(feature)),
    });
  };

  return (
    <MapContainer
      center={MIAMI_CENTER}
      zoom={MIAMI_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
      aria-label="Map of Miami zip codes"
    >
      <TileLayer
        attribution={TILE_ATTRIBUTION}
        url={TILE_URL}
        maxZoom={19}
        className="warm-tiles"
      />
      <GeoJSON key={layerKey} data={geo} style={style as L.StyleFunction} onEachFeature={onEachFeature} />
      {results.map((r) => {
        const centroid = r.centroid ?? geo.features.find((f) => f.properties.zip === r.zip)?.properties.centroid;
        if (!centroid) return null;
        return (
          <Marker
            key={`${r.zip}-${r.rank}-${r.zip === selectedZip}`}
            position={centroid}
            icon={L.divIcon({
              className: "",
              html: `<div class="rank-badge${r.zip === selectedZip ? " is-selected" : ""}">${r.rank}</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            })}
            eventHandlers={{ click: () => onSelect(r.zip) }}
            title={`#${r.rank} ${r.zip} ${r.neighborhood}`}
            zIndexOffset={r.zip === selectedZip ? 1000 : 500 - r.rank}
          />
        );
      })}
      <ViewController geo={geo} results={results} selectedZip={selectedZip} />
    </MapContainer>
  );
}
