import { useState } from "react";
import "./MucilageProcess.css";

// Formation of marine mucilage in four steps. Each step lists the factors involved and
// whether this project tracks them with satellite data.
const STEPS = [
  {
    key: "ingredients",
    no: "01",
    title: "Malzemeler",
    short: "Besin + fitoplankton + sıcak, ışıklı su",
    text:
      "Atık su, sanayi ve tarımdan gelen azot ve fosfor fitoplanktonu besler. Sıcak ve ışıklı su fitoplanktonun " +
      "hızla çoğalmasını sağlar. Müsilajın hammaddesini bu mikroskobik algler üretir.",
    factors: [
      { name: "Deniz sıcaklığı", data: "MODIS uydusu", kind: "tracked" },
      { name: "Fitoplankton miktarı", data: "MODIS uydusu", kind: "tracked" },
      { name: "Besin yükü (azot, fosfor)", kind: "none" },
    ],
  },
  {
    key: "secretion",
    no: "02",
    title: "Salgı",
    short: "Stresteki hücreler yapışkan şeker salgılar",
    text:
      "Azot bol ama fosfor kıt olduğunda hücreler fotosentez yapmaya devam eder, fakat büyüyüp bölünemez. " +
      "Fazla ürettikleri karbonu yapışkan şeker zincirleri (polisakkarit) olarak dışarı atarlar.",
    factors: [
      { name: "Yüksek sıcaklık", data: "MODIS uydusu", kind: "tracked" },
      { name: "Azot/fosfor dengesizliği", kind: "none" },
    ],
  },
  {
    key: "accumulation",
    no: "03",
    title: "Birikme",
    short: "Durgun, tabakalı suda dağılmaz",
    text:
      "Fosfor kıtlığında bakteriler de yavaşlar ve şekerleri parçalayamaz. Rüzgâr zayıfsa su karışmaz; Marmara'nın " +
      "iki katmanlı yapısı da yüzey ile derin suyun karışmasını engeller. Salgılanan madde dağılmak yerine birikir.",
    factors: [
      { name: "Zayıf rüzgâr / durgun su", data: "MERRA-2", kind: "tracked" },
      { name: "Tabakalaşma (iki katmanlı yapı)", kind: "none" },
    ],
  },
  {
    key: "result",
    no: "04",
    title: "Müsilaj",
    short: "Deniz karı → bulut → tabaka",
    text:
      "Mikroskobik parçacıklar birbirine yapışarak önce “deniz karı” denen küçük kümeleri, sonra pamuksu bulutları, " +
      "en sonunda yüzeyi veya dibi örten tabakaları oluşturur. Dibe çöken müsilaj oksijeni azaltır ve dip canlılarını boğar.",
    factors: [],
    stages: ["Deniz karı", "Bulut", "Tabaka"],
  },
];

// tracked: this project follows the factor with NASA data; none: cannot be measured from space
const KIND = {
  tracked: { label: "NASA verisiyle izliyoruz", className: "tag-sat" },
  none: { label: "Uydudan ölçülemiyor", className: "tag-none" },
};

const COMPOSITION = [
  { name: "Su", note: "Kütlenin büyük kısmı; jel iskeletin içinde tutulur", weight: 6 },
  { name: "Polisakkarit iskelet", note: "Fitoplankton ve bakterilerin salgıladığı yapışkan şeker zincirleri", weight: 2 },
  { name: "Canlı ve ölü hücreler", note: "Diyatomeler, dinoflagellatlar (ör. Gonyaulax fragilis)", weight: 1 },
  { name: "Bakteri ve virüsler", note: "Bazıları insan sağlığı açısından risklidir", weight: 1 },
  { name: "Partiküller", note: "Organik döküntü, kil, mikroplastik", weight: 1 },
];
const COMPOSITION_COLORS = ["#2d5566", "#d8f77a", "#5fc27e", "#b48cff", "#9ca8aa"];

export default function MucilageProcess() {
  const [active, setActive] = useState("ingredients");
  const step = STEPS.find((s) => s.key === active);

  return (
    <div className="mp-wrap">
      <div className="eyebrow mono">OLUŞUM SÜRECİ</div>
      <h3 className="mp-title">Müsilaj nasıl oluşur? Bir adıma tıklayın</h3>

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
          <h4>Müsilaj neyden oluşur?</h4>
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
          <p className="mp-note">Çubuktaki oranlar temsilîdir; ölçülmüş yüzdeler değildir.</p>
        </div>
      </div>
    </div>
  );
}