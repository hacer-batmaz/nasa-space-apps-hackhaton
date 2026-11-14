import { useEffect, useState } from "react";
import PlotChart from "../components/PlotChart";

const API = "http://127.0.0.1:8000/api";

const REGIONS = { marmara: "Marmara Denizi", aegean: "Ege Denizi", blacksea: "Karadeniz" };
const VARS = {
  sst: { name: "Deniz Yüzeyi Sıcaklığı (SST)", unit: "°C", isPct: false },
  wind: { name: "Yüzey Rüzgâr Hızı", unit: "m/s", isPct: false },
  chl: { name: "Klorofil-a (CHL)", unit: "mg/m³", isPct: true },
  flh: { name: "Floresans Çizgi Yüksekliği (FLH)", unit: "W m⁻² µm⁻¹ sr⁻¹", isPct: false },
};

const TREND_TR = { increasing: "Artıyor ↑", decreasing: "Azalıyor ↓", "no trend": "Belirgin trend yok →" };

export default function Statistics() {
  const [region, setRegion] = useState("marmara");
  const [variable, setVariable] = useState("chl");
  const [startYear, setStartYear] = useState(2003);
  const [endYear, setEndYear] = useState(2024);
  const [res, setRes] = useState(null);

  useEffect(() => {
    const activeRegion = variable === "flh" ? "marmara" : region;
    if (variable === "flh" && region !== "marmara") setRegion("marmara");
    const params = new URLSearchParams({
      region: activeRegion,
      variable,
      start_year: startYear,
      end_year: endYear,
    });
    fetch(`${API}/statistics?${params}`)
      .then((r) => r.json())
      .then(setRes)
      .catch(console.error);
  }, [region, variable, startYear, endYear]);

  if (!res) return <p>İstatistiksel analiz hesaplanıyor...</p>;

  const { stats } = res;
  const meta = VARS[variable];
  const changeTxt =
    stats.change_per_decade === null
      ? "–"
      : meta.isPct
      ? `${stats.change_per_decade > 0 ? "+" : ""}${stats.change_per_decade.toFixed(1)}% / 10 yıl`
      : `${stats.change_per_decade > 0 ? "+" : ""}${stats.change_per_decade.toFixed(2)} ${meta.unit} / 10 yıl`;

  const pTxt = stats.p_value === null ? "–" : stats.p_value < 0.001 ? "< 0,001" : stats.p_value.toFixed(3);

  return (
    <div>
      <h1 style={{ color: "var(--navy)", marginTop: 0 }}>📊 Bilimsel Trend ve İstatistik Analizi</h1>

      <div className="panel-card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        <div>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Bölge</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: 8 }}>
            {Object.entries(REGIONS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Değişken</label>
          <select value={variable} onChange={(e) => setVariable(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: 8 }}>
            {Object.entries(VARS).map(([k, v]) => (
              <option key={k} value={k}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Başlangıç Yılı: {startYear}</label>
          <input type="range" min="2003" max="2020" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Bitiş Yılı: {endYear}</label>
          <input type="range" min="2008" max="2024" value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
      </div>

      <div className="grid-4">
        <div className="metric-card">
          <div className="metric-label">Trend Yönü (Mann-Kendall)</div>
          <div className="metric-value">{TREND_TR[stats.trend] || stats.trend}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Sen Eğimi (Sen&apos;s Slope)</div>
          <div className="metric-value">{changeTxt}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">p-değeri (Hamed-Rao)</div>
          <div className="metric-value">{pTxt}</div>
          <div className="metric-sub">{stats.significant ? "✔ Anlamlı (p < 0,05)" : "Anlamlı değil (p ≥ 0,05)"}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Analiz Edilen Ay</div>
          <div className="metric-value">{stats.n_months}</div>
          <div className="metric-sub">{startYear}–{endYear}</div>
        </div>
      </div>

      <div className={`alert-box ${stats.significant ? "success" : ""}`}>
        {stats.significant ? (
          <>
            <b>İstatistiksel Olarak Anlamlı Eğilim (p &lt; 0,05):</b> {REGIONS[region]} bölgesinde{" "}
            <b>{meta.name}</b> için hesaplanan <b>{changeTxt}</b> değişimi tesadüf değildir; %95&apos;in
            üzerinde bilimsel güvenle kanıtlanmıştır.
          </>
        ) : (
          <>
            <b>Belirgin Trend Kanıtlanamadı (p ≥ 0,05):</b> Gözlenen eğim doğal yıldan yıla iklimsel
            dalgalanmalardan istatistiksel olarak ayırt edilememektedir.
          </>
        )}
      </div>

      <div className="panel-card">
        <PlotChart
          data={[
            { x: res.dates, y: res.values, type: "scatter", mode: "lines", name: "Aylık Ölçüm", line: { color: "#1565c0", width: 1.5 } },
            ...(res.trend_values.length
              ? [{ x: res.dates, y: res.trend_values, type: "scatter", mode: "lines", name: "Sen Eğimi Trendi", line: { color: "#111827", width: 3, dash: "dash" } }]
              : []),
          ]}
          layout={{
            title: `Ham Zaman Serisi ve Sen Eğimi Trend Çizgisi — ${meta.name}`,
            yaxis: { title: meta.unit, type: variable === "chl" ? "log" : "linear" },
            height: 380,
            margin: { t: 45, b: 40, l: 55, r: 20 },
          }}
        />
      </div>

      <div className="panel-card">
        <PlotChart
          data={[
            {
              x: res.dates,
              y: res.anomalies,
              type: "bar",
              name: "Anomali",
              marker: { color: res.anomalies.map((v) => (v >= 0 ? "#dc2626" : "#2563eb")) },
            },
          ]}
          layout={{
            title: `Mevsimsellikten Arındırılmış Aylık Anomali (${res.anomaly_unit})`,
            yaxis: { title: res.anomaly_unit },
            height: 330,
            margin: { t: 45, b: 40, l: 55, r: 20 },
          }}
        />
      </div>

      <div className="grid-3" style={{ marginBottom: "1.4rem" }}>
        <div className="info-card">
          <h4>❓ Mann-Kendall ve p-değeri nedir?</h4>
          <p>
            Zaman serisinde sistematik artış/azalış olup olmadığını ölçer. Ardışık ayların benzerliğini
            düzeltmek için <b>Hamed-Rao otokorelasyon düzeltmesi</b> uygulanır. <b>p &lt; 0,05</b> ise
            eğilim tesadüf değildir.
          </p>
        </div>
        <div className="info-card">
          <h4>❓ Klorofile neden Log10 uyguladık?</h4>
          <p>
            Alg patlamalarında klorofil değerleri onlarca kat sıçrayarak ortalamayı bozar. Log10 dönüşümü
            dağılımı dengeler ve oşinografide uluslararası standarttır.
          </p>
        </div>
        <div className="info-card">
          <h4>❓ Mevsimsellikten arındırma nasıl çalışır?</h4>
          <p>
            Her ayın ölçümünden o takvim ayının 22 yıllık ortalaması çıkarılır (Örn. Mayıs 2021 − Tüm
            Mayıslar). Böylece mevsim döngüsü elenir, gerçek iklim sapması kalır.
          </p>
        </div>
      </div>

      <div className="panel-card">
        <h3 style={{ marginTop: 0 }}>Ek İstatistiksel Test: Spearman Sıra Korelasyonu</h3>
        <p style={{ color: "var(--muted)", fontSize: "0.92rem" }}>
          Klorofil-a anomalisinin sıcaklık (SST) ve rüzgâr anomalileriyle ilişkisi (0–3 ay gecikmeli kuluçka etkisi).
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>İlişki</th>
              <th>ρ (Aynı Ay)</th>
              <th>p (Aynı Ay)</th>
              <th>En Güçlü Gecikme</th>
              <th>ρ (En Güçlü)</th>
              <th>p (En Güçlü)</th>
            </tr>
          </thead>
          <tbody>
            {res.correlations.map((c) => (
              <tr key={c.label}>
                <td><b>{c.label}</b></td>
                <td>{c.rho_same?.toFixed(2)}</td>
                <td>{c.p_same?.toFixed(3)}</td>
                <td>{c.best_lag} ay</td>
                <td>{c.rho_best?.toFixed(2)}</td>
                <td>{c.p_best?.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {res.flh_check && (
        <div className="panel-card">
          <h3 style={{ marginTop: 0 }}>🛰️ Uydu Güvenilirlik Kontrolü (FLH vs CHL — Marmara)</h3>
          <span
            className="badge"
            style={{
              background:
                res.flh_check.status === "consistent"
                  ? "#16a34a"
                  : res.flh_check.status === "partly consistent"
                  ? "#eab308"
                  : "#dc2626",
            }}
          >
            {res.flh_check.status === "consistent"
              ? "✅ Tutarlı"
              : res.flh_check.status === "partly consistent"
              ? "⚠️ Kısmen Tutarlı"
              : "❌ Tutarsız"}
          </span>
          <p style={{ marginTop: "0.7rem", lineHeight: 1.55 }}>
            Renk tabanlı Klorofil-a ile floresans tabanlı FLH arasındaki Spearman korelasyonu:{" "}
            <b>ρ = {res.flh_check.rho?.toFixed(2)}</b> (n = {res.flh_check.n}). Bulanık veya müsilajlı
            sularda iki bağımsız sensörün aynı yönü göstermesi ölçümün gerçek biyolojik artış olduğunu doğrular.
          </p>
        </div>
      )}
    </div>
  );
}