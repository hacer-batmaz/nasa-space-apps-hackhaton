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

const FEATURE_LABELS = {
  chl_log_lag1: "Önceki Ay Biyokütle Birikimi (CHL t-1)",
  month_sin: "Mevsimsel Döngü (Sinüs)",
  month_cos: "Mevsimsel Döngü (Kosinüs)",
  sst: "Anlık Deniz Yüzeyi Sıcaklığı (SST)",
  sst_lag1: "Önceki Ay Sıcaklık Etkisi (SST t-1)",
  wind: "Anlık Yüzey Rüzgâr Hızı",
  wind_lag1: "Önceki Ay Durgunluk Etkisi (Rüzgâr t-1)",
};

export default function Statistics() {
  const [region, setRegion] = useState("marmara");
  const [variable, setVariable] = useState("chl");
  const [startYear, setStartYear] = useState(2003);
  const [endYear, setEndYear] = useState(2024);
  const [modelType, setModelType] = useState("rf"); // "rf" | "xgb"
  const [res, setRes] = useState(null);
  const [mlReport, setMlReport] = useState(null);
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

  // Seçilen model türüne (rf/xgb) göre YZ raporunu çek
  useEffect(() => {
    const activeRegion = variable === "flh" ? "marmara" : region;
    fetch(`${API}/ml-report?region=${activeRegion}&model_type=${modelType}`)
      .then((r) => r.json())
      .then(setMlReport)
      .catch(console.error);
  }, [region, variable, modelType]);

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
        <p className="mono">İSTATİSTİKSEL TESTLER VE YAPAY ZEKÂ MODELİ YÜKLENİYOR...</p>
      </div>
    );
  }

  const { stats } = res;
  const meta = VARS[variable];
  const changeTxt =
    stats.change_per_decade === null
      ? "–"
      : meta.isPct
      ? `${stats.change_per_decade > 0 ? "+" : ""}${stats.change_per_decade.toFixed(1)}% / 10 yıl`
      : `${stats.change_per_decade > 0 ? "+" : ""}${stats.change_per_decade.toFixed(2)} ${meta.unit} / 10 yıl`;

  const pTxt = stats.p_value === null ? "–" : stats.p_value < 0.001 ? "< 0,001" : stats.p_value.toFixed(3);

  const darkPlotLayout = {
    paper_bgcolor: "#0d171c",
    plot_bgcolor: "#0d171c",
    font: { color: "#f0f0e8", size: 12 },
    xaxis: { gridcolor: "rgba(255,255,255,0.06)" },
    yaxis: { gridcolor: "rgba(255,255,255,0.06)" },
    margin: { t: 48, b: 40, l: 55, r: 20 },
  };

  const sortedImportances = mlReport?.feature_importances
    ? Object.entries(mlReport.feature_importances).sort((a, b) => b[1] - a[1])
    : [];

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
            hesaplanan <b>{changeTxt}</b> değişimi istatistiksel olarak anlamlıdır; doğal dalgalanma veya
            tesadüf olma ihtimali %5&apos;in altındadır.
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
            height: 360,
          }}
        />
      </div>

      <div className="dark-card" style={{ marginTop: "16px" }}>
        <PlotChart
          data={[
            {
              x: res.dates,
              y: res.anomalies,
              type: "bar",
              name: "Anomali",
              marker: { color: res.anomalies.map((v) => (v >= 0 ? "#d8f77a" : "#3b82f6")) },
            },
          ]}
          layout={{
            ...darkPlotLayout,
            title: { text: `Mevsimsellikten Arındırılmış Aylık Anomali (${res.anomaly_unit})`, font: { size: 14 } },
            yaxis: { ...darkPlotLayout.yaxis, title: res.anomaly_unit },
            height: 310,
          }}
        />
      </div>

      {/* YZ MODEL DOĞRULAMA VE MODEL SEÇİM PANELİ */}
      {mlReport && !mlReport.error && (
        <div className="section-block" style={{ marginTop: "36px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <div className="eyebrow mono">MAKİNE ÖĞRENMESİ PREDİKTÖRÜ</div>
              <h2 style={{ fontSize: "26px", fontWeight: 400, letterSpacing: "-0.6px", margin: "6px 0 4px" }}>
                Yapay Zekâ Model Karşılaştırma &amp; Kriz Testi ({REGIONS[mlReport.region]})
              </h2>
            </div>
            {/* Model Seçim Butonları */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className={`btn-outline ${modelType === "rf" ? "active" : ""}`}
                onClick={() => setModelType("rf")}
                style={{ padding: "7px 14px", fontSize: "11px", borderColor: modelType === "rf" ? "var(--acid)" : "#3b4748" }}
              >
                Random Forest
              </button>
              <button
                className={`btn-outline ${modelType === "xgb" ? "active" : ""}`}
                onClick={() => setModelType("xgb")}
                style={{ padding: "7px 14px", fontSize: "11px", borderColor: modelType === "xgb" ? "var(--acid)" : "#3b4748" }}
              >
                XGBoost (Boosting)
              </button>
              <button
                className={`btn-outline ${modelType === "svr" ? "active" : ""}`}
                onClick={() => setModelType("svr")}
                style={{ padding: "7px 14px", fontSize: "11px", borderColor: modelType === "svr" ? "var(--acid)" : "#3b4748" }}
              >
                SVR (Destek Vektör Regresyon)
              </button>
            </div>
          </div>

          <p style={{ color: "#a1b0b4", fontSize: "13px", maxWidth: "850px", margin: "10px 0 16px" }}>
            Seçilen Algoritma: <b style={{ color: "var(--acid)" }}>{mlReport.model_name}</b>. Model{" "}
            <b>{mlReport.train_period}</b> ({mlReport.train_samples} ay) ile eğitilmiş, <b>{mlReport.test_period}</b> (
            {mlReport.test_samples} ay — 2021 büyük müsilaj krizi dahil) kör test setinde doğrulanmıştır.
          </p>

          <div className="strip" style={{ marginTop: "8px" }}>
            <div>
              <div className="numeral" style={{ fontSize: "24px", color: "var(--acid)" }}>
                {mlReport.train_period}
              </div>
              <p>Eğitim Seti (%80)</p>
            </div>
            <div>
              <div className="numeral" style={{ fontSize: "24px", color: "#4fd1b5" }}>
                {mlReport.test_period}
              </div>
              <p>Kör Test Seti (%20)</p>
            </div>
            <div>
              <div className="numeral" style={{ fontSize: "24px", color: "var(--acid)" }}>
                {mlReport.r2_score.toFixed(2).replace(".", ",")}
              </div>
              <p>R² Açıklayıcılık Skoru</p>
            </div>
            <div>
              <div className="numeral" style={{ fontSize: "24px" }}>
                ±{mlReport.mae.toFixed(2).replace(".", ",")} <small>mg/m³</small>
              </div>
              <p>Ortalama Mutlak Hata (MAE)</p>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: "20px" }}>
            <div className="dark-card">
              <PlotChart
                data={[
                  {
                    x: mlReport.test_dates,
                    y: mlReport.actual_chl,
                    type: "scatter",
                    mode: "lines+markers",
                    name: "Gerçek NASA Uydusu (MODIS)",
                    line: { color: "#4fd1b5", width: 2 },
                    marker: { size: 4 },
                  },
                  {
                    x: mlReport.test_dates,
                    y: mlReport.predicted_chl,
                    type: "scatter",
                    mode: "lines+markers",
                    name: `YZ Tahmini (${modelType.toUpperCase()})`,
                    line: { color: "#d8f77a", width: 2.5, dash: "dot" },
                    marker: { size: 4 },
                  },
                ]}
                layout={{
                  ...darkPlotLayout,
                  title: { text: `Kör Test Dönemi: Gerçek vs. YZ Klorofil-a (${modelType.toUpperCase()})`, font: { size: 13.5 } },
                  yaxis: { ...darkPlotLayout.yaxis, title: "Klorofil-a (mg/m³)", rangemode: "tozero" },
                  shapes: [
                    {
                      type: "rect",
                      xref: "x",
                      yref: "paper",
                      x0: "2021-03-01",
                      x1: "2021-07-01",
                      y0: 0,
                      y1: 1,
                      fillcolor: "rgba(216, 247, 122, 0.14)",
                      line: { width: 0 },
                    },
                  ],
                  annotations: [
                    {
                      x: "2021-05-01",
                      y: 1,
                      yref: "paper",
                      text: "2021 Müsilaj Zirvesi",
                      showarrow: false,
                      font: { color: "#d8f77a", size: 10 },
                    },
                  ],
                  legend: { orientation: "h", y: -0.22 },
                  height: 360,
                }}
              />
            </div>

            <div className="dark-card">
              <h4>Öznitelik Önem Dereceleri (Feature Importance)</h4>
              <p style={{ fontSize: "12px", color: "#9ca8aa", marginBottom: "14px" }}>
                Modelin klorofil sıçramalarını tahmin ederken hangi değişkenlere ağırlık verdiği:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {sortedImportances.map(([feat, pct]) => (
                  <div key={feat}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                      <span>{FEATURE_LABELS[feat] || feat}</span>
                      <b style={{ color: "var(--acid)" }}>%{pct.toFixed(1).replace(".", ",")}</b>
                    </div>
                    <div style={{ width: "100%", height: "7px", background: "#16272e", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(pct * 1.4, 100)}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #4fd1b5, #d8f77a)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="panel-card dark-card" style={{ marginTop: "20px" }}>
        <h4>Ek İstatistiksel Test: Spearman Sıra Korelasyonu (0–3 Ay Gecikmeli)</h4>
        <table className="dark-table" style={{ marginTop: "10px" }}>
          <thead>
            <tr>
              <th>İlişki</th>
              <th>ρ (Aynı Ay)</th>
              <th>p (Aynı Ay)</th>
              <th>En Güçlü Gecikme</th>
              <th>ρ (En Güçlü)</th>
              <th>p (En Güçlü)</th>
            </tr>
          </thead>
          <tbody>
            {res.correlations.map((c) => (
              <tr key={c.label}>
                <td><b>{c.label}</b></td>
                <td>{c.rho_same?.toFixed(2)}</td>
                <td>{c.p_same?.toFixed(3)}</td>
                <td>{c.best_lag} ay</td>
                <td style={{ color: "var(--acid)" }}>{c.rho_best?.toFixed(2)}</td>
                <td>{c.p_best?.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}