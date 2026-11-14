import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Globe3D from "../components/Globe3D";

const API = "http://127.0.0.1:8000/api";

const SEA_DETAILS = {
  marmara: {
    name: "Marmara Denizi",
    coords: "40,65° N · 28,30° E",
    summary:
      "Yarı kapalı yapısı, iki katmanlı akıntı sistemi ve yoğun kentsel-endüstriyel besin yükü nedeniyle ısınma ve rüzgâr zayıflamasına en hassas havza. 2007, 2008 ve 2021 müsilaj salgınlarının merkez üssü.",
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
      "Büyük nehir girdileri ve geniş kıta sahanlığı ile yüksek biyolojik üretkenliğe sahiptir. Boğaz çıkışı üzerinden Marmara yüzey suyunu besler.",
  },
};

const trNum = (v, d = 2, sign = false) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const txt = sign && v > 0 ? `+${v.toFixed(d)}` : v.toFixed(d);
  return txt.replace(".", ",");
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

      {/* Canlı Veri Şeridi */}
      <div className="strip">
        <div>
          <div className="numeral">
            22<small>yıl</small>
          </div>
          <p>
            Kesintisiz aylık veri arşivi ({overview ? `${overview.min_year}–${overview.max_year}` : "2003–2024"})
          </p>
        </div>
        <div>
          <div className="numeral">
            {overview ? trNum(overview.marmara_sst_change, 2, true) : "+0,83"}
            <small>°C / 10 yıl</small>
          </div>
          <p>Marmara&apos;da deniz yüzeyi ısınma eğilimi</p>
        </div>
        <div>
          <div className="numeral">
            {overview ? trNum(overview.aegean_chl_change, 1, true) : "+13,1"}
            <small>% / 10 yıl</small>
          </div>
          <p>Ege Denizi klorofil-a değişim oranı</p>
        </div>
        <div>
          <div className="numeral">
            {overview ? overview.total_months : 264}
            <small>ay</small>
          </div>
          <p>Her deniz havzası için uydu gözlemi</p>
        </div>
      </div>

      {/* Deniz Seçimi */}
      <div className="sea-selection">
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

        <div className="grid-2">
          <div>
            <div className="eyebrow mono">KRONOLOJİ</div>
            <h3 style={{ fontSize: "18px", fontWeight: 500, margin: "8px 0" }}>
              Türkiye&apos;de Müsilaj Geçmişi
            </h3>
            <div className="timeline-dark">
              <p>
                <b>2007</b> — Marmara Denizi&apos;nde ilk kez geniş ölçekli müsilaj tabakaları raporlandı.
              </p>
              <p>
                <b>2008</b> — Marmara&apos;da yeniden yoğun kümeler görüldü; baskın tür{" "}
                <i>Gonyaulax fragilis</i> idi.
              </p>
              <p>
                <b>2021</b> — Erken ilkbaharda başlayıp Kuzey Ege ve Batı Karadeniz&apos;e yayılan{" "}
                <b>tarihin en büyük salgını</b> yaşandı.
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
                <b>Marmara Denizi:</b> Yüzey ve dip ekosistemini kaplayarak balıkçılığı ve deniz turizmini
                durma noktasına getirdi.
              </li>
              <li>
                <b>Çanakkale Boğazı &amp; Kuzey Ege:</b> Mart–Temmuz arasında yaklaşık 5 ay sürdü; dip
                canlılarında toplu ölümler gözlendi.
              </li>
              <li>
                <b>Batı Karadeniz:</b> İstanbul Boğazı çıkışında gözlemlendi ancak yoğunluğu Marmara&apos;nın
                çok altında kaldı.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}