import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Initial view: the whole of Türkiye and its seas
export const TURKEY_BOUNDS = [
  [35.6, 25.4],
  [42.4, 44.9],
];
export const MARMARA_BOUNDS = [
  [39.9, 26.2],
  [41.35, 30.1],
];

const BASIN_BOXES = {
  marmara: { box: [26.9, 40.2, 30.0, 41.1], name: "Marmara veri kutusu" },
  aegean: { box: [25.5, 36.8, 27.5, 39.8], name: "Ege veri kutusu" },
  blacksea: { box: [28.0, 41.0, 41.8, 42.5], name: "Karadeniz veri kutusu" },
};

// Box outline per base map: dark navy on the light map, white on satellite imagery.
// A very light fill marks the area without hiding the map underneath.
const BOX_STYLE = {
  light: { color: "#496183", opacity: 0.9, fillOpacity: 0.06 },
  satellite: { color: "#e0dbdb", opacity: 0.9, fillOpacity: 0.08 },
};

const BASE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, Maxar, Earthstar Geographics",
  },
  light: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap",
    subdomains: "abc",
  },
};

// Same colour steps as the risk levels: low → moderate → high → critical
export function riskColor(score) {
  if (score >= 75) return "#b04bd6";
  if (score >= 50) return "#ff8a3d";
  if (score >= 25) return "#f2d24b";
  return "#5fc27e";
}

function fmt(v, digits = 1) {
  return Number(v).toFixed(digits).replace(".", ",");
}

export default function RiskMap({
  points = [],
  baseLayer = "light",
  showBoxes = true,
  focus = "turkey",
  selectedName = null,
  onSelect = () => {},
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const baseRef = useRef(null);
  const boxesRef = useRef(null);
  const pointsRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // create the map once
  useEffect(() => {
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 4,
      maxZoom: 11,
      worldCopyJump: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.fitBounds(TURKEY_BOUNDS);
    boxesRef.current = L.layerGroup().addTo(map);
    pointsRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // keep tiles correct when the container is resized
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // base map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseRef.current) map.removeLayer(baseRef.current);
    const cfg = BASE_LAYERS[baseLayer] || BASE_LAYERS.light;
    baseRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      subdomains: cfg.subdomains || "abc",
      maxZoom: 19,
    }).addTo(map);
    baseRef.current.bringToBack();
  }, [baseLayer]);

  // focus buttons
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyToBounds(focus === "marmara" ? MARMARA_BOUNDS : TURKEY_BOUNDS, { duration: 0.8 });
  }, [focus]);

  // basin boxes
  useEffect(() => {
    const group = boxesRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showBoxes) return;
    const style = BOX_STYLE[baseLayer] || BOX_STYLE.light;
    Object.values(BASIN_BOXES).forEach(({ box: [w, s, e, n], name }) => {
      L.rectangle(
        [
          [s, w],
          [n, e],
        ],
        {
          color: style.color,
          opacity: style.opacity,
          weight: 2,
          dashArray: "8 5",
          fill: true,
          fillColor: style.color,
          fillOpacity: style.fillOpacity,
          interactive: true,
        }
      )
        .bindTooltip(name, { sticky: true, className: "risk-tooltip" })
        .addTo(group);
    });
  }, [showBoxes, baseLayer]);

  // risk points
  useEffect(() => {
    const group = pointsRef.current;
    if (!group) return;
    group.clearLayers();
    points.forEach((p) => {
      const color = riskColor(p.score);
      const radius = 6 + p.score * 0.14;
      const isSelected = p.name === selectedName;
      // soft halo
      L.circleMarker([p.lat, p.lon], {
        radius: radius + 6,
        stroke: false,
        fillColor: color,
        fillOpacity: 0.18,
        interactive: false,
      }).addTo(group);
      L.circleMarker([p.lat, p.lon], {
        radius,
        color: isSelected ? "#ffffff" : "#0b151b",
        weight: isSelected ? 3 : 1.5,
        fillColor: color,
        fillOpacity: 0.92,
      })
        .bindTooltip(
          `<div class="rt-title">${p.name}</div>
           <div class="rt-row"><span>Risk</span><b style="color:${color}">${fmt(p.score, 0)}/100 · ${p.level}</b></div>
           <div class="rt-row"><span>SST</span><b>${fmt(p.sst)} °C</b></div>
           <div class="rt-row"><span>Rüzgâr</span><b>${fmt(p.wind)} m/s</b></div>
           <div class="rt-row"><span>Klorofil-a</span><b>${fmt(p.chl, 2)} mg/m³</b></div>
           <div class="rt-note">${p.note}</div>`,
          { direction: "top", offset: [0, -radius], className: "risk-tooltip" }
        )
        .on("click", () => onSelectRef.current(p.name))
        .addTo(group);
    });
  }, [points, selectedName]);

  return <div ref={containerRef} className="risk-map" />;
}