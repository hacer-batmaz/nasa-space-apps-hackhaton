"""
app.py — Mucilage Detective (Müsilaj Dedektifi)
NASA Space Apps Challenge 2026 · "Be An Earth System Trend Detective!"

Run:  streamlit run app.py
Code is in English; the user interface is in Turkish.
"""
from __future__ import annotations

import sys
import time
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from analysis import (RISK_WEIGHTS, SST_MIDPOINT, WIND_MIDPOINT, VARIABLES,  # noqa: E402
                      anomaly_for_display, baseline_conditions, get_series,
                      risk_level, risk_score, satellite_consistency,
                      spearman_anomaly_correlation, trend_line, trend_test)
from data_loader import load_all, load_catalog  # noqa: E402
from map_view import BASE_MAPS, risk_map  # noqa: E402

# =============================================================================== config
st.set_page_config(page_title="Müsilaj Dedektifi", page_icon="🔎", layout="wide")

REGION_TR = {"marmara": "Marmara Denizi", "aegean": "Ege Denizi", "blacksea": "Karadeniz"}
REGION_LOC = {"marmara": "Marmara Denizi'nde", "aegean": "Ege Denizi'nde", "blacksea": "Karadeniz'de"}
REGION_COLORS = {"marmara": "#c0392b", "aegean": "#2980b9", "blacksea": "#2c3e50"}
VARIABLE_TR = {
    "sst":  ("Deniz Yüzeyi Sıcaklığı (SST)", "°C"),
    "wind": ("Yüzey Rüzgâr Hızı", "m/s"),
    "chl":  ("Klorofil-a (CHL)", "mg/m³"),
    "flh":  ("Floresans Çizgi Yüksekliği (FLH)", "W m⁻² µm⁻¹ sr⁻¹"),
}
MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül",
             "Ekim", "Kasım", "Aralık"]
TREND_TR = {"increasing": "Artıyor ↑", "decreasing": "Azalıyor ↓", "no trend": "Belirgin trend yok →"}
LEVEL_COLORS = {"Düşük": "#2e7d32", "Orta": "#f9a825", "Yüksek": "#ef6c00", "Kritik": "#6a1b9a"}
# Basin boxes used for the Giovanni downloads (W, S, E, N)
BASIN_BOXES = {
    "marmara":  (26.9, 40.2, 30.0, 41.1),
    "aegean":   (25.5, 36.8, 27.5, 39.8),
    "blacksea": (28.0, 41.0, 41.8, 42.5),
}

# Map points. 'susceptibility' (0–1) is an expert-judgement factor for how enclosed /
# nutrient-loaded a location is; satellite values come from the basin averages.
MAP_POINTS = [
    # Sea of Marmara
    {"name": "İzmit Körfezi", "region": "marmara", "lat": 40.74, "lon": 29.62, "susceptibility": 1.00,
     "note": "Kapalı körfez; yoğun sanayi ve kentsel atık su yükü"},
    {"name": "İstanbul Boğazı (Marmara çıkışı)", "region": "marmara", "lat": 40.98, "lon": 28.98,
     "susceptibility": 0.95, "note": "Megakent atık suyu ve Karadeniz kökenli yüzey akıntısı"},
    {"name": "Gemlik Körfezi", "region": "marmara", "lat": 40.42, "lon": 28.95, "susceptibility": 0.95,
     "note": "Yarı kapalı körfez; zayıf su değişimi"},
    {"name": "Orta Marmara", "region": "marmara", "lat": 40.75, "lon": 28.20, "susceptibility": 0.85,
     "note": "Açık su; iki katmanlı (tabakalı) yapı"},
    {"name": "Kapıdağ / Erdek", "region": "marmara", "lat": 40.45, "lon": 27.75, "susceptibility": 0.92,
     "note": "2021'de yoğun müsilaj gözlenen alanlardan"},
    {"name": "Marmara Adası kuzeyi", "region": "marmara", "lat": 40.68, "lon": 27.60, "susceptibility": 0.90,
     "note": "Adalar arası sığ ve korunaklı sular"},
    {"name": "Çanakkale Boğazı girişi", "region": "marmara", "lat": 40.42, "lon": 26.72, "susceptibility": 0.85,
     "note": "Marmara sularının Ege'ye çıkış kapısı"},
    # Aegean Sea
    {"name": "Saros Körfezi", "region": "aegean", "lat": 40.55, "lon": 26.45, "susceptibility": 0.65,
     "note": "Boğaz çıkışına yakın, yarı kapalı körfez"},
    {"name": "Gökçeada açıkları", "region": "aegean", "lat": 40.15, "lon": 25.65, "susceptibility": 0.55,
     "note": "Marmara kökenli suların Ege'ye yayıldığı hat"},
    {"name": "Bozcaada açıkları", "region": "aegean", "lat": 39.83, "lon": 25.95, "susceptibility": 0.55,
     "note": "Açık Ege; güçlü karışım"},
    {"name": "Edremit Körfezi", "region": "aegean", "lat": 39.50, "lon": 26.75, "susceptibility": 0.62,
     "note": "Körfez içi; tarım ve turizm baskısı"},
    {"name": "İzmir açıkları", "region": "aegean", "lat": 38.55, "lon": 26.60, "susceptibility": 0.62,
     "note": "Büyükşehir ve Gediz etkisi"},
    # Black Sea
    {"name": "İstanbul Boğazı (Karadeniz çıkışı)", "region": "blacksea", "lat": 41.30, "lon": 29.15,
     "susceptibility": 0.75, "note": "Boğaz ağzı; kıyısal karışım"},
    {"name": "Zonguldak açıkları", "region": "blacksea", "lat": 41.55, "lon": 31.75, "susceptibility": 0.65,
     "note": "Sanayi kıyısı; dik şelf"},
    {"name": "Sinop açıkları", "region": "blacksea", "lat": 42.15, "lon": 35.10, "susceptibility": 0.55,
     "note": "Açık deniz özellikleri baskın"},
    {"name": "Samsun açıkları", "region": "blacksea", "lat": 41.45, "lon": 36.40, "susceptibility": 0.72,
     "note": "Kızılırmak ve Yeşilırmak besin girdisi"},
]

# =============================================================================== styling
st.markdown(
    """
    <style>
      .hero {background: linear-gradient(120deg,#0b3d91 0%,#1565c0 55%,#00897b 100%);
             color:#fff;padding:2.2rem 2.4rem;border-radius:18px;margin-bottom:1.2rem;}
      .hero h1 {color:#fff;font-size:2.3rem;margin:0 0 .4rem 0;}
      .hero p {font-size:1.08rem;opacity:.93;margin:0;}
      .card {background:#f7f9fc;border:1px solid #e3e8f0;border-radius:14px;padding:1.1rem 1.2rem;height:100%;}
      .card h4 {margin-top:0;}
      .cta {background:#ffffff;border:2px solid #1565c0;border-radius:16px;padding:1.3rem 1.4rem;}
      .cta h3 {margin-top:0;color:#0b3d91;}
      .timeline {border-left:3px solid #1565c0;padding-left:1rem;margin-left:.3rem;}
      .timeline p {margin:.2rem 0 .8rem 0;}
      .badge {display:inline-block;padding:.25rem .7rem;border-radius:999px;color:#fff;font-weight:600;}
      .small {font-size:.86rem;color:#5f6b7a;}
      /* ---------- map page (dark green design) ---------- */
      .map-header {display:flex;justify-content:space-between;align-items:flex-end;gap:2rem;
                   background:linear-gradient(90deg,#0f1f1a 0%,#14281f 100%);color:#e6efe9;
                   padding:1.1rem 1.6rem;border-radius:10px 10px 0 0;margin-bottom:0;}
      .map-header .kicker {color:#4fd1b5;font-size:.72rem;font-weight:700;letter-spacing:.14em;}
      .map-header .title {font-family:Georgia,"Times New Roman",serif;font-size:1.9rem;font-weight:700;
                          color:#ffffff;margin:.15rem 0;}
      .map-header .subtitle {color:#a9bdb3;font-size:.92rem;}
      .map-header .stats {display:flex;gap:2.2rem;text-align:left;}
      .map-header .stat-label {color:#a9bdb3;font-size:.7rem;letter-spacing:.12em;}
      .map-header .stat-value {color:#e8b84a;font-size:1.25rem;font-weight:700;}
      .st-key-map_panel, .st-key-map_panel_lower {background:#12221c;padding:1rem 1.1rem;color:#dfe9e4;}
      .st-key-map_panel {border-radius:0 0 0 0;}
      .st-key-map_panel_lower {margin-top:-1rem;border-radius:0 0 10px 0;}
      .st-key-map_panel p, .st-key-map_panel label, .st-key-map_panel span,
      .st-key-map_panel_lower p, .st-key-map_panel_lower li {color:#dfe9e4 !important;}
      .panel-h {color:#4fd1b5 !important;font-size:.78rem !important;font-weight:700;letter-spacing:.14em;
                text-transform:uppercase;border-top:1px solid rgba(255,255,255,.12);padding-top:.9rem;
                margin:.6rem 0 .3rem 0;}
      .panel-note {color:#a9bdb3 !important;font-size:.8rem !important;line-height:1.45;}
      .panel-list {font-size:.84rem !important;padding-left:1.1rem;}
      .panel-list li {font-size:.84rem !important;}
      .st-key-scenario_bar {background:#12221c;padding:.9rem 1.2rem .3rem 1.2rem;border-radius:0 0 0 10px;}
      .st-key-scenario_bar p, .st-key-scenario_bar label, .st-key-scenario_bar span {color:#dfe9e4 !important;}
      .panel-list li {margin-bottom:.35rem;}
      .map-note {background:#1b3029;color:#e6efe9;padding:.55rem .9rem;font-size:.82rem;margin-top:-1rem;}
      .map-footer {background:#0f1f1a;color:#a9bdb3;padding:.7rem 1.2rem;border-radius:8px;font-size:.8rem;
                   margin-top:1.2rem;}
    </style>
    """,
    unsafe_allow_html=True,
)


# =============================================================================== helpers
@st.cache_data(show_spinner="NASA verileri yükleniyor…")
def get_data() -> pd.DataFrame:
    return load_all()


@st.cache_data
def get_catalog() -> pd.DataFrame:
    return load_catalog()


def tr_num(value: float, digits: int = 2, sign: bool = False) -> str:
    """Format a number with Turkish decimal comma."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "–"
    text = f"{value:+.{digits}f}" if sign else f"{value:.{digits}f}"
    return text.replace(".", ",")


def tr_p(p: float) -> str:
    if p is None or np.isnan(p):
        return "–"
    return "< 0,001" if p < 0.001 else tr_num(p, 3)


def p_text(p: float) -> str:
    """'p < 0,001' or 'p = 0,024'."""
    if p is None or np.isnan(p):
        return "p = –"
    return "p < 0,001" if p < 0.001 else f"p = {tr_num(p, 3)}"


def change_label(variable: str, res: dict) -> str:
    if np.isnan(res["change_per_decade"]):
        return "–"
    if VARIABLES[variable][2]:
        return f"{tr_num(res['change_per_decade'], 1, sign=True)} % / 10 yıl"
    return f"{tr_num(res['change_per_decade'], 2, sign=True)} {VARIABLE_TR[variable][1]} / 10 yıl"


def text_metric(container, label: str, value: str, note: str | None = None, color: str = "off") -> None:
    """Metric whose delta is descriptive text (no arrow). Falls back on older Streamlit versions."""
    try:
        container.metric(label, value, note, delta_color=color, delta_arrow="off")
    except TypeError:
        container.metric(label, value, note, delta_color=color)


def go_to(page: str) -> None:
    st.session_state["page"] = page


# =============================================================================== page: home
def page_home(df: pd.DataFrame) -> None:
    st.markdown(
        """
        <div class="hero">
          <h1>🔎 Müsilaj Dedektifi</h1>
          <p><b>Türk Denizlerinde İklim ve Ekosistem Eğilimleri</b> — NASA uydu verileriyle Marmara, Ege ve
          Karadeniz'de <i>ne değişti, nerede değişti, ne kadar değişti ve bu değişim önemli mi?</i></p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Live headline numbers from the data
    sst_marmara = trend_test(get_series(df, "marmara", "sst"), False)
    chl_marmara = trend_test(get_series(df, "marmara", "chl"), True)
    chl_aegean = trend_test(get_series(df, "aegean", "chl"), True)
    years = df["date"].dt.year
    c1, c2, c3, c4 = st.columns(4)
    text_metric(c1, "Analiz dönemi", f"{years.min()}–{years.max()}", f"{df['date'].nunique()} ay")
    text_metric(c2, "Marmara ısınması", change_label("sst", sst_marmara), p_text(sst_marmara["p_value"]))
    text_metric(c3, "Marmara klorofil", change_label("chl", chl_marmara), p_text(chl_marmara["p_value"]))
    text_metric(c4, "Ege klorofil", change_label("chl", chl_aegean), p_text(chl_aegean["p_value"]))

    st.write("")
    st.subheader("Hızlı başlangıç")
    a, b = st.columns(2)
    with a:
        st.markdown(
            """<div class="cta"><h3>🗺️ İnteraktif Türkiye Haritası & Müsilaj Risk Simülasyonu</h3>
            <p>Gerçek NASA verisinden başlayın; sıcaklığı, rüzgârı ve besin yükünü değiştirin,
            16 kıyı noktasında riskin nasıl değiştiğini anlık izleyin.</p></div>""",
            unsafe_allow_html=True,
        )
        st.button("Simülasyonu Başlat →", type="primary", width="stretch",
                  on_click=go_to, args=("sim",))
    with b:
        st.markdown(
            """<div class="cta"><h3>📊 Bilimsel Trend ve İstatistik Analizi</h3>
            <p>Mann-Kendall, Sen eğimi ve Spearman korelasyonu ile
            22 yıllık değişimin gerçekten anlamlı olup olmadığını test edin.</p></div>""",
            unsafe_allow_html=True,
        )
        st.button("Analize Git →", type="primary", width="stretch",
                  on_click=go_to, args=("stats",))

    st.divider()
    st.subheader("Müsilaj (deniz salyası) nedir?")
    st.markdown(
        "Müsilaj; fitoplankton başta olmak üzere deniz canlılarının salgıladığı, şekerden zengin organik "
        "maddelerin kümelenmesiyle oluşan, jöle kıvamında bir yapıdır. Yüzeyde kahverengi-gri tabakalar "
        "oluşturur, ancak büyük kısmı dibe çökerek dip canlılarını boğar; balıkçılığı, turizmi ve deniz "
        "ekosistemini ciddi biçimde etkiler."
    )
    t1, t2, t3 = st.columns(3)
    with t1:
        st.markdown(
            """<div class="card"><h4>🌡️ Yüksek deniz sıcaklığı</h4>
            Normalden sıcak sular fitoplankton büyümesini ve organik madde salgısını hızlandırır;
            sıcak kışlar mevsimsel karışımı zayıflatır.</div>""", unsafe_allow_html=True)
    with t2:
        st.markdown(
            """<div class="card"><h4>🍃 Zayıf rüzgâr ve durgunluk</h4>
            Rüzgâr azaldığında su karışmaz, yüzey tabakası durgunlaşır (tabakalaşma) ve salgılanan
            maddeler dağılmak yerine birikir.</div>""", unsafe_allow_html=True)
    with t3:
        st.markdown(
            """<div class="card"><h4>🌿 Aşırı besin ve fitoplankton</h4>
            Atık su ve tarımsal girdilerle gelen azot ve fosfor, klorofil-a ile ölçülen fitoplankton
            biyokütlesini artırır; müsilajın hammaddesi budur.</div>""", unsafe_allow_html=True)

    st.write("")
    left, right = st.columns([1.1, 1])
    with left:
        st.subheader("Türkiye'de müsilaj geçmişi")
        st.markdown(
            """
            <div class="timeline">
            <p><b>2007</b> — Müsilaj Türkiye sularında, Marmara Denizi'nde ilk kez geniş ölçekte görüldü.</p>
            <p><b>2008</b> — Marmara'da yeniden büyük kümeler oluştu; baskın fitoplankton türü
            <i>Gonyaulax fragilis</i> idi.</p>
            <p><b>2021</b> — Erken ilkbaharda Marmara ve Türkiye'nin Kuzey Ege kıyılarında başladı;
            kayıtlardaki <b>en büyük salgın</b> oldu. Bu kez baskın tür <i>Phaeocystis pouchetii</i> idi.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with right:
        st.subheader("2021 krizinin etkileri")
        st.markdown(
            """
            - **Marmara:** Yüzeyi ve kıyıları kalın tabakalar halinde kapladı; balıkçılık ve turizm durma
              noktasına geldi. Haziran 2021'de geniş çaplı temizlik ve eylem planı başlatıldı.
            - **Çanakkale Boğazı ve Kuzey Ege:** Örtü tipi müsilaj Mart–Temmuz arasında yaklaşık beş ay
              sürdü; dip omurgasızlarında toplu ölümler raporlandı. Müsilaj Limni gibi Kuzeydoğu Ege
              adalarına kadar ulaştı.
            - **Batı Karadeniz:** Boğaz yoluyla bitişik Karadeniz kıyılarında da müsilaj görüldüğü bildirildi;
              ancak yoğunluk Marmara'nın çok altındaydı.
            """
        )

    with st.expander("📚 Kaynaklar ve veri setleri"):
        st.markdown(
            """
            - Savun-Hekimoğlu & Gazioğlu (2021), *Mucilage Problem in the Semi-Enclosed Seas*, Int. J. Environment and Geoinformatics 8(4).
            - Özalp (2021), *Mucilage in the Çanakkale Strait and North Aegean Sea*, Journal of the Black Sea/Mediterranean Environment 27(2).
            - Journal of the Black Sea/Mediterranean Environment (2021), Editör notu: 2021 Marmara müsilajı özel sayısı.
            - Medvedeva & Stanichny (2022), *Outbreak of marine mucilage in the Sea of Marmara in 2021*, Marine Biological Journal 7(1).
            """
        )
        catalog = get_catalog()
        if not catalog.empty:
            st.markdown("**Kullanılan NASA veri setleri** (Giovanni'de tekrar üretme linkleriyle):")
            st.dataframe(catalog[["file", "variable_name", "region", "source", "unit", "start", "end",
                                  "giovanni_url"]],
                         column_config={"giovanni_url": st.column_config.LinkColumn("Giovanni linki")},
                         hide_index=True, width="stretch")


# =============================================================================== page: simulation
MAP_FOCUS = {
    "Marmara odaklı": ({"lat": 40.62, "lon": 28.45}, 6.9),
    "Tüm Türk denizleri": ({"lat": 40.2, "lon": 32.0}, 4.7),
}
PLAY_DELAY_SECONDS = 0.9


@st.cache_data
def month_index(df: pd.DataFrame) -> list[pd.Timestamp]:
    return sorted(df["date"].unique())


def month_label(ts: pd.Timestamp) -> str:
    ts = pd.Timestamp(ts)
    return f"{MONTHS_TR[ts.month - 1]} {ts.year}"


def basin_susceptibility() -> dict:
    """Mean susceptibility of the map points in each basin."""
    pts = pd.DataFrame(MAP_POINTS)
    return pts.groupby("region")["susceptibility"].mean().to_dict()


@st.cache_data
def monthly_risk(df: pd.DataFrame, d_sst: float, d_wind: int, d_chl: int) -> pd.DataFrame:
    """Basin-average risk score for every month of real data, with the scenario deltas applied."""
    sus = basin_susceptibility()
    rows = []
    for _, r in df.dropna(subset=["sst", "wind", "chl"]).iterrows():
        score, _ = risk_score(r["sst"] + d_sst, max(r["wind"] * (1 + d_wind / 100), 0.1),
                              max(r["chl"] * (1 + d_chl / 100), 1e-3), sus[r["region"]])
        rows.append({"date": r["date"], "region": r["region"], "score": score})
    return pd.DataFrame(rows)


def build_points(base: dict, d_sst: float, d_wind: int, d_chl: int) -> pd.DataFrame:
    rows = []
    for p in MAP_POINTS:
        b = base[p["region"]]
        sst = b["sst"] + d_sst
        wind = max(b["wind"] * (1 + d_wind / 100), 0.1)
        chl = max(b["chl"] * (1 + d_chl / 100), 1e-3)
        score, comps = risk_score(sst, wind, chl, p["susceptibility"])
        base_score, _ = risk_score(b["sst"], b["wind"], b["chl"], p["susceptibility"])
        rows.append({
            "Konum": p["name"], "Bölge": REGION_TR[p["region"]], "region": p["region"],
            "lat": p["lat"], "lon": p["lon"], "SST (°C)": sst, "Rüzgâr (m/s)": wind, "Klorofil (mg/m³)": chl,
            "Risk Skoru": score, "Baz Skor": base_score, "Risk Seviyesi": risk_level(score), "Not": p["note"],
            **{f"comp_{k}": v for k, v in comps.items()}, "susceptibility": p["susceptibility"],
        })
    return pd.DataFrame(rows)


def risk_timeseries_chart(series: pd.DataFrame, selected: pd.Timestamp) -> go.Figure:
    """Dark, compact chart for the side panel: 24-month window around the selected month."""
    start, end = selected - pd.DateOffset(months=12), selected + pd.DateOffset(months=11)
    window = series[(series["date"] >= start) & (series["date"] <= end)]
    fig = go.Figure()
    for region, color, width in (("aegean", "#5c8db8", 1.4), ("blacksea", "#8aa39b", 1.4),
                                 ("marmara", "#e8b84a", 2.6)):
        sub = window[window["region"] == region]
        fig.add_trace(go.Scatter(x=sub["date"], y=sub["score"], mode="lines+markers", name=REGION_TR[region],
                                 line={"color": color, "width": width}, marker={"size": 5 if region == "marmara" else 3},
                                 hovertemplate="%{x|%m.%Y}: %{y:.0f}<extra>" + REGION_TR[region] + "</extra>"))
    sel = window[(window["region"] == "marmara") & (window["date"] == selected)]
    if not sel.empty:
        fig.add_trace(go.Scatter(x=sel["date"], y=sel["score"], mode="markers", showlegend=False,
                                 marker={"size": 14, "color": "#4fd1b5", "line": {"color": "#e8b84a", "width": 2}},
                                 hoverinfo="skip"))
    fig.add_hrect(y0=75, y1=100, fillcolor="#6a1b9a", opacity=0.12, line_width=0)
    fig.update_layout(
        height=290, margin={"l": 6, "r": 6, "t": 8, "b": 60}, paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)", font={"color": "#cfe0d8", "size": 10},
        yaxis={"range": [0, 100], "gridcolor": "rgba(255,255,255,.08)", "title": "Risk"},
        xaxis={"gridcolor": "rgba(255,255,255,.05)", "tickformat": "%m.%y"},
        legend={"orientation": "h", "x": 0, "y": -0.22, "font": {"size": 10, "color": "#dfe9e4"},
                "bgcolor": "rgba(0,0,0,0)"},
    )
    return fig


def page_simulation(df: pd.DataFrame) -> None:
    months = month_index(df)
    labels = [month_label(m) for m in months]
    default_idx = next((i for i, m in enumerate(months) if pd.Timestamp(m) == pd.Timestamp("2021-05-01")),
                       len(months) - 1)
    st.session_state.setdefault("month_idx", default_idx)
    st.session_state.setdefault("playing", False)
    if "next_month_idx" in st.session_state:              # advance requested by the player
        st.session_state["month_idx"] = st.session_state.pop("next_month_idx")

    header = st.empty()
    map_col, panel = st.columns([2.7, 1], gap="small")

    with panel.container(key="map_panel"):
        # ---- player -----------------------------------------------------------------------
        play_col, slider_col = st.columns([1.25, 2])
        play_label = "⏸ Durdur" if st.session_state["playing"] else "▶ Oynat"
        if play_col.button(play_label, type="primary", width="stretch"):
            st.session_state["playing"] = not st.session_state["playing"]
            st.rerun()
        slider_col.select_slider("Ay", options=list(range(len(months))), format_func=lambda i: labels[i],
                                 key="month_idx", label_visibility="collapsed")
        idx = st.session_state["month_idx"]
        selected = pd.Timestamp(months[idx])
        st.markdown(f'<p class="panel-note">Ay {idx + 1} / {len(months)} · {labels[idx]}</p>',
                    unsafe_allow_html=True)
        use_climatology = st.toggle("Tarihsel ortalamayı kullan (aynı takvim ayı)", value=False,
                                    help="Açıkken seçili yılın değil, tüm yıllardaki aynı ayın ortalaması kullanılır.")

        # ---- layers -----------------------------------------------------------------------
        st.markdown('<p class="panel-h">Katmanlar</p>', unsafe_allow_html=True)
        base_map = st.radio("Altlık", list(BASE_MAPS), label_visibility="collapsed")
        show_points = st.checkbox("Müsilaj risk noktaları", value=True)
        show_boxes = st.checkbox("Havza veri kutuları", value=True)
        show_chl = st.checkbox("Klorofil-a (MODIS Aqua / NASA GIBS)", value=False)
        show_sst = st.checkbox("Deniz yüzeyi sıcaklığı (GHRSST / NASA GIBS)", value=False)
        gibs_day = date(selected.year, selected.month, 15)
        if show_chl or show_sst:
            gibs_day = st.date_input("GIBS görüntü günü", value=gibs_day, min_value=date(2003, 1, 1),
                                     max_value=date.today(), format="DD.MM.YYYY")
        st.markdown('<p class="panel-note">GIBS katmanları seçili güne göre yenilenir. En yüksek çözünürlük '
                    '7. yakınlaştırma düzeyidir; bulut veya yörünge boşluklarında karo gelmeyebilir.</p>',
                    unsafe_allow_html=True)
        focus = st.radio("Harita odağı", list(MAP_FOCUS), horizontal=True)


    # ---- scenario bar under the map ---------------------------------------------------------
    map_slot = map_col.empty()
    note_slot = map_col.empty()
    with map_col.container(key="scenario_bar"):
        st.markdown('<p class="panel-h" style="border-top:none;padding-top:0">Senaryo — iklim ve besin '
                    'koşullarını değiştirin</p>', unsafe_allow_html=True)
        s1, s2, s3 = st.columns(3)
        d_sst = s1.slider("ΔSST (°C)", -2.0, 4.0, 0.0, 0.1)
        d_wind = s2.slider("ΔRüzgâr (%)", -50, 50, 0, 5, help="Rüzgâr azaldıkça su karışmaz; durgunluk artar.")
        d_chl = s3.slider("ΔKlorofil-a / besin yükü (%)", -40, 150, 0, 5)

    # ---- computation ------------------------------------------------------------------------
    mode = "climatology" if use_climatology else "event"
    base = {r: baseline_conditions(df, r, mode, month=selected.month, event_year=selected.year)
            for r in REGION_TR}
    points = build_points(base, d_sst, d_wind, d_chl)
    summary = points.groupby("region").agg(score=("Risk Skoru", "mean"), base=("Baz Skor", "mean"))
    summary["delta"] = summary["score"] - summary["base"]
    series = monthly_risk(df, d_sst, d_wind, d_chl)

    # ---- header -----------------------------------------------------------------------------
    date_text = f"{MONTHS_TR[selected.month - 1]} · tarihsel ort." if use_climatology else labels[idx]
    marmara_score = summary.loc["marmara", "score"]
    header.markdown(
        f"""
        <div class="map-header">
          <div>
            <div class="kicker">NASA SPACE APPS · MÜSİLAJ DEDEKTİFİ</div>
            <div class="title">Marmara Müsilaj Risk Haritası</div>
            <div class="subtitle">MODIS-Aqua & MERRA-2 aylık verisi · senaryo tabanlı risk göstergesi</div>
          </div>
          <div class="stats">
            <div><div class="stat-label">SEÇİLİ TARİH</div><div class="stat-value">{date_text}</div></div>
            <div><div class="stat-label">MARMARA RİSK SKORU</div>
                 <div class="stat-value">{tr_num(marmara_score, 0)} / 100 · {risk_level(marmara_score)}</div></div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ---- map --------------------------------------------------------------------------------
    overlays = [k for k, on in (("chl", show_chl), ("sst", show_sst)) if on]
    center, zoom = MAP_FOCUS[focus]
    fig = risk_map(points, base_map, overlays, gibs_day, BASIN_BOXES, REGION_COLORS, REGION_TR,
                   show_points=show_points, show_boxes=show_boxes, height=760, center=center, zoom=zoom)
    map_slot.plotly_chart(fig, width="stretch", config={"scrollZoom": True, "displaylogo": False})
    note_slot.markdown('<div class="map-note">Kapsam: Noktalar kendi havzasının ortalama uydu değerlerini kullanır; '
                       'noktalar arası fark yerel duyarlılık katsayısından gelir. Skor bir senaryo göstergesidir, '
                       'tahmin değildir.</div>', unsafe_allow_html=True)

    # ---- panel (lower part) -----------------------------------------------------------------
    with panel.container(key="map_panel_lower"):
        st.markdown('<p class="panel-h">Risk skoru zaman serisi</p>', unsafe_allow_html=True)
        st.plotly_chart(risk_timeseries_chart(series, selected), width="stretch",
                        config={"displayModeBar": False})
        st.markdown('<p class="panel-note">Gerçek aylık NASA verisi + seçili senaryo değişimleri. '
                    'Turkuaz nokta seçili ayı, mor bant kritik bölgeyi (75+) gösterir.</p>', unsafe_allow_html=True)
        st.markdown('<p class="panel-h">Dikkat edilmesi gerekenler</p>', unsafe_allow_html=True)
        st.markdown(
            """
            <ul class="panel-list">
              <li>Risk skoru doğrulanmış bir tahmin modeli değildir; ağırlıklar ve eşikler uzman yargısına dayanır.</li>
              <li>Uydu verisi havza ortalamasıdır; kıyıya yakın ve bulanık sularda klorofil ölçümü yanılabilir.</li>
              <li>Rüzgâr verisi model (MERRA-2) çıktısıdır, ~50 km çözünürlüklüdür.</li>
              <li>Besin tuzları ve akıntılar uydu ile doğrudan ölçülmez.</li>
            </ul>
            """,
            unsafe_allow_html=True,
        )

    # ---- below the map ----------------------------------------------------------------------
    st.write("")
    k1, k2, k3 = st.columns(3)
    for col, region in zip((k1, k2, k3), ("marmara", "aegean", "blacksea")):
        row = summary.loc[region]
        delta = (f"{tr_num(row['delta'], 1, sign=True)} puan (senaryo etkisi)" if abs(row["delta"]) >= 0.05 else None)
        col.metric(f"{REGION_TR[region]} — {risk_level(row['score'])}", f"{tr_num(row['score'], 0)} / 100",
                   delta, delta_color="inverse")

    st.subheader("Simülasyon yorumu")
    st.markdown(scenario_message(points, summary, d_sst, d_wind, d_chl))

    st.subheader("Riski hangi etken sürüklüyor?")
    contrib = []
    for region in ("marmara", "aegean", "blacksea"):
        sub = points[points["region"] == region]
        for key, label in (("thermal", "Sıcaklık"), ("calm", "Durgunluk (zayıf rüzgâr)"), ("biomass", "Klorofil / besin")):
            value = (100 * RISK_WEIGHTS[key] * sub[f"comp_{key}"] * sub["susceptibility"]).mean()
            contrib.append({"Havza": REGION_TR[region], "Etken": label, "Katkı (puan)": value})
    bar = px.bar(pd.DataFrame(contrib), x="Havza", y="Katkı (puan)", color="Etken", barmode="stack",
                 color_discrete_map={"Sıcaklık": "#e53935", "Durgunluk (zayıf rüzgâr)": "#8e24aa",
                                     "Klorofil / besin": "#43a047"}, height=340)
    bar.update_layout(yaxis_range=[0, 100], margin={"t": 10})
    st.plotly_chart(bar, width="stretch")

    with st.expander("ℹ️ Risk skoru nasıl hesaplanıyor? (yöntem ve sınırlamalar)"):
        st.markdown("Her etken 0–1 arasına yumuşak bir lojistik eğriyle ölçeklenir:")
        st.latex(r"T=\frac{1}{1+e^{-(SST-%.0f)/1.5}}\quad R=\frac{1}{1+e^{-(%.0f-U)/0.8}}"
                 r"\quad C=\frac{1}{1+e^{-(\log_{10}CHL-\log_{10}2)/0.3}}" % (SST_MIDPOINT, WIND_MIDPOINT))
        st.latex(r"\text{Risk}=100\times S\times(0.35\,T+0.25\,R+0.40\,C)")
        st.markdown(
            f"""
            - **T (sıcaklık):** {SST_MIDPOINT:.0f} °C civarında yarı yarıya etkin.
            - **R (durgunluk):** Rüzgâr {WIND_MIDPOINT:.0f} m/s'nin altına indikçe yüzey karışımı zayıflar.
            - **C (biyokütle):** 2 mg/m³ üzeri klorofil ötrofik koşulları gösterir; log ölçekte değerlendirilir.
            - **S (yerel duyarlılık, 0–1):** Konumun ne kadar kapalı ve besin yüklü olduğuna dair uzman değerlendirmesi.
            - **Seviyeler:** 0–25 Düşük · 25–50 Orta · 50–75 Yüksek · 75–100 Kritik.

            ⚠️ Bu skor **senaryo tabanlı bir göstergedir; doğrulanmış bir tahmin modeli değildir.** Yalnızca iki
            tarihsel olay (2007, 2021) bulunduğu için istatistiksel olarak kalibre edilemez.
            """
        )
    with st.expander("📋 Seçili ayın baz değerleri (gerçek NASA verisi)"):
        base_tbl = pd.DataFrame(base).T.rename(index=REGION_TR, columns={"sst": "SST (°C)", "wind": "Rüzgâr (m/s)",
                                                                        "chl": "Klorofil (mg/m³)"})
        st.dataframe(base_tbl.style.format("{:.2f}"), width="stretch")

    st.markdown('<div class="map-footer">Veri: NASA Giovanni — MODIS-Aqua (SST, Klorofil-a), MERRA-2 (rüzgâr) · '
                'Klorofil/SST görüntüleri: NASA GIBS / EOSDIS · Altlık: © OpenStreetMap, © CARTO, Esri · '
                'Eğitim amaçlı prototip.</div>', unsafe_allow_html=True)

    # ---- player loop ------------------------------------------------------------------------
    if st.session_state["playing"]:
        time.sleep(PLAY_DELAY_SECONDS)
        st.session_state["next_month_idx"] = (idx + 1) % len(months)
        st.rerun()


def scenario_message(points: pd.DataFrame, summary: pd.DataFrame, d_sst: float, d_wind: int, d_chl: int) -> str:
    """Build a dynamic, data-driven interpretation of the current scenario."""
    marmara = summary.loc["marmara"]
    parts = []
    changes = []
    if d_sst:
        changes.append(f"sıcaklık {tr_num(d_sst, 1, sign=True)} °C")
    if d_wind:
        changes.append(f"rüzgâr %{abs(d_wind)} {'zayıfladığında' if d_wind < 0 else 'güçlendiğinde'}")
    if d_chl:
        changes.append(f"klorofil/besin yükü %{abs(d_chl)} {'arttığında' if d_chl > 0 else 'azaldığında'}")

    critical = points[points["Risk Skoru"] >= 75]["Konum"].tolist()
    level = risk_level(marmara["score"])

    if not changes:
        parts.append(f"**Baz senaryo:** Marmara Denizi ortalama risk skoru **{tr_num(marmara['score'], 0)}/100** "
                     f"(**{level}**). Ege {tr_num(summary.loc['aegean', 'score'], 0)}, Karadeniz "
                     f"{tr_num(summary.loc['blacksea', 'score'], 0)} puanda.")
    else:
        scenario = ", ".join(changes)
        parts.append(f"**Senaryo:** {scenario} Marmara Denizi ortalama risk skoru "
                     f"**{tr_num(marmara['base'], 0)} → {tr_num(marmara['score'], 0)}** (**{level}**).")
        for other in ("aegean", "blacksea"):
            d_other = summary.loc[other, "delta"]
            if marmara["delta"] > 0.5 and d_other > 0.5:
                ratio = marmara["delta"] / d_other
                parts.append(f"Marmara'daki risk artışı **{REGION_LOC[other]}kinin {tr_num(ratio, 1)} katı** "
                             f"({tr_num(marmara['delta'], 1, sign=True)} vs {tr_num(d_other, 1, sign=True)} puan).")
        if marmara["delta"] > 0.5:
            parts.append("Kapalı yapısı, uzun su yenilenme süresi ve yüksek besin yükü nedeniyle Marmara, aynı "
                         "iklim değişimine komşu denizlerden daha güçlü tepki verir.")

    if critical:
        parts.append(f"🚨 **Kritik eşiği (75/100) aşan konumlar:** {', '.join(critical)}.")
    else:
        top = points.sort_values("Risk Skoru", ascending=False).iloc[0]
        parts.append(f"Kritik eşiği aşan konum yok. En yüksek risk: **{top['Konum']}** "
                     f"({tr_num(top['Risk Skoru'], 0)}/100).")
    return "\n\n".join(parts)


# =============================================================================== page: statistics
def page_statistics(df: pd.DataFrame) -> None:
    st.header("📊 Bilimsel Trend ve İstatistik Analizi")
    min_year, max_year = int(df["date"].dt.year.min()), int(df["date"].dt.year.max())

    f1, f2, f3 = st.columns([1.2, 1.2, 2])
    region_options = {"Marmara Denizi": "marmara", "Ege Denizi": "aegean", "Karadeniz": "blacksea",
                      "Üç Denizi Karşılaştır": "compare"}
    region_choice = region_options[f1.selectbox("Bölge", list(region_options))]
    var_labels = {VARIABLE_TR[v][0]: v for v in ("sst", "wind", "chl", "flh")}
    variable = var_labels[f2.selectbox("Değişken", list(var_labels), index=2)]
    start_year, end_year = f3.slider("Yıl aralığı", min_year, max_year, (min_year, max_year))

    if end_year - start_year < 4:
        st.warning("Güvenilir trend testi için en az 5 yıllık bir aralık seçin.")
        return

    name, unit = VARIABLE_TR[variable]
    log_transform = VARIABLES[variable][2]

    if variable == "flh" and region_choice != "marmara":
        st.info("FLH yalnızca Marmara için indirildi (bulanık suda klorofil ölçümünü doğrulamak amacıyla). "
                "Gösterim Marmara Denizi ile sınırlandırıldı.")
        region_choice = "marmara"

    if region_choice == "compare":
        compare_regions(df, variable, start_year, end_year)
        return

    series = get_series(df, region_choice, variable, start_year, end_year)
    res = trend_test(series, log_transform)

    st.subheader(f"{REGION_TR[region_choice]} · {name} · {start_year}–{end_year}")
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Trend yönü (Mann-Kendall)", TREND_TR.get(res["trend"], res["trend"]))
    m2.metric("Sen eğimi", change_label(variable, res))
    text_metric(m3, "p-değeri", tr_p(res["p_value"]),
                "✔ Anlamlı (p < 0,05)" if res["significant"] else "Anlamlı değil",
                color="normal" if res["significant"] else "off")
    text_metric(m4, "Analiz edilen ay", f"{res['n_months']}", f"{start_year}–{end_year}")

    if res["significant"]:
        st.success(interpret_trend(region_choice, variable, res))
    else:
        st.info(interpret_trend(region_choice, variable, res))

    # Chart 1: raw series + Sen trend line
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=series.index, y=series.values, mode="lines", name="Aylık değer",
                             line={"color": REGION_COLORS[region_choice], "width": 1.3}))
    if not np.isnan(res["slope_per_month"]):
        line = trend_line(series, log_transform, res["slope_per_month"])
        fig.add_trace(go.Scatter(x=line.index, y=line.values, mode="lines", name="Sen eğimi trend çizgisi",
                                 line={"color": "black", "width": 3, "dash": "dash"}))
    fig.add_vrect(x0="2021-04-01", x1="2021-07-01", fillcolor="orange", opacity=0.15, line_width=0,
                  annotation_text="2021 müsilaj", annotation_position="top left")
    fig.update_layout(title=f"Ham zaman serisi ve Sen eğimi trend çizgisi — {name}",
                      yaxis_title=f"{name} ({unit})", height=420, margin={"t": 50},
                      yaxis_type="log" if log_transform else "linear",
                      legend={"orientation": "h", "y": -0.15})
    st.plotly_chart(fig, width="stretch")

    # Chart 2: anomaly bars
    display_anomaly, anomaly_unit = anomaly_for_display(series, variable)
    fig2 = go.Figure(go.Bar(x=display_anomaly.index, y=display_anomaly.values,
                            marker_color=np.where(display_anomaly.values >= 0, "#d32f2f", "#1976d2"),
                            name="Anomali"))
    fig2.add_vrect(x0="2021-04-01", x1="2021-07-01", fillcolor="orange", opacity=0.15, line_width=0)
    fig2.update_layout(title=f"Mevsimsellikten arındırılmış aylık anomali ({anomaly_unit})",
                       yaxis_title=anomaly_unit, height=360, margin={"t": 50})
    st.plotly_chart(fig2, width="stretch")

    info_boxes(variable)

    # Extra test: Spearman rank correlation
    st.subheader("Ek istatistiksel test: Spearman sıra korelasyonu")
    st.markdown("Klorofil-a anomalisinin sıcaklık ve rüzgâr anomalileriyle ilişkisi (0–3 ay gecikme denenir).")
    corr_rows = []
    chl = get_series(df, region_choice, "chl", start_year, end_year)
    for driver, label in (("sst", "SST → Klorofil"), ("wind", "Rüzgâr → Klorofil")):
        driver_series = get_series(df, region_choice, driver, start_year, end_year)
        best = None
        for lag in range(0, 4):
            r = spearman_anomaly_correlation(driver_series, False, chl, True, lag_months=lag)
            if best is None or (not np.isnan(r["rho"]) and abs(r["rho"]) > abs(best["rho"])):
                best = {**r, "lag": lag}
        same = spearman_anomaly_correlation(driver_series, False, chl, True, 0)
        corr_rows.append({"İlişki": label, "ρ (aynı ay)": same["rho"], "p (aynı ay)": same["p_value"],
                          "En güçlü gecikme (ay)": best["lag"], "ρ (en güçlü)": best["rho"],
                          "p (en güçlü)": best["p_value"]})
    corr_df = pd.DataFrame(corr_rows)
    st.dataframe(corr_df.style.format({"ρ (aynı ay)": "{:+.2f}", "p (aynı ay)": "{:.3f}",
                                       "ρ (en güçlü)": "{:+.2f}", "p (en güçlü)": "{:.3f}"}),
                 hide_index=True, width="stretch")
    st.caption(correlation_sentence(corr_df))
    with st.expander("Spearman korelasyonu nedir?"):
        st.markdown("İki değişkenin değerlerini **sıralarına** göre karşılaştırır; biri artarken diğeri de artma "
                    "(ρ > 0) ya da azalma (ρ < 0) eğiliminde mi diye bakar. Aykırı değerlere dayanıklıdır ve "
                    "doğrusal ilişki varsaymaz. Mevsimsel döngünün sahte korelasyon üretmemesi için anomaliler "
                    "üzerinde hesaplanır. **Korelasyon nedensellik değildir.**")

    if region_choice == "marmara":
        satellite_badge(df, start_year, end_year)

    st.divider()
    st.subheader("Üç denizin karşılaştırması")
    comparison_chart(df, variable, start_year, end_year)


def interpret_trend(region: str, variable: str, res: dict) -> str:
    name = VARIABLE_TR[variable][0]
    if np.isnan(res["p_value"]):
        return "Bu aralıkta trend testi için yeterli veri yok."
    p = res["p_value"]
    chance = "%0,1'den az" if p < 0.001 else f"%{tr_num(p * 100, 1)}"
    direction = {"increasing": "artış", "decreasing": "azalış"}.get(res["trend"], "eğilim")
    if res["significant"]:
        return (f"**{p_text(p)} (< 0,05):** {REGION_LOC[region]}ki {name} {direction} eğilimi "
                f"({change_label(variable, res)}) istatistiksel olarak anlamlıdır. Gerçekte hiçbir eğilim "
                f"olmasaydı, bu kadar güçlü bir eğilimi yalnızca şans eseri görme olasılığı {chance} olurdu; "
                f"yani bu değişimin tesadüf olması çok düşük bir ihtimaldir.")
    return (f"**{p_text(p)} (≥ 0,05):** {REGION_LOC[region]}ki {name} için gözlenen eğim "
            f"({change_label(variable, res)}) doğal yıldan yıla dalgalanmadan ayırt edilemiyor. "
            f"Bu, değişim olmadığı anlamına gelmez; bu veriyle güvenle kanıtlanamadığı anlamına gelir.")


def correlation_sentence(corr_df: pd.DataFrame) -> str:
    texts = []
    for _, row in corr_df.iterrows():
        rho, p = row["ρ (en güçlü)"], row["p (en güçlü)"]
        if np.isnan(rho):
            continue
        strength = "zayıf" if abs(rho) < 0.3 else ("orta" if abs(rho) < 0.5 else "güçlü")
        sign = "pozitif" if rho > 0 else "negatif"
        sig = "anlamlı" if p < 0.05 else "anlamlı değil"
        lag = int(row["En güçlü gecikme (ay)"])
        lag_txt = "aynı ayda" if lag == 0 else f"{lag} ay gecikmeyle"
        texts.append(f"{row['İlişki']}: {lag_txt} {strength} {sign} ilişki (ρ = {tr_num(rho, 2, sign=True)}, {sig}).")
    return " ".join(texts) + " Korelasyon nedensellik değildir; ilişkinin yönünü ve gücünü gösterir."


def info_boxes(variable: str) -> None:
    c1, c2, c3 = st.columns(3)
    with c1.expander("❓ Mann-Kendall ve p-değeri ne anlama gelir?"):
        st.markdown(
            "**Mann-Kendall testi**, her ayı sonraki tüm aylarla karşılaştırarak serinin sistematik olarak "
            "yükselip yükselmediğini sayar; verinin normal dağılmasını gerektirmez.\n\n"
            "Ardışık aylar birbirine benzediği için (otokorelasyon) klasik test sahte anlamlılık üretebilir. "
            "Bu yüzden **Hamed-Rao düzeltmesi** kullanıyoruz.\n\n"
            "**p-değeri:** Gerçekte hiç eğilim olmasaydı, bu kadar güçlü bir eğilimi şans eseri görme "
            "olasılığıdır. **p < 0,05** ise eğilimi *istatistiksel olarak anlamlı* kabul ederiz.\n\n"
            "**Sen eğimi:** Tüm nokta çiftleri arasındaki eğimlerin medyanıdır; uç değerlerden etkilenmez.")
    with c2.expander("❓ Klorofile neden Log10 dönüşümü uyguladık?"):
        st.markdown(
            "Klorofil-a değerleri 0,1 ile 30 mg/m³ arasında değişebilir ve birkaç aşırı patlama ortalamayı "
            "bozar. Bu tür **log-normal** dağılımlarda logaritma almak değişkenliği dengeler ve okyanus "
            "renk biliminde standart uygulamadır.\n\n"
            "Log ölçekteki eğim, **yüzde değişim** olarak yorumlanır: *“on yılda −%10”* gibi.\n\n"
            "SST ve rüzgâr normal dağılıma yakın olduğundan dönüştürülmez.")
    with c3.expander("❓ Mevsimsellikten arındırılmış anomali nasıl yorumlanır?"):
        st.markdown(
            "Her bahar klorofil, her yaz sıcaklık doğal olarak yükselir. Bu döngü gerçek eğilimi gizler.\n\n"
            "Anomali = **o ayın değeri − aynı takvim ayının uzun dönem ortalaması**. Örneğin Mayıs 2021, "
            "tüm Mayıs aylarının ortalamasıyla karşılaştırılır.\n\n"
            "**Kırmızı çubuk:** normalden yüksek · **Mavi çubuk:** normalden düşük. Anomaliler zamanla bir "
            "yöne kayıyorsa, bu mevsimsel değil **uzun dönemli** bir değişimdir.")


def satellite_badge(df: pd.DataFrame, start_year: int, end_year: int) -> None:
    st.subheader("🛰️ Uydu güvenilirlik kontrolü (FLH vs CHL, Marmara)")
    check = satellite_consistency(get_series(df, "marmara", "chl", start_year, end_year),
                                  get_series(df, "marmara", "flh", start_year, end_year))
    colors = {"consistent": "#2e7d32", "partly consistent": "#f9a825", "inconsistent": "#c62828"}
    labels = {"consistent": "✅ Tutarlı", "partly consistent": "⚠️ Kısmen tutarlı", "inconsistent": "❌ Tutarsız"}
    st.markdown(f'<span class="badge" style="background:{colors[check["status"]]}">{labels[check["status"]]}</span>',
                unsafe_allow_html=True)
    event_txt = (f" 2021 müsilaj zirvesinde (Nisan–Haziran) iki gösterge {check['event_months_total']} ayın "
                 f"{check['event_months_agree']}'ünde aynı yönde saptı." if check["event_months_total"] else "")
    st.markdown(
        f"Klorofil-a (renk tabanlı) ile FLH (floresans tabanlı) iki **bağımsız** optik göstergedir. "
        f"Anomalileri arasındaki Spearman korelasyonu **ρ = {tr_num(check['rho'], 2, sign=True)}** "
        f"({p_text(check['p_value'])}, n = {check['n']}).{event_txt}"
    )
    st.caption("Bulanık veya müsilajla kaplı suda renk algoritması yanılabilir. Floresans fitoplanktonun kendi "
               "yaydığı ışığı ölçtüğü için bulanıklıktan daha az etkilenir. İkisi aynı yönü gösteriyorsa "
               "klorofil sinyali gerçektir; ölçüm hatası değildir.")


def comparison_chart(df: pd.DataFrame, variable: str, start_year: int, end_year: int) -> pd.DataFrame:
    name, unit = VARIABLE_TR[variable]
    log_transform = VARIABLES[variable][2]
    fig = go.Figure()
    rows = []
    for region in ("marmara", "aegean", "blacksea"):
        series = get_series(df, region, variable, start_year, end_year)
        if series.dropna().empty:
            continue
        display_anomaly, anomaly_unit = anomaly_for_display(series, variable)
        rolling = display_anomaly.rolling(12, center=True, min_periods=9).mean()
        res = trend_test(series, log_transform)
        fig.add_trace(go.Scatter(x=rolling.index, y=rolling.values, mode="lines", name=REGION_TR[region],
                                 line={"color": REGION_COLORS[region], "width": 2.5}))
        rows.append({"Bölge": REGION_TR[region], "Trend": TREND_TR.get(res["trend"], res["trend"]),
                     "Sen eğimi": change_label(variable, res), "p-değeri": tr_p(res["p_value"]),
                     "Anlamlı mı?": "Evet" if res["significant"] else "Hayır",
                     "_dir": res["trend"], "_sig": res["significant"]})
    fig.add_hline(y=0, line_color="black", line_width=0.8)
    fig.add_vrect(x0="2021-04-01", x1="2021-07-01", fillcolor="orange", opacity=0.15, line_width=0)
    fig.update_layout(title=f"12 aylık hareketli ortalama anomali — {name}", yaxis_title=anomaly_unit,
                      height=420, margin={"t": 50}, legend={"orientation": "h", "y": -0.15})
    st.plotly_chart(fig, width="stretch")
    table = pd.DataFrame(rows)
    if not table.empty:
        st.dataframe(table.drop(columns=["_dir", "_sig"]), hide_index=True, width="stretch")
        sig = table[table["_sig"]]
        if {"increasing", "decreasing"} <= set(sig["_dir"]):
            up = ", ".join(sig[sig["_dir"] == "increasing"]["Bölge"])
            down = ", ".join(sig[sig["_dir"] == "decreasing"]["Bölge"])
            st.warning(f"🔍 **Zıt yönlü eğilim tespit edildi:** {name} {up} bölgesinde anlamlı biçimde artarken "
                       f"{down} bölgesinde anlamlı biçimde azalıyor. Aynı süreç farklı havzalarda zıt sonuçlar "
                       f"doğurabilir; bu yüzden tek bir bölgeye bakmak yanıltıcıdır.")
    return table


def compare_regions(df: pd.DataFrame, variable: str, start_year: int, end_year: int) -> None:
    st.subheader(f"Üç Denizin Karşılaştırması · {VARIABLE_TR[variable][0]} · {start_year}–{end_year}")
    if variable == "flh":
        st.info("FLH yalnızca Marmara için mevcut; karşılaştırma için başka bir değişken seçin.")
        return
    comparison_chart(df, variable, start_year, end_year)
    info_boxes(variable)


# =============================================================================== main
def main() -> None:
    try:
        df = get_data()
    except FileNotFoundError as err:
        st.error(f"Veri bulunamadı: {err}. Giovanni CSV dosyalarını data/raw/<değişken>/ klasörlerine koyun.")
        st.stop()

    pages = {"home": "🏠 Ana Sayfa", "sim": "🗺️ Risk Simülasyonu", "stats": "📊 İstatistik Analizi"}
    if "page" not in st.session_state:
        st.session_state["page"] = "home"
    with st.sidebar:
        st.markdown("## 🔎 Müsilaj Dedektifi")
        st.radio("Bölümler", list(pages), format_func=pages.get, key="page")
        st.divider()
        st.markdown('<p class="small">NASA Space Apps Challenge 2026 · Sivas<br>'
                    'Veri: NASA Giovanni — MODIS-Aqua (SST, Klorofil-a, FLH), MERRA-2 (rüzgâr), '
                    '2003–2024 aylık.</p>', unsafe_allow_html=True)

    page = st.session_state["page"]
    if page == "home":
        page_home(df)
    elif page == "sim":
        page_simulation(df)
    else:
        page_statistics(df)


main()