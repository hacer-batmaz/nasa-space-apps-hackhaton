import { useEffect, useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

const API = "http://127.0.0.1:8000/api";
const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// Türkiye kıyıları ve Marmara/Ege/Karadeniz için ölçeklenebilir SVG koordinat dönüşümü
// Lon: 25.0 -> 42.0, Lat: 35.8 -> 42.6
const lonToX = (lon) => ((lon - 24.8) / (42.2 - 24.8)) * 1000;
const latToY = (lat) => ((42.8 - lat) / (42.8 - 35.6)) * 560;

// Türkiye kara kütlesi (Anadolu + Trakya) temiz vektör poligonu
const ANATOLIA_SVG = [
  [26.1, 39.5], [26.8, 39.4], [26.7, 38.4], [27.2, 37.9], [27.2, 37.1],
  [28.5, 36.8], [30.3, 36.3], [32.5, 36.1], [35.5, 36.6], [36.2, 36.8],
  [36.0, 35.9], [41.3, 37.1], [44.2, 37.1], [44.4, 39.4], [43.5, 41.1],
  [41.5, 41.5], [39.4, 41.1], [37.0, 41.3], [35.1, 42.0], [32.5, 41.8],
  [29.9, 41.2], [29.2, 40.8], [28.3, 40.4], [27.1, 40.4], [26.1, 39.5],
]
  .map(([lon, lat], i) => `${i === 0 ? "M" : "L"} ${lonToX(lon).toFixed(1)},${latToY(lat).toFixed(1)}`)
  .join(" ") + " Z";

const THRACE_SVG = [
  [26.1, 40.7], [26.5, 41.6], [28.0, 42.0], [29.0, 41.2], [28.8, 41.0],
  [27.5, 41.0], [26.8, 40.5], [26.2, 40.1], [26.1, 40.7],
]
  .map(([lon, lat], i) => `${i === 0 ? "M" : "L"} ${lonToX(lon).toFixed(1)},${latToY(lat).toFixed(1)}`)
  .join(" ") + " Z";

export default function Simulation() {
  const [monthIdx, setMonthIdx] = useState(220); // Mayıs 2021 (2003 Ocak = 0)
  const [climatology, setClimatology] = useState(false);
  const [dSst, setDSst] = useState(0);
  const [dWind, setDWind] = useState(0);
  const [dChl, setDChl] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState("İzmit Körfezi");
  const [activeMetric, setActiveMetric] = useState("score"); // score | sst | wind | chl
  const [zoomMarmara, setZoomMarmara] = useState(true);
  const [data, setData] = useState(null);

  const year = 2003 + Math.floor(monthIdx / 12);
  const month = (monthIdx % 12) + 1;

  useEffect(() => {
    const params = new URLSearchParams({
      year,
      month,
      climatology,
      d_sst: dSst,
      d_wind: dWind,
      d_chl: dChl,
    });
    fetch(`${API}/simulation?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [year, month, climatology, dSst, dWind, dChl]);

  const currentPt =
    data?.points?.find((p) => p.name === selectedPoint) || data?.points?.[0] || null;

  const metricDisplay = () => {
    if (!currentPt) return { val: "—", unit: "" };
    if (activeMetric === "sst") return { val: currentPt.sst.toFixed(1).replace(".", ","), unit: "°C · Deniz Yüzeyi Sıcaklığı" };
    if (activeMetric === "wind") return { val: currentPt.wind.toFixed(1).replace(".", ","), unit: "m/s · Yüzey Rüzgâr Hızı" };
    if (activeMetric === "chl") return { val: currentPt.chl.toFixed(2).replace(".", ","), unit: "mg/m³ · Klorofil-a" };
    return { val: Math.round(currentPt.score), unit: `/ 100 · ${currentPt.level} Risk` };
  };

  const md = metricDisplay();

  // Marmara odaklı zoom veya Tüm Türkiye görünümü
  const viewBox = zoomMarmara ? "65 65 290 190" : "0 0 1000 560";

  return (
    <div className="page-container">
      <div className="atlas-wrapper">
        <div className="atlas-stage">
          {/* Harita Katmanı */}
          <svg
            viewBox={viewBox}
            style={{ width: "100%", height: "100%", display: "block", transition: "all 0.45s ease" }}
          >
            {/* Izgara Çizgileri */}
            {[150, 300, 450, 600, 750, 900].map((x) => (
              <line key={x} x1={x} y1="0" x2={x} y2="560" stroke="rgba(255,255,255,0.04)" />
            ))}
            {[120, 240, 360, 480].map((y) => (
              <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(255,255,255,0.04)" />
            ))}

            {/* Kara Parçaları */}
            <path d={THRACE_SVG} fill="#18323a" stroke="#3c5e69" strokeWidth={zoomMarmara ? 0.8 : 1.4} />
            <path d={ANATOLIA_SVG} fill="#18323a" stroke="#3c5e69" strokeWidth={zoomMarmara ? 0.8 : 1.4} />

            {/* Kıyı Gözlem Noktaları */}
            {data?.points?.map((pt) => {
              const cx = lonToX(pt.lon);
              const cy = latToY(pt.lat);
              const isSelected = pt.name === currentPt?.name;
              const isCritical = pt.score >= 75;
              const baseR = zoomMarmara ? 3.5 : 6;
              const dynR = baseR + (pt.score / 100) * (zoomMarmara ? 5.5 : 10);

              return (
                <g
                  key={pt.name}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedPoint(pt.name)}
                >
                  {/* Risk Etki Halesi */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={dynR}
                    fill={isCritical ? "rgba(216, 247, 122, 0.28)" : "rgba(79, 209, 181, 0.22)"}
                    stroke={isSelected ? "#d8f77a" : isCritical ? "#d8f77a" : "#4fd1b5"}
                    strokeWidth={isSelected ? (zoomMarmara ? 1.2 : 2.2) : (zoomMarmara ? 0.6 : 1.2)}
                  />
                  {/* Merkez Nokta */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={zoomMarmara ? 1.8 : 3.5}
                    fill={isSelected ? "#d8f77a" : "#f0f0e8"}
                  />
                </g>
              );
            })}
          </svg>

          {/* Sol Üst Yüzen Gözlem Kartı (Atlas Stili) */}
          {currentPt && (
            <div className="floating-panel">
              <div className="eyebrow mono">BÖLGESEL GÖZLEM</div>
              <h2>{currentPt.name}</h2>
              <p style={{ fontSize: "11px", color: "#9eafb6", margin: "4px 0 0" }}>
                {currentPt.lat.toFixed(2)}° N · {currentPt.lon.toFixed(2)}° E
              </p>

              <div className="switches">
                <button className={activeMetric === "score" ? "active" : ""} onClick={() => setActiveMetric("score")}>
                  Risk Skoru
                </button>
                <button className={activeMetric === "sst" ? "active" : ""} onClick={() => setActiveMetric("sst")}>
                  Sıcaklık
                </button>
                <button className={activeMetric === "wind" ? "active" : ""} onClick={() => setActiveMetric("wind")}>
                  Rüzgâr
                </button>
                <button className={activeMetric === "chl" ? "active" : ""} onClick={() => setActiveMetric("chl")}>
                  CHL
                </button>
              </div>

              <div className="reading-big" style={{ color: currentPt.score >= 75 ? "var(--acid)" : "var(--paper)" }}>
                {md.val}
              </div>
              <div style={{ fontSize: "12px", color: "#9eafb6", marginBottom: "12px" }}>{md.unit}</div>

              <p style={{ fontSize: "11px", color: "#90a4ad", lineHeight: 1.5, margin: 0 }}>
                {currentPt.note}
              </p>
            </div>
          )}

          {/* Sağ Üst Simülasyon Kontrol Kartı */}
          <div className="sim-sliders-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span className="mono" style={{ color: "var(--acid)" }}>
                SENARYO SİMÜLASYONU
              </span>
              <button
                className="btn-outline"
                style={{ padding: "4px 8px", fontSize: "10px" }}
                onClick={() => setZoomMarmara(!zoomMarmara)}
                title="Harita Yakınlaştırma"
              >
                {zoomMarmara ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
                <span>{zoomMarmara ? "Tüm Türkiye" : "Marmara Zoom"}</span>
              </button>
            </div>

            <label>
              🌡️ ΔSST (Sıcaklık): <b style={{ color: "var(--paper)" }}>{dSst > 0 ? `+${dSst}` : dSst} °C</b>
            </label>
            <input type="range" min="-2" max="4" step="0.1" value={dSst} onChange={(e) => setDSst(Number(e.target.value))} />

            <label>
              🍃 ΔRüzgâr Hızı: <b style={{ color: "var(--paper)" }}>{dWind > 0 ? `+${dWind}` : dWind}%</b>
            </label>
            <input type="range" min="-50" max="50" step="5" value={dWind} onChange={(e) => setDWind(Number(e.target.value))} />

            <label>
              🌿 ΔKlorofil / Besin: <b style={{ color: "var(--paper)" }}>{dChl > 0 ? `+${dChl}` : dChl}%</b>
            </label>
            <input type="range" min="-40" max="150" step="5" value={dChl} onChange={(e) => setDChl(Number(e.target.value))} />

            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginTop: "4px" }}>
              <input type="checkbox" checked={climatology} onChange={(e) => setClimatology(e.target.checked)} />
              <span>Tarihsel ortalamayı kullan</span>
            </label>

            <button
              className="btn-outline"
              style={{ width: "100%", justifyContent: "center", marginTop: "12px" }}
              onClick={() => {
                setDSst(0);
                setDWind(0);
                setDChl(0);
              }}
            >
              <RotateCcw size={13} />
              <span>Parametreleri Sıfırla</span>
            </button>
          </div>
        </div>

        {/* Alt Zaman Çubuğu (2003 - 2024) */}
        <div className="timebar">
          <div>
            <strong style={{ display: "block", fontSize: "14px" }}>
              {climatology ? `${MONTHS[month - 1]} (Ort.)` : `${MONTHS[month - 1]} ${year}`}
            </strong>
            <span className="mono" style={{ color: "#7d939c" }}>
              AY {monthIdx + 1} / 264
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="263"
            step="1"
            value={monthIdx}
            onChange={(e) => setMonthIdx(Number(e.target.value))}
            aria-label="Gözlem ayı"
          />

          <div style={{ textAlign: "right" }}>
            <span className="mono" style={{ color: "#90a4ad" }}>
              2003 — 2024
              <br />
              NASA GIOVANNI
            </span>
          </div>
        </div>
      </div>

      {/* Nokta Seçim Şeridi */}
      {data && (
        <div className="detail-banner">
          <b>Simülasyon Analizi:</b> Seçili <b>{currentPt?.name}</b> noktasında risk skoru{" "}
          <b style={{ color: "var(--acid)" }}>{Math.round(currentPt?.score || 0)} / 100</b> (Baz:{" "}
          {Math.round(currentPt?.base_score || 0)} puan). Harita üzerindeki herhangi bir kıyı noktasına
          tıklayarak yerel sıcaklık ({currentPt?.sst} °C), rüzgâr ({currentPt?.wind} m/s) ve klorofil (
          {currentPt?.chl} mg/m³) tepkisini inceleyebilirsiniz.
        </div>
      )}
    </div>
  );
}