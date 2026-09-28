import React, { Component, ErrorInfo, ReactNode } from "react";
import { RotateCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-5">
            <img
              src="/logo-area46-transparent.png"
              alt="Area46 Landmine Lab"
              className="h-14 w-auto object-contain"
            />

            <div className="size-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="size-6" />
            </div>

            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-white">
                Sessione da Ricaricare
              </h2>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                È disponibile un aggiornamento o la sessione è stata reimpostata. Ricarica per completare la sincronizzazione.
              </p>
            </div>

            <div className="w-full flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-[#1c00ff] hover:bg-[#1500cc] text-[#e3ff00] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#1c00ff]/20 cursor-pointer active:scale-95"
              >
                <RotateCw className="size-4" />
                Ricarica Applicazione
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Ripristina Schermata Iniziale
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
