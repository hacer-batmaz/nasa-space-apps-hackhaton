import { useEffect, useState } from "react";
import PlotChart from "../components/PlotChart";

const API = "http://127.0.0.1:8000/api";

const REGIONS = { marmara: "Sea of Marmara", aegean: "Aegean Sea", blacksea: "Black Sea" };
const MODELS = [
    { key: "rf", label: "Random Forest" },
    { key: "xgb", label: "XGBoost (Boosting)" },
    { key: "svr", label: "SVR (Support Vector Regression)" },
];

const FEATURE_LABELS = {
    chl_log_lag1: "Previous month’s chlorophyll",
    season: "Season (month of the year)",
    sst: "Current month’s sea surface temperature",
    sst_lag1: "Previous month’s sea surface temperature",
    wind: "Current month’s wind speed",
    wind_lag1: "Previous month’s wind speed",
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
                    ERROR: {error} — Backend (uvicorn api:app --port 8000) must be running; check the server.
                </p>
            </div>
        );
    }

    const ready = mlReport && !mlReport.error;
    const total = ready ? mlReport.train_samples + mlReport.test_samples : 0;
    // The split is by date (train until 2019, test 2020–2024), so it is the same for every algorithm
    const testPct = ready ? Math.round((mlReport.test_samples / total) * 100) : 0;
    const hasImportance = modelType !== "svr"; // SVR has no built-in feature importance
    // month_sin and month_cos are two parts of one piece of information (the month), so they are shown as one row
    const mergedImportances = {};
    if (ready && hasImportance) {
        Object.entries(mlReport.feature_importances).forEach(([feat, pct]) => {
            const key = feat === "month_sin" || feat === "month_cos" ? "season" : feat;
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
                AI Model Comparison &amp; Crisis Test
            </h1>
            <p style={{ color: "#a1b0b4", fontSize: "13px", maxWidth: "850px", margin: "6px 0 0" }}>
                Models estimate monthly chlorophyll-a from temperature, wind, season and the previous month’s chlorophyll. They are evaluated on unseen data from 2020–2024, including the 2021 mucilage crisis.
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
                        Trained on <b>{mlReport.train_period}</b> ({mlReport.train_samples} months), evaluated on the held-out <b>{mlReport.test_period}</b> test set ({mlReport.test_samples} months).
                    </div>

                    <div className="strip" style={{ marginTop: "10px" }}>
                        <div>
                            <div className="numeral" style={{ fontSize: "24px", color: "var(--acid)" }}>{mlReport.train_period}</div>
                            <p>Training period · {mlReport.train_samples} months ({100 - testPct}%)</p>
                        </div>
                        <div>
                            <div className="numeral" style={{ fontSize: "24px", color: "#4fd1b5" }}>{mlReport.test_period}</div>
                            <p>Held-out test period · {mlReport.test_samples} months ({testPct}%)</p>
                        </div>
                        <div>
                            <div className="numeral" style={{ fontSize: "24px", color: "var(--acid)" }}>{trNum(mlReport.r2_score)}</div>
                            <p>R² score (log chlorophyll)</p>
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
                                    name: "NASA observations (MODIS)",
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
                                title: { text: `Held-out Test: Observed vs. Predicted Chlorophyll-a (${modelType.toUpperCase()})`, font: { size: 15 } },
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
                            <h4>Which features does the model use?</h4>
                            {hasImportance ? (
                                <>
                                    <p style={{ fontSize: "12px", color: "#9ca8aa", marginBottom: "14px" }}>
                                        Relative feature importance in chlorophyll prediction; values sum to 100%. This is not a measure of causality. Correlated features, such as current and previous month’s temperature, may share importance. Because sea temperature also carries the season (warm in summer, cold in winter), the season variable gets a small share.                                    </p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                        {sortedImportances.map(([feat, pct]) => (
                                            <div key={feat}>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                                                    <span>{FEATURE_LABELS[feat] || feat}</span>
                                                    <b style={{ color: "var(--acid)" }}>{pct.toFixed(1)}%</b>
                                                </div>
                                                <div style={{ width: "100%", height: "7px", background: "#16272e", borderRadius: "4px", overflow: "hidden" }}>
                                                    <div
                                                        style={{
                                                            width: `${pct}%`,
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
                                    Unlike tree-based models, SVR does not provide built-in feature importance. Select Random Forest or XGBoost to view importance values.
                                </p>
                            )}
                        </div>

                        <div className="dark-card">
                            <h4>How to read the results</h4>
                            <p style={{ marginBottom: "10px" }}>
                                <b>R²:</b> Measures how much monthly chlorophyll variation is explained on a logarithmic scale. Values closer to 1 indicate better agreement; around 0 means performance is comparable to predicting the mean.
                            </p>
                            <p style={{ marginBottom: "10px" }}>
                                <b>MAE:</b> The average absolute difference between predictions and observations, in mg/m³.
                            </p>
                            <p>
                                <b>Held-out test:</b> Data are split chronologically: models train on 2003–2019 and are tested on unseen 2020–2024 data. The same test period (23%) is used for every algorithm for a fair comparison. Performance around the 2021 peak shows how well they estimate extreme chlorophyll values.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}