import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Smartphone,
  RotateCcw,
  Maximize2,
  Monitor,
  Wifi,
  Battery,
  Volume2,
  Check,
} from "lucide-react";

interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  borderRadius: number;
}

const DEVICES: DevicePreset[] = [
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    width: 393,
    height: 852,
    borderRadius: 50,
  },
  {
    id: "iphone-se",
    name: "iPhone SE",
    width: 375,
    height: 667,
    borderRadius: 36,
  },
  {
    id: "galaxy-s24",
    name: "Galaxy S24",
    width: 412,
    height: 915,
    borderRadius: 44,
  },
];

export default function MobileSimulator() {
  const [device, setDevice] = useState<DevicePreset>(DEVICES[0]);
  const [scaleMode, setScaleMode] = useState<"auto" | "100" | "90" | "80">("auto");
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 900,
  );
  const [currentTime, setCurrentTime] = useState("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Aggiorna l'orologio della barra di stato del telefono ogni minuto
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      setCurrentTime(`${h}:${m}`);
    }
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  // Gestione ridimensionamento finestra desktop per auto-scale
  useEffect(() => {
    function handleResize() {
      setWindowHeight(window.innerHeight);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sincronizzazione URL: quando l'iframe naviga, aggiorna l'URL del browser desktop
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "MOBILE_NAV") {
        const fullPath = event.data.pathname + (event.data.search || "");
        window.history.replaceState(null, "", fullPath);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Calcolo dell'URL iniziale per l'iframe in base alla pagina corrente
  const initialIframeSrc = useMemo(() => {
    const path = window.location.pathname;
    const search = window.location.search;
    const sep = search ? "&" : "?";
    return `${path}${search}${sep}mobile_frame=1`;
  }, []);

  // Calcolo del fattore di scala per far rientrare lo smartphone perfettamente nello schermo del computer
  const scale = useMemo(() => {
    if (scaleMode === "100") return 1;
    if (scaleMode === "90") return 0.9;
    if (scaleMode === "80") return 0.8;

    // Modalità "auto": adatta l'altezza totale (telefono + barre + margini) all'altezza visibile
    const totalPhoneHeight = device.height + 42 + 20 + 24; // screen + status + home + padding
    const availableHeight = Math.max(500, windowHeight - 90);
    const calculated = availableHeight / totalPhoneHeight;
    return Math.min(1, Math.max(0.65, parseFloat(calculated.toFixed(2))));
  }, [scaleMode, windowHeight, device]);

  function reloadIframe() {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }

  function switchToDesktop() {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "desktop");
    window.location.href = url.pathname + url.search;
  }

  return (
    <div className="min-h-screen w-screen bg-[#07070a] text-white flex flex-col items-center select-none overflow-x-hidden">
      {/* Barra di Controllo Desktop in alto */}
      <header className="w-full bg-[#0e0e13]/90 border-b border-zinc-800/80 backdrop-blur-md px-4 py-2.5 flex items-center justify-between gap-4 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-black text-sm tracking-tight">
            <span style={{ color: "#1c00ff" }}>Area</span>
            <span style={{ color: "#e3ff00" }}>46</span>
            <span className="text-zinc-400 font-normal ml-1 text-xs">
              Landmine Lab
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#1c00ff]/15 text-[#8b9eff] border border-[#1c00ff]/30">
            <span className="size-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            Vista Mobile
          </span>
        </div>

        {/* Selettore Modello e Zoom */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Preset Dispositivi */}
          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-zinc-800 text-xs">
            {DEVICES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDevice(d)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  device.id === d.id
                    ? "bg-[#1c00ff] text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>

          {/* Preset Zoom */}
          <div className="hidden sm:flex items-center bg-black/40 rounded-lg p-0.5 border border-zinc-800 text-xs text-zinc-400">
            {(["auto", "100", "90", "80"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setScaleMode(m)}
                className={`px-2 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  scaleMode === m
                    ? "bg-zinc-800 text-white font-bold"
                    : "hover:text-white"
                }`}
              >
                {m === "auto" ? "Adatta" : `${m}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Azioni Rapide */}
        <div className="flex items-center gap-2">
          <button
            onClick={reloadIframe}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
            title="Ricarica la schermata mobile"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden md:inline">Ricarica</span>
          </button>

          <button
            onClick={switchToDesktop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer"
            title="Visualizza a schermo intero del computer"
          >
            <Monitor className="size-3.5 text-zinc-400" />
            <span className="hidden md:inline">Vista Computer</span>
          </button>
        </div>
      </header>

      {/* Area Studio con Smartphone Centrato */}
      <main
        className="flex-1 w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden relative"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(28,0,255,0.12) 0%, rgba(9,9,11,0.95) 75%)",
        }}
      >
        {/* Chassis Smartphone */}
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            transition: "transform 0.2s ease-out",
          }}
          className="relative transition-transform"
        >
          {/* Tasti Fisici Laterali (Hardware buttons) */}
          {/* Tasto Azione */}
          <div className="w-1 h-7 bg-zinc-600 rounded-l absolute -left-2 top-28 shadow-sm" />
          {/* Volume + */}
          <div className="w-1 h-12 bg-zinc-600 rounded-l absolute -left-2 top-40 shadow-sm" />
          {/* Volume - */}
          <div className="w-1 h-12 bg-zinc-600 rounded-l absolute -left-2 top-56 shadow-sm" />
          {/* Tasto Accensione / Power */}
          <div className="w-1 h-16 bg-zinc-600 rounded-r absolute -right-2 top-44 shadow-sm" />

          {/* Bordo Titanio Esterno del Telefono */}
          <div
            className="p-3 bg-[#0a0a0e] relative"
            style={{
              borderRadius: `${device.borderRadius + 6}px`,
              border: "3.5px solid #2e2e38",
              boxShadow:
                "0 30px 80px -15px rgba(0,0,0,0.95), 0 0 50px rgba(28,0,255,0.22), inset 0 0 3px 1px rgba(255,255,255,0.15)",
            }}
          >
            {/* Schermo Interno */}
            <div
              className="flex flex-col bg-[#f8f9fa] overflow-hidden relative"
              style={{
                width: `${device.width}px`,
                height: `${device.height}px`,
                borderRadius: `${device.borderRadius}px`,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
              }}
            >
              {/* Barra di Stato Mobile (Top Status Bar) */}
              <div
                className="w-full bg-white text-zinc-900 border-b border-zinc-100 flex items-center justify-between px-7 shrink-0 relative z-30 select-none"
                style={{ height: "42px" }}
              >
                {/* Orario Attuale */}
                <span className="text-xs font-bold tracking-tight text-zinc-900">
                  {currentTime || "09:41"}
                </span>

                {/* Dynamic Island (Isola Dinamica) */}
                <div
                  className="bg-black rounded-full flex items-center justify-between px-2.5 shadow-md"
                  style={{
                    width: "116px",
                    height: "26px",
                    border: "1px solid rgba(0,0,0,0.15)",
                  }}
                >
                  <div className="size-2 rounded-full bg-zinc-900 border border-zinc-800" />
                  <div className="size-2.5 rounded-full bg-[#0a0f1d] border border-zinc-800" />
                </div>

                {/* Icone Rete e Batteria */}
                <div className="flex items-center gap-2 text-zinc-900">
                  <span className="text-[10px] font-bold tracking-wider">5G</span>
                  <Wifi className="size-3.5" />
                  <div className="flex items-center gap-0.5">
                    <div className="w-5 h-2.5 rounded-sm border border-zinc-900 p-0.5 flex items-center">
                      <div className="w-full h-full bg-zinc-900 rounded-xs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contenuto Reale dell'App Mobile (Iframe Nativo a 393px) */}
              <div className="flex-1 w-full relative overflow-hidden bg-[#f8f9fa]">
                <iframe
                  ref={iframeRef}
                  src={initialIframeSrc}
                  title="Area46 Landmine Lab - Mobile App"
                  className="w-full h-full border-0 bg-[#f8f9fa]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>

              {/* Barra Home Indicator (Bottom Home Bar) */}
              <div
                className="w-full bg-white flex items-center justify-center shrink-0 z-30 select-none pb-1 border-t border-zinc-100"
                style={{ height: "20px" }}
              >
                <div className="w-32 h-1 bg-zinc-300 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Nota rapida di navigazione a fondo pagina */}
      <footer className="w-full py-2 px-4 bg-[#0a0a0d] border-t border-zinc-850 text-center text-[11px] text-zinc-400 shrink-0">
        Naviga liberamente all'interno dello schermo del telefono. Timer, schede
        e registrazione carichi funzionano esattamente come su smartphone.
      </footer>
    </div>
  );
}
