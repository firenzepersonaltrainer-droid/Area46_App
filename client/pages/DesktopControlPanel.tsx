import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarCheck,
  Users,
  Receipt,
  Coins,
  ShieldCheck,
  Smartphone,
  Dumbbell,
  LogOut,
  Clock,
  Sparkles,
  TrendingUp,
  BarChart3,
  ExternalLink,
  ChevronRight,
  Monitor,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { useCurrentUser, useProfili, useLabConfig } from "../lib/useUser";
import ManagerCalendarPage from "./ManagerCalendar";
import ManagerAtletiPage from "./ManagerAtleti";
import ManagerFiscoPage from "./ManagerFisco";
import { Button } from "../components/Button";
import { toast } from "sonner";

type DesktopTab = "calendario" | "atleti" | "fisco";

export default function DesktopControlPanel() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isManager, switchUser, logout } = useCurrentUser();
  const { profili } = useProfili();
  const { config } = useLabConfig();

  // Tab selezionata (sincronizzata con URL query param)
  const currentTabParam = (searchParams.get("tab") as DesktopTab) || "calendario";
  const [activeTab, setActiveTab] = useState<DesktopTab>(
    ["calendario", "atleti", "fisco"].includes(currentTabParam)
      ? currentTabParam
      : "calendario"
  );

  useEffect(() => {
    if (searchParams.get("tab") !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  // Orologio tempo reale
  const [currentTime, setCurrentTime] = useState("");
  const [currentDateStr, setCurrentDateStr] = useState("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
      setCurrentDateStr(
        now.toLocaleDateString("it-IT", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Conteggi e metriche rapide per la topbar
  const atletiAttivi = profili.filter((p) => p.ruolo === "atleta").length;
  const atletiInScadenza = profili.filter(
    (p) => p.ruolo === "atleta" && p.avviso_scadenza && p.stato_iscrizione !== "dismesso"
  ).length;
  const atletiInDebito = profili.filter((p) => p.ruolo === "atleta" && p.crediti < 0).length;

  // Se l'utente NON è autenticato o non è manager, schermata di accesso Coach desktop
  if (!user || !isManager) {
    return (
      <div className="min-h-screen w-full bg-[#09090b] flex flex-col items-center justify-center p-4 selection:bg-[#1c00ff] selection:text-white">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl text-white text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-zinc-800/80 rounded-2xl border border-zinc-700/60 inline-flex items-center gap-3">
              <img
                src="/logo-area46-transparent.png"
                alt="Area46"
                className="h-12 w-auto object-contain"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e3ff00]/10 text-[#e3ff00] border border-[#e3ff00]/30 text-xs font-black tracking-wider uppercase">
              <ShieldCheck className="size-3.5" /> Pannello Esecutivo Desktop
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Area46 Landmine Lab
            </h1>
            <p className="text-xs text-zinc-400">
              Accesso riservato al Coach per la gestione panoramica di Calendario, Atleti, Performance e Fisco su grande schermo.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/60 text-left space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Account Manager:</span>
              <strong className="text-white font-mono">firenzepersonaltrainer@gmail.com</strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Coach Titolare:</span>
              <span className="text-emerald-400 font-bold">Stefano Tronconi</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-zinc-700/50 pt-2">
              <span className="text-zinc-400">Ambiente:</span>
              <span className="text-zinc-300 font-medium">Desktop Panoramico (No Frame)</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              onClick={() => {
                switchUser("usr-coach-01");
              }}
              className="w-full h-12 rounded-2xl bg-[#1c00ff] hover:bg-[#1600cc] text-white font-black text-sm shadow-lg shadow-[#1c00ff]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="size-4" /> Entra come Coach Stefano Tronconi
            </Button>

            <Link
              to="/"
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
            >
              <Smartphone className="size-3.5" /> Vai all'App Mobile per Atleti
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f1f3f7] flex flex-col md:flex-row text-zinc-900 selection:bg-[#1c00ff] selection:text-white">
      {/* SIDEBAR LATERALE DESKTOP EXECUTIVE (W-72 FISSO) */}
      <aside className="w-full md:w-72 bg-[#09090b] text-white flex flex-col justify-between shrink-0 border-r border-zinc-800 z-20 md:h-screen md:sticky md:top-0">
        <div className="p-6 space-y-6">
          {/* LOGO & BRAND */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo-area46-transparent.png"
                alt="Area46 Landmine Lab"
                className="h-10 w-auto object-contain brightness-110"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#e3ff00] text-black">
              PRO
            </span>
          </div>

          {/* BADGE COACH ATTIVO */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#1c00ff] flex items-center justify-center text-[#e3ff00] font-black text-base shadow-inner shrink-0">
              ST
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-black truncate text-white">
                Stefano Tronconi
              </div>
              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Coach & Amministratore</span>
              </div>
            </div>
          </div>

          {/* MENU NAVIGAZIONE SCHEDE DESKTOP */}
          <nav className="space-y-1.5 pt-2">
            <div className="text-[10px] font-black tracking-widest uppercase text-zinc-500 px-3 mb-2">
              Gestione Lab
            </div>

            <button
              onClick={() => setActiveTab("calendario")}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "calendario"
                  ? "bg-[#1c00ff] text-white shadow-lg shadow-[#1c00ff]/30 font-black"
                  : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <CalendarCheck className={`size-4 ${activeTab === "calendario" ? "text-[#e3ff00]" : "text-zinc-400"}`} />
                <span>Calendario & Presenze</span>
              </div>
              {activeTab === "calendario" && <ChevronRight className="size-4 text-[#e3ff00]" />}
            </button>

            <button
              onClick={() => setActiveTab("atleti")}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "atleti"
                  ? "bg-[#1c00ff] text-white shadow-lg shadow-[#1c00ff]/30 font-black"
                  : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className={`size-4 ${activeTab === "atleti" ? "text-[#e3ff00]" : "text-zinc-400"}`} />
                <span>Atleti & Performance</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                {atletiAttivi}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("fisco")}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "fisco"
                  ? "bg-[#1c00ff] text-white shadow-lg shadow-[#1c00ff]/30 font-black"
                  : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Receipt className={`size-4 ${activeTab === "fisco" ? "text-[#e3ff00]" : "text-zinc-400"}`} />
                <span>Fisco & Registro Incassi</span>
              </div>
              {activeTab === "fisco" && <ChevronRight className="size-4 text-[#e3ff00]" />}
            </button>
          </nav>

          {/* SUMMARY CARDS IN SIDEBAR */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-2">
            <div className="text-[10px] font-black tracking-widest uppercase text-zinc-500 px-3 mb-1">
              Stato Generale
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs flex justify-between items-center">
              <span className="text-zinc-400">Atleti Registrati:</span>
              <strong className="text-white font-mono">{atletiAttivi}</strong>
            </div>

            {atletiInScadenza > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-amber-400" /> Pacchetti in Scadenza:
                </span>
                <strong className="font-mono">{atletiInScadenza}</strong>
              </div>
            )}

            {atletiInDebito > 0 && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex justify-between items-center">
                <span>Atleti con Debiti:</span>
                <strong className="font-mono text-red-400">{atletiInDebito}</strong>
              </div>
            )}
          </div>
        </div>

        {/* CONTROLLI INFERIORI (SWITCH TO MOBILE & LOGOUT) */}
        <div className="p-6 border-t border-zinc-800 space-y-2 bg-[#050507]">
          <Link
            to="/"
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold transition-colors cursor-pointer border border-zinc-800"
            title="Apri l'interfaccia mobile per allenarti o testare l'app atleta"
          >
            <div className="flex items-center gap-2.5">
              <Smartphone className="size-4 text-[#e3ff00]" />
              <span>Vista Smartphone</span>
            </div>
            <ArrowRight className="size-3.5 text-zinc-400" />
          </Link>

          <Link
            to="/diario"
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold transition-colors cursor-pointer border border-zinc-800"
            title="Accedi al diario allenamenti personale su mobile"
          >
            <div className="flex items-center gap-2.5">
              <Dumbbell className="size-4 text-emerald-400" />
              <span>Workout Pedana</span>
            </div>
            <ArrowRight className="size-3.5 text-zinc-400" />
          </Link>

          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>Disconnetti Sessione</span>
          </button>
        </div>
      </aside>

      {/* CONTENITORE PRINCIPALE (FULL-WIDTH SCROLLABLE) */}
      <main className="flex-1 md:h-screen md:overflow-y-auto flex flex-col bg-[#f4f5f8] [scrollbar-width:thin]">
        {/* DESKTOP TOPBAR */}
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 lg:px-10 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 rounded-xl text-zinc-700">
              <Monitor className="size-4 text-[#1c00ff]" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Pannello Esecutivo Coach
              </div>
              <h2 className="text-base font-black text-zinc-900 capitalize">
                {activeTab === "calendario" && "Calendario & Presenze Pedane Lab"}
                {activeTab === "atleti" && "Anagrafica Atleti & Performance I.A."}
                {activeTab === "fisco" && "Registro Incassi & Fatturazione Fiscale"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* OROLOGIO & DATA */}
            <div className="hidden lg:flex flex-col items-end text-right">
              <span className="text-xs font-black text-zinc-900 font-mono tabular-nums">
                {currentTime || "--:--:--"}
              </span>
              <span className="text-[10px] text-zinc-500 capitalize">
                {currentDateStr || "Area46 Landmine Lab"}
              </span>
            </div>

            {/* SELETTORE RAPIDO SCHEDE IN TESTATA */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              <button
                onClick={() => setActiveTab("calendario")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "calendario"
                    ? "bg-white text-zinc-900 shadow-xs font-black"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Calendario
              </button>
              <button
                onClick={() => setActiveTab("atleti")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "atleti"
                    ? "bg-white text-zinc-900 shadow-xs font-black"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Atleti & Performance
              </button>
              <button
                onClick={() => setActiveTab("fisco")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "fisco"
                    ? "bg-white text-zinc-900 shadow-xs font-black"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Fisco
              </button>
            </div>

            {/* PULSANTE PASSAGGIO MOBILE */}
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[#e3ff00] text-xs font-black transition-colors cursor-pointer border border-zinc-800"
              title="Passa alla vista smartphone"
            >
              <Smartphone className="size-3.5" />
              <span>Simulatore Mobile</span>
            </Link>
          </div>
        </header>

        {/* CORPO DELLA SCHEDA ATTIVA (PANORAMICO WIDE SCREEN) */}
        <div className="p-6 lg:p-10 max-w-7xl w-full mx-auto flex-1">
          {activeTab === "calendario" && (
            <div className="animate-in fade-in-50 duration-200">
              <ManagerCalendarPage />
            </div>
          )}

          {activeTab === "atleti" && (
            <div className="animate-in fade-in-50 duration-200">
              <ManagerAtletiPage />
            </div>
          )}

          {activeTab === "fisco" && (
            <div className="animate-in fade-in-50 duration-200">
              <ManagerFiscoPage />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
