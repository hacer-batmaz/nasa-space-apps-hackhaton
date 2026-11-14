import { useState } from "react";
import { Home as HomeIcon, Map, BarChart3, BookOpen, Search } from "lucide-react";
import Home from "./pages/Home";
import Simulation from "./pages/Simulation";
import Statistics from "./pages/Statistics";
import Sources from "./pages/Sources";

const NAV_ITEMS = [
  { key: "home", label: "Ana Sayfa", icon: HomeIcon },
  { key: "sim", label: "Risk Simülasyonu", icon: Map },
  { key: "stats", label: "İstatistik Analizi", icon: BarChart3 },
  { key: "sources", label: "Kaynaklar ve Veri Setleri", icon: BookOpen },
];

export default function App() {
  const [page, setPage] = useState("home");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Search size={24} color="#0b3d91" />
          <span>Müsilaj Dedektifi</span>
        </div>

        <nav className="nav-list">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`nav-btn ${page === key ? "active" : ""}`}
              onClick={() => setPage(key)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        {page === "home" && <Home onNavigate={setPage} />}
        {page === "sim" && <Simulation />}
        {page === "stats" && <Statistics />}
        {page === "sources" && <Sources />}
      </main>
    </div>
  );
}