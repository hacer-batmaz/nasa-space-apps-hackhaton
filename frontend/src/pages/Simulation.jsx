import { useEffect, useRef, useState } from "react";
import L from "leaflet";

const API = "http://127.0.0.1:8000/api";
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const levelColor = (level) => {
  if (level === "Kritik") return "#7e22ce";
  if (level === "Yüksek") return "#ea580c";
  if (level === "Orta") return "#eab308";
  return "#16a34a";
};

export default function Simulation() {
  const [year, setYear] = useState(2021);
  const [month, setMonth] = useState(5);
  const [climatology, setClimatology] = useState(false);
  const [dSst, setDSst] = useState(0);
  const [dWind, setDWind] = useState(0);
  const [dChl, setDChl] = useState(0);
  const [focus, setFocus] = useState("marmara");
  const [data, setData] = useState(null);

  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const layerGroup = useRef(null);

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

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, { scrollWheelZoom: true }).setView([40.62, 28.45], 7);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    }).addTo(map);
    layerGroup.current = L.layerGroup().addTo(map);
    leafletMap.current = map;
    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  useEffect(() => {
    if (!leafletMap.current) return;
    if (focus === "marmara") {
      leafletMap.current.setView([40.62, 28.45], 7);
    } else {
      leafletMap.current.setView([40.2, 31.8], 5);
    }
  }, [focus]);

  useEffect(() => {
    if (!layerGroup.current || !data) return;
    layerGroup.current.clearLayers();
    data.points.forEach((pt) => {
      const color = levelColor(pt.level);
      const radius = 8 + (pt.score / 100) * 14;
      const circle = L.circleMarker([pt.lat, pt.lon], {
        radius,
        fillColor: color,
        color: "#ffffff",
        weight: 1.5,
        fillOpacity: 0.85,
      });
      circle.bindPopup(`
        <div style="font-family:sans-serif;min-width:190px">
          <b>${pt.name}</b><br/>
          <span style="color:${color};font-weight:700">Risk: ${pt.score}/100 (${pt.level})</span><hr style="margin:6px 0"/>
          🌡️ SST: <b>${pt.sst} °C</b><br/>
          🍃 Rüzgâr: <b>${pt.wind} m/s</b><br/>
          🌿 Klorofil: <b>${pt.chl} mg/m³</b><br/>
          <small style="color:#555">${pt.note}</small>
        </div>
      `);
      circle.addTo(layerGroup.current);
    });
  }, [data]);

  const avgByRegion = (reg) => {
    if (!data) return { score: 0, base: 0 };
    const pts = data.points.filter((p) => p.region === reg);
    const score = pts.reduce((a, b) => a + b.score, 0) / pts.length;
    const base = pts.reduce((a, b) => a + b.base_score, 0) / pts.length;
    return { score, base };
  };

  const marmara = avgByRegion("marmara");
  const aegean = avgByRegion("aegean");
  const blacksea = avgByRegion("blacksea");
  const criticalPts = data ? data.points.filter((p) => p.score >= 75).map((p) => p.name) : [];

  return (
    <div>
      <div className="sim-header">
        <div>
          <div className="sim-kicker">NASA SPACE APPS · MÜSİLAJ DEDEKTİFİ</div>
          <div className="sim-title">İnteraktif Müsilaj Risk Haritası &amp; Simülasyon</div>
        </div>
        <div className="sim-stats">
          <div>
            <div style={{ fontSize: "0.75rem", color: "#a9bdb3" }}>SEÇİLİ DÖNEM</div>
            <div className="sim-stat-val">
              {climatology ? `${MONTHS[month - 1]} (Ort.)` : `${MONTHS[month - 1]} ${year}`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#a9bdb3" }}>MARMARA RİSK SKORU</div>
            <div className="sim-stat-val">{Math.round(marmara.score)} / 100</div>
          </div>
        </div>
      </div>

      <div className="sim-body">
        <div ref={mapRef} style={{ height: "540px", width: "100%" }} />

        <div className="sim-controls">
          <div>
            <label>Harita Odağı</label>
            <select value={focus} onChange={(e) => setFocus(e.target.value)} style={{ padding: "0.4rem", borderRadius: 6 }}>
              <option value="marmara">Marmara Odaklı (Zoom)</option>
              <option value="all">Tüm Türk Denizleri</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <label>Yıl</label>
              <select
                value={year}
                disabled={climatology}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{ padding: "0.4rem", borderRadius: 6 }}
              >
                {Array.from({ length: 22 }, (_, i) => 2003 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Ay</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: "0.4rem", borderRadius: 6 }}>
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={climatology} onChange={(e) => setClimatology(e.target.checked)} />
            Tarihsel ortalamayı kullan
          </label>

          <hr style={{ borderColor: "rgba(255,255,255,0.12)", width: "100%" }} />

          <div>
            <label>🌡️ ΔSST (Sıcaklık Değişimi): <b>{dSst > 0 ? `+${dSst}` : dSst} °C</b></label>
            <input type="range" min="-2" max="4" step="0.1" value={dSst} onChange={(e) => setDSst(Number(e.target.value))} />
          </div>

          <div>
            <label>🍃 ΔRüzgâr Hızı: <b>{dWind > 0 ? `+${dWind}` : dWind}%</b></label>
            <input type="range" min="-50" max="50" step="5" value={dWind} onChange={(e) => setDWind(Number(e.target.value))} />
          </div>

          <div>
            <label>🌿 ΔKlorofil-a / Besin Yükü: <b>{dChl > 0 ? `+${dChl}` : dChl}%</b></label>
            <input type="range" min="-40" max="150" step="5" value={dChl} onChange={(e) => setDChl(Number(e.target.value))} />
          </div>

          <button
            className="btn-primary"
            style={{ background: "#00897b", marginTop: "auto" }}
            onClick={() => {
              setDSst(0);
              setDWind(0);
              setDChl(0);
            }}
          >
            Senaryoyu Sıfırla
          </button>
        </div>
      </div>

      <div className="grid-3">
        <div className="metric-card">
          <div className="metric-label">Marmara Denizi Ortalama Risk</div>
          <div className="metric-value">{Math.round(marmara.score)} / 100</div>
          <div className="metric-sub">Baz: {Math.round(marmara.base)} puan</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Ege Denizi Ortalama Risk</div>
          <div className="metric-value">{Math.round(aegean.score)} / 100</div>
          <div className="metric-sub">Baz: {Math.round(aegean.base)} puan</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Karadeniz Ortalama Risk</div>
          <div className="metric-value">{Math.round(blacksea.score)} / 100</div>
          <div className="metric-sub">Baz: {Math.round(blacksea.base)} puan</div>
        </div>
      </div>

      <div className="alert-box">
        <b>Simülasyon Yorumu:</b> Marmara Denizi ortalama risk skoru <b>{Math.round(marmara.score)}/100</b>{" "}
        seviyesindedir. Kapalı havza yapısı ve uzun su yenilenme süresi nedeniyle Marmara, sıcaklık artışı ve
        rüzgâr zayıflamasına Ege ve Karadeniz&apos;den daha şiddetli tepki verir.
        {criticalPts.length > 0 && (
          <div style={{ marginTop: "0.5rem", color: "#b91c1c" }}>
            🚨 <b>Kritik eşiği (75+) aşan noktalar:</b> {criticalPts.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}