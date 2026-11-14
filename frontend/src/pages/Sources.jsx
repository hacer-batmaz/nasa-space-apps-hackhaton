import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000/api";

export default function Sources() {
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    fetch(`${API}/sources`)
      .then((r) => r.json())
      .then(setCatalog)
      .catch(console.error);
  }, []);

  return (
    <div className="page-container" style={{ paddingTop: "28px" }}>
      <div className="eyebrow mono">AÇIK BİLİM VE TEKRAR ÜRETİLEBİLİRLİK</div>
      <h1 style={{ fontSize: "34px", fontWeight: 400, letterSpacing: "-1px", margin: "8px 0 12px" }}>
        Kaynaklar ve NASA Veri Setleri
      </h1>

      <div className="dark-card" style={{ overflowX: "auto" }}>
        <h4>1. Kullanılan NASA Giovanni Veri Setleri</h4>
        <table className="dark-table" style={{ marginTop: "10px" }}>
          <thead>
            <tr>
              <th>Dosya Adı</th>
              <th>Değişken</th>
              <th>Bölge</th>
              <th>Kaynak</th>
              <th>Birim</th>
              <th>Aralık</th>
              <th>Giovanni</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((row) => (
              <tr key={row.file}>
                <td><code>{row.file}</code></td>
                <td>{row.variable_name}</td>
                <td>{row.region}</td>
                <td>{row.source}</td>
                <td>{row.unit}</td>
                <td>{row.start} – {row.end}</td>
                <td>
                  {row.giovanni_url && (
                    <a href={row.giovanni_url} target="_blank" rel="noreferrer" style={{ color: "var(--acid)" }}>
                      Doğrula ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dark-card" style={{ marginTop: "16px" }}>
        <h4>2. Bilimsel Literatür</h4>
        <ul style={{ color: "#b5c5c8", lineHeight: 1.8, paddingLeft: "18px", margin: "8px 0 0" }}>
          <li><b>Savun-Hekimoğlu &amp; Gazioğlu (2021)</b>, <i>Mucilage Problem in the Semi-Enclosed Seas: Recent Outbreak in the Sea of Marmara</i>, Int. J. Environment and Geoinformatics, 8(4).</li>
          <li><b>Özalp (2021)</b>, <i>First massive mucilage event observed in deep waters of Çanakkale Strait (Dardanelles), Turkey</i>, Journal of the Black Sea/Mediterranean Environment, 27(2).</li>
          <li><b>Medvedeva &amp; Stanichny (2022)</b>, <i>Outbreak of marine mucilage in the Sea of Marmara in 2021 according to satellite data</i>, Marine Biological Journal, 7(1).</li>
          <li><b>Hamed &amp; Rao (1998)</b>, <i>A modified Mann-Kendall trend test for autocorrelated data</i>, Journal of Hydrology, 204(1–4).</li>
        </ul>
      </div>
    </div>
  );
}