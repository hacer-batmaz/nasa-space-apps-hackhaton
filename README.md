# Mucilage Detective

**NASA Space Apps Challenge 2026 · Sivas · Challenge: _Be An Earth System Trend Detective_**

**Team Space 58:** Alimenur AKÖZ · Hacer BATMAZ · Elif KARA

### 🌐 Live demo: **[https://nasa-space-apps-hackhaton.vercel.app/](https://nasa-space-apps-hackhaton.vercel.app/)**

Mucilage Detective uses 22 years of NASA data (2003–2024) to find trends in the conditions behind mucilage ("sea snot") outbreaks in the seas around Türkiye. It focuses on the Sea of Marmara and uses the Aegean and the Black Sea for comparison.

The project has two parts:
- a **Python/FastAPI back end**, which loads the data, runs the trend statistics, the risk index and the machine learning models;
- a **React web app**, which shows the results as interactive pages.

---

## Why mucilage, why the Sea of Marmara?

Mucilage is a sticky mass of organic matter released by phytoplankton under stress. In Türkiye it was first observed in 1992 in Erdek Bay (Sea of Marmara). Large outbreaks in the Sea of Marmara happened in 2007–08, in 2020–21 (the largest on record, covering the whole sea and killing seafloor life) and again in October 2024.

Four things make the Marmara especially vulnerable:

1. **Semi-enclosed.** It is linked to other seas only by two narrow straits, so its water renews slowly.
2. **Two layers.** Brackish Black Sea water sits on top of salty Mediterranean water. The layers barely mix, so the deep water loses oxygen.
3. **Heavy nutrient load.** Wastewater from Istanbul and the industrial coast feeds the phytoplankton.
4. **Fastest warming.** In our data it warms faster than the Aegean and the Black Sea.

**Our question:** are the conditions that favour mucilage becoming more common?

---

## NASA data

All series were downloaded from **[NASA Giovanni](https://giovanni.gsfc.nasa.gov/)** as monthly area-averaged time series. The period is January 2003 to December 2024: 264 months with no gaps.

| Variable | NASA product (Giovanni ID) | Resolution | Why it matters | Used for |
|---|---|---|---|---|
| Sea surface temperature | MODIS-Aqua `MODISA_L3m_SST_Monthly_4km_R2019_0_sst` | 4 km | Warm water speeds up growth and secretion | Trend, risk, ML |
| Chlorophyll-a | MODIS-Aqua `MODISA_L3m_CHL_Mo_4km_R2022_0_chlor_a` | 4 km | Amount of phytoplankton, the raw material of mucilage | Trend, risk, ML (target) |
| Surface wind speed | MERRA-2 `M2TMNXFLX_5_12_4_SPEED` | 0.5° × 0.625° | Weak wind means calm, unmixed water | Trend, risk, ML |
| Fluorescence line height | MODIS-Aqua `MODISA_L3m_FLH_Mo_4km_R2022_0_nflh` | 4 km | Cross-checks chlorophyll in turbid or slimy water (Marmara only) | Consistency check |

Area-average boxes, given as lon_min, lat_min, lon_max, lat_max:

| Sea | Box |
|---|---|
| Marmara | 26.9, 40.2, 30.0, 41.1 |
| Aegean | 25.5, 36.8, 27.5, 39.8 |
| Black Sea | 28.0, 41.0, 41.8, 42.5 |

`data/data_catalog.csv` lists every file with its Giovanni URL, unit, the exact data box and processing notes.

---

## Methods

1. **Cleaning.** We remove fill values (MODIS: −32767, MERRA-2: 1e15) and analyse chlorophyll on a log10 scale. Outliers are flagged but never removed.
2. **Anomalies.** We remove the seasonal cycle by subtracting each calendar month's 2003–2024 mean.
3. **Trend test.** We use the Mann-Kendall test with the Hamed-Rao correction for autocorrelation (Hamed & Rao, 1998).
4. **Trend size.** We use Sen's slope (Sen, 1968), reported as change per decade.
5. **Risk index.** For each of 16 coastal sites, we turn the conditions into a 0–100 score:

   ```
   risk = 100 × site_susceptibility × (0.35·T + 0.25·R + 0.40·C)
   ```

   - **T** is temperature, **R** is calm wind and **C** is chlorophyll. Each is scaled with a logistic curve, with midpoints at 17 °C, 5 m/s and 2 mg/m³.
   - **Risk levels:** < 25 low, < 50 medium, < 75 high, otherwise critical.
   - **The score shows how favourable conditions are. It is not a forecast of an outbreak.**
6. **Machine learning.** The models predict chlorophyll-a, the phytoplankton fuel; they do not predict mucilage itself.
   - **Target:** log10 chlorophyll-a.
   - **Inputs (11):**
     - sea temperature: this month, last month, 2 months ago and the 3-month average;
     - wind: this month, last month and the 3-month average;
     - chlorophyll: last month and 2 months ago;
     - season: the month as sine and cosine, so December and January sit next to each other.
   - **Split by date:** train on 2003–2019 (204 months), blind test on 2020–2024 (60 months, including the 2021 outbreak).
   - **Algorithms:**
     - Random Forest: 300 trees, maximum depth 8.
     - XGBoost: 300 gradient-boosted trees, learning rate 0.03, maximum depth 5.
     - SVR: RBF kernel on scaled inputs (C = 1, ε = 0.1).

---

## Key results

| Sea | Sea temperature | Wind | Chlorophyll-a |
|---|---|---|---|
| Marmara | **+0.83 °C / decade** | no trend | −10.2 % / decade |
| Black Sea | +0.76 °C / decade | no trend | no trend |
| Aegean | +0.59 °C / decade | no trend | +13.1 % / decade |

- All three seas are warming significantly (p < 0.001), and the Marmara is warming fastest.
- Before the outbreaks, the Marmara was unusually warm and winds were weaker:
  - Sep–Nov 2020: +1.4 °C above the monthly normal.
  - Jul–Sep 2024: +1.6 °C above the monthly normal.
- Machine learning results for the Sea of Marmara, on the 2020–2024 blind test:

  | Model | R² | MAE (mg/m³) |
  |---|---|---|
  | Random Forest | 0.32 | 2.17 |
  | XGBoost | 0.31 | 2.25 |
  | SVR | 0.25 | 2.19 |

  Sea temperature is the most important input group: 58 % of the Random Forest importance (all temperature inputs together).

---

## The web app

| Page | What it does |
|---|---|
| **Explore** | A 3D globe with the three seas, 22-year trend cards for each sea, how mucilage forms, and a chronology of outbreaks |
| **Simulation** | A risk atlas of 16 coastal sites on a Leaflet map, with these controls: <ul><li>a time player for 2003–2024, by month, season or year, at 0.5–4× speed</li><li>"what if" sliders for temperature, wind and chlorophyll</li><li>a comparison with the historical average for a year range you choose</li></ul> |
| **Statistics** | Trend tests, Sen's slope and anomaly charts, with the outbreak periods marked |
| **Model** | A comparison of Random Forest, XGBoost and SVR for each sea: <ul><li>a chart of the blind test</li><li>the importance of each input group</li></ul> |
| **Sources & Data** | The data catalogue and the literature |

---

## Project structure

```
├── api.py                  # FastAPI back end (all /api endpoints)
├── requirements.txt
├── data/
│   ├── data_catalog.csv    # dataset metadata and Giovanni links
│   ├── raw/{sst,chl,wind,flh}/<region>_<var>_<source>_mo_2003-2024.csv
│   └── processed/all_monthly.csv
├── src/
│   ├── data_loader.py      # reads and merges the Giovanni files
│   ├── analysis.py         # anomalies, Mann-Kendall, Sen's slope, risk index
│   ├── ml_model.py         # Random Forest / XGBoost / SVR
│   ├── data_check.py       # data quality report
│   ├── merge_data.py       # builds data/processed/all_monthly.csv
│   ├── run_analysis.py     # saves trend tables and figures to outputs/
│   └── map_view.py
└── frontend/               # React + Vite app
    └── src/
        ├── App.jsx
        ├── pages/          # Home, Simulation, Statistics, Model, Sources
        ├── components/     # Globe3D, RiskMap, MucilageProcess, PlotChart
        └── data/references.js
```

---

## Running it locally

**Requirements:** Python 3.10+ (tested on 3.12) and Node.js 20+.

### 1. Back end

Run these from the project root:

```bash
python -m pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

- The API runs at `http://127.0.0.1:8000`.
- Interactive API docs are at `http://127.0.0.1:8000/docs`.
- XGBoost is optional. If it is not installed, the app falls back to Random Forest.

### 2. Front end

Run these in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open the address Vite prints, usually `http://localhost:5173`. The front end expects the API at `http://127.0.0.1:8000/api`.

### Optional scripts

```bash
python src/data_check.py     # quality check of the raw files
python src/merge_data.py     # rebuild data/processed/all_monthly.csv
python src/run_analysis.py   # export trend tables and figures
```

### API endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/overview` | Trend summary for each sea |
| `GET /api/months` | Available months and the default month |
| `GET /api/simulation` | Risk for the 16 sites. Parameters: <ul><li>`year`, `month`</li><li>`climatology`, `clim_start`, `clim_end`</li><li>`d_sst`, `d_wind`, `d_chl`</li></ul> |
| `GET /api/statistics` | Trend tests and anomaly series |
| `GET /api/ml-report` | Model results. Parameters: `region`, `model_type` (`rf`, `xgb` or `svr`) |
| `GET /api/sources` | Data catalogue |

---

## Limitations

- The risk score describes **favourable conditions**; it does not forecast outbreaks.
- Satellites see only the sea surface. Nutrients, stratification and oxygen cannot be measured from space and are not in the model.
- Data are monthly basin averages, so short local events can be smoothed out.
- MERRA-2 wind is a reanalysis (model) product, not a direct observation.

## Next steps

- **NASA PACE** hyperspectral ocean colour, to tell phytoplankton types apart.
- **Sentinel-2** maps of surface mucilage.
- **Copernicus Marine** nutrient and oxygen models.
- Near-real-time alerts, extended to the wider Mediterranean.

---

## References

- Tüfekçi, Balkıs, Polat Beken, Ediger & Mantıkçı (2010). Phytoplankton composition and environmental conditions of a mucilage event in the Sea of Marmara. *Turkish Journal of Biology*, 34(2): 199–210. https://doi.org/10.3906/biy-0812-1
- Koncagül, Erdem Dülger & Yinanç (2022). Formation and the effect of mucilage in the Sea of Marmara and in the world. *European Journal of Engineering and Applied Sciences*, 5(2): 73–79. https://doi.org/10.55581/ejeas.1217901
- Özalp (2021a). First massive mucilage event observed in deep waters of Çanakkale Strait (Dardanelles), Turkey. *J. Black Sea/Mediterranean Environment*, 27(1): 49–66.
- Özalp (2021b). A preliminary assessment of the mass mortality of some benthic species due to the mucilage phenomenon of 2021 in the Çanakkale Strait and North Aegean Sea. *J. Black Sea/Mediterranean Environment*, 27(2): 154–166.
- Topçu Eryalçın & Öztürk (2021). The impact of the massive mucilage outbreak in the Sea of Marmara on gorgonians of Prince Islands. *J. Black Sea/Mediterranean Environment*, 27(2): 270–278.
- Savun-Hekimoğlu & Gazioğlu (2021). Mucilage problem in the semi-enclosed seas: recent outbreak in the Sea of Marmara. *Int. J. Environment and Geoinformatics*, 8(4): 402–413.
- Medvedeva & Stanichny (2022). Outbreak of marine mucilage in the Sea of Marmara in 2021. *Marine Biological Journal*, 7(1): 107–109. https://doi.org/10.21072/mbj.2022.07.1.09
- Sarı & Karadurmuş (2026). Documenting the emergence of a new mucilage formation in the Sea of Marmara in 2024. *Turkish J. Maritime and Marine Sciences*, 12(2): 168–176. https://doi.org/10.52998/trjmms.1838428
- Hamed & Rao (1998). A modified Mann-Kendall trend test for autocorrelated data. *Journal of Hydrology*, 204: 182–196. https://doi.org/10.1016/S0022-1694(97)00125-X
- Sen (1968). Estimates of the regression coefficient based on Kendall's tau. *JASA*, 63(324): 1379–1389. https://doi.org/10.1080/01621459.1968.10480934

## Data acknowledgement

- Sea surface temperature, chlorophyll-a and FLH: NASA Ocean Biology Processing Group, MODIS-Aqua Level-3 products.
- Wind: NASA GMAO MERRA-2.
- All data were accessed through NASA GES DISC Giovanni.
- Base maps: © OpenStreetMap contributors, © CARTO, Esri.