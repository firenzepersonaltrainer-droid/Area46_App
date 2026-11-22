import React, { useRef, useEffect } from "react";
import { Plus, Minus, Calendar, RotateCcw } from "lucide-react";

interface ProrogaRoulettePickerProps {
  value: number; // Giorni di proroga: 0, 1, 2, 3, 4, ...
  onChange: (days: number) => void;
  currentExpirationDate?: string | null;
  label?: string;
  min?: number;
  max?: number;
}

export const ProrogaRoulettePicker: React.FC<ProrogaRoulettePickerProps> = ({
  value = 0,
  onChange,
  currentExpirationDate,
  label = "Proroga Scadenza",
  min = 0,
  max = 180,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calcolo dinamico della nuova scadenza
  const calcolaNuovaScadenza = (): { dataOriginale: string | null; dataNuova: string | null } => {
    if (!currentExpirationDate) return { dataOriginale: null, dataNuova: null };
    try {
      const base = new Date(currentExpirationDate + "T00:00:00");
      if (isNaN(base.getTime())) return { dataOriginale: null, dataNuova: null };

      const opt: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
      const originaleStr = base.toLocaleDateString("it-IT", opt);

      if (value === 0) {
        return { dataOriginale: originaleStr, dataNuova: originaleStr };
      }

      const nuova = new Date(base);
      nuova.setDate(nuova.getDate() + value);
      const nuovaStr = nuova.toLocaleDateString("it-IT", opt);
      return { dataOriginale: originaleStr, dataNuova: nuovaStr };
    } catch {
      return { dataOriginale: null, dataNuova: null };
    }
  };

  const { dataOriginale, dataNuova } = calcolaNuovaScadenza();

  const handleStep = (delta: number) => {
    const next = Math.max(min, Math.min(max, value + delta));
    onChange(next);
  };

  // Elenco dei valori per la roulette a scorrimento (1 giorno alla volta da 0 a 60)
  const rouletteValues = Array.from({ length: 61 }, (_, i) => i);

  // Auto-scroll per mantenere visibile l'elemento selezionato nella roulette
  useEffect(() => {
    if (scrollRef.current) {
      const activeBtn = scrollRef.current.querySelector<HTMLButtonElement>(`[data-day="${value}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [value]);

  return (
    <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-white select-none space-y-2.5">
      {/* Header compatto */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
          <Calendar className="size-3.5 text-[#F9DE47]" />
          {label}
        </span>
        {value > 0 && (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="text-[10px] font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            title="Azzera proroga"
          >
            <RotateCcw className="size-2.5" />
            Reset
          </button>
        )}
      </div>

      {/* Controllo Stepper Principale: Touch-Friendly 1 giorno alla volta */}
      <div className="flex items-center justify-between gap-2 bg-zinc-950/70 p-1.5 rounded-xl border border-zinc-800">
        <button
          type="button"
          onClick={() => handleStep(-1)}
          disabled={value <= min}
          className="size-11 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-white transition-all cursor-pointer shrink-0"
          title="Sottrai 1 giorno"
        >
          <Minus className="size-4.5 stroke-[2.5]" />
        </button>

        <div className="flex flex-col items-center justify-center flex-1 px-1">
          <div className="text-xl font-black tabular-nums tracking-tight text-white flex items-baseline gap-1">
            <span>{value === 0 ? "0" : `+${value}`}</span>
            <span className="text-xs font-bold text-zinc-400">
              {value === 1 ? "giorno" : "giorni"}
            </span>
          </div>
          <div className="text-[10px] text-zinc-400 font-medium">
            {value === 0 ? "Scadenza invariata" : `Proroga di ${value} ${value === 1 ? "giorno" : "giorni"}`}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleStep(1)}
          disabled={value >= max}
          className="size-11 rounded-lg bg-[#1900F2] hover:bg-[#1500cc] active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-white transition-all cursor-pointer shrink-0 shadow-md"
          title="Aggiungi 1 giorno"
        >
          <Plus className="size-4.5 stroke-[2.5]" />
        </button>
      </div>

      {/* Roulette a scorrimento orizzontale fluido (1, 2, 3, 4, 5, 6, 7, 8, ...) */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex items-center gap-1 overflow-x-auto py-1 px-1 no-scrollbar scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {rouletteValues.map((d) => {
            const isSelected = value === d;
            return (
              <button
                key={d}
                type="button"
                data-day={d}
                onClick={() => onChange(d)}
                className={`h-8 min-w-[38px] px-2 rounded-lg text-xs font-black transition-all shrink-0 cursor-pointer flex items-center justify-center tabular-nums ${
                  isSelected
                    ? "bg-[#F9DE47] text-zinc-950 scale-105 shadow-sm ring-1 ring-yellow-400 font-black"
                    : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-semibold"
                }`}
              >
                {d === 0 ? "0" : `+${d}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Anteprima dinamica della nuova data di scadenza (monoriga compatta) */}
      {dataNuova && (
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[11px]">
          <span className="text-zinc-400">Scadenza pacchetto:</span>
          <span
            className={`font-black tabular-nums ${
              value > 0 ? "text-[#F9DE47]" : "text-zinc-200"
            }`}
          >
            {dataNuova}
          </span>
        </div>
      )}
    </div>
  );
};

export default ProrogaRoulettePicker;
