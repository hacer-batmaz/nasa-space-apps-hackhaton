import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Globe3D from "../components/Globe3D";
import MucilageProcess from "../components/MucilageProcess";
import { REFERENCES } from "../data/references";

// small "Source" link shown after a sentence
function Src({ refs }) {
  return (
    <span style={{ fontSize: "11px", color: "#6c818c", marginLeft: "6px", whiteSpace: "nowrap" }}>
      [
      {refs.map((r, i) => (
        <span key={r.url}>
          {i > 0 && "; "}
          <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "#9fb3a4" }}>
            {r.short}
          </a>
        </span>
      ))}
      ]
    </span>
  );
}

const API = "/api";

const SEA_DETAILS = {
  marmara: {
    name: "Sea of Marmara",
    coords: "40.65° N · 28.30° E",
    summary:
      "A semi-enclosed basin with a two-layer circulation and heavy urban and industrial nutrient loads, particularly sensitive to warming and weaker winds. Mucilage events occurred in 2007–2008, 2020–2021 and 2024.",
  },
  aegean: {
    name: "Aegean Sea (Türkiye Coast)",
    coords: "38.60° N · 25.80° E",
    summary:
      "Exchanges water with the Sea of Marmara through the Dardanelles. Chlorophyll-a shows a statistically significant increase of 13.1% per decade over the 22-year record.",
  },
  blacksea: {
    name: "Black Sea (Türkiye Coast)",
    coords: "42.00° N · 34.50° E",
    summary:
      "Nutrients from major rivers such as the Danube support high biological productivity. Low-salinity surface water flows through the Bosphorus into Marmara, forming its upper layer.",
  },
};

const trNum = (v, d = 2, sign = false) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const txt = sign && v > 0 ? `+${v.toFixed(d)}` : v.toFixed(d);
  return txt;
};

// "increasing (significant, p < 0.001)" or "no clear trend"
const trendNote = (change, p, up, down) => {
  if (change === null || change === undefined || p === null || p === undefined) return "calculating";
  if (p >= 0.05) return "no clear trend";
  const pText = p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`;
  return `${change > 0 ? up : down} (significant, ${pText})`;
};

export default function Home({ onNavigate }) {
  const [overview, setOverview] = useState(null);
  const [selectedSea, setSelectedSea] = useState("marmara");

  useEffect(() => {
    fetch(`${API}/overview`)
      .then((r) => r.json())
      .then(setOverview)
      .catch(console.error);
  }, []);

  const seaInfo = SEA_DETAILS[selectedSea];
  const trend = overview?.regions?.[selectedSea];

  return (
    <div className="page-container">
      {/* Yörünge Hero Bölümü */}
      <div className="orbit-hero">
        <div>
          <div className="eyebrow mono">LOOK UP TO UNDERSTAND EARTH.</div>
          <h1>
            The seas’
            <br />
            untold
            <br />
            <em>story.</em>
          </h1>
          <p className="orbit-intro">
            Explore 22 years of climate and ecosystem change in the Marmara, Aegean and Black Seas through NASA satellite data.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button className="btn-acid" onClick={() => onNavigate("sim")}>
              <span>Start Simulation</span>
              <ArrowUpRight size={16} />
            </button>
            <button className="btn-outline" onClick={() => onNavigate("stats")}>
              <span>Statistical Analysis</span>
              <ArrowUpRight size={15} />
            </button>
          </div>
        </div>

        <Globe3D region={selectedSea} />
      </div>

      {/* Deniz Seçimi: seçim hem küreyi, hem veri şeridini, hem de açıklamayı değiştirir */}
      <div className="sea-selection" style={{ marginTop: "28px" }}>
        <span className="mono" style={{ color: "#a1b0b4" }}>
          SELECT A SEA
        </span>
        <div className="sea-buttons">
          <button className={selectedSea === "marmara" ? "active" : ""} onClick={() => setSelectedSea("marmara")}>
            Marmara ↗
          </button>
          <button className={selectedSea === "aegean" ? "active" : ""} onClick={() => setSelectedSea("aegean")}>
            Aegean ↗
          </button>
          <button className={selectedSea === "blacksea" ? "active" : ""} onClick={() => setSelectedSea("blacksea")}>
            Black Sea ↗
          </button>
        </div>
      </div>

      {/* Canlı Veri Şeridi: seçili denizin 22 yıllık eğilimi (Mann-Kendall + Sen eğimi) */}
      <div className="mono" style={{ marginTop: "22px", color: "#8a9a9e" }}>
        {seaInfo.name.toLocaleUpperCase("en-US")} · 22-YEAR TREND (
        {overview ? `${overview.min_year}–${overview.max_year}` : "2003–2024"})
      </div>
      <div className="strip" style={{ marginTop: "12px", borderTop: 0, paddingTop: 0 }}>
        <div>
          <div className="numeral">
            {overview ? overview.total_months : 264}
            <small>months</small>
          </div>
          <p>Continuous monthly NASA data; trends are calculated from this record</p>
        </div>
        <div>
          <div className="numeral">
            {trend ? trNum(trend.sst_change, 2, true) : "–"}
            <small>°C / decade</small>
          </div>
          <p>Sea surface temperature · {trendNote(trend?.sst_change, trend?.sst_p, "increasing", "decreasing")}</p>
        </div>
        <div>
          <div className="numeral">
            {trend ? (Math.abs(trend.wind_change) < 0.005 ? "≈ 0" : trNum(trend.wind_change, 2, true)) : "–"}
            <small>m/s / decade</small>
          </div>
          <p>Surface wind speed · {trendNote(trend?.wind_change, trend?.wind_p, "increasing", "decreasing")}</p>
        </div>
        <div>
          <div className="numeral">
            {trend ? trNum(trend.chl_change, 1, true) : "–"}
            <small>% / decade</small>
          </div>
          <p>Surface chlorophyll · {trendNote(trend?.chl_change, trend?.chl_p, "increasing", "decreasing")}</p>
        </div>
      </div>

      <div className="detail-banner">
        <b>
          {seaInfo.name} ({seaInfo.coords}):
        </b>{" "}
        {seaInfo.summary}
      </div>

      {/* Mucilage Bilgilendirme & Tarihçe */}
      <div className="section-block">
        <div className="eyebrow mono">ECOSYSTEM DRIVERS</div>
        <h2 style={{ fontSize: "24px", fontWeight: 400, margin: "10px 0 8px", letterSpacing: "-0.5px" }}>
          What is marine mucilage, and what triggers it?
        </h2>
        <p style={{ color: "#a1b0b4", maxWidth: "820px", fontSize: "13px" }}>
          Marine mucilage is a gel-like aggregation of organic matter released by marine organisms, especially phytoplankton, under stress. Satellite data help us track three key drivers:
        </p>

        <div className="grid-3">
          <div className="dark-card">
            <h4>01 · High Sea Surface Temperature (SST)</h4>
            <p>
              Warmer waters accelerate phytoplankton metabolism and organic matter release; mild winters weaken vertical mixing.
            </p>
          </div>
          <div className="dark-card">
            <h4>02 · Weak Winds and Calm Waters</h4>
            <p>
              Weaker winds reduce mixing and promote stratification; organic matter accumulates near the surface and within the water column instead of dispersing.
            </p>
          </div>
          <div className="dark-card">
            <h4>03 · Excess Nutrients and Phytoplankton (CHL)</h4>
            <p>
              Nitrogen and phosphorus from wastewater and agriculture increase phytoplankton biomass, measured through chlorophyll-a, supplying the material for mucilage.
            </p>
          </div>
        </div>

        {/* Oluşum süreci diyagramı */}
        <MucilageProcess />

        <div className="grid-2">
          <div>
            <div className="eyebrow mono">TIMELINE</div>
            <h3 style={{ fontSize: "18px", fontWeight: 500, margin: "8px 0" }}>
              Mucilage History in Türkiye
            </h3>
            <div className="timeline-dark">
              <p>
                <b>1992</b> — The first mucilage in Türkiye was observed in Erdek Bay by sport divers.
                <Src refs={[REFERENCES.koncagul2022, REFERENCES.tufekci2010]} />
              </p>
              <p>
                <b>October 2007 – February 2008</b> — Widespread mucilage in Marmara, especially in İzmit Bay. One of the dominant species was <i>Gonyaulax fragilis</i>.
                <Src refs={[REFERENCES.tufekci2010]} />
              </p>
              <p>
                <b>Autumn 2020 – Summer 2021</b> — Began across Marmara in autumn 2020 and reached deep waters of the Dardanelles in December. Surface coverage developed in spring 2021 and persisted in the Dardanelles from March to July. The <b>largest recorded outbreak</b>.
                <Src refs={[REFERENCES.topcu2021, REFERENCES.ozalp2021a, REFERENCES.ozalp2021b]} />
              </p>
              <p>
                <b>October 2024</b> — Mucilage was observed again in Erdek Bay.
                <Src refs={[REFERENCES.sari2026]} />
              </p>
            </div>
          </div>

          <div>
            <div className="eyebrow mono">IMPACTS OF THE 2021 CRISIS</div>
            <h3 style={{ fontSize: "18px", fontWeight: 500, margin: "8px 0" }}>
              Regional Ecological Impacts
            </h3>
            <ul style={{ color: "#b5c5c8", fontSize: "12.5px", paddingLeft: "18px", lineHeight: 1.7 }}>
              <li>
                <b>Sea of Marmara:</b> Covered surface waters and the seabed, clogged fishing nets, and severely affected fisheries and tourism. <Src refs={[REFERENCES.savun2021]} />
              </li>
              <li>
                <b>Dardanelles &amp; North Aegean:</b> Lasted roughly five months from March to July; mass mortality of benthic organisms was observed. <Src refs={[REFERENCES.ozalp2021b]} />
              </li>
              <li>
                <b>North Aegean:</b> Saros Bay, Gökçeada, Bozcaada and the Tavşan Islands were also affected. <Src refs={[REFERENCES.ozalp2021b]} />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}