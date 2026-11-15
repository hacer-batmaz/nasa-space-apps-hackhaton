from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from analysis import (  # noqa: E402
    RISK_WEIGHTS,
    VARIABLES,
    anomaly_for_display,
    baseline_conditions,
    get_series,
    risk_level as original_risk_level,
    risk_score,
    satellite_consistency,
    trend_line,
    trend_test,
)
from data_loader import load_all, load_catalog  # noqa: E402
from ml_model import predict_scenario_chl, train_and_evaluate  # noqa: E402

app = FastAPI(title="Mucilage Detective API")


def risk_level(score: float) -> str:
    """Translate display labels without changing the shared risk calculation."""
    return {"Düşük": "Low", "Orta": "Moderate", "Yüksek": "High", "Kritik": "Critical"}[original_risk_level(score)]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DF = load_all()
CATALOG = load_catalog()

MAP_POINTS = [
    {"name": "İzmit Bay", "region": "marmara", "lat": 40.74, "lon": 29.62, "susceptibility": 1.00, "note": "Enclosed bay; heavy industrial and urban wastewater load"},
    {"name": "Bosphorus (Marmara outlet)", "region": "marmara", "lat": 40.98, "lon": 28.98, "susceptibility": 0.95, "note": "Metropolitan wastewater and surface currents from the Black Sea"},
    {"name": "Gemlik Bay", "region": "marmara", "lat": 40.42, "lon": 28.95, "susceptibility": 0.95, "note": "Semi-enclosed bay; limited water exchange"},
    {"name": "Central Marmara", "region": "marmara", "lat": 40.75, "lon": 28.20, "susceptibility": 0.85, "note": "Open water; stratified two-layer structure"},
    {"name": "Kapıdağ / Erdek", "region": "marmara", "lat": 40.45, "lon": 27.75, "susceptibility": 0.92, "note": "One of the areas with extensive mucilage in 2021"},
    {"name": "North of Marmara Island", "region": "marmara", "lat": 40.68, "lon": 27.60, "susceptibility": 0.90, "note": "Shallow, sheltered waters between islands"},
    {"name": "Dardanelles entrance", "region": "marmara", "lat": 40.42, "lon": 26.72, "susceptibility": 0.85, "note": "Outlet of Marmara waters into the Aegean"},
    {"name": "Saros Bay", "region": "aegean", "lat": 40.55, "lon": 26.45, "susceptibility": 0.65, "note": "Semi-enclosed bay near the strait outlet"},
    {"name": "Off Gökçeada", "region": "aegean", "lat": 40.15, "lon": 25.65, "susceptibility": 0.55, "note": "Path of Marmara-origin waters into the Aegean"},
    {"name": "Off Bozcaada", "region": "aegean", "lat": 39.83, "lon": 25.95, "susceptibility": 0.55, "note": "Open Aegean; strong mixing"},
    {"name": "Edremit Bay", "region": "aegean", "lat": 39.50, "lon": 26.75, "susceptibility": 0.62, "note": "Bay waters; pressure from agriculture and tourism"},
    {"name": "Off İzmir", "region": "aegean", "lat": 38.55, "lon": 26.60, "susceptibility": 0.62, "note": "Metropolitan and Gediz River influence"},
    {"name": "Bosphorus (Black Sea outlet)", "region": "blacksea", "lat": 41.30, "lon": 29.15, "susceptibility": 0.75, "note": "Strait mouth; coastal mixing"},
    {"name": "Off Zonguldak", "region": "blacksea", "lat": 41.55, "lon": 31.75, "susceptibility": 0.65, "note": "Industrial coast; steep shelf"},
    {"name": "Off Sinop", "region": "blacksea", "lat": 42.15, "lon": 35.10, "susceptibility": 0.55, "note": "Predominantly open-sea conditions"},
    {"name": "Off Samsun", "region": "blacksea", "lat": 41.45, "lon": 36.40, "susceptibility": 0.72, "note": "Nutrient inputs from the Kızılırmak and Yeşilırmak rivers"},
]

# Tüm modelleri (RF, XGB, SVR) sunucu açılışında 3 havza için önbelleğe alıyoruz
ML_MODELS = {}
for reg in ("marmara", "aegean", "blacksea"):
    for m_type in ("rf", "xgb", "svr"):
        ML_MODELS[(reg, m_type)] = train_and_evaluate(DF, reg, m_type)


@app.get("/api/ml-report")
def get_ml_report(region: str = Query("marmara"), model_type: str = Query("rf")) -> dict:
    key = (region, model_type)
    bundle = ML_MODELS.get(key, ML_MODELS[("marmara", "rf")])
    return {k: v for k, v in bundle.items() if k != "_model"}


def clean_num(val: Any) -> float | None:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    return float(val)


@app.get("/api/overview")
def get_overview() -> dict:
    sst_m = trend_test(get_series(DF, "marmara", "sst"), False)
    chl_m = trend_test(get_series(DF, "marmara", "chl"), True)
    wind_m = trend_test(get_series(DF, "marmara", "wind"), False)
    chl_a = trend_test(get_series(DF, "aegean", "chl"), True)
    years = DF["date"].dt.year
    # 22-year trends of the three mucilage drivers for each sea (home-page strip)
    regions = {}
    for reg in ("marmara", "aegean", "blacksea"):
        out = {}
        for var, log_t in (("sst", False), ("wind", False), ("chl", True)):
            res = trend_test(get_series(DF, reg, var), log_t)
            out[f"{var}_change"] = clean_num(res["change_per_decade"])
            out[f"{var}_p"] = clean_num(res["p_value"])
        regions[reg] = out
    return {
        "regions": regions,
        "min_year": int(years.min()),
        "max_year": int(years.max()),
        "total_months": int(DF["date"].nunique()),
        "marmara_sst_change": clean_num(sst_m["change_per_decade"]),
        "marmara_sst_p": clean_num(sst_m["p_value"]),
        "marmara_chl_change": clean_num(chl_m["change_per_decade"]),
        "marmara_chl_p": clean_num(chl_m["p_value"]),
        "marmara_wind_change": clean_num(wind_m["change_per_decade"]),
        "marmara_wind_p": clean_num(wind_m["p_value"]),
        "aegean_chl_change": clean_num(chl_a["change_per_decade"]),
        "aegean_chl_p": clean_num(chl_a["p_value"]),
    }


REGION_TR = {"marmara": "Sea of Marmara", "aegean": "Aegean Sea", "blacksea": "Black Sea"}
REGION_LOC = {"marmara": "the Sea of Marmara", "aegean": "the Aegean Sea", "blacksea": "the Black Sea"}
MONTHS_TR = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
             "October", "November", "December"]
COMPONENT_TR = {"thermal": "temperature", "calm": "calm water (weak winds)", "biomass": "chlorophyll / nutrients"}
MONTHS = sorted(DF["date"].dropna().unique())
MIN_YEAR, MAX_YEAR = int(DF["date"].dt.year.min()), int(DF["date"].dt.year.max())


def tr_num(value: float, digits: int = 0, sign: bool = False) -> str:
    text = f"{value:+.{digits}f}" if sign else f"{value:.{digits}f}"
    return text


def basin_susceptibility() -> dict:
    sus: dict[str, list[float]] = {}
    for p in MAP_POINTS:
        sus.setdefault(p["region"], []).append(p["susceptibility"])
    return {r: float(np.mean(v)) for r, v in sus.items()}


def basin_risk(values: dict, region: str, d_sst: float, d_wind: int, d_chl: int) -> float:
    score, _ = risk_score(values["sst"] + d_sst, max(values["wind"] * (1 + d_wind / 100), 0.1),
                          max(values["chl"] * (1 + d_chl / 100), 1e-3), basin_susceptibility()[region])
    return score


@app.get("/api/months")
def get_months() -> dict:
    labels = [pd.Timestamp(m).strftime("%Y-%m") for m in MONTHS]
    default = "2021-05" if "2021-05" in labels else labels[-1]
    return {"months": labels, "default": default, "min_year": MIN_YEAR, "max_year": MAX_YEAR}


@app.get("/api/simulation")
def get_simulation(
    year: int = 2021,
    month: int = 5,
    climatology: bool = False,
    d_sst: float = 0.0,
    d_wind: int = 0,
    d_chl: int = 0,
    clim_start: int | None = None,
    clim_end: int | None = None,
) -> dict:
    mode = "climatology" if climatology else "event"
    clim_start = max(MIN_YEAR, clim_start or MIN_YEAR)
    clim_end = min(MAX_YEAR, clim_end or MAX_YEAR)
    if clim_end < clim_start:
        clim_start, clim_end = clim_end, clim_start
    base = {
        r: baseline_conditions(DF, r, mode, month=month, event_year=year,
                               start_year=clim_start, end_year=clim_end)
        for r in ("marmara", "aegean", "blacksea")
    }
    points_out = []
    for p in MAP_POINTS:
        b = base[p["region"]]
        sst = b["sst"] + d_sst
        wind = max(b["wind"] * (1 + d_wind / 100), 0.1)
        chl = max(b["chl"] * (1 + d_chl / 100), 1e-3)
        ai_chl = predict_scenario_chl(ML_MODELS[(p["region"], "rf")], sst, wind, b["chl"], month)
        score, comps = risk_score(sst, wind, chl, p["susceptibility"])
        base_score, _ = risk_score(b["sst"], b["wind"], b["chl"], p["susceptibility"])
        points_out.append({
            **p,
            "sst": round(sst, 2),
            "wind": round(wind, 2),
            "chl": round(chl, 2),
            "ai_chl": ai_chl,
            "score": round(score, 1),
            "base_score": round(base_score, 1),
            "level": risk_level(score),
            "components": {k: round(v, 3) for k, v in comps.items()},
        })
    # ---- basin summary (map points averaged per basin) ------------------------------------
    summary = {}
    for region in ("marmara", "aegean", "blacksea"):
        pts = [p for p in points_out if p["region"] == region]
        score = float(np.mean([p["score"] for p in pts]))
        base_score = float(np.mean([p["base_score"] for p in pts]))
        shares = {k: float(np.mean([RISK_WEIGHTS[k] * p["components"][k] * p["susceptibility"] for p in pts]))
                  for k in RISK_WEIGHTS}
        total = sum(shares.values()) or 1.0
        summary[region] = {
            "name": REGION_TR[region], "score": round(score, 1), "base_score": round(base_score, 1),
            "delta": round(score - base_score, 1), "level": risk_level(score),
            "drivers": {k: round(100 * v / total, 1) for k, v in shares.items()},
        }

    # ---- risk curve ---------------------------------------------------------------------
    # real data: the 12 months either side of the selected month
    # long-term normal: the 12 calendar months of the selected year range
    if climatology:
        series: dict[str, list] = {"mode": "climatology", "dates": MONTHS_TR}
        for region in ("marmara", "aegean", "blacksea"):
            series[region] = [round(basin_risk(baseline_conditions(DF, region, "climatology", month=m,
                                                                   start_year=clim_start, end_year=clim_end),
                                               region, d_sst, d_wind, d_chl), 1) for m in range(1, 13)]
    else:
        selected = pd.Timestamp(year=year, month=month, day=1)
        window = DF[(DF["date"] >= selected - pd.DateOffset(months=12)) &
                    (DF["date"] <= selected + pd.DateOffset(months=12))].dropna(subset=["sst", "wind", "chl"])
        series = {"mode": "event", "dates": sorted({d.strftime("%Y-%m") for d in window["date"]})}
        for region in ("marmara", "aegean", "blacksea"):
            sub = window[window["region"] == region].sort_values("date")
            series[region] = [round(basin_risk(r, region, d_sst, d_wind, d_chl), 1) for _, r in sub.iterrows()]

    insights = build_insights(year, month, climatology, clim_start, clim_end, summary, points_out,
                              d_sst, d_wind, d_chl)
    return {"base": base, "points": points_out, "weights": RISK_WEIGHTS, "summary": summary,
            "series": series, "insights": insights, "climatology_range": [clim_start, clim_end]}


def build_insights(year: int, month: int, climatology: bool, clim_start: int, clim_end: int,
                   summary: dict, points: list, d_sst: float, d_wind: int, d_chl: int) -> list[dict]:
    """Data-driven English interpretation sentences for the simulation page."""
    out = []
    month_name = MONTHS_TR[month - 1]
    m = summary["marmara"]

    if climatology:
        n_years = clim_end - clim_start + 1
        out.append({"kind": "info", "text": f"The map shows the average for {month_name} across "
                                            f"{n_years} years ({clim_start}–{clim_end}), "
                                            f"rather than a single year (a typical {month_name})."})
        # selected period's normal vs the full-record normal (shows long-term change)
        if (clim_start, clim_end) != (MIN_YEAR, MAX_YEAR):
            period = baseline_conditions(DF, "marmara", "climatology", month=month,
                                         start_year=clim_start, end_year=clim_end)
            full = baseline_conditions(DF, "marmara", "climatology", month=month)
            out.append({"kind": "compare", "text": (
                f"Compared with the full record ({MIN_YEAR}–{MAX_YEAR}), the {month_name} average "
                f"for {clim_start}–{clim_end} in Marmara differs by SST {tr_num(period['sst'] - full['sst'], 2, True)} °C, wind "
                f"{tr_num((period['wind'] / full['wind'] - 1) * 100, 0, True)} %, chlorophyll "
                f"{tr_num((period['chl'] / full['chl'] - 1) * 100, 0, True)} %.")})
    else:
        out.append({"kind": "info", "text": f"The map shows NASA observations for {month_name} {year}."})
        actual = baseline_conditions(DF, "marmara", "event", month=month, event_year=year)
        normal = baseline_conditions(DF, "marmara", "climatology", month=month)
        a_score = basin_risk(actual, "marmara", 0, 0, 0)
        n_score = basin_risk(normal, "marmara", 0, 0, 0)
        diff = a_score - n_score
        verdict = ("higher risk than normal" if diff > 2 else
                   ("lower risk than normal" if diff < -2 else "close to normal"))
        out.append({"kind": "compare", "text": (
            f"In Marmara, {month_name} {year} has {verdict} ({tr_num(a_score)} / normal {tr_num(n_score)}). "
            f"Deviations: SST {tr_num(actual['sst'] - normal['sst'], 1, True)} °C, wind "
            f"{tr_num((actual['wind'] / normal['wind'] - 1) * 100, 0, True)} %, chlorophyll "
            f"{tr_num((actual['chl'] / normal['chl'] - 1) * 100, 0, True)} %.")})

    # scenario effect
    changes = []
    if d_sst:
        changes.append(f"temperature {tr_num(d_sst, 1, True)} °C")
    if d_wind:
        changes.append(f"wind {tr_num(d_wind, 0, True)} %")
    if d_chl:
        changes.append(f"chlorophyll/nutrients {tr_num(d_chl, 0, True)} %")
    if changes and abs(m["delta"]) < 1:
        out.append({"kind": "scenario", "text": (
            f"The scenario ({', '.join(changes)}) barely changes Marmara risk this month "
            f"({tr_num(m['base_score'])} → {tr_num(m['score'])}). Seasonal conditions limit its effect.")})
    elif changes:
        verb = "increases" if m["delta"] > 0 else "decreases"
        text = (f"The scenario ({', '.join(changes)}) {verb} Marmara risk from {tr_num(m['base_score'])} to "
                f"{tr_num(m['score'])} points ({m['level']}).")
        ratios = [f"{tr_num(m['delta'] / summary[r]['delta'], 1)} times the increase in {REGION_LOC[r]}"
                  for r in ("aegean", "blacksea") if m["delta"] > 0.5 and summary[r]["delta"] > 0.5]
        if ratios and m["delta"] > 0:
            text += " The increase in Marmara is " + " and ".join(ratios) + "; its enclosed setting makes it more susceptible."
        out.append({"kind": "scenario", "text": text})
    else:
        out.append({"kind": "scenario", "text": "All scenario changes are zero: scores are calculated directly from "
                                                "NASA data with no changes to observed conditions."})

    # dominant driver
    top = max(m["drivers"], key=m["drivers"].get)
    out.append({"kind": "driver", "text": f"The largest contributor to Marmara risk is {COMPONENT_TR[top]} "
                                          f"({tr_num(m['drivers'][top])}% of the score)."})

    # rank among the same calendar month (real data only)
    if not climatology:
        same = DF[(DF["region"] == "marmara") & (DF["date"].dt.month == month)].dropna(subset=["sst", "wind", "chl"])
        scores = sorted(((basin_risk(r, "marmara", d_sst, d_wind, d_chl), r["date"].year)
                         for _, r in same.iterrows()), reverse=True)
        rank = next((i + 1 for i, (_, y) in enumerate(scores) if y == year), None)
        if rank:
            out.append({"kind": "rank", "text": f"Under these conditions, {month_name} {year} ranks #{rank} "
                                                f"for risk among the {len(scores)} observations for {month_name}."})

    # critical locations
    critical = [p["name"] for p in points if p["score"] >= 75]
    if critical:
        out.append({"kind": "alert", "text": f"Locations above the critical threshold (75): {', '.join(critical)}."})
    else:
        best = max(points, key=lambda p: p["score"])
        out.append({"kind": "ok", "text": f"No location exceeds the critical threshold; the highest risk is at {best['name']} "
                                          f"({tr_num(best['score'])}/100)."})
    return out


@app.get("/api/statistics")
def get_statistics(
    region: str = Query("marmara"),
    variable: str = Query("chl"),
    start_year: int = Query(2003),
    end_year: int = Query(2024),
) -> dict:
    log_t = VARIABLES[variable][2]
    series = get_series(DF, region, variable, start_year, end_year)
    res = trend_test(series, log_t)
    t_line = (
        trend_line(series, log_t, res["slope_per_month"])
        if not np.isnan(res["slope_per_month"])
        else pd.Series(dtype=float)
    )
    anom, anom_unit = anomaly_for_display(series, variable)

    comparison = []
    for reg in ("marmara", "aegean", "blacksea"):
        s = get_series(DF, reg, variable, start_year, end_year)
        if s.dropna().empty:
            continue
        r_res = trend_test(s, log_t)
        a_ser, _ = anomaly_for_display(s, variable)
        roll = a_ser.rolling(12, center=True, min_periods=9).mean()
        comparison.append({
            "region": reg,
            "trend": r_res["trend"],
            "change_per_decade": clean_num(r_res["change_per_decade"]),
            "p_value": clean_num(r_res["p_value"]),
            "significant": bool(r_res["significant"]),
            "rolling_dates": [d.strftime("%Y-%m-%d") for d in roll.index],
            "rolling_values": [clean_num(v) for v in roll.values],
        })

    flh_check = None
    if region == "marmara":
        chk = satellite_consistency(
            get_series(DF, "marmara", "chl", start_year, end_year),
            get_series(DF, "marmara", "flh", start_year, end_year),
        )
        flh_check = {k: (clean_num(v) if isinstance(v, float) else v) for k, v in chk.items()}

    return {
        "stats": {k: (clean_num(v) if isinstance(v, float) else v) for k, v in res.items()},
        "dates": [d.strftime("%Y-%m-%d") for d in series.index],
        "values": [clean_num(v) for v in series.values],
        "trend_values": [clean_num(v) for v in t_line.values] if not t_line.empty else [],
        "anomalies": [clean_num(v) for v in anom.values],
        "anomaly_unit": "% deviation" if anom_unit == "% sapma" else anom_unit,
        "comparison": comparison,
        "flh_check": flh_check,
    }


@app.get("/api/sources")
def get_sources() -> list[dict]:
    if CATALOG.empty:
        return []
    return CATALOG.fillna("").to_dict(orient="records")
