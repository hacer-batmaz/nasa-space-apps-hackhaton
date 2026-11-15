import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Globe3D from "../components/Globe3D";
import MucilageProcess from "../components/MucilageProcess";
import { REFERENCES, SECONDARY } from "../data/references";

// small "Kaynak" link shown after a sentence
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

const API = "http://127.0.0.1:8000/api";

const SEA_DETAILS = {
  marmara: {
    name: "Marmara Denizi",
    coords: "40,65° N · 28,30° E",
    summary:
      "Yarı kapalı yapısı, iki katmanlı akıntı sistemi ve yoğun kentsel-endüstriyel besin yükü nedeniyle ısınma ve rüzgâr zayıflamasına en hassas havza. 2007–2008, 2020–2021 ve 2024 müsilaj olaylarının yaşandığı deniz.",
  },
  aegean: {
    name: "Ege Denizi (Türkiye Kıyısı)",
    coords: "38,60° N · 25,80° E",
    summary:
      "Çanakkale Boğazı üzerinden Marmara sularıyla etkileşim halindedir. Klorofil-a seviyelerinde son 22 yılda on yılda +%13,1 ile istatistiksel olarak anlamlı artış eğilimi göstermektedir.",
  },
  blacksea: {
    name: "Karadeniz (Türkiye Kıyısı)",
    coords: "42,00° N · 34,50° E",
    summary:
      "Tuna gibi büyük nehirlerin getirdiği besinlerle biyolojik üretkenliği yüksektir. Az tuzlu yüzey suyu İstanbul Boğazı üzerinden Marmara'ya akarak Marmara'nın üst katmanını oluşturur.",
  },
};

const trNum = (v, d = 2, sign = false) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const txt = sign && v > 0 ? `+${v.toFixed(d)}` : v.toFixed(d);
  return txt.replace(".", ",");
};

// "artıyor (anlamlı, p < 0,001)" or "belirgin bir eğilim yok"
const trendNote = (change, p, up, down) => {
  if (change === null || change === undefined || p === null || p === undefined) return "hesaplanıyor";
  if (p >= 0.05) return "belirgin bir eğilim yok";
  const pText = p < 0.001 ? "p < 0,001" : `p = ${p.toFixed(3).replace(".", ",")}`;
  return `${change > 0 ? up : down} (anlamlı, ${pText})`;
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
          <div className="eyebrow mono">YERYÜZÜNÜ ANLAMAK İÇİN YUKARI BAK.</div>
          <h1>
            Denizlerin
            <br />
            görünmeyen
            <br />
            <em>hikâyesi.</em>
          </h1>
          <p className="orbit-intro">
            Uzaydan gelen NASA uydu verileriyle Marmara, Ege ve Karadeniz&apos;in 22 yıllık iklim ve
            ekosistem değişimini keşfedin.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button className="btn-acid" onClick={() => onNavigate("sim")}>
              <span>Simülasyonu Başlat</span>
              <ArrowUpRight size={16} />
            </button>
            <button className="btn-outline" onClick={() => onNavigate("stats")}>
              <span>İstatistik Analizi</span>
              <ArrowUpRight size={15} />
            </button>
          </div>
        </div>

        <Globe3D region={selectedSea} />
      </div>

      {/* Deniz Seçimi: seçim hem küreyi, hem veri şeridini, hem de açıklamayı değiştirir */}
      <div className="sea-selection" style={{ marginTop: "28px" }}>
        <span className="mono" style={{ color: "#a1b0b4" }}>
          BİR DENİZ SEÇİN
        </span>
        <div className="sea-buttons">
          <button className={selectedSea === "marmara" ? "active" : ""} onClick={() => setSelectedSea("marmara")}>
            Marmara ↗
          </button>
          <button className={selectedSea === "aegean" ? "active" : ""} onClick={() => setSelectedSea("aegean")}>
            Ege ↗
          </button>
          <button className={selectedSea === "blacksea" ? "active" : ""} onClick={() => setSelectedSea("blacksea")}>
            Karadeniz ↗
          </button>
        </div>
      </div>

      {/* Canlı Veri Şeridi: seçili denizin 22 yıllık eğilimi (Mann-Kendall + Sen eğimi) */}
      <div className="mono" style={{ marginTop: "22px", color: "#8a9a9e" }}>
        {seaInfo.name.toLocaleUpperCase("tr")} · 22 YILLIK EĞİLİM (
        {overview ? `${overview.min_year}–${overview.max_year}` : "2003–2024"})
      </div>
      <div className="strip" style={{ marginTop: "12px", borderTop: 0, paddingTop: 0 }}>
        <div>
          <div className="numeral">
            {overview ? overview.total_months : 264}
            <small>ay</small>
          </div>
          <p>Kesintisiz aylık NASA verisi; yandaki eğilimler bu seriden hesaplandı</p>
        </div>
        <div>
          <div className="numeral">
            {trend ? trNum(trend.sst_change, 2, true) : "–"}
            <small>°C / 10 yıl</small>
          </div>
          <p>Deniz yüzeyi sıcaklığı · {trendNote(trend?.sst_change, trend?.sst_p, "artıyor", "azalıyor")}</p>
        </div>
        <div>
          <div className="numeral">
            {trend ? (Math.abs(trend.wind_change) < 0.005 ? "≈ 0" : trNum(trend.wind_change, 2, true)) : "–"}
            <small>m/s / 10 yıl</small>
          </div>
          <p>Yüzey rüzgâr hızı · {trendNote(trend?.wind_change, trend?.wind_p, "artıyor", "azalıyor")}</p>
        </div>
        <div>
          <div className="numeral">
            {trend ? trNum(trend.chl_change, 1, true) : "–"}
            <small>% / 10 yıl</small>
          </div>
          <p>Yüzey klorofili · {trendNote(trend?.chl_change, trend?.chl_p, "artıyor", "azalıyor")}</p>
        </div>
      </div>

      <div className="detail-banner">
        <b>
          {seaInfo.name} ({seaInfo.coords}):
        </b>{" "}
        {seaInfo.summary}
      </div>

      {/* Müsilaj Bilgilendirme & Tarihçe */}
      <div className="section-block">
        <div className="eyebrow mono">EKOSİSTEM MEKANİZMASI</div>
        <h2 style={{ fontSize: "24px", fontWeight: 400, margin: "10px 0 8px", letterSpacing: "-0.5px" }}>
          Müsilaj (deniz salyası) nedir ve nasıl tetiklenir?
        </h2>
        <p style={{ color: "#a1b0b4", maxWidth: "820px", fontSize: "13px" }}>
          Müsilaj; fitoplankton başta olmak üzere deniz canlılarının stres altında salgıladığı organik
          maddelerin kümelenmesiyle oluşan jelimsi yapıdır. Uydu verileri üç temel tetikleyiciyi izlememizi sağlar:
        </p>

        <div className="grid-3">
          <div className="dark-card">
            <h4>01 · Yüksek Deniz Sıcaklığı (SST)</h4>
            <p>
              Normalden sıcak sular fitoplankton metabolizmasını ve organik madde salgısını hızlandırır;
              ılık kışlar dikey su karışımını zayıflatır.
            </p>
          </div>
          <div className="dark-card">
            <h4>02 · Zayıf Rüzgâr ve Durgunluk</h4>
            <p>
              Rüzgâr hızı düştüğünde yüzey tabakası karışmaz (tabakalaşma); salgılanan organik maddeler
              dağılmak yerine yüzeyde ve orta suda birikir.
            </p>
          </div>
          <div className="dark-card">
            <h4>03 · Aşırı Besin ve Fitoplankton (CHL)</h4>
            <p>
              Atık su ve tarımsal girdilerle gelen azot ve fosfor, klorofil-a ile ölçülen fitoplankton
              yoğunluğunu artırarak müsilajın hammaddesini üretir.
            </p>
          </div>
        </div>

        {/* Oluşum süreci diyagramı */}
        <MucilageProcess />

        <div className="grid-2">
          <div>
            <div className="eyebrow mono">KRONOLOJİ</div>
            <h3 style={{ fontSize: "18px", fontWeight: 500, margin: "8px 0" }}>
              Türkiye&apos;de Müsilaj Geçmişi
            </h3>
            <div className="timeline-dark">
              <p>
                <b>1992</b> — Türkiye&apos;deki ilk müsilaj gözlemlerinin Erdek Körfezi&apos;nde yapıldığı aktarılır.
                <Src refs={[SECONDARY.erdek1992]} />
              </p>
              <p>
                <b>Ekim 2007 – Şubat 2008</b> — Marmara&apos;da, en yoğun olarak İzmit Körfezi&apos;nde geniş ölçekli
                müsilaj. Baskın türlerden biri <i>Gonyaulax fragilis</i> idi.
                <Src refs={[REFERENCES.tufekci2010]} />
              </p>
              <p>
                <b>Sonbahar 2020 – Yaz 2021</b> — Sonbahar 2020&apos;de Marmara genelinde başladı; Aralık 2020&apos;de
                Çanakkale Boğazı&apos;nın derin sularında da görüldü. 2021 baharında yüzeyi kapladı, Çanakkale&apos;de
                Mart–Temmuz arasında sürdü. Kayıtlardaki <b>en büyük salgın</b>.
                <Src refs={[REFERENCES.topcu2021, REFERENCES.ozalp2021a, REFERENCES.ozalp2021b]} />
              </p>
              <p>
                <b>Ekim 2024</b> — Erdek Körfezi&apos;nde yeniden müsilaj gözlendi.
                <Src refs={[REFERENCES.sari2026]} />
              </p>
            </div>
          </div>

          <div>
            <div className="eyebrow mono">2021 KRİZİNİN ETKİLERİ</div>
            <h3 style={{ fontSize: "18px", fontWeight: 500, margin: "8px 0" }}>
              Bölgesel Ekolojik Sonuçlar
            </h3>
            <ul style={{ color: "#b5c5c8", fontSize: "12.5px", paddingLeft: "18px", lineHeight: 1.7 }}>
              <li>
                <b>Marmara Denizi:</b> Yüzeyi ve dibi kapladı; balıkçı ağlarını tıkayarak balıkçılığa ve
                turizme ciddi zarar verdi. <Src refs={[REFERENCES.savun2021]} />
              </li>
              <li>
                <b>Çanakkale Boğazı &amp; Kuzey Ege:</b> Mart–Temmuz arasında yaklaşık 5 ay sürdü; dip
                canlılarında toplu ölümler gözlendi. <Src refs={[REFERENCES.ozalp2021b]} />
              </li>
              <li>
                <b>Kuzey Ege:</b> Saros Körfezi, Gökçeada, Bozcaada ve Tavşan Adaları da müsilajdan
                etkilendi. <Src refs={[REFERENCES.ozalp2021b]} />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}