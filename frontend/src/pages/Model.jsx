import { useEffect, useState } from "react";
import PlotChart from "../components/PlotChart";

const API = "http://127.0.0.1:8000/api";

const REGIONS = { marmara: "Marmara Denizi", aegean: "Ege Denizi", blacksea: "Karadeniz" };
const MODELS = [
  { key: "rf", label: "Random Forest" },
  { key: "xgb", label: "XGBoost (Boosting)" },
  { key: "svr", label: "SVR (Destek Vektör Regresyon)" },
];

const FEATURE_LABELS = {
  chl_log_lag1: "Önceki ayın klorofili",
  month_sin: "Mevsim (yılın hangi ayı olduğu, sinüs)",
  month_cos: "Mevsim (yılın hangi ayı olduğu, kosinüs)",
  sst: "Aynı ayın deniz yüzeyi sıcaklığı",
  sst_lag1: "Önceki ayın deniz yüzeyi sıcaklığı",
  wind: "Aynı ayın rüzgâr hızı",
  wind_lag1: "Önceki ayın rüzgâr hızı",
};

const trNum = (v, d = 2) => (v === null || v === undefined ? "–" : v.toFixed(d).replace(".", ","));

export default function Model() {
  const [region, setRegion] = useState("marmara");
  const [modelType, setModelType] = useState("rf");
  const [mlReport, setMlReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    fetch(`${API}/ml-report?region=${region}&model_type=${modelType}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Sunucu hatası: ${r.status}`);
        return r.json();
      })
      .then(setMlReport)
      .catch((err) => setError(err.message));
  }, [region, modelType]);

  if (error) {
    return (
      <div className="page-container" style={{ paddingTop: "40px" }}>
        <p className="mono" style={{ color: "#ff6b6b" }}>
          HATA: {error} — Backend (uvicorn api:app --port 8000) çalışıyor mu kontrol edin.
        </p>
      </div>
    );
  }

  const ready = mlReport && !mlReport.error;
  const total = ready ? mlReport.train_samples + mlReport.test_samples : 0;
  // The split is by date (train until 2019, test 2020–2024), so it is the same for every algorithm
  const testPct = ready ? Math.round((mlReport.test_samples / total) * 100) : 0;
  const hasImportance = modelType !== "svr"; // SVR has no built-in feature importance
  const sortedImportances =
    ready && hasImportance ? Object.entries(mlReport.feature_importances).sort((a, b) => b[1] - a[1]) : [];
  // bars are scaled to the most important variable so the longest bar is full width
  const maxImportance = sortedImportances.length ? sortedImportances[0][1] || 1 : 1;

  const darkPlotLayout = {
    paper_bgcolor: "#0d171c",
    plot_bgcolor: "#0d171c",
    font: { color: "#f0f0e8", size: 12 },
    xaxis: { gridcolor: "rgba(255,255,255,0.06)" },
    yaxis: { gridcolor: "rgba(255,255,255,0.06)" },
    margin: { t: 48, b: 40, l: 60, r: 24 },
  };

  return (
    <div className="page-container" style={{ paddingTop: "28px" }}>
      <div className="eyebrow mono">MAKİNE ÖĞRENMESİ PREDİKTÖRÜ</div>
      <h1 style={{ fontSize: "34px", fontWeight: 400, letterSpacing: "-1px", margin: "8px 0 4px" }}>
        Model Karşılaştırma &amp; Kriz Testi
      </h1>
      <p style={{ color: "#a1b0b4", fontSize: "13px", maxWidth: "850px", margin: "6px 0 0" }}>
        Modeller sıcaklık, rüzgâr, mevsim ve bir önceki ayın klorofil düzeyinden o ayın klorofil-a değerini tahmin
        eder. Eğitimde hiç görmedikleri 2020–2024 dönemi (2021 müsilaj krizi dahil) üzerinde sınanırlar.
      </p>

      <div className="control-bar">
        <div>
          <label className="mono" style={{ color: "#9ca8aa" }}>BÖLGE</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {Object.entries(REGIONS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: "span 3" }}>
          <label className="mono" style={{ color: "#9ca8aa" }}>ALGORİTMA</label>
          <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
            {MODELS.map((m) => (
              <button
                key={m.key}
                className="btn-outline"
                onClick={() => setModelType(m.key)}
                style={{
                  padding: "7px 14px",
                  fontSize: "11px",
                  borderColor: modelType === m.key ? "var(--acid)" : "#3b4748",
                  color: modelType === m.key ? "var(--acid)" : undefined,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!mlReport && <p className="mono">YAPAY ZEKÂ MODELİ YÜKLENİYOR...</p>}
      {mlReport?.error && <div className="detail-banner">{mlReport.error}</div>}

      {ready && (
        <>
          <div className="detail-banner" style={{ marginTop: 0 }}>
            Seçilen algoritma: <b style={{ color: "var(--acid)" }}>{mlReport.model_name}</b> · {REGIONS[mlReport.region]}.
            Model <b>{mlReport.train_period}</b> ({mlReport.train_samples} ay) ile eğitildi,{" "}
            <b>{mlReport.test_period}</b> ({mlReport.test_samples} ay) kör test setinde doğrulandı.
          </div>

          <div className="strip" style={{ marginTop: "10px" }}>
            <div>
              <div className="numeral" style={{ fontSize: "24px", color: "var(--acid)" }}>{mlReport.train_period}</div>
              <p>Eğitim dönemi · {mlReport.train_samples} ay (%{100 - testPct})</p>
            </div>
            <div>
              <div className="numeral" style={{ fontSize: "24px", color: "#4fd1b5" }}>{mlReport.test_period}</div>
              <p>Kör test dönemi · {mlReport.test_samples} ay (%{testPct})</p>
            </div>
            <div>
              <div className="numeral" style={{ fontSize: "24px", color: "var(--acid)" }}>{trNum(mlReport.r2_score)}</div>
              <p>R² açıklayıcılık skoru (log klorofil)</p>
            </div>
            <div>
              <div className="numeral" style={{ fontSize: "24px" }}>
                ±{trNum(mlReport.mae)} <small>mg/m³</small>
              </div>
              <p>Ortalama mutlak hata (MAE)</p>
            </div>
          </div>

          {/* Full-width chart */}
          <div className="dark-card" style={{ marginTop: "20px" }}>
            <PlotChart
              data={[
                {
                  x: mlReport.test_dates,
                  y: mlReport.actual_chl,
                  type: "scatter",
                  mode: "lines+markers",
                  name: "Gerçek NASA uydusu (MODIS)",
                  line: { color: "#4fd1b5", width: 2.2 },
                  marker: { size: 5 },
                },
                {
                  x: mlReport.test_dates,
                  y: mlReport.predicted_chl,
                  type: "scatter",
                  mode: "lines+markers",
                  name: `YZ tahmini (${modelType.toUpperCase()})`,
                  line: { color: "#d8f77a", width: 2.6, dash: "dot" },
                  marker: { size: 5 },
                },
              ]}
              layout={{
                ...darkPlotLayout,
                title: { text: `Kör Test Dönemi: Gerçek vs. YZ Klorofil-a (${modelType.toUpperCase()})`, font: { size: 15 } },
                xaxis: { ...darkPlotLayout.xaxis, tickformat: "%m.%Y", dtick: "M6" },
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
                    yanchor: "bottom",
                    text: "2021 Müsilaj Zirvesi",
                    showarrow: false,
                    font: { color: "#d8f77a", size: 11 },
                  },
                ],
                legend: { orientation: "h", y: -0.16 },
                height: 480,
              }}
            />
          </div>

          <div className="grid-2" style={{ marginTop: "20px" }}>
            <div className="dark-card">
              <h4>Model hangi değişkenlere dayanıyor?</h4>
              {hasImportance ? (
                <>
                  <p style={{ fontSize: "12px", color: "#9ca8aa", marginBottom: "14px" }}>
                    Her değişkenin, modelin klorofil tahmininde ne kadar kullanıldığı (öznitelik önemi). Toplam %100.
                    Bu bir neden-sonuç ölçüsü değildir; birbirine benzeyen değişkenler (ör. bu ay ve önceki ayın
                    sıcaklığı) önemi aralarında paylaşabilir.
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
                              width: `${(pct / maxImportance) * 100}%`,
                              height: "100%",
                              background: "linear-gradient(90deg, #4fd1b5, #d8f77a)",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p>
                  SVR, ağaç tabanlı modeller gibi yerleşik bir öznitelik önemi üretmez. Bu yüzden bu model için önem
                  dereceleri gösterilmiyor; karşılaştırma için Random Forest veya XGBoost seçin.
                </p>
              )}
            </div>

            <div className="dark-card">
              <h4>Sonuçlar nasıl okunur?</h4>
              <p style={{ marginBottom: "10px" }}>
                <b>R²:</b> Modelin, klorofilin aydan aya değişiminin ne kadarını açıkladığını gösterir (logaritmik
                ölçekte). 1&apos;e yaklaştıkça tahmin gerçeğe yaklaşır; 0 civarı, modelin ortalamadan daha iyi
                olmadığını gösterir.
              </p>
              <p style={{ marginBottom: "10px" }}>
                <b>MAE:</b> Tahminin gerçek değerden ortalama kaç mg/m³ saptığıdır.
              </p>
              <p>
                <b>Kör test:</b> Veri tarihe göre bölünür: model 2003–2019 ile eğitilir, 2020–2024&apos;ü hiç görmez.
                Bütün algoritmalar aynı dönemle sınandığı için oran (%23) hepsinde aynıdır; bu, karşılaştırmanın adil
                olmasını sağlar. 2021 zirvesini yakalayıp
                yakalayamadığı, aşırı olayları tahmin etme gücünü gösterir.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}