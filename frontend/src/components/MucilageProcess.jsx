import { useState } from "react";
import "./MucilageProcess.css";

// Formation of marine mucilage in four steps. Each step lists the factors involved and
// whether this project tracks them with satellite data.
const STEPS = [
  {
    key: "ingredients",
    no: "01",
    title: "Ingredients",
    short: "Nutrients + phytoplankton + warm, sunlit water",
    text:
      "Nitrogen and phosphorus from wastewater, industry and agriculture feed phytoplankton. Warm, sunlit water supports " +
      "rapid growth. These microscopic algae produce the raw material for mucilage.",
    factors: [
      { name: "Sea temperature", data: "MODIS satellite", kind: "tracked" },
      { name: "Phytoplankton biomass", data: "MODIS satellite", kind: "tracked" },
      { name: "Nutrient load (nitrogen, phosphorus)", kind: "none" },
    ],
  },
  {
    key: "secretion",
    no: "02",
    title: "Secretion",
    short: "Stressed cells release sticky sugars",
    text:
      "When nitrogen is abundant but phosphorus is scarce, cells continue photosynthesis but cannot grow and divide. " +
      "They release excess carbon as sticky sugar chains (polysaccharides).",
    factors: [
      { name: "High temperature", data: "MODIS satellite", kind: "tracked" },
      { name: "Nitrogen/phosphorus imbalance", kind: "none" },
    ],
  },
  {
    key: "accumulation",
    no: "03",
    title: "Accumulation",
    short: "Limited dispersal in calm, stratified water",
    text:
      "Phosphorus scarcity also slows bacterial breakdown of sugars. Weak winds reduce mixing; Marmara’s " +
      "two-layer structure further limits exchange between surface and deep water. Secretions accumulate instead of dispersing.",
    factors: [
      { name: "Weak winds / calm water", data: "MERRA-2", kind: "tracked" },
      { name: "Stratification (two-layer structure)", kind: "none" },
    ],
  },
  {
    key: "result",
    no: "04",
    title: "Mucilage",
    short: "Marine snow → clouds → mats",
    text:
      "Microscopic particles stick together, forming small aggregates called “marine snow”, then fluffy clouds, " +
      "and finally mats covering the surface or seabed. Sinking mucilage depletes oxygen and smothers benthic organisms.",
    factors: [],
    stages: ["Marine snow", "Clouds", "Mats"],
  },
];

// tracked: this project follows the factor with NASA data; none: cannot be measured from space
const KIND = {
  tracked: { label: "Tracked with NASA data", className: "tag-sat" },
  none: { label: "Not measured by satellite", className: "tag-none" },
};

const COMPOSITION = [
  { name: "Water", note: "Most of the mass, held within the gel structure", weight: 6 },
  { name: "Polysaccharide matrix", note: "Sticky sugar chains released by phytoplankton and bacteria", weight: 2 },
  { name: "Living and dead cells", note: "Diatoms and dinoflagellates (e.g. Gonyaulax fragilis)", weight: 1 },
  { name: "Bacteria and viruses", note: "Some can pose human health risks", weight: 1 },
  { name: "Particles", note: "Organic debris, clay and microplastics", weight: 1 },
];
const COMPOSITION_COLORS = ["#2d5566", "#d8f77a", "#5fc27e", "#b48cff", "#9ca8aa"];

export default function MucilageProcess() {
  const [active, setActive] = useState("ingredients");
  const step = STEPS.find((s) => s.key === active);

  return (
    <div className="mp-wrap">
      <div className="eyebrow mono">FORMATION PROCESS</div>
      <h3 className="mp-title">How does mucilage form? Select a step</h3>

      <div className="mp-layout">
        <div>
          <div className="mp-steps">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                className={`mp-step ${active === s.key ? "active" : ""}`}
                onClick={() => setActive(s.key)}
              >
                <span className="mp-no mono">{s.no}</span>
                <span className="mp-step-title">{s.title}</span>
                <span className="mp-step-short">{s.short}</span>
                {i < STEPS.length - 1 && <span className="mp-arrow" aria-hidden="true">→</span>}
              </button>
            ))}
          </div>

          <div className="mp-detail">
            <p className="mp-text">{step.text}</p>
            {step.stages && (
              <div className="mp-stages">
                {step.stages.map((st, i) => (
                  <span key={st} className="mp-stage" style={{ opacity: 0.55 + i * 0.22 }}>
                    <i style={{ width: 10 + i * 10, height: 10 + i * 6 }} />
                    {st}
                  </span>
                ))}
              </div>
            )}
            {step.factors.length > 0 && (
              <div className="mp-factors">
                {step.factors.map((f) => (
                  <div key={f.name} className="mp-factor">
                    <span className="mp-factor-name">{f.name}</span>
                    <span className={`mp-tag ${KIND[f.kind].className}`} title={f.data}>
                      {KIND[f.kind].label}
                      {f.data ? ` · ${f.data}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mp-composition">
          <h4>What is mucilage made of?</h4>
          <div className="mp-bar" aria-hidden="true">
            {COMPOSITION.map((c, i) => (
              <div key={c.name} style={{ flex: c.weight, background: COMPOSITION_COLORS[i] }} />
            ))}
          </div>
          <ul>
            {COMPOSITION.map((c, i) => (
              <li key={c.name}>
                <i style={{ background: COMPOSITION_COLORS[i] }} />
                <div>
                  <b>{c.name}</b>
                  <span>{c.note}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mp-note">Bar proportions are illustrative, not measured percentages.</p>
        </div>
      </div>
    </div>
  );
}