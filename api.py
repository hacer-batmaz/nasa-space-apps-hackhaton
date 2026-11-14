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
from ml_model import predict_scenario_chl, train_and_evaluate  # noqa: E402

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


REGION_TR = {"marmara": "Marmara Denizi", "aegean": "Ege Denizi", "blacksea": "Karadeniz"}
REGION_LOC = {"marmara": "Marmara Denizi'nde", "aegean": "Ege Denizi'nde", "blacksea": "Karadeniz'de"}
MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül",
             "Ekim", "Kasım", "Aralık"]
COMPONENT_TR = {"thermal": "sıcaklık", "calm": "durgunluk (zayıf rüzgâr)", "biomass": "klorofil / besin"}
MONTHS = sorted(DF["date"].dropna().unique())
MIN_YEAR, MAX_YEAR = int(DF["date"].dt.year.min()), int(DF["date"].dt.year.max())


def tr_num(value: float, digits: int = 0, sign: bool = False) -> str:
    text = f"{value:+.{digits}f}" if sign else f"{value:.{digits}f}"
    return text.replace(".", ",")


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
    """Data-driven interpretation sentences (Turkish UI text) for the simulation page."""
    out = []
    month_name = MONTHS_TR[month - 1]
    m = summary["marmara"]

    if climatology:
        n_years = clim_end - clim_start + 1
        out.append({"kind": "info", "text": f"Harita tek bir yılı değil, {clim_start}–{clim_end} arasındaki "
                                            f"{n_years} {month_name} ayının ortalamasını gösteriyor "
                                            f"(\"normal bir {month_name}\")."})
        # selected period's normal vs the full-record normal (shows long-term change)
        if (clim_start, clim_end) != (MIN_YEAR, MAX_YEAR):
            period = baseline_conditions(DF, "marmara", "climatology", month=month,
                                         start_year=clim_start, end_year=clim_end)
            full = baseline_conditions(DF, "marmara", "climatology", month=month)
            out.append({"kind": "compare", "text": (
                f"{clim_start}–{clim_end} döneminin {month_name} normali, tüm kaydın ({MIN_YEAR}–{MAX_YEAR}) "
                f"normaline göre Marmara'da SST {tr_num(period['sst'] - full['sst'], 2, True)} °C, rüzgâr "
                f"{tr_num((period['wind'] / full['wind'] - 1) * 100, 0, True)} %, klorofil "
                f"{tr_num((period['chl'] / full['chl'] - 1) * 100, 0, True)} %.")})
    else:
        out.append({"kind": "info", "text": f"Harita {month_name} {year} ayının gerçek uydu ölçümlerini gösteriyor."})
        actual = baseline_conditions(DF, "marmara", "event", month=month, event_year=year)
        normal = baseline_conditions(DF, "marmara", "climatology", month=month)
        a_score = basin_risk(actual, "marmara", 0, 0, 0)
        n_score = basin_risk(normal, "marmara", 0, 0, 0)
        diff = a_score - n_score
        verdict = ("normalden daha riskli" if diff > 2 else
                   ("normalden daha az riskli" if diff < -2 else "normale yakın"))
        out.append({"kind": "compare", "text": (
            f"{month_name} {year}, Marmara'da {verdict} ({tr_num(a_score)} / normal {tr_num(n_score)}). "
            f"SST {tr_num(actual['sst'] - normal['sst'], 1, True)} °C, rüzgâr "
            f"{tr_num((actual['wind'] / normal['wind'] - 1) * 100, 0, True)} %, klorofil "
            f"{tr_num((actual['chl'] / normal['chl'] - 1) * 100, 0, True)} %.")})

    # scenario effect
    changes = []
    if d_sst:
        changes.append(f"sıcaklık {tr_num(d_sst, 1, True)} °C")
    if d_wind:
        changes.append(f"rüzgâr {tr_num(d_wind, 0, True)} %")
    if d_chl:
        changes.append(f"klorofil/besin {tr_num(d_chl, 0, True)} %")
    if changes and abs(m["delta"]) < 1:
        out.append({"kind": "scenario", "text": (
            f"Senaryo ({', '.join(changes)}) bu ayda Marmara riskini neredeyse değiştirmiyor "
            f"({tr_num(m['base_score'])} → {tr_num(m['score'])}). Mevsim koşulları senaryo etkisini sınırlıyor.")})
    elif changes:
        verb = "yükseltiyor" if m["delta"] > 0 else "düşürüyor"
        text = (f"Senaryo ({', '.join(changes)}) Marmara riskini {tr_num(m['base_score'])} → "
                f"{tr_num(m['score'])} puana {verb} ({m['level']}).")
        ratios = [f"{REGION_LOC[r]}kinin {tr_num(m['delta'] / summary[r]['delta'], 1)} katı"
                  for r in ("aegean", "blacksea") if m["delta"] > 0.5 and summary[r]["delta"] > 0.5]
        if ratios and m["delta"] > 0:
            text += " Marmara'daki artış " + " ve ".join(ratios) + "; kapalı yapısı nedeniyle daha hassas."
        out.append({"kind": "scenario", "text": text})
    else:
        out.append({"kind": "scenario", "text": "Senaryo değişimleri sıfırda: skorlar doğrudan uydu verisinden "
                                                "hesaplanıyor (hiçbir koşul değiştirilmedi)."})

    # dominant driver
    top = max(m["drivers"], key=m["drivers"].get)
    out.append({"kind": "driver", "text": f"Marmara'da riskin en büyük kaynağı {COMPONENT_TR[top]} "
                                          f"(skorun %{tr_num(m['drivers'][top])}'i)."})

    # rank among the same calendar month (real data only)
    if not climatology:
        same = DF[(DF["region"] == "marmara") & (DF["date"].dt.month == month)].dropna(subset=["sst", "wind", "chl"])
        scores = sorted(((basin_risk(r, "marmara", d_sst, d_wind, d_chl), r["date"].year)
                         for _, r in same.iterrows()), reverse=True)
        rank = next((i + 1 for i, (_, y) in enumerate(scores) if y == year), None)
        if rank:
            out.append({"kind": "rank", "text": f"Bu koşullarda {month_name} {year}, verideki {len(scores)} "
                                                f"{month_name} ayı içinde risk sıralamasında {rank}. sırada."})

    # critical locations
    critical = [p["name"] for p in points if p["score"] >= 75]
    if critical:
        out.append({"kind": "alert", "text": f"Kritik eşiği (75) aşan konumlar: {', '.join(critical)}."})
    else:
        best = max(points, key=lambda p: p["score"])
        out.append({"kind": "ok", "text": f"Kritik eşiği aşan konum yok; en yüksek risk {best['name']} "
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