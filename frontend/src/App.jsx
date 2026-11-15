import { useState } from "react";
import { Orbit } from "lucide-react";
import Home from "./pages/Home";
import Simulation from "./pages/Simulation";
import Statistics from "./pages/Statistics";
import Model from "./pages/Model";
import Sources from "./pages/Sources";

const NAV_ITEMS = [
  { key: "home", label: "Explore" },
  { key: "sim", label: "Simulation" },
  { key: "stats", label: "Statistics" },
  { key: "model", label: "Model comparison" },
  { key: "sources", label: "Sources and data" },
];

export default function App() {
  const [page, setPage] = useState("home");

  return (
    <div>
      <header className="top-header">
        <button className="wordmark" onClick={() => setPage("home")}>
          <Orbit size={26} color="#d8f77a" />
          <div>
            MUCILAGE
            <br />
            DETECTIVE
            <small>EARTH OBSERVATORY</small>
          </div>
        </button>

        <nav className="topnav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={page === item.key ? "active" : ""}
              onClick={() => setPage(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {page === "home" && <Home onNavigate={setPage} />}
        {page === "sim" && <Simulation />}
        {page === "stats" && <Statistics />}
        {page === "model" && <Model />}
        {page === "sources" && <Sources />}
      </main>

      <footer className="site-footer">
        <span>NASA GIOVANNI / MODIS AQUA / MERRA-2</span>
        <span>NASA SPACE APPS CHALLENGE 2026</span>
      </footer>
    </div>
  );
}