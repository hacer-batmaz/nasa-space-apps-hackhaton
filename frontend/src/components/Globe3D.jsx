import { useEffect, useState } from "react";

const SEA_COORDS = {
  marmara: { lon: 28.4, lat: 40.7, label: "40° N / 28° E · MARMARA" },
  aegean: { lon: 25.8, lat: 38.6, label: "39° N / 26° E · EGE" },
  blacksea: { lon: 34.5, lat: 42.0, label: "42° N / 35° E · KARADENİZ" },
};

// Basitleştirilmiş Türkiye ve çevresi kıyı konturu (ortografik küre görünümü için)
const ANATOLIA_PATH =
  "M 145,148 L 160,142 L 178,144 L 195,141 L 215,146 L 222,155 L 214,166 L 192,168 L 168,167 L 150,164 L 143,156 Z";
const THRACE_PATH = "M 136,142 L 148,139 L 152,145 L 140,147 Z";
const EUROPE_HINT =
  "M 95,120 L 118,105 L 145,102 L 162,115 L 142,135 L 122,138 L 105,132 Z";
const AFRICA_HINT =
  "M 110,185 L 155,182 L 185,195 L 175,235 L 130,238 L 105,210 Z";

export default function Globe3D({ region = "marmara" }) {
  const [pulse, setPulse] = useState(0);
  const info = SEA_COORDS[region] || SEA_COORDS.marmara;

  // Seçili denize göre küre üzerindeki işaretçi koordinatı
  const markerPos = {
    marmara: { x: 152, y: 146 },
    aegean: { x: 144, y: 156 },
    blacksea: { x: 184, y: 138 },
  }[region] || { x: 152, y: 146 };

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => (p + 1) % 100), 40);
    return () => clearInterval(id);
  }, []);

  const ringRadius = 8 + (pulse / 100) * 14;
  const ringOpacity = 1 - pulse / 100;

  return (
    <div className="globe-wrap">
      <div className="orbital-notes">
        <span>MODIS AQUA</span>
        <span>2003 — 2024</span>
      </div>

      <svg
        viewBox="0 0 340 340"
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
          <clipPath id="globeClip">
            <circle cx="170" cy="170" r="126" />
          </clipPath>
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
          r="126"
          fill="url(#oceanSphere)"
          stroke="rgba(163, 195, 206, 0.25)"
          strokeWidth="1"
        />

        {/* Enlem & Boylam Izgarası + Kara Parçaları */}
        <g clipPath="url(#globeClip)">
          <ellipse cx="170" cy="170" rx="126" ry="42" fill="none" stroke="rgba(255,255,255,0.06)" />
          <ellipse cx="170" cy="170" rx="126" ry="88" fill="none" stroke="rgba(255,255,255,0.06)" />
          <ellipse cx="170" cy="170" rx="45" ry="126" fill="none" stroke="rgba(255,255,255,0.06)" />
          <ellipse cx="170" cy="170" rx="92" ry="126" fill="none" stroke="rgba(255,255,255,0.06)" />

          <path d={EUROPE_HINT} fill="#18323b" stroke="#294c58" strokeWidth="0.8" />
          <path d={AFRICA_HINT} fill="#18323b" stroke="#294c58" strokeWidth="0.8" />
          <path d={THRACE_PATH} fill="#234652" stroke="#4f7c8a" strokeWidth="0.9" />
          <path d={ANATOLIA_PATH} fill="#234652" stroke="#4f7c8a" strokeWidth="1" />
        </g>

        {/* Uydu Tarama Noktası */}
        <circle
          cx={markerPos.x}
          cy={markerPos.y}
          r={ringRadius}
          fill="none"
          stroke="#d8f77a"
          strokeWidth="1.5"
          opacity={ringOpacity}
        />
        <circle cx={markerPos.x} cy={markerPos.y} r="4.5" fill="#d8f77a" />
      </svg>

      <span className="globe-label">{info.label}</span>
    </div>
  );
}