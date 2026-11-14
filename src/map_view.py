"""
map_view.py
Map building blocks for the risk simulation page: base maps, NASA GIBS overlays and the
risk-point figure. Uses Plotly's token-free MapLibre maps (falls back to Mapbox on old Plotly).
"""
from __future__ import annotations

from datetime import date

import pandas as pd
import plotly.graph_objects as go

HAS_MAPLIBRE = hasattr(go, "Scattermap")
MAP_TRACE = go.Scattermap if HAS_MAPLIBRE else go.Scattermapbox
MAP_LAYOUT_KEY = "map" if HAS_MAPLIBRE else "mapbox"

ESRI_IMAGERY = ("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/"
                "{z}/{y}/{x}")

# label -> (built-in style, extra raster source or None, attribution)
BASE_MAPS = {
    "Açık cadde (OSM)":        ("open-street-map", None, "© OpenStreetMap"),
    "Uydu (Esri)":             ("white-bg", ESRI_IMAGERY, "Esri, Maxar, Earthstar Geographics"),
    "Sade (Carto)":            ("carto-positron", None, "© OpenStreetMap © CARTO"),
    "Altlıksız (çevrimdışı)":  ("white-bg", None, ""),
}

# NASA GIBS daily overlays (Web Mercator, max native zoom 7)
GIBS_LAYERS = {
    "chl": ("MODIS_Aqua_L2_Chlorophyll_A", 7, "png"),
    "sst": ("GHRSST_L4_MUR_Sea_Surface_Temperature", 7, "png"),
}

RISK_COLORSCALE = [[0.0, "#2e7d32"], [0.25, "#9ccc65"], [0.40, "#fdd835"], [0.55, "#fb8c00"],
                   [0.75, "#c62828"], [1.0, "#4a148c"]]


def gibs_tile_url(key: str, day: date) -> str:
    layer, level, ext = GIBS_LAYERS[key]
    return (f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{day:%Y-%m-%d}/"
            f"GoogleMapsCompatible_Level{level}/{{z}}/{{y}}/{{x}}.{ext}")


def raster_layer(url: str, attribution: str, opacity: float = 1.0) -> dict:
    return {"sourcetype": "raster", "source": [url], "below": "traces",
            "sourceattribution": attribution, "opacity": opacity}


def risk_map(points: pd.DataFrame, base_map: str, overlays: list[str], gibs_day: date,
             boxes: dict, box_colors: dict, region_names: dict,
             show_points: bool = True, show_boxes: bool = True, height: int = 720,
             center: dict | None = None, zoom: float = 6.6) -> go.Figure:
    """Build the interactive risk map."""
    style, base_source, base_attr = BASE_MAPS[base_map]
    layers = []
    if base_source:
        layers.append(raster_layer(base_source, base_attr))
    for key in overlays:
        layers.append(raster_layer(gibs_tile_url(key, gibs_day), "NASA GIBS / EOSDIS", opacity=0.85))

    fig = go.Figure()

    if show_boxes:
        for region, (w, s, e, n) in boxes.items():
            fig.add_trace(MAP_TRACE(lon=[w, e, e, w, w], lat=[s, s, n, n, s], mode="lines",
                                    line={"width": 2, "color": box_colors[region]},
                                    name=f"{region_names[region]} veri kutusu", hoverinfo="name"))

    if show_points and not points.empty:
        sizes = 10 + points["Risk Skoru"] * 0.32
        # white halo underneath for contrast on any base map
        fig.add_trace(MAP_TRACE(lat=points["lat"], lon=points["lon"], mode="markers",
                                marker={"size": sizes + 5, "color": "white", "opacity": 0.9},
                                hoverinfo="skip", showlegend=False))
        custom = points[["Bölge", "SST (°C)", "Rüzgâr (m/s)", "Klorofil (mg/m³)", "Risk Skoru",
                         "Risk Seviyesi", "Not"]].values
        fig.add_trace(MAP_TRACE(
            lat=points["lat"], lon=points["lon"], mode="markers", name="Risk noktaları",
            text=points["Konum"], customdata=custom,
            marker={"size": sizes, "color": points["Risk Skoru"], "colorscale": RISK_COLORSCALE,
                    "cmin": 0, "cmax": 100, "opacity": 0.95,
                    "colorbar": {"title": {"text": "Risk"}, "tickvals": [0, 25, 50, 75, 100],
                                 "x": 0.01, "xanchor": "left", "y": 0.98, "yanchor": "top",
                                 "len": 0.45, "thickness": 12, "bgcolor": "rgba(255,255,255,.85)"}},
            hovertemplate=("<b>%{text}</b><br>%{customdata[0]}<br>"
                           "SST: %{customdata[1]:.2f} °C<br>Rüzgâr: %{customdata[2]:.2f} m/s<br>"
                           "Klorofil-a: %{customdata[3]:.2f} mg/m³<br>"
                           "<b>Risk: %{customdata[4]:.0f}/100 (%{customdata[5]})</b><br>"
                           "<i>%{customdata[6]}</i><extra></extra>"),
        ))

    fig.update_layout(
        **{MAP_LAYOUT_KEY: {"style": style, "layers": layers,
                            "center": center or {"lat": 40.55, "lon": 28.6}, "zoom": zoom}},
        height=height, margin={"l": 0, "r": 0, "t": 0, "b": 0}, showlegend=False,
        uirevision=f"view-{zoom}",   # keep the user's zoom/pan while sliders change; reset on new focus
    )
    return fig