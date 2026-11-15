import { useEffect, useState } from "react";
import PlotChart from "../components/PlotChart";

const API = import.meta.env.VITE_API_URL || "/api";

const REGIONS = { marmara: "Sea of Marmara", aegean: "Aegean Sea", blacksea: "Black Sea" };
const MODELS = [
  { key: "rf", label: "Random Forest" },
  { key: "xgb", label: "XGBoost (Boosting)" },
  { key: "svr", label: "SVR (Support Vector Regression)" },
];

// Each model input belongs to one of four groups; the page shows one row per group
const FEATURE_GROUP = {
  sst: "sst", sst_lag1: "sst", sst_lag2: "sst", sst_roll3: "sst",
  chl_log_lag1: "chl", chl_log_lag2: "chl",
  wind: "wind", wind_lag1: "wind", wind_roll3: "wind",
  month_sin: "season", month_cos: "season",
};

const GROUP_LABELS = {
  sst: { name: "Sea surface temperature", detail: "this month, last month, 2 months ago and the 3-month average" },
  chl: { name: "Recent chlorophyll", detail: "last month and 2 months ago" },
  wind: { name: "Wind speed", detail: "this month, last month and the 3-month average" },
  season: { name: "Season", detail: "month of the year" },
};

const trNum = (v, d = 2) => (v === null || v === undefined ? "–" : v.toFixed(d));

export default function Model() {
  const [region, setRegion] = useState("marmara");
  const [modelType, setModelType] = useState("rf");
  const [mlReport, setMlReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    fetch(`${API}/ml-report?region=${region}&model_type=${modelType}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server error: ${r.status}`);
        return r.json();
      })
      .then(setMlReport)
      .catch((err) => setError(err.message));
  }, [region, modelType]);

  if (error) {
    return (
      <div className="page-container" style={{ paddingTop: "40px" }}>
        <p className="mono" style={{ color: "#ff6b6b" }}>
          ERROR: {error} — Check whether the backend (uvicorn api:app --port 8000) is running.
        </p>
      </div>
    );
  }

  const ready = mlReport && !mlReport.error;
  const total = ready ? mlReport.train_samples + mlReport.test_samples : 0;
  // The split is by date (train until 2019, test 2020–2024), so it is the same for every algorithm
  const testPct = ready ? Math.round((mlReport.test_samples / total) * 100) : 0;
  const hasImportance = modelType !== "svr"; // SVR has no built-in feature importance
  // inputs of the same kind (e.g. this month's and last month's temperature) are added up into one group
  const mergedImportances = {};
  if (ready && hasImportance) {
    Object.entries(mlReport.feature_importances).forEach(([feat, pct]) => {
      const key = FEATURE_GROUP[feat] || feat;
      mergedImportances[key] = (mergedImportances[key] || 0) + pct;
    });
  }
  const sortedImportances = Object.entries(mergedImportances).sort((a, b) => b[1] - a[1]);

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
      <div className="eyebrow mono">MACHINE LEARNING PREDICTOR</div>
      <h1 style={{ fontSize: "34px", fontWeight: 400, letterSpacing: "-1px", margin: "8px 0 4px" }}>
        Model Comparison &amp; Crisis Test
      </h1>
      <p style={{ color: "#a1b0b4", fontSize: "13px", maxWidth: "850px", margin: "6px 0 0" }}>
        The models predict each month's chlorophyll-a value from temperature, wind, season and the previous month's
        chlorophyll level. They are tested on the 2020–2024 period (including the 2021 mucilage crisis), which they
        never saw during training.
      </p>

      <div className="control-bar">
        <div>
          <label className="mono" style={{ color: "#9ca8aa" }}>REGION</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {Object.entries(REGIONS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: "span 3" }}>
          <label className="mono" style={{ color: "#9ca8aa" }}>ALGORITHM</label>
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

      {!mlReport && <p className="mono">LOADING AI MODEL...</p>}
      {mlReport?.error && <div className="detail-banner">{mlReport.error}</div>}

      {ready && (
        <>
          <div className="detail-banner" style={{ marginTop: 0 }}>
            Selected algorithm: <b style={{ color: "var(--acid)" }}>{mlReport.model_name}</b> · {REGIONS[mlReport.region]}.
            The model was trained on <b>{mlReport.train_period}</b> ({mlReport.train_samples} months) and validated on
            the <b>{mlReport.test_period}</b> ({mlReport.test_samples} months) blind test set.
          </div>

          <div className="strip" style={{ marginTop: "10px" }}>
            <div>
              <div className="numeral" style={{ fontSize: "24px", color: "var(--acid)" }}>{mlReport.train_period}</div>
              <p>Training period · {mlReport.train_samples} months ({100 - testPct}%)</p>
            </div>
            <div>
              <div className="numeral" style={{ fontSize: "24px", color: "#4fd1b5" }}>{mlReport.test_period}</div>
              <p>Blind test period · {mlReport.test_samples} months ({testPct}%)</p>
            </div>
            <div>
              <div className="numeral" style={{ fontSize: "24px", color: "var(--acid)" }}>{trNum(mlReport.r2_score)}</div>
              <p>R² explanatory score (log chlorophyll)</p>
            </div>
            <div>
              <div className="numeral" style={{ fontSize: "24px" }}>
                ±{trNum(mlReport.mae)} <small>mg/m³</small>
              </div>
              <p>Mean absolute error (MAE)</p>
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
                  name: "Actual NASA satellite (MODIS)",
                  line: { color: "#4fd1b5", width: 2.2 },
                  marker: { size: 5 },
                },
                {
                  x: mlReport.test_dates,
                  y: mlReport.predicted_chl,
                  type: "scatter",
                  mode: "lines+markers",
                  name: `AI prediction (${modelType.toUpperCase()})`,
                  line: { color: "#d8f77a", width: 2.6, dash: "dot" },
                  marker: { size: 5 },
                },
              ]}
              layout={{
                ...darkPlotLayout,
                title: { text: `Blind Test Period: Actual vs. AI Chlorophyll-a (${modelType.toUpperCase()})`, font: { size: 15 } },
                xaxis: { ...darkPlotLayout.xaxis, tickformat: "%m.%Y", dtick: "M6" },
                yaxis: { ...darkPlotLayout.yaxis, title: "Chlorophyll-a (mg/m³)", rangemode: "tozero" },
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
                    text: "2021 Mucilage Peak",
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
              <h4>Which variables does the model rely on?</h4>
              {hasImportance ? (
                <>
                  <p style={{ fontSize: "12px", color: "#9ca8aa", marginBottom: "14px" }}>
                    How much the model relies on each group of inputs (feature importance, total 100%). Each group
                    combines related inputs, such as this month's and last month's temperature. This is not a measure
                    of cause and effect. Because sea temperature also carries the season (warm in summer, cold in
                    winter), part of its share reflects the seasonal cycle.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {sortedImportances.map(([feat, pct]) => (
                      <div key={feat}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                          <span>
                            {GROUP_LABELS[feat]?.name || feat}
                            <small style={{ color: "#8a9a9e", marginLeft: "6px" }}>{GROUP_LABELS[feat]?.detail}</small>
                          </span>
                          <b style={{ color: "var(--acid)" }}>{pct.toFixed(1)}%</b>
                        </div>
                        <div style={{ width: "100%", height: "7px", background: "#16272e", borderRadius: "4px", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${pct}%`, // bars are on a 0–100 % scale, like the numbers
                              minWidth: "3px",
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
                  Unlike tree-based models, SVR does not produce a built-in feature importance. That is why importance
                  scores are not shown for this model; select Random Forest or XGBoost for comparison.
                </p>
              )}
            </div>

            <div className="dark-card">
              <h4>How to read the results</h4>
              <p style={{ marginBottom: "10px" }}>
                <b>R²:</b> Shows how much of the month-to-month variation in chlorophyll the model explains (on a
                logarithmic scale). The closer it is to 1, the closer the prediction is to reality; around 0 means the
                model is no better than the average.
              </p>
              <p style={{ marginBottom: "10px" }}>
                <b>MAE:</b> How many mg/m³ the prediction deviates from the actual value on average.
              </p>
              <p>
                <b>Blind test:</b> The data is split by date: the model is trained on 2003–2019 and never sees
                2020–2024. Because all algorithms are tested on the same period, the ratio (23%) is the same for all of
                them; this keeps the comparison fair. Whether it catches the 2021 peak or not shows its ability to
                predict extreme events.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}