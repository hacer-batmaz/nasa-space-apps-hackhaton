import { useEffect, useState } from "react";
import PlotChart from "../components/PlotChart";

const API = "http://127.0.0.1:8000/api";

const REGIONS = { marmara: "Marmara Denizi", aegean: "Ege Denizi", blacksea: "Karadeniz" };
const VARS = {
  sst: { name: "Deniz Yüzeyi Sıcaklığı (SST)", unit: "°C", isPct: false },
  wind: { name: "Yüzey Rüzgâr Hızı", unit: "m/s", isPct: false },
  chl: { name: "Klorofil-a (CHL)", unit: "mg/m³", isPct: true },
  flh: { name: "Floresans Çizgi Yüksekliği (FLH)", unit: "W m⁻² µm⁻¹ sr⁻¹", isPct: false },
};
const TREND_TR = { increasing: "Artıyor ↑", decreasing: "Azalıyor ↓", "no trend": "Belirgin trend yok →" };

// Turkish number format (decimal comma); "–" for missing values
const tr = (v, d) => (v === null || v === undefined ? "–" : v.toFixed(d).replace(".", ","));

// Recorded mucilage events in the Sea of Marmara (see Kaynaklar page for the studies)
const EVENT_PERIODS = [
  { label: "2007–08 müsilajı", start: "2007-10-01", end: "2008-02-29" },
  { label: "2020–21 müsilajı", start: "2020-10-01", end: "2021-07-31" },
  { label: "2024 Erdek", start: "2024-10-01", end: "2024-10-31" },
];


export default function Statistics() {
  const [region, setRegion] = useState("marmara");
  const [variable, setVariable] = useState("chl");
  const [startYear, setStartYear] = useState(2003);
  const [endYear, setEndYear] = useState(2024);
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    const activeRegion = variable === "flh" ? "marmara" : region;
    if (variable === "flh" && region !== "marmara") setRegion("marmara");
    const params = new URLSearchParams({
      region: activeRegion,
      variable,
      start_year: startYear,
      end_year: endYear,
    });
    fetch(`${API}/statistics?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Sunucu hatası: ${r.status}`);
        return r.json();
      })
      .then(setRes)
      .catch((err) => setError(err.message));
  }, [region, variable, startYear, endYear]);

  if (error) {
    return (
      <div className="page-container" style={{ paddingTop: "40px" }}>
        <p className="mono" style={{ color: "#ff6b6b" }}>
          HATA: {error} — Backend (uvicorn api:app --port 8000) çalışıyor mu kontrol edin.
        </p>
      </div>
    );
  }

  if (!res) {
    return (
      <div className="page-container" style={{ paddingTop: "40px" }}>
        <p className="mono">İSTATİSTİKSEL TESTLER HESAPLANIYOR...</p>
      </div>
    );
  }

  const { stats } = res;
  const meta = VARS[variable];
  const changeTxt =
    stats.change_per_decade === null
      ? "–"
      : meta.isPct
      ? `${stats.change_per_decade > 0 ? "+" : ""}${tr(stats.change_per_decade, 1)}% / 10 yıl`
      : `${stats.change_per_decade > 0 ? "+" : ""}${tr(stats.change_per_decade, 2)} ${meta.unit} / 10 yıl`;

  const pTxt = stats.p_value === null ? "–" : stats.p_value < 0.001 ? "< 0,001" : tr(stats.p_value, 3);

  const darkPlotLayout = {
    paper_bgcolor: "#0d171c",
    plot_bgcolor: "#0d171c",
    font: { color: "#f0f0e8", size: 12 },
    xaxis: { gridcolor: "rgba(255,255,255,0.06)" },
    yaxis: { gridcolor: "rgba(255,255,255,0.06)" },
    margin: { t: 48, b: 40, l: 55, r: 20 },
  };

  // purple bands for the recorded mucilage events inside the selected year range
  const events = EVENT_PERIODS.filter(
    (e) => Number(e.end.slice(0, 4)) >= startYear && Number(e.start.slice(0, 4)) <= endYear
  );
  const eventShapes = events.map((e) => ({
    type: "rect", xref: "x", yref: "paper", x0: e.start, x1: e.end, y0: 0, y1: 1,
    fillcolor: "rgba(176, 75, 214, 0.2)", line: { width: 0 }, layer: "below",
  }));
  const eventLabels = events.map((e) => ({
    x: e.start, y: 1, xref: "x", yref: "paper", xanchor: "left", yanchor: "bottom",
    text: e.label, showarrow: false, font: { size: 10, color: "#c99be0" },
  }));

  return (
    <div className="page-container" style={{ paddingTop: "28px" }}>
      <div className="eyebrow mono">PARAMETRİK OLMAYAN ZAMAN SERİSİ ANALİZİ</div>
      <h1 style={{ fontSize: "34px", fontWeight: 400, letterSpacing: "-1px", margin: "8px 0 4px" }}>
        Bilimsel Trend ve İstatistik Analizi
      </h1>

      <div className="control-bar">
        <div>
          <label className="mono" style={{ color: "#9ca8aa" }}>BÖLGE</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {Object.entries(REGIONS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mono" style={{ color: "#9ca8aa" }}>DEĞİŞKEN</label>
          <select value={variable} onChange={(e) => setVariable(e.target.value)}>
            {Object.entries(VARS).map(([k, v]) => (
              <option key={k} value={k}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mono" style={{ color: "#9ca8aa" }}>BAŞLANGIÇ YILI: {startYear}</label>
          <input type="range" min="2003" max="2020" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--acid)", marginTop: "12px" }} />
        </div>
        <div>
          <label className="mono" style={{ color: "#9ca8aa" }}>BİTİŞ YILI: {endYear}</label>
          <input type="range" min="2008" max="2024" value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--acid)", marginTop: "12px" }} />
        </div>
      </div>

      <div className="strip" style={{ marginTop: "10px" }}>
        <div>
          <div className="numeral" style={{ fontSize: "24px" }}>{TREND_TR[stats.trend] || stats.trend}</div>
          <p>Mann-Kendall Trend Yönü</p>
        </div>
        <div>
          <div className="numeral" style={{ fontSize: "24px", color: "var(--acid)" }}>{changeTxt}</div>
          <p>Sen Eğimi (Sen&apos;s Slope)</p>
        </div>
        <div>
          <div className="numeral" style={{ fontSize: "24px" }}>{pTxt}</div>
          <p>{stats.significant ? "✔ İstatistiksel Anlamlı (p < 0,05)" : "Anlamlı Değil (p ≥ 0,05)"}</p>
        </div>
        <div>
          <div className="numeral" style={{ fontSize: "24px" }}>{stats.n_months} <small>ay</small></div>
          <p>{startYear}–{endYear} gözlem sayısı</p>
        </div>
      </div>

      <div className="detail-banner">
        {stats.significant ? (
          <>
            <b>Bilimsel Yorum (p &lt; 0,05):</b> {REGIONS[region]} bölgesinde <b>{meta.name}</b> için
            hesaplanan <b>{changeTxt}</b> değişimi istatistiksel olarak anlamlıdır: gerçekte hiçbir eğilim
            olmasaydı, bu kadar güçlü bir eğilimi yalnızca şans eseri görme olasılığı %5&apos;in altında olurdu.
          </>
        ) : (
          <>
            <b>Bilimsel Yorum (p ≥ 0,05):</b> Gözlenen eğim mevcut zaman aralığında doğal yıldan yıla
            dalgalanmalardan istatistiksel olarak ayırt edilememektedir.
          </>
        )}
      </div>

      <div className="dark-card" style={{ marginTop: "20px" }}>
        <PlotChart
          data={[
            { x: res.dates, y: res.values, type: "scatter", mode: "lines", name: "Aylık Ölçüm", line: { color: "#4fd1b5", width: 1.5 } },
            ...(res.trend_values.length
              ? [{ x: res.dates, y: res.trend_values, type: "scatter", mode: "lines", name: "Sen Eğimi Trendi", line: { color: "#d8f77a", width: 2.8, dash: "dash" } }]
              : []),
          ]}
          layout={{
            ...darkPlotLayout,
            title: { text: `Ham Zaman Serisi ve Sen Eğimi — ${meta.name}`, font: { size: 14 } },
            yaxis: { ...darkPlotLayout.yaxis, title: meta.unit, type: variable === "chl" ? "log" : "linear" },
            shapes: eventShapes,
            annotations: eventLabels,
            height: 360,
          }}
        />
      </div>

      <div className="dark-card" style={{ marginTop: "16px" }}>
        <PlotChart
          data={[
            // two traces so the legend explains the colours
            {
              x: res.dates,
              y: res.anomalies.map((v) => (v !== null && v >= 0 ? v : null)),
              type: "bar",
              name: "Normalden yüksek (o takvim ayının ortalamasının üstünde)",
              marker: { color: "#d8f77a" },
            },
            {
              x: res.dates,
              y: res.anomalies.map((v) => (v !== null && v < 0 ? v : null)),
              type: "bar",
              name: "Normalden düşük (o takvim ayının ortalamasının altında)",
              marker: { color: "#3b82f6" },
            },
          ]}
          layout={{
            ...darkPlotLayout,
            title: { text: `Mevsimsellikten Arındırılmış Aylık Anomali (${res.anomaly_unit})`, font: { size: 14 } },
            yaxis: { ...darkPlotLayout.yaxis, title: res.anomaly_unit, zeroline: true, zerolinecolor: "rgba(255,255,255,0.35)" },
            barmode: "relative",
            legend: { orientation: "h", y: -0.2 },
            shapes: eventShapes,
            annotations: eventLabels,
            height: 340,
          }}
        />
        {events.length > 0 && (
          <p style={{ fontSize: "11.5px", color: "#8a9a9e", margin: "6px 0 0" }}>
            <span style={{ display: "inline-block", width: 12, height: 10, background: "rgba(176,75,214,0.45)", marginRight: 6, verticalAlign: -1 }} />
            Mor bantlar, kayıtlı müsilaj olaylarının dönemleridir. İki grafikte de aynı şekilde işaretlidir.
          </p>
        )}
      </div>

    </div>
  );
}