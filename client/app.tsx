import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Dumbbell, BookOpen, BookMarked, TrendingUp, Wifi, Battery } from "lucide-react";
import { Nav } from "./components/Nav";
import { Toaster } from "./components/Toast";
import AllenamentiPage from "./pages/Allenamenti";
import GiornoDetailPage from "./pages/GiornoDetail";
import EsercizioDetailPage from "./pages/EsercizioDetail";
import DiarioPage from "./pages/Diario";
import LibreriaPage from "./pages/Libreria";
import TonnellaggioPage from "./pages/Tonnellaggio";
import ArchivioPage from "./pages/ArchivioAllenamenti";
import FloatingTimer from "./components/FloatingTimer";

const APP_LOGO_URL = "";

function MobileStatusBar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function update() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      setTime(`${h}:${m}`);
    }
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hidden sm:flex items-center justify-between px-6 pt-3 pb-1 text-xs font-semibold text-zinc-800 shrink-0 select-none z-40 bg-white border-b border-zinc-100">
      <span className="tabular-nums font-bold text-[13px] text-zinc-900">
        {time || "09:41"}
      </span>
      {/* Dynamic Island */}
      <div className="w-24 h-5 bg-[#09090b] rounded-full flex items-center justify-center gap-1.5 px-2 shadow-inner">
        <span className="size-2 rounded-full bg-[#1c00ff]/70" />
        <span className="size-2 rounded-full bg-zinc-700" />
      </div>
      <div className="flex items-center gap-1.5 text-zinc-700">
        <Wifi className="size-3.5" />
        <Battery className="size-3.5" />
      </div>
    </div>
  );
}

function MobileHomeIndicator() {
  return (
    <div className="hidden sm:flex items-center justify-center py-2 shrink-0 select-none pointer-events-none z-30 bg-[#f8f9fa]">
      <div className="w-32 h-1 bg-zinc-400/80 rounded-full" />
    </div>
  );
}

function AppHeader() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b-2 shadow-xs shrink-0"
      style={{ borderBottomColor: "#1c00ff" }}
    >
      {APP_LOGO_URL ? (
        <img
          src={APP_LOGO_URL}
          alt="Area46 Landmine Lab logo"
          className="h-8 w-auto object-contain"
        />
      ) : (
        <div className="flex flex-col leading-tight">
          <div className="text-lg font-black tracking-tight leading-none flex items-center">
            <span style={{ color: "#1c00ff" }}>Area</span>
            <span
              className="inline-block px-1 ml-0.5 rounded text-sm font-black"
              style={{
                background: "#e3ff00",
                color: "#1c00ff",
                border: "1px solid #1c00ff",
              }}
            >
              46
            </span>
          </div>
          <div
            className="text-xs font-bold leading-none mt-1"
            style={{ color: "#09090b" }}
          >
            Landmine Lab
          </div>
        </div>
      )}
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Sfondo studio chiaro su computer per massima leggibilità ed eleganza */}
      <div className="min-h-screen w-full bg-[#eaedf2] flex flex-col items-center justify-start sm:py-6 sm:px-4 text-primary selection:bg-[#1c00ff] selection:text-white">
        {/* Cornice Smartphone Centrata e Fissa: sempre attiva su computer, nativa su smartphone */}
        <div
          id="phone-frame"
          className="w-full sm:max-w-[420px] min-h-screen sm:min-h-[860px] sm:max-h-[min(920px,calc(100vh-32px))] bg-[#f8f9fa] sm:rounded-[48px] sm:border-[10px] sm:border-[#1a1a20] sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3),0_0_0_1px_rgba(0,0,0,0.08),0_10px_30px_rgba(28,0,255,0.06)] flex flex-col relative overflow-hidden"
        >
          <Toaster
            position="top-center"
            offset="45vh"
            style={{ pointerEvents: "none" } as React.CSSProperties}
            toastOptions={{ style: { pointerEvents: "auto" } }}
          />

          {/* Barra di stato mobile con orologio e notch */}
          <MobileStatusBar />

          {/* Intestazione Area46 */}
          <AppHeader />

          {/* Area Contenuto a scorrimento verticale mobile */}
          <main className="w-full flex-1 overflow-y-auto px-4 pb-28 pt-2 select-text [scrollbar-width:thin]">
            <Routes>
              <Route path="/" element={<AllenamentiPage />} />
              <Route
                path="/allenamento/:livello/:giorno"
                element={<GiornoDetailPage />}
              />
              <Route
                path="/esercizio/:livello/:giorno/:idEsercizio"
                element={<EsercizioDetailPage />}
              />
              <Route path="/diario" element={<DiarioPage />} />
              <Route path="/libreria" element={<LibreriaPage />} />
              <Route path="/tonnellaggio" element={<TonnellaggioPage />} />
              <Route path="/archivio" element={<ArchivioPage />} />
            </Routes>
          </main>

          {/* Barra di Navigazione Mobile Inferiore */}
          <Nav
            items={[
              { href: "/", label: "Allenamenti", icon: <Dumbbell /> },
              { href: "/libreria", label: "Database", icon: <BookOpen /> },
              { href: "/diario", label: "Diario", icon: <BookMarked /> },
              {
                href: "/tonnellaggio",
                label: "Tonnellaggio",
                icon: <TrendingUp />,
              },
            ]}
          />

          {/* Timer Flottante Sovraimpresso integrato nello smartphone */}
          <FloatingTimer />

          {/* Home indicator dello smartphone */}
          <MobileHomeIndicator />
        </div>
      </div>
    </BrowserRouter>
  );
}