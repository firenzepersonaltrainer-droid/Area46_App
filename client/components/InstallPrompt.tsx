import React, { useState, useEffect } from "react";
import { Download, Share, X, Sparkles, Smartphone } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode (installed)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;

    // Check if iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const hasDismissed = sessionStorage.getItem("area46_dismiss_install");
    if (hasDismissed) return;

    // Listen for beforeinstallprompt on Android/Chrome
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("area46_dismiss_install", "true");
  };

  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-[390px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#09090b] text-white border-2 border-[#1c00ff] rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-[#1c00ff] flex items-center justify-center shrink-0 shadow-xs">
            <Smartphone className="size-5 text-[#e3ff00]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-[#e3ff00] flex items-center gap-1">
              <Sparkles className="size-3" /> App per il tuo Telefono
            </p>
            <p className="text-xs text-zinc-300 font-semibold truncate">
              Salva l&apos;icona Area46 sul display
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-[#e3ff00] hover:bg-[#d4ee00] text-[#09090b] font-black text-xs uppercase tracking-wider flex items-center gap-1 shadow-md cursor-pointer transition-transform active:scale-95"
          >
            <Download className="size-3.5" />
            Installa
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
            title="Chiudi"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
