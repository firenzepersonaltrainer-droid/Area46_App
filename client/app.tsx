import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  Dumbbell,
  BookOpen,
  BookMarked,
  TrendingUp,
  Wifi,
  Battery,
  CalendarCheck,
  Coins,
  Users,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Nav } from "./components/Nav";
import { Toaster } from "./components/Toast";
import { WalletBar } from "./components/WalletBar";
import { useCurrentUser } from "./lib/useUser";

import AllenamentiPage from "./pages/Allenamenti";
import GiornoDetailPage from "./pages/GiornoDetail";
import EsercizioDetailPage from "./pages/EsercizioDetail";
import DiarioPage from "./pages/Diario";
import LibreriaPage from "./pages/Libreria";
import TonnellaggioPage from "./pages/Tonnellaggio";
import ArchivioPage from "./pages/ArchivioAllenamenti";
import PrenotaSlotPage from "./pages/PrenotaSlot";
import TariffarioPage from "./pages/Tariffario";
import ManagerCalendarPage from "./pages/ManagerCalendar";
import ManagerAtletiPage from "./pages/ManagerAtleti";
import ManagerFiscoPage from "./pages/ManagerFisco";
import FloatingTimer from "./components/FloatingTimer";

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
  const { isManager } = useCurrentUser();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-white border-b shadow-xs shrink-0 relative">
      <div className="flex items-center gap-2">
        <div className="flex flex-col leading-tight">
          <div className="text-lg font-black tracking-tight leading-none flex items-center">
            <span style={{ color: "#1c00ff" }}>Area</span>
            <span
              className="inline-block px-1.5 py-0.5 ml-1 rounded text-xs font-black"
              style={{
                background: "#e3ff00",
                color: "#09090b",
                border: "1.5px solid #09090b",
              }}
            >
              46
            </span>
          </div>
          <div
            className="text-[10px] font-black uppercase tracking-wider leading-none mt-1"
            style={{ color: "#09090b" }}
          >
            Landmine Lab
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {isManager ? (
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs bg-[#09090b] text-[#e3ff00] border border-[#e3ff00]/50"
          >
            <ShieldCheck className="size-3 text-[#e3ff00]" />
            GESTIONE COACH
          </span>
        ) : (
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs"
            style={{
              background: "#1c00ff",
              color: "#e3ff00",
            }}
          >
            <span className="size-1.5 rounded-full bg-[#e3ff00] animate-pulse" />
            LIVELLO PRO
          </span>
        )}
      </div>

      {/* Linea d'accento bicolore Area46 */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] flex">
        <div className="h-full w-2/3 bg-[#1c00ff]" />
        <div className="h-full w-1/3 bg-[#e3ff00]" />
      </div>
    </header>
  );
}

function AppContent() {
  const { isManager } = useCurrentUser();

  const navItems = isManager
    ? [
        { href: "/manager/calendario", label: "Calendario", icon: <CalendarCheck /> },
        { href: "/manager/atleti", label: "Atleti", icon: <Users /> },
        { href: "/", label: "Allenamenti", icon: <Dumbbell /> },
        { href: "/diario", label: "Diario", icon: <BookMarked /> },
        { href: "/manager/fisco", label: "Fisco", icon: <Settings /> },
      ]
    : [
        { href: "/", label: "Allenamenti", icon: <Dumbbell /> },
        { href: "/prenota", label: "Prenota 1:1", icon: <CalendarCheck /> },
        { href: "/diario", label: "Diario", icon: <BookMarked /> },
        { href: "/tariffario", label: "Tariffario", icon: <Coins /> },
        { href: "/libreria", label: "Database", icon: <BookOpen /> },
      ];

  return (
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

      {/* Wallet Bar con Saldo Crediti / Debito & Role Switcher */}
      <WalletBar />

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
          <Route path="/prenota" element={<PrenotaSlotPage />} />
          <Route path="/tariffario" element={<TariffarioPage />} />
          <Route path="/diario" element={<DiarioPage />} />
          <Route path="/libreria" element={<LibreriaPage />} />
          <Route path="/tonnellaggio" element={<TonnellaggioPage />} />
          <Route path="/archivio" element={<ArchivioPage />} />

          {/* Rotte Manager Coach */}
          <Route path="/manager/calendario" element={<ManagerCalendarPage />} />
          <Route path="/manager/atleti" element={<ManagerAtletiPage />} />
          <Route path="/manager/fisco" element={<ManagerFiscoPage />} />
        </Routes>
      </main>

      {/* Barra di Navigazione Mobile Inferiore */}
      <Nav items={navItems} />

      {/* Timer Flottante Sovraimpresso integrato nello smartphone */}
      <FloatingTimer />

      {/* Home indicator dello smartphone */}
      <MobileHomeIndicator />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Sfondo studio chiaro su computer per massima leggibilità ed eleganza */}
      <div className="min-h-screen w-full bg-[#eaedf2] flex flex-col items-center justify-start sm:py-6 sm:px-4 text-primary selection:bg-[#1c00ff] selection:text-white">
        <AppContent />
      </div>
    </BrowserRouter>
  );
}