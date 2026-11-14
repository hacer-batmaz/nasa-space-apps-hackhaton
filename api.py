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
    risk_level,
    risk_score,
    satellite_consistency,
    spearman_anomaly_correlation,
    trend_line,
    trend_test,
)
from data_loader import load_all, load_catalog  # noqa: E402

app = FastAPI(title="Müsilaj Dedektifi API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DF = load_all()
CATALOG = load_catalog()

MAP_POINTS = [
    {"name": "İzmit Körfezi", "region": "marmara", "lat": 40.74, "lon": 29.62, "susceptibility": 1.00, "note": "Kapalı körfez; yoğun sanayi ve kentsel atık su yükü"},
    {"name": "İstanbul Boğazı (Marmara çıkışı)", "region": "marmara", "lat": 40.98, "lon": 28.98, "susceptibility": 0.95, "note": "Megakent atık suyu ve Karadeniz kökenli yüzey akıntısı"},
    {"name": "Gemlik Körfezi", "region": "marmara", "lat": 40.42, "lon": 28.95, "susceptibility": 0.95, "note": "Yarı kapalı körfez; zayıf su değişimi"},
    {"name": "Orta Marmara", "region": "marmara", "lat": 40.75, "lon": 28.20, "susceptibility": 0.85, "note": "Açık su; iki katmanlı (tabakalı) yapı"},
    {"name": "Kapıdağ / Erdek", "region": "marmara", "lat": 40.45, "lon": 27.75, "susceptibility": 0.92, "note": "2021'de yoğun müsilaj gözlenen alanlardan"},
    {"name": "Marmara Adası kuzeyi", "region": "marmara", "lat": 40.68, "lon": 27.60, "susceptibility": 0.90, "note": "Adalar arası sığ ve korunaklı sular"},
    {"name": "Çanakkale Boğazı girişi", "region": "marmara", "lat": 40.42, "lon": 26.72, "susceptibility": 0.85, "note": "Marmara sularının Ege'ye çıkış kapısı"},
    {"name": "Saros Körfezi", "region": "aegean", "lat": 40.55, "lon": 26.45, "susceptibility": 0.65, "note": "Boğaz çıkışına yakın, yarı kapalı körfez"},
    {"name": "Gökçeada açıkları", "region": "aegean", "lat": 40.15, "lon": 25.65, "susceptibility": 0.55, "note": "Marmara kökenli suların Ege'ye yayıldığı hat"},
    {"name": "Bozcaada açıkları", "region": "aegean", "lat": 39.83, "lon": 25.95, "susceptibility": 0.55, "note": "Açık Ege; güçlü karışım"},
    {"name": "Edremit Körfezi", "region": "aegean", "lat": 39.50, "lon": 26.75, "susceptibility": 0.62, "note": "Körfez içi; tarım ve turizm baskısı"},
    {"name": "İzmir açıkları", "region": "aegean", "lat": 38.55, "lon": 26.60, "susceptibility": 0.62, "note": "Büyükşehir ve Gediz etkisi"},
    {"name": "İstanbul Boğazı (Karadeniz çıkışı)", "region": "blacksea", "lat": 41.30, "lon": 29.15, "susceptibility": 0.75, "note": "Boğaz ağzı; kıyısal karışım"},
    {"name": "Zonguldak açıkları", "region": "blacksea", "lat": 41.55, "lon": 31.75, "susceptibility": 0.65, "note": "Sanayi kıyısı; dik şelf"},
    {"name": "Sinop açıkları", "region": "blacksea", "lat": 42.15, "lon": 35.10, "susceptibility": 0.55, "note": "Açık deniz özellikleri baskın"},
    {"name": "Samsun açıkları", "region": "blacksea", "lat": 41.45, "lon": 36.40, "susceptibility": 0.72, "note": "Kızılırmak ve Yeşilırmak besin girdisi"},
]


def clean_num(val: Any) -> float | None:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    return float(val)


@app.get("/api/overview")
def get_overview() -> dict:
    sst_m = trend_test(get_series(DF, "marmara", "sst"), False)
    chl_m = trend_test(get_series(DF, "marmara", "chl"), True)
    chl_a = trend_test(get_series(DF, "aegean", "chl"), True)
    years = DF["date"].dt.year
    return {
        "min_year": int(years.min()),
        "max_year": int(years.max()),
        "total_months": int(DF["date"].nunique()),
        "marmara_sst_change": clean_num(sst_m["change_per_decade"]),
        "marmara_sst_p": clean_num(sst_m["p_value"]),
        "marmara_chl_change": clean_num(chl_m["change_per_decade"]),
        "marmara_chl_p": clean_num(chl_m["p_value"]),
        "aegean_chl_change": clean_num(chl_a["change_per_decade"]),
        "aegean_chl_p": clean_num(chl_a["p_value"]),
    }


@app.get("/api/simulation")
def get_simulation(
    year: int = 2021,
    month: int = 5,
    climatology: bool = False,
    d_sst: float = 0.0,
    d_wind: int = 0,
    d_chl: int = 0,
) -> dict:
    mode = "climatology" if climatology else "event"
    base = {
        r: baseline_conditions(DF, r, mode, month=month, event_year=year)
        for r in ("marmara", "aegean", "blacksea")
    }
    points_out = []
    for p in MAP_POINTS:
        b = base[p["region"]]
        sst = b["sst"] + d_sst
        wind = max(b["wind"] * (1 + d_wind / 100), 0.1)
        chl = max(b["chl"] * (1 + d_chl / 100), 1e-3)
        score, comps = risk_score(sst, wind, chl, p["susceptibility"])
        base_score, _ = risk_score(b["sst"], b["wind"], b["chl"], p["susceptibility"])
        points_out.append({
            **p,
            "sst": round(sst, 2),
            "wind": round(wind, 2),
            "chl": round(chl, 2),
            "score": round(score, 1),
            "base_score": round(base_score, 1),
            "level": risk_level(score),
            "components": {k: round(v, 3) for k, v in comps.items()},
        })
    return {"base": base, "points": points_out, "weights": RISK_WEIGHTS}


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

    # Spearman correlations
    chl = get_series(DF, region, "chl", start_year, end_year)
    correlations = []
    for driver, label in (("sst", "SST → Klorofil"), ("wind", "Rüzgâr → Klorofil")):
        d_ser = get_series(DF, region, driver, start_year, end_year)
        same = spearman_anomaly_correlation(d_ser, False, chl, True, 0)
        best = max(
            (
                {**spearman_anomaly_correlation(d_ser, False, chl, True, lag), "lag": lag}
                for lag in range(4)
            ),
            key=lambda x: abs(x["rho"]) if not np.isnan(x["rho"]) else -1,
        )
        correlations.append({
            "label": label,
            "rho_same": clean_num(same["rho"]),
            "p_same": clean_num(same["p_value"]),
            "best_lag": best["lag"],
            "rho_best": clean_num(best["rho"]),
            "p_best": clean_num(best["p_value"]),
        })

    # Comparison across 3 seas
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
        "anomaly_unit": anom_unit,
        "correlations": correlations,
        "comparison": comparison,
        "flh_check": flh_check,
    }


@app.get("/api/sources")
def get_sources() -> list[dict]:
    if CATALOG.empty:
        return []
    return CATALOG.fillna("").to_dict(orient="records")