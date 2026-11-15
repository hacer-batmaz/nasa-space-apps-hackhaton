import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward, ZoomIn, ZoomOut } from "lucide-react";
import RiskMap, { riskColor } from "../components/RiskMap";
import PlotChart from "../components/PlotChart";
import "./Simulation.css";

// same base address as the other pages (Home, Statistics, Sources)
const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül",
  "Ekim", "Kasım", "Aralık"];
const REGIONS = [
  { key: "marmara", label: "Marmara" },
  { key: "aegean", label: "Ege" },
  { key: "blacksea", label: "Karadeniz" },
];
const REGION_COLORS = { marmara: "#d8f77a", aegean: "#6fb7e0", blacksea: "#9ca8aa" };
const SPEEDS = [
  { label: "0,5×", ms: 1800 },
  { label: "1×", ms: 1000 },
  { label: "2×", ms: 500 },
  { label: "4×", ms: 220 },
];
const STEPS = [
  { label: "Aylık", months: 1 },
  { label: "Mevsimlik", months: 3 },
  { label: "Yıllık", months: 12 },
];
const DRIVERS = [
  { key: "thermal", label: "Sıcaklık", color: "#ff6b5b" },
  { key: "calm", label: "Durgunluk", color: "#b48cff" },
  { key: "biomass", label: "Klorofil / besin", color: "#5fc27e" },
];
const INSIGHT_ICONS = { info: "◎", compare: "⇄", scenario: "◐", driver: "➤", rank: "▤", alert: "▲", ok: "✓" };
// 0 = no change: the month's measured satellite conditions
const DEFAULT_SCENARIO = { d_sst: 0, d_wind: 0, d_chl: 0 };
const YEAR_MIN = 2003;
const YEAR_MAX = 2024;
const METRICS = [
  { key: "score", label: "Risk skoru" },
  { key: "sst", label: "Sıcaklık" },
  { key: "wind", label: "Rüzgâr" },
  { key: "chl", label: "CHL" },
];

function monthLabel(ym) {
  if (!ym) return "–";
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_TR[m - 1]} ${y}`;
}

function fmt(v, digits = 0, sign = false) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const s = Number(v).toFixed(digits).replace(".", ",");
  return sign && v > 0 ? `+${s}` : s;
}

export default function Simulation() {
  const [months, setMonths] = useState([]);
  const [idx, setIdx] = useState(0);
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [climatology, setClimatology] = useState(false);
  const [climRange, setClimRange] = useState([YEAR_MIN, YEAR_MAX]);
  const [region, setRegion] = useState("marmara");
  const [selectedPoint, setSelectedPoint] = useState("İzmit Körfezi");
  const [activeMetric, setActiveMetric] = useState("score");
  const [baseLayer, setBaseLayer] = useState("light");
  const [showBoxes, setShowBoxes] = useState(true);
  const [focus, setFocus] = useState("turkey");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [step, setStep] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const playTimer = useRef(null);

  // ---- month list ------------------------------------------------------------------------
  useEffect(() => {
    // fallback when an older api.py without /api/months is running: Jan 2003 – Dec 2024
    const fallback = Array.from({ length: 264 }, (_, i) =>
      `${2003 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
    fetch(`${API}/months`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no months endpoint"))))
      .then((res) => {
        setMonths(res.months);
        setIdx(Math.max(0, res.months.indexOf(res.default)));
      })
      .catch(() => {
        setMonths(fallback);
        setIdx(fallback.indexOf("2021-05"));
      });
  }, []);

  const current = months[idx];
  const currentMonth = current ? Number(current.split("-")[1]) : 5;
  const stepMonths = climatology ? 1 : STEPS[step].months;

  // ---- simulation data (debounced for sliders, aborted when outdated) -----------------------
  useEffect(() => {
    if (!current) return;
    const [year, month] = current.split("-").map(Number);
    const params = new URLSearchParams({
      year,
      month,
      climatology,
      ...scenario,
      clim_start: climRange[0],
      clim_end: climRange[1],
    });
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`${API}/simulation?${params}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((res) => {
          setData(res);
          setError(null);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError("Simülasyon verisi alınamadı.");
        });
    }, playing ? 0 : 150);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [current, scenario, climatology, climRange, playing]);

  // ---- autoplay: advance only after the current frame has rendered ------------------------
  useEffect(() => {
    if (!playing || !data || !months.length) return;
    playTimer.current = setTimeout(() => {
      setIdx((i) => (i + stepMonths) % months.length);
    }, SPEEDS[speed].ms);
    return () => clearTimeout(playTimer.current);
  }, [playing, data, speed, stepMonths, months.length]);

  const move = (delta) => setIdx((i) => (i + delta + months.length) % months.length);
  const setScenarioValue = (key, value) => setScenario((s) => ({ ...s, [key]: value }));

  const currentPt = data?.points?.find((p) => p.name === selectedPoint) || data?.points?.[0] || null;
  const selectPoint = (name) => {
    setSelectedPoint(name);
    const pt = data?.points?.find((p) => p.name === name);
    if (pt?.region) setRegion(pt.region);
  };

  const reading = (() => {
    if (!currentPt) return { val: "–", unit: "" };
    if (activeMetric === "sst") return { val: fmt(currentPt.sst, 1), unit: "°C · deniz yüzeyi sıcaklığı" };
    if (activeMetric === "wind") return { val: fmt(currentPt.wind, 1), unit: "m/s · yüzey rüzgâr hızı" };
    if (activeMetric === "chl") return { val: fmt(currentPt.chl, 2), unit: "mg/m³ · klorofil-a" };
    return { val: fmt(currentPt.score), unit: `/100 · ${currentPt.level} risk` };
  })();
  const pointDelta = currentPt ? currentPt.score - currentPt.base_score : 0;
  const scenarioActive = scenario.d_sst !== 0 || scenario.d_wind !== 0 || scenario.d_chl !== 0;
  const periodLabel = climatology
    ? `${MONTHS_TR[currentMonth - 1]} · ${climRange[0]}–${climRange[1]} ortalaması`
    : monthLabel(current);
  const setClimYear = (which, value) =>
    setClimRange(([a, b]) => (which === 0 ? [Math.min(value, b), b] : [a, Math.max(value, a)]));

  // ---- risk curve chart --------------------------------------------------------------------
  const curve = useMemo(() => {
    if (!data?.series) return null;
    const isClim = data.series.mode === "climatology";
    const dates = isClim ? data.series.dates : data.series.dates.map((d) => `${d}-01`);
    const traces = REGIONS.map((r) => ({
      x: dates,
      y: data.series[r.key],
      type: "scatter",
      mode: "lines+markers",
      name: r.label,
      line: { color: REGION_COLORS[r.key], width: r.key === "marmara" ? 3 : 1.6 },
      marker: { size: r.key === "marmara" ? 6 : 4 },
      hovertemplate: `${isClim ? "%{x}" : "%{x|%m.%Y}"}: %{y:.0f}/100<extra>${r.label}</extra>`,
    }));
    const selIndex = isClim ? currentMonth - 1 : data.series.dates.indexOf(current);
    if (selIndex >= 0) {
      traces.push({
        x: [dates[selIndex]],
        y: [data.series.marmara[selIndex]],
        type: "scatter",
        mode: "markers",
        name: "Seçili ay",
        marker: { size: 15, color: "#0b151b", line: { color: "#d8f77a", width: 3 } },
        hoverinfo: "skip",
      });
    }
    return {
      data: traces,
      layout: {
        height: 300,
        margin: { l: 44, r: 16, t: 10, b: 36 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { color: "#a9b8bb", size: 11 },
        yaxis: { range: [0, 100], gridcolor: "rgba(255,255,255,0.07)", title: "Risk skoru" },
        xaxis: isClim
          ? { gridcolor: "rgba(255,255,255,0.04)", type: "category" }
          : { gridcolor: "rgba(255,255,255,0.04)", tickformat: "%m.%Y" },
        legend: { orientation: "h", y: 1.14, x: 0 },
        shapes: [
          { type: "rect", xref: "paper", x0: 0, x1: 1, y0: 75, y1: 100, fillcolor: "#b04bd6", opacity: 0.1, line: { width: 0 } },
          ...(selIndex >= 0
            ? [{ type: "line", x0: dates[selIndex], x1: dates[selIndex], yref: "paper", y0: 0, y1: 1, line: { color: "#d8f77a", dash: "dot", width: 1 } }]
            : []),
        ],
      },
      config: { displayModeBar: false },
    };
  }, [data, current, currentMonth]);

  return (
    <div className="page-container">
      <div className="sim-head">
        <span className="mono eyebrow">Simülasyon · Müsilaj risk atlası</span>
        <h1>Türk denizlerinde müsilaj riski</h1>
        <p>
          Gerçek NASA uydu verisinden (MODIS-Aqua, MERRA-2) bir ay seçin ya da zamanı oynatın; senaryo
          kaydırıcılarıyla sıcaklık, rüzgâr ve besin koşullarını değiştirin.
        </p>
      </div>

      {error && <div className="sim-error">{error}</div>}

      <div className="atlas-wrapper">
        <div className="atlas-stage">
          <RiskMap
            points={data?.points || []}
            baseLayer={baseLayer}
            showBoxes={showBoxes}
            focus={focus}
            selectedName={currentPt?.name}
            onSelect={selectPoint}
          />

          {/* ---- left panel: selected coastal point (click a point on the map) ------------- */}
          <div className="floating-panel">
            <span className="mono eyebrow">
              Bölgesel gözlem · {periodLabel}
            </span>
            <h2>{currentPt?.name || "–"}</h2>
            {currentPt && (
              <p className="point-coords">
                {fmt(currentPt.lat, 2)}° K · {fmt(currentPt.lon, 2)}° D
              </p>
            )}
            <div className="switches">
              {METRICS.map((m) => (
                <button key={m.key} className={activeMetric === m.key ? "active" : ""} onClick={() => setActiveMetric(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="reading-big" style={{ color: currentPt && activeMetric === "score" ? riskColor(currentPt.score) : undefined }}>
              {reading.val}
            </div>
            <div className="reading-sub">{reading.unit}</div>
            {currentPt && Math.abs(pointDelta) >= 0.1 && (
              <div className={pointDelta > 0 ? "delta up" : "delta down"} style={{ fontSize: 12, marginTop: 6 }}>
                {fmt(pointDelta, 1, true)} puan senaryo etkisi (baz {fmt(currentPt.base_score)})
              </div>
            )}
            {currentPt?.note && <p className="point-note">{currentPt.note}</p>}
            <p className="point-hint mono">Başka bir noktayı seçmek için haritada tıklayın</p>
          </div>

          {/* ---- right panel: scenario ------------------------------------------------------ */}
          <div className="sim-sliders-panel">
            <div className="panel-head">
              <span className="mono eyebrow">Senaryo simülasyonu</span>
              <button className="btn-outline zoom-btn" onClick={() => setFocus(focus === "turkey" ? "marmara" : "turkey")}>
                {focus === "turkey" ? <ZoomIn size={13} /> : <ZoomOut size={13} />}
                <span>{focus === "turkey" ? "Marmara" : "Tüm Türkiye"}</span>
              </button>
            </div>
            <label>
              ΔSST <b>{fmt(scenario.d_sst, 1, true)} °C</b>
            </label>
            <input type="range" min={-2} max={4} step={0.1} value={scenario.d_sst}
              onChange={(e) => setScenarioValue("d_sst", Number(e.target.value))} />
            <label>
              ΔRüzgâr <b>{fmt(scenario.d_wind, 0, true)} %</b>
            </label>
            <input type="range" min={-50} max={50} step={5} value={scenario.d_wind}
              onChange={(e) => setScenarioValue("d_wind", Number(e.target.value))} />
            <label>
              ΔKlorofil / besin <b>{fmt(scenario.d_chl, 0, true)} %</b>
            </label>
            <input type="range" min={-40} max={150} step={5} value={scenario.d_chl}
              onChange={(e) => setScenarioValue("d_chl", Number(e.target.value))} />
            <button className="btn-outline reset-btn" disabled={!scenarioActive} onClick={() => setScenario(DEFAULT_SCENARIO)}>
              <RotateCcw size={13} /> {climatology ? "Ortalama koşullara dön" : "Gerçek veriye dön"}
            </button>
            <p className="preset-note">
              {climatology
                ? `0 değeri "müsilaj yok" demek değildir; ${climRange[0]}–${climRange[1]} ortalama koşullarının hiç değiştirilmediği anlamına gelir. Kaydırıcılar bu ortalamaya göre farkı gösterir.`
                : "0 değeri \"müsilaj yok\" demek değildir; seçili ayın uydu ile ölçülen koşullarının hiç değiştirilmediği anlamına gelir. Kaydırıcılar bu gerçek duruma göre farkı gösterir."}
            </p>
          </div>

          {/* ---- map tools: legend, base layer, data boxes ------------------------------------ */}
          <div className="map-tools">
            <div className="risk-legend">
              {[
                ["Düşük", 10],
                ["Orta", 30],
                ["Yüksek", 60],
                ["Kritik", 80],
              ].map(([label, v]) => (
                <span key={label}>
                  <i style={{ background: riskColor(v) }} />
                  {label}
                </span>
              ))}
            </div>
            <div className="layer-tools">
              {[
                ["satellite", "Uydu"],
                ["light", "Açık"],
              ].map(([key, label]) => (
                <button key={key} className={baseLayer === key ? "chip active" : "chip"} onClick={() => setBaseLayer(key)}>
                  {label}
                </button>
              ))}
              <label className="check-row inline">
                <input type="checkbox" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} />
                Veri kutuları
              </label>
            </div>
          </div>
        </div>

        {/* ---- time bar ------------------------------------------------------------------------ */}
        <div className="timebar">
          <div className="player">
            <button className="icon-btn" onClick={() => move(-stepMonths)} aria-label="Geri">
              <SkipBack size={14} />
            </button>
            <button className="btn-acid play-btn" onClick={() => setPlaying((p) => !p)} disabled={!months.length}>
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? "Durdur" : "Oynat"}
            </button>
            <button className="icon-btn" onClick={() => move(stepMonths)} aria-label="İleri">
              <SkipForward size={14} />
            </button>
          </div>

          <div className="time-slider">
            {climatology ? (
              <>
                <div className="time-labels">
                  <span className="mono">Ocak</span>
                  <span className="time-current">{periodLabel}</span>
                  <span className="mono">Aralık</span>
                </div>
                {/* long-term normal: only the calendar month matters */}
                <input type="range" min={1} max={12} value={currentMonth}
                  onChange={(e) => setIdx((i) => i - currentMonth + Number(e.target.value))} />
              </>
            ) : (
              <>
                <div className="time-labels">
                  <span className="mono">{months[0] ? monthLabel(months[0]) : ""}</span>
                  <span className="time-current">{monthLabel(current)}</span>
                  <span className="mono">{months.length ? monthLabel(months[months.length - 1]) : ""}</span>
                </div>
                <input type="range" min={0} max={Math.max(0, months.length - 1)} value={idx}
                  onChange={(e) => setIdx(Number(e.target.value))} />
              </>
            )}
          </div>

          <div className="player-options">
            <label className="mono">Hız</label>
            <div className="chip-row">
              {SPEEDS.map((s, i) => (
                <button key={s.label} className={speed === i ? "chip active" : "chip"} onClick={() => setSpeed(i)}>
                  {s.label}
                </button>
              ))}
            </div>
            <label className="mono">Adım</label>
            <div className="chip-row">
              {STEPS.map((s, i) => (
                <button key={s.label} className={step === i ? "chip active" : "chip"} onClick={() => setStep(i)}
                  disabled={climatology && i > 0} title={climatology && i > 0 ? "Tarihsel ortalamada ay ay ilerler" : undefined}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- comparison baseline: real month vs long-term normal --------------------------- */}
        <div className="baseline-bar">
          <div className="baseline-switch">
            <span className="mono">Veri tabanı</span>
            <div className="segmented">
              <button className={!climatology ? "active" : ""} onClick={() => setClimatology(false)}>
                Gerçek ay verisi
              </button>
              <button className={climatology ? "active" : ""} onClick={() => setClimatology(true)}>
                Tarihsel ortalama
              </button>
            </div>
          </div>
          {climatology && (
            <div className="baseline-range">
              <span className="mono">Ortalama alınan yıllar</span>
              <select value={climRange[0]} onChange={(e) => setClimYear(0, Number(e.target.value))}>
                {Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span>–</span>
              <select value={climRange[1]} onChange={(e) => setClimYear(1, Number(e.target.value))}>
                {Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="chip-row">
                {[
                  ["Tümü", YEAR_MIN, YEAR_MAX],
                  ["İlk 10 yıl", 2003, 2012],
                  ["Son 10 yıl", 2015, 2024],
                ].map(([label, a, b]) => (
                  <button key={label} className={climRange[0] === a && climRange[1] === b ? "chip active" : "chip"}
                    onClick={() => setClimRange([a, b])}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="baseline-note">
            {climatology
              ? `Seçili ayın tek bir yılı yerine ${climRange[0]}–${climRange[1]} arasındaki ${climRange[1] - climRange[0] + 1} yılın aynı ayının ortalaması kullanılır: "normal bir ${MONTHS_TR[currentMonth - 1]}". Yıl aralığını değiştirerek örneğin ilk 10 yılın normalini son 10 yılınkiyle karşılaştırabilirsiniz.`
              : "Haritada seçili ayın gerçek uydu ölçümleri gösterilir. \"Tarihsel ortalama\"yı seçerseniz tek bir yıl yerine seçtiğiniz yıl aralığındaki aynı ayın ortalaması kullanılır."}
          </p>
        </div>
      </div>

      {/* ---- simulation analysis (prominent) --------------------------------------------------- */}
      <section className="sim-analysis">
        <div className="sim-analysis-head">
          <span className="mono eyebrow">Simülasyon analizi</span>
          <h2>
            {periodLabel} {scenarioActive ? "· senaryo uygulanmış" : "· gerçek koşullar"}
          </h2>
        </div>

        {data && !data.summary && (
          <div className="sim-error" style={{ marginBottom: 16 }}>
            Analiz verisi gelmedi: arka uçta eski api.py çalışıyor. Yeni api.py dosyasını koyup uvicorn'u yeniden başlatın.
          </div>
        )}
        <div className="basin-cards">
          {REGIONS.map((r) => {
            const s = data?.summary?.[r.key];
            return (
              <div key={r.key} className={`basin-card ${region === r.key ? "selected" : ""}`} onClick={() => setRegion(r.key)}>
                <div className="basin-top">
                  <span className="basin-name">{s?.name || r.label}</span>
                  <span className="level-badge" style={{ background: s ? riskColor(s.score) : "#333" }}>{s?.level || "–"}</span>
                </div>
                <div className="basin-score" style={{ color: s ? riskColor(s.score) : undefined }}>
                  {s ? fmt(s.score) : "–"}<small>/100</small>
                </div>
                <div className="score-track">
                  <div className="score-fill" style={{ width: `${s?.score || 0}%`, background: s ? riskColor(s.score) : "#333" }} />
                  <div className="score-mark" style={{ left: "75%" }} />
                </div>
                <div className="basin-delta">
                  {s && Math.abs(s.delta) >= 0.1 ? (
                    <span className={s.delta > 0 ? "delta up" : "delta down"}>{fmt(s.delta, 1, true)} puan senaryo etkisi</span>
                  ) : (
                    <span className="delta flat">Senaryo etkisi yok</span>
                  )}
                </div>
                <div className="driver-bar" title="Skorun etkenlere göre dağılımı">
                  {DRIVERS.map((d) => (
                    <div key={d.key} style={{ width: `${s?.drivers?.[d.key] || 0}%`, background: d.color }}>
                      {(s?.drivers?.[d.key] || 0) >= 14 ? `%${fmt(s.drivers[d.key])}` : ""}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="driver-legend">
          {DRIVERS.map((d) => (
            <span key={d.key}>
              <i style={{ background: d.color }} />
              {d.label}
            </span>
          ))}
        </div>

        <div className="analysis-grid">
          <div className="insight-panel">
            <h3>Yorum</h3>
            <ul className="insight-list">
              {(data?.insights || []).map((ins, i) => (
                <li key={i} className={`insight ${ins.kind}`}>
                  <span className="insight-icon">{INSIGHT_ICONS[ins.kind] || "•"}</span>
                  <span>{ins.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="curve-panel">
            <h3>Aylık risk eğrisi</h3>
            <p className="curve-note">{climatology ? `${climRange[0]}–${climRange[1]} ortalamasıyla 12 takvim ayı` : "Seçili ayın 12 ay öncesi ve sonrası"}, senaryo uygulanmış hâliyle. Mor bant kritik bölge (75+).</p>
            {curve && <PlotChart data={curve.data} layout={curve.layout} config={curve.config} />}
          </div>
        </div>

        <p className="method-note">
          <b>Nasıl hesaplanıyor?</b> Sıcaklık (%35), durgunluk (%25) ve klorofil (%40) etkenleri 0–1 arasına ölçeklenip
          konumun yerel duyarlılığıyla çarpılır. Bu skor senaryo tabanlı bir göstergedir; doğrulanmış bir tahmin modeli değildir.
        </p>
      </section>
    </div>
  );
}