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
    <div>
      <h1 style={{ color: "var(--navy)", marginTop: 0 }}>📚 Kaynaklar ve NASA Veri Setleri</h1>
      <p style={{ lineHeight: 1.6 }}>
        Bu çalışmada kullanılan uydu gözlemleri, yeniden analiz (reanalysis) verileri ve bilimsel literatür
        şeffaflık ve tekrar üretilebilirlik ilkesi gereği eksiksiz listelenmiştir.
      </p>

      <div className="panel-card" style={{ overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>1. Kullanılan NASA Veri Setleri ve Giovanni Doğrulama Linkleri</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Dosya Adı</th>
              <th>Değişken</th>
              <th>Bölge</th>
              <th>Kaynak</th>
              <th>Birim</th>
              <th>Aralık</th>
              <th>Doğrulama</th>
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
                    <a href={row.giovanni_url} target="_blank" rel="noreferrer" style={{ color: "var(--blue)", fontWeight: 600 }}>
                      Giovanni ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-card">
        <h3 style={{ marginTop: 0 }}>2. Bilimsel Literatür ve Referanslar</h3>
        <ul style={{ lineHeight: 1.7, paddingLeft: "1.2rem" }}>
          <li><b>Savun-Hekimoğlu &amp; Gazioğlu (2021)</b>, <i>Mucilage Problem in the Semi-Enclosed Seas: Recent Outbreak in the Sea of Marmara</i>, Int. J. Environment and Geoinformatics, 8(4).</li>
          <li><b>Özalp (2021)</b>, <i>First massive mucilage event observed in deep waters of Çanakkale Strait (Dardanelles), Turkey</i>, Journal of the Black Sea/Mediterranean Environment, 27(2).</li>
          <li><b>Medvedeva &amp; Stanichny (2022)</b>, <i>Outbreak of marine mucilage in the Sea of Marmara in 2021 according to satellite data</i>, Marine Biological Journal, 7(1).</li>
          <li><b>Hamed &amp; Rao (1998)</b>, <i>A modified Mann-Kendall trend test for autocorrelated data</i>, Journal of Hydrology, 204(1–4).</li>
        </ul>
      </div>
    </div>
  );
}