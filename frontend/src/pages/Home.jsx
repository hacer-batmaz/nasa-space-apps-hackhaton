import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000/api";

const trNum = (v, d = 2, sign = false) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const txt = sign && v > 0 ? `+${v.toFixed(d)}` : v.toFixed(d);
  return txt.replace(".", ",");
};

const pText = (p) => {
  if (p === null || p === undefined) return "p = –";
  return p < 0.001 ? "p < 0,001" : `p = ${trNum(p, 3)}`;
};

export default function Home({ onNavigate }) {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    fetch(`${API}/overview`)
      .then((r) => r.json())
      .then(setOverview)
      .catch(console.error);
  }, []);

  return (
    <div>
      <div className="hero">
        <h1>🔎 Müsilaj Dedektifi</h1>
        <p>
          <b>Türk Denizlerinde İklim ve Ekosistem Eğilimleri</b> — NASA uydu verileriyle Marmara, Ege ve
          Karadeniz&apos;de <i>ne değişti, nerede değişti, ne kadar değişti ve bu değişim önemli mi?</i>
        </p>
      </div>

      {overview && (
        <div className="grid-4">
          <div className="metric-card">
            <div className="metric-label">Analiz dönemi</div>
            <div className="metric-value">
              {overview.min_year}–{overview.max_year}
            </div>
            <div className="metric-sub">{overview.total_months} ay</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Marmara ısınması</div>
            <div className="metric-value">{trNum(overview.marmara_sst_change, 2, true)} °C / 10 yıl</div>
            <div className="metric-sub">{pText(overview.marmara_sst_p)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Marmara klorofil</div>
            <div className="metric-value">{trNum(overview.marmara_chl_change, 1, true)} % / 10 yıl</div>
            <div className="metric-sub">{pText(overview.marmara_chl_p)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Ege klorofil</div>
            <div className="metric-value">{trNum(overview.aegean_chl_change, 1, true)} % / 10 yıl</div>
            <div className="metric-sub">{pText(overview.aegean_chl_p)}</div>
          </div>
        </div>
      )}

      <h2 className="section-title">Hızlı başlangıç</h2>
      <div className="grid-2">
        <div className="cta-card">
          <div>
            <h3>🗺️ İnteraktif Türkiye Haritası &amp; Risk Simülasyonu</h3>
            <p>
              Gerçek NASA verisinden başlayın; sıcaklığı, rüzgârı ve besin yükünü değiştirin, 16 kıyı
              noktasında riskin nasıl değiştiğini anlık izleyin.
            </p>
          </div>
          <button className="btn-primary" onClick={() => onNavigate("sim")}>
            Simülasyonu Başlat →
          </button>
        </div>

        <div className="cta-card">
          <div>
            <h3>📊 Bilimsel Trend ve İstatistik Analizi</h3>
            <p>
              Mann-Kendall, Sen eğimi ve Spearman korelasyonu ile 22 yıllık değişimin gerçekten anlamlı
              olup olmadığını test edin.
            </p>
          </div>
          <button className="btn-primary" onClick={() => onNavigate("stats")}>
            Analize Git →
          </button>
        </div>
      </div>

      <h2 className="section-title">Müsilaj (deniz salyası) nedir?</h2>
      <p style={{ lineHeight: 1.6, marginBottom: "1rem" }}>
        Müsilaj; fitoplankton başta olmak üzere deniz canlılarının salgıladığı, şekerden zengin organik
        maddelerin kümelenmesiyle oluşan, jöle kıvamında bir yapıdır. Yüzeyde kahverengi-gri tabakalar
        oluşturur, ancak büyük kısmı dibe çökerek dip canlılarını boğar; balıkçılığı, turizmi ve deniz
        ekosistemini ciddi biçimde etkiler.
      </p>

      <div className="grid-3">
        <div className="info-card">
          <h4>🌡️ Yüksek deniz sıcaklığı</h4>
          <p>
            Normalden sıcak sular fitoplankton büyümesini ve organik madde salgısını hızlandırır; sıcak
            kışlar mevsimsel karışımı zayıflatır.
          </p>
        </div>
        <div className="info-card">
          <h4>🍃 Zayıf rüzgâr ve durgunluk</h4>
          <p>
            Rüzgâr azaldığında su karışmaz, yüzey tabakası durgunlaşır (tabakalaşma) ve salgılanan
            maddeler dağılmak yerine birikir.
          </p>
        </div>
        <div className="info-card">
          <h4>🌿 Aşırı besin ve fitoplankton</h4>
          <p>
            Atık su ve tarımsal girdilerle gelen azot ve fosfor, klorofil-a ile ölçülen fitoplankton
            biyokütlesini artırır; müsilajın hammaddesi budur.
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: "1.6rem" }}>
        <div>
          <h2 className="section-title">Türkiye&apos;de müsilaj geçmişi</h2>
          <div className="timeline">
            <p>
              <b>2007</b> — Müsilaj Türkiye sularında, Marmara Denizi&apos;nde ilk kez geniş ölçekte görüldü.
            </p>
            <p>
              <b>2008</b> — Marmara&apos;da yeniden büyük kümeler oluştu; baskın fitoplankton türü{" "}
              <i>Gonyaulax fragilis</i> idi.
            </p>
            <p>
              <b>2021</b> — Erken ilkbaharda Marmara ve Türkiye&apos;nin Kuzey Ege kıyılarında başladı;
              kayıtlardaki <b>en büyük salgın</b> oldu. Bu kez baskın tür <i>Phaeocystis pouchetii</i> idi.
            </p>
          </div>
        </div>
        <div>
          <h2 className="section-title">2021 krizinin etkileri</h2>
          <ul style={{ lineHeight: 1.6, paddingLeft: "1.2rem" }}>
            <li>
              <b>Marmara:</b> Yüzeyi ve kıyıları kalın tabakalar halinde kapladı; balıkçılık ve turizm
              durma noktasına geldi.
            </li>
            <li>
              <b>Çanakkale Boğazı ve Kuzey Ege:</b> Örtü tipi müsilaj Mart–Temmuz arasında yaklaşık beş
              ay sürdü; dip omurgasızlarında toplu ölümler raporlandı.
            </li>
            <li>
              <b>Batı Karadeniz:</b> Boğaz yoluyla bitişik Karadeniz kıyılarında da müsilaj görüldü;
              ancak yoğunluk Marmara&apos;nın çok altındaydı.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}