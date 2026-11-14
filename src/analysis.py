"""
analysis.py
Statistical methods and the scenario-based mucilage risk index.

Trend method (per region and variable):
  1. log10 transform     -> chlorophyll only (log-normally distributed)
  2. anomaly             -> value minus the long-term mean of the same calendar month
  3. trend test          -> Mann-Kendall with Hamed-Rao autocorrelation correction
  4. trend magnitude     -> Sen's slope, expressed per decade
Extra tests:
  - Spearman rank correlation between deseasonalised anomalies
  - Event z-scores (how unusual each month was for its calendar month)

Risk index:
  A transparent, scenario-based indicator (0-100) combining thermal, calm-water and
  nutrient/biomass components. It is NOT a validated forecast model.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy import stats

from data_loader import ROOT, load_all  # noqa: F401  (ROOT re-exported for scripts)

# ----------------------------------------------------------------------------- metadata
VARIABLES = {
    # key: (English name, unit, log-transform?)
    "chl":  ("Chlorophyll-a", "mg m-3", True),
    "sst":  ("Sea surface temperature", "°C", False),
    "wind": ("Surface wind speed", "m/s", False),
    "flh":  ("Fluorescence line height", "W m-2 µm-1 sr-1", False),
}
REGIONS = {"marmara": "Sea of Marmara", "blacksea": "Black Sea (Türkiye coast)", "aegean": "Aegean Sea (Türkiye coast)"}
SIGNIFICANCE_LEVEL = 0.05
MONTHS_PER_DECADE = 120


# ----------------------------------------------------------------------------- data access
def load_data() -> pd.DataFrame:
    """Merged monthly table. Column 'date' is also exposed as 'time' for older scripts."""
    df = load_all()
    df["time"] = df["date"]
    return df


def get_series(df: pd.DataFrame, region: str, variable: str,
               start_year: int | None = None, end_year: int | None = None) -> pd.Series:
    """Monthly series for one region/variable, indexed by date, optionally limited to a year range."""
    date_col = "date" if "date" in df.columns else "time"
    s = df.loc[df["region"] == region].set_index(date_col)[variable].sort_index()
    if start_year is not None:
        s = s[s.index.year >= start_year]
    if end_year is not None:
        s = s[s.index.year <= end_year]
    return s.astype(float)


# ----------------------------------------------------------------------------- core transforms
def transform(series: pd.Series, log_transform: bool) -> pd.Series:
    """log10 for log-normal variables (non-positive values -> NaN), identity otherwise."""
    if log_transform:
        return np.log10(series.where(series > 0))
    return series


def climatology(series: pd.Series, log_transform: bool) -> pd.Series:
    """Long-term mean of each calendar month, aligned to the series index (transformed space)."""
    x = transform(series, log_transform)
    return x.groupby(x.index.month).transform("mean")


def compute_anomaly(series: pd.Series, log_transform: bool) -> pd.Series:
    """Deseasonalised anomaly in transformed space: value minus same-calendar-month mean."""
    return transform(series, log_transform) - climatology(series, log_transform)


def anomaly_for_display(series: pd.Series, variable: str) -> tuple[pd.Series, str]:
    """
    Anomaly in the most readable unit:
      chl -> % deviation from the monthly normal (via log space)
      flh -> % deviation from the monthly normal (linear)
      sst, wind -> deviation in native units
    """
    log_transform = VARIABLES[variable][2]
    anomaly = compute_anomaly(series, log_transform)
    if variable == "chl":
        return (10 ** anomaly - 1) * 100, "% sapma"
    if variable == "flh":
        clim = climatology(series, False)
        return anomaly / clim * 100, "% sapma"
    return anomaly, VARIABLES[variable][1]


def z_scores(series: pd.Series, log_transform: bool) -> pd.Series:
    """Anomaly divided by the standard deviation of its calendar month."""
    anomaly = compute_anomaly(series, log_transform)
    return anomaly / anomaly.groupby(anomaly.index.month).transform("std")


# ----------------------------------------------------------------------------- statistical tests
def trend_test(series: pd.Series, log_transform: bool) -> dict:
    """Mann-Kendall (Hamed-Rao corrected) + Sen's slope on the deseasonalised anomaly."""
    anomaly = compute_anomaly(series, log_transform).dropna()
    if len(anomaly) < 24:
        return {"trend": "insufficient data", "p_value": np.nan, "significant": False,
                "change_per_decade": np.nan, "change_unit": "", "slope_per_month": np.nan,
                "n_months": len(anomaly)}

    result = mk.hamed_rao_modification_test(anomaly.values)
    slope_per_decade = result.slope * MONTHS_PER_DECADE
    if log_transform:
        change, unit = (10 ** slope_per_decade - 1) * 100, "% per decade"
    else:
        change, unit = slope_per_decade, "per decade"

    return {
        "trend": result.trend,
        "p_value": float(result.p),
        "significant": bool(result.p < SIGNIFICANCE_LEVEL),
        "change_per_decade": float(change),
        "change_unit": unit,
        "slope_per_month": float(result.slope),   # in transformed units per month
        "n_months": int(len(anomaly)),
    }


def trend_line(series: pd.Series, log_transform: bool, slope_per_month: float) -> pd.Series:
    """
    Sen's-slope trend line drawn on the original scale:
    long-term mean level + slope * (months since series midpoint).
    """
    x = transform(series, log_transform).dropna()
    months = (x.index.year - x.index.year.min()) * 12 + (x.index.month - x.index.month.min())
    months = np.asarray(months, dtype=float)
    line = x.mean() + slope_per_month * (months - months.mean())
    line = pd.Series(line, index=x.index)
    return 10 ** line if log_transform else line


def spearman_anomaly_correlation(series_a: pd.Series, log_a: bool,
                                 series_b: pd.Series, log_b: bool, lag_months: int = 0) -> dict:
    """
    Spearman rank correlation between deseasonalised anomalies of two series.
    lag_months > 0 means series_a leads series_b by that many months.
    """
    a = compute_anomaly(series_a, log_a)
    b = compute_anomaly(series_b, log_b)
    if lag_months:
        a = a.shift(lag_months)
    joined = pd.concat([a, b], axis=1).dropna()
    if len(joined) < 24:
        return {"rho": np.nan, "p_value": np.nan, "n": len(joined), "significant": False}
    rho, p = stats.spearmanr(joined.iloc[:, 0], joined.iloc[:, 1])
    return {"rho": float(rho), "p_value": float(p), "n": int(len(joined)), "significant": bool(p < SIGNIFICANCE_LEVEL)}


def event_anomaly(series: pd.Series, log_transform: bool, start: str, end: str) -> pd.DataFrame:
    """Anomaly and z-score for each month in an event window (e.g. the 2021 mucilage)."""
    anomaly = compute_anomaly(series, log_transform)
    z = anomaly / anomaly.groupby(anomaly.index.month).transform("std")
    window = slice(start, end)
    out = pd.DataFrame({"anomaly": anomaly[window], "z_score": z[window]})
    if log_transform:
        out["percent_of_normal"] = (10 ** out["anomaly"] - 1) * 100
    return out


def satellite_consistency(chl: pd.Series, flh: pd.Series) -> dict:
    """
    CHL vs FLH reliability check (Marmara): do two independent optical indicators agree?
      - Spearman correlation of their deseasonalised anomalies
      - sign agreement of their anomalies during the 2021 mucilage peak (Apr–Jun)
    """
    corr = spearman_anomaly_correlation(chl, True, flh, False)
    a_chl = compute_anomaly(chl, True)["2021-04":"2021-06"]
    a_flh = compute_anomaly(flh, False)["2021-04":"2021-06"]
    joined = pd.concat([a_chl, a_flh], axis=1).dropna()
    agree = int((np.sign(joined.iloc[:, 0]) == np.sign(joined.iloc[:, 1])).sum()) if len(joined) else 0

    if corr["significant"] and corr["rho"] > 0.3:
        status = "consistent"
    elif corr["significant"] and corr["rho"] > 0:
        status = "partly consistent"
    else:
        status = "inconsistent"
    return {**corr, "event_months_agree": agree, "event_months_total": int(len(joined)), "status": status}


def describe_trend(region: str, variable: str, res: dict) -> str:
    """Plain-English sentence summarising a trend result (used by run_analysis.py)."""
    name, unit, log_transform = VARIABLES[variable]
    size = (f"{res['change_per_decade']:+.1f}% per decade" if log_transform
            else f"{res['change_per_decade']:+.2f} {unit} per decade")
    verdict = "statistically significant" if res["significant"] else "not statistically significant"
    direction = {"increasing": "increasing", "decreasing": "decreasing"}.get(res["trend"], "showing no clear trend")
    return (f"{name} in the {REGIONS[region]} is {direction} ({size}, p = {res['p_value']:.3f}), "
            f"which is {verdict} at the 5% level.")


# ----------------------------------------------------------------------------- risk index
# Thresholds and weights are expert-judgement settings, shown openly in the app.
RISK_WEIGHTS = {"thermal": 0.35, "calm": 0.25, "biomass": 0.40}
SST_MIDPOINT, SST_SCALE = 17.0, 1.5          # °C: spring warmth favouring mucilage formation
WIND_MIDPOINT, WIND_SCALE = 5.0, 0.8         # m/s: below this the surface layer tends to stay calm
CHL_MIDPOINT, CHL_SCALE = np.log10(2.0), 0.3 # mg m-3: eutrophic threshold, evaluated in log10
RISK_LEVELS = [(25, "Düşük"), (50, "Orta"), (75, "Yüksek"), (101, "Kritik")]


def _sigmoid(x: np.ndarray | float) -> np.ndarray | float:
    return 1.0 / (1.0 + np.exp(-x))


def risk_components(sst: float, wind: float, chl: float) -> dict:
    """Each component scaled to 0..1 with a smooth logistic curve."""
    return {
        "thermal": float(_sigmoid((sst - SST_MIDPOINT) / SST_SCALE)),
        "calm":    float(_sigmoid((WIND_MIDPOINT - wind) / WIND_SCALE)),
        "biomass": float(_sigmoid((np.log10(max(chl, 1e-3)) - CHL_MIDPOINT) / CHL_SCALE)),
    }


def risk_score(sst: float, wind: float, chl: float, susceptibility: float) -> tuple[float, dict]:
    """
    Composite mucilage risk score (0-100):
        score = 100 * susceptibility * (0.35*thermal + 0.25*calm + 0.40*biomass)
    susceptibility (0-1) reflects how enclosed / nutrient-loaded a location is.
    """
    comps = risk_components(sst, wind, chl)
    weighted = sum(RISK_WEIGHTS[k] * v for k, v in comps.items())
    return float(np.clip(100 * susceptibility * weighted, 0, 100)), comps


def risk_level(score: float) -> str:
    for upper, label in RISK_LEVELS:
        if score < upper:
            return label
    return RISK_LEVELS[-1][1]


def baseline_conditions(df: pd.DataFrame, region: str, mode: str, month: int = 5,
                        event_year: int = 2021, start_year: int | None = None,
                        end_year: int | None = None) -> dict:
    """
    Baseline SST / wind / CHL for a region from the real data.
      mode = "climatology": mean of the given calendar month over all years
                            (or only start_year..end_year when given)
      mode = "event":       the given month of event_year (e.g. May 2021)
    """
    rows = df[df["region"] == region]
    date_col = "date" if "date" in rows.columns else "time"
    if mode == "event":
        rows = rows[(rows[date_col].dt.year == event_year) & (rows[date_col].dt.month == month)]
        return {v: float(rows[v].iloc[0]) for v in ("sst", "wind", "chl")}
    rows = rows[rows[date_col].dt.month == month]
    if start_year is not None:
        rows = rows[rows[date_col].dt.year >= start_year]
    if end_year is not None:
        rows = rows[rows[date_col].dt.year <= end_year]
    return {
        "sst": float(rows["sst"].mean()),
        "wind": float(rows["wind"].mean()),
        "chl": float(10 ** np.log10(rows["chl"]).mean()),   # geometric mean for log-normal chl
    }