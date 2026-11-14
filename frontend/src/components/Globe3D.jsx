import { useEffect, useMemo, useRef, useState } from "react";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries50m from "world-atlas/countries-50m.json";

const SEA_COORDS = {
  marmara: { lon: 28.4, lat: 40.7, label: "40° N / 28° E · MARMARA" },
  aegean: { lon: 25.8, lat: 38.6, label: "39° N / 26° E · EGE" },
  blacksea: { lon: 34.5, lat: 42.0, label: "42° N / 35° E · KARADENİZ" },
};

// Real coastlines (Natural Earth 1:50m via world-atlas), converted once
const COUNTRIES = feature(countries50m, countries50m.objects.countries).features;
const TURKEY_ID = "792"; // ISO 3166-1 numeric code of Türkiye
const GRATICULE = geoGraticule10();

const SIZE = 340;
const RADIUS = 126;
// Globe centre sits slightly south-west of the selected sea so all three seas stay visible
const centreFor = (sea) => [-(sea.lon + 2), -(sea.lat - 4)];

export default function Globe3D({ region = "marmara" }) {
  const [pulse, setPulse] = useState(0);
  const info = SEA_COORDS[region] || SEA_COORDS.marmara;
  const [rotation, setRotation] = useState(() => centreFor(info));
  const target = useRef(centreFor(info));

  useEffect(() => {
    target.current = centreFor(info);
  }, [info]);

  // pulse ring + smooth rotation towards the selected sea
  useEffect(() => {
    const id = setInterval(() => {
      setPulse((p) => (p + 1) % 100);
      setRotation(([lambda, phi]) => {
        const [tl, tp] = target.current;
        if (Math.abs(tl - lambda) < 0.05 && Math.abs(tp - phi) < 0.05) return [lambda, phi];
        return [lambda + (tl - lambda) * 0.12, phi + (tp - phi) * 0.12];
      });
    }, 40);
    return () => clearInterval(id);
  }, []);

  const projection = useMemo(
    () => geoOrthographic().scale(RADIUS).translate([SIZE / 2, SIZE / 2]).rotate(rotation).clipAngle(90),
    [rotation]
  );

  // land paths only change while the globe is rotating
  const shapes = useMemo(() => {
    const path = geoPath(projection);
    return {
      graticule: path(GRATICULE),
      land: COUNTRIES.filter((c) => c.id !== TURKEY_ID).map((c) => path(c)).filter(Boolean),
      turkey: path(COUNTRIES.find((c) => c.id === TURKEY_ID)),
    };
  }, [projection]);

  const markerPos = projection([info.lon, info.lat]) || [SIZE / 2, SIZE / 2];
  const ringRadius = 8 + (pulse / 100) * 14;
  const ringOpacity = 1 - pulse / 100;

  return (
    <div className="globe-wrap">
      <div className="orbital-notes">
        <span>MODIS AQUA</span>
        <span>2003 — 2024</span>
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          width: "100%",
          height: "350px",
          filter: "drop-shadow(0 0 32px rgba(62, 140, 171, 0.18))",
        }}
        role="img"
        aria-label="Türkiye merkezli dünya küresi ve seçili denizin konumu"
      >
        <defs>
          <radialGradient id="oceanSphere" cx="42%" cy="38%" r="60%">
            <stop offset="0%" stopColor="#193b47" />
            <stop offset="65%" stopColor="#0d2129" />
            <stop offset="100%" stopColor="#061015" />
          </radialGradient>
        </defs>

        {/* Yörünge Halkası */}
        <ellipse
          cx="170"
          cy="170"
          rx="162"
          ry="58"
          transform="rotate(-22 170 170)"
          fill="none"
          stroke="rgba(216, 247, 122, 0.22)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Dünya Küresi */}
        <circle
          cx="170"
          cy="170"
          r={RADIUS}
          fill="url(#oceanSphere)"
          stroke="rgba(163, 195, 206, 0.25)"
          strokeWidth="1"
        />

        {/* Enlem & Boylam Izgarası + Kara Parçaları (gerçek kıyı çizgileri) */}
        <path d={shapes.graticule} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
        {shapes.land.map((d, i) => (
          <path key={i} d={d} fill="#18323b" stroke="#294c58" strokeWidth="0.5" strokeLinejoin="round" />
        ))}
        {shapes.turkey && (
          <path d={shapes.turkey} fill="#234652" stroke="#4f7c8a" strokeWidth="0.9" strokeLinejoin="round" />
        )}

        {/* Uydu Tarama Noktası */}
        <circle
          cx={markerPos[0]}
          cy={markerPos[1]}
          r={ringRadius}
          fill="none"
          stroke="#d8f77a"
          strokeWidth="1.5"
          opacity={ringOpacity}
        />
        <circle cx={markerPos[0]} cy={markerPos[1]} r="4.5" fill="#d8f77a" />
      </svg>

      <span className="globe-label">{info.label}</span>
    </div>
  );
}