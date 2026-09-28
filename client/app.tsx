import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
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
  User,
} from "lucide-react";
import { Nav } from "./components/Nav";
import { Toaster } from "./components/Toast";
import { WalletBar } from "./components/WalletBar";
import { useCurrentUser } from "./lib/useUser";
import { useLivelloMemoria } from "./lib/useLivelloMemoria";

import AllenamentiPage from "./pages/Allenamenti";
import GiornoDetailPage from "./pages/GiornoDetail";
import EsercizioDetailPage from "./pages/EsercizioDetail";
import DiarioPage from "./pages/Diario";
import LibreriaPage from "./pages/Libreria";
import TonnellaggioPage from "./pages/Tonnellaggio";
import ArchivioPage from "./pages/ArchivioAllenamenti";
import AreaPersonalePage from "./pages/AreaPersonale";
import PrenotaSlotPage from "./pages/PrenotaSlot";
import TariffarioPage from "./pages/Tariffario";
import ManagerCalendarPage from "./pages/ManagerCalendar";
import ManagerAtletiPage from "./pages/ManagerAtleti";
import ManagerFiscoPage from "./pages/ManagerFisco";
import LoginPage from "./pages/Login";
import FloatingTimer from "./components/FloatingTimer";
import { InstallPrompt } from "./components/InstallPrompt";

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

import { ManualeUtenteModal } from "./components/ManualeUtenteModal";

function AppHeader({ onOpenManual }: { onOpenManual?: () => void }) {
  const { user, isManager } = useCurrentUser();
  const { livello: livelloMemoria } = useLivelloMemoria();
  const location = useLocation();

  // Rileva dinamicamente il livello visualizzato o memorizzato
  const matchAllenamento = location.pathname.match(/^\/allenamento\/([^/]+)/);
  const matchEsercizio = location.pathname.match(/^\/esercizio\/([^/]+)/);
  const activeLevelRaw = matchAllenamento
    ? decodeURIComponent(matchAllenamento[1])
    : matchEsercizio
    ? decodeURIComponent(matchEsercizio[1])
    : (livelloMemoria && livelloMemoria.trim() ? livelloMemoria : "Livello Pro");

  const displayLevel = activeLevelRaw.trim().toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-white border-b shadow-xs shrink-0 relative">
      <Link to="/" className="flex items-center gap-2 group cursor-pointer" title="Home Area46">
        <img
          src="/logo-area46-transparent.png"
          alt="Area46 Landmine Lab"
          className="h-10 w-auto max-w-[140px] object-contain transition-transform group-hover:scale-105 drop-shadow-2xs"
        />
      </Link>

      <div className="flex items-center gap-1.5">
        {onOpenManual && (
          <button
            type="button"
            onClick={onOpenManual}
            className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 transition-colors cursor-pointer"
            title="Guida & Manuale Istruzioni App"
          >
            <BookOpen className="size-3.5 text-[#1c00ff]" />
            <span className="hidden xs:inline">Guida</span>
          </button>
        )}

        {!user ? (
          <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs bg-zinc-100 text-zinc-700 border border-zinc-200">
            ACCESSO LAB
          </span>
        ) : isManager ? (
          <span
            className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs bg-[#09090b] text-[#e3ff00] border border-[#e3ff00]/50"
          >
            <ShieldCheck className="size-3.5 text-[#e3ff00]" />
            GESTIONE COACH
          </span>
        ) : (
          <span
            className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs"
            style={{
              background: "#1c00ff",
              color: "#e3ff00",
            }}
          >
            <span className="size-2 rounded-full bg-[#e3ff00] animate-pulse" />
            {displayLevel}
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
  const { user, isManager, isLoading } = useCurrentUser();
  const [showManualModal, setShowManualModal] = useState(false);

  // 1. Schermata di caricamento iniziale
  if (isLoading) {
    return (
      <div
        id="phone-frame"
        className="w-full sm:max-w-[420px] min-h-screen sm:min-h-[860px] sm:max-h-[min(920px,calc(100vh-32px))] bg-[#f8f9fa] sm:rounded-[48px] sm:border-[10px] sm:border-[#1a1a20] sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3),0_0_0_1px_rgba(0,0,0,0.08),0_10px_30px_rgba(28,0,255,0.06)] flex flex-col items-center justify-center relative overflow-hidden"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-[#1c00ff] border-t-transparent animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Caricamento Area46...
          </span>
        </div>
      </div>
    );
  }

  // 2. Se l'utente NON è autenticato (logout effettuato o visitatore)
  if (!user) {
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
        <MobileStatusBar />
        <AppHeader onOpenManual={() => setShowManualModal(true)} />
        <ManualeUtenteModal open={showManualModal} onOpenChange={setShowManualModal} />

        <main className="w-full flex-1 overflow-y-auto px-4 pb-8 pt-2 select-text [scrollbar-width:thin]">
          <Routes>
            <Route path="/tariffario" element={<TariffarioPage />} />
            <Route path="*" element={<LoginPage />} />
          </Routes>
        </main>
        <InstallPrompt />
        <MobileHomeIndicator />
      </div>
    );
  }

  // 3. Utente autenticato
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
        { href: "/libreria", label: "Database", icon: <BookOpen /> },
        { href: "/diario", label: "Diario", icon: <BookMarked /> },
        { href: "/account", label: "Area Personale", icon: <User /> },
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
      <AppHeader onOpenManual={() => setShowManualModal(true)} />

      {/* Modale Manuale Utente Globale */}
      <ManualeUtenteModal open={showManualModal} onOpenChange={setShowManualModal} />

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
          <Route path="/account" element={<AreaPersonalePage />} />
          <Route path="/prenota" element={<AreaPersonalePage />} />
          <Route path="/tariffario" element={<AreaPersonalePage />} />
          <Route path="/diario" element={<DiarioPage />} />
          <Route path="/libreria" element={<LibreriaPage />} />
          <Route path="/tonnellaggio" element={<TonnellaggioPage />} />
          <Route path="/archivio" element={<ArchivioPage />} />
          <Route path="/login" element={<LoginPage />} />

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

      {/* Prompt installazione PWA per Android/Chrome/iOS */}
      <InstallPrompt />

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