import React, { useRef, useEffect, useState, useMemo } from "react";
import { ChevronUp, ChevronDown, Check, X, Plus, Minus } from "lucide-react";

export interface WheelColumnOption {
  label: string;
  value: string;
}

interface WheelPickerColumnProps {
  options: WheelColumnOption[];
  selectedValue: string;
  onChange: (value: string) => void;
  title?: string;
  unit?: string;
  itemHeight?: number;
}

/**
 * Singola Colonna a Tamburo Magnetico (Scroll-Snap Roller)
 */
export const WheelPickerColumn: React.FC<WheelPickerColumnProps> = ({
  options,
  selectedValue,
  onChange,
  title,
  unit,
  itemHeight = 44,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);

  const selectedIndex = useMemo(() => {
    const idx = options.findIndex((o) => o.value === selectedValue);
    return idx >= 0 ? idx : 0;
  }, [options, selectedValue]);

  // Allinea lo scroll al valore selezionato quando cambia esternamente
  useEffect(() => {
    if (!isScrollingRef.current && containerRef.current) {
      const targetScrollTop = selectedIndex * itemHeight;
      if (Math.abs(containerRef.current.scrollTop - targetScrollTop) > 2) {
        containerRef.current.scrollTo({
          top: targetScrollTop,
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex, itemHeight]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const rawIndex = Math.round(scrollTop / itemHeight);
      const clampedIndex = Math.max(0, Math.min(options.length - 1, rawIndex));

      if (options[clampedIndex] && options[clampedIndex].value !== selectedValue) {
        onChange(options[clampedIndex].value);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(10);
          } catch {}
        }
      }
      isScrollingRef.current = false;
    }, 80);
  };

  const handleStep = (direction: -1 | 1) => {
    const newIndex = Math.max(0, Math.min(options.length - 1, selectedIndex + direction));
    if (options[newIndex]) {
      onChange(options[newIndex].value);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(12);
        } catch {}
      }
    }
  };

  return (
    <div className="flex flex-col items-center flex-1 min-w-0 select-none">
      {/* Intestazione Colonna */}
      {title && (
        <div className="mb-2 text-center">
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
            {title}
          </span>
          {unit && <span className="ml-1 text-[10px] font-bold text-zinc-500">({unit})</span>}
        </div>
      )}

      {/* Stepper Pulsante Rapido Superiore (-) */}
      <button
        type="button"
        onClick={() => handleStep(-1)}
        disabled={selectedIndex <= 0}
        className="w-full py-1.5 flex items-center justify-center text-zinc-400 hover:text-[#e3ff00] hover:bg-white/5 active:scale-95 rounded-lg transition-all disabled:opacity-20 cursor-pointer"
        aria-label={`Riduci ${title || "valore"}`}
      >
        <ChevronUp className="size-4" />
      </button>

      {/* Rullo Tamburo con Scroll Snap */}
      <div className="relative w-full h-[176px] overflow-hidden my-1">
        {/* Indicatore Visivo Cella Centrale Attiva (Safe Zone) */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-xl border-y-2 border-[#1c00ff] bg-[#1c00ff]/20 shadow-[0_0_15px_rgba(28,0,255,0.25)]"
          style={{ height: itemHeight }}
        />

        {/* Gradiente Ombra Superiore */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[#09090b] via-[#09090b]/80 to-transparent z-10" />

        {/* Gradiente Ombra Inferiore */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent z-10" />

        {/* Contenitore Scrollabile */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-auto no-scrollbar"
          style={{
            scrollSnapType: "y mandatory",
            paddingTop: itemHeight * 1.5,
            paddingBottom: itemHeight * 1.5,
          }}
        >
          {options.map((option, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  if (containerRef.current) {
                    containerRef.current.scrollTo({
                      top: idx * itemHeight,
                      behavior: "smooth",
                    });
                  }
                }}
                className={`flex items-center justify-center cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? "text-[#e3ff00] font-black text-xl sm:text-2xl scale-105"
                    : "text-zinc-500 font-semibold text-sm sm:text-base opacity-40 hover:opacity-75"
                }`}
                style={{
                  height: itemHeight,
                  scrollSnapAlign: "center",
                }}
              >
                {option.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stepper Pulsante Rapido Inferiore (+) */}
      <button
        type="button"
        onClick={() => handleStep(1)}
        disabled={selectedIndex >= options.length - 1}
        className="w-full py-1.5 flex items-center justify-center text-zinc-400 hover:text-[#e3ff00] hover:bg-white/5 active:scale-95 rounded-lg transition-all disabled:opacity-20 cursor-pointer"
        aria-label={`Aumenta ${title || "valore"}`}
      >
        <ChevronDown className="size-4" />
      </button>
    </div>
  );
};

// Generatori di Opzioni Standard Area46 Lab

/** Opzioni Carico (kg): da 0 a 200 kg a passi di 0.5 kg */
export function generateCaricoOptions(maxKg: number = 200): WheelColumnOption[] {
  const options: WheelColumnOption[] = [];
  for (let kg = 0; kg <= maxKg; kg += 0.5) {
    const valStr = kg % 1 === 0 ? String(kg) : kg.toFixed(1);
    options.push({
      label: kg === 0 ? "0 (Corpo Libero)" : `${valStr} kg`,
      value: valStr,
    });
  }
  return options;
}

/** Opzioni Ripetizioni (reps): da 1 a 60 reps */
export function generateRepsOptions(maxReps: number = 60): WheelColumnOption[] {
  const options: WheelColumnOption[] = [];
  for (let r = 1; r <= maxReps; r++) {
    options.push({
      label: `${r} rep`,
      value: String(r),
    });
  }
  return options;
}

/** Opzioni RPE: da 5.0 a 10.0 a passi di 0.5 */
export function generateRpeOptions(): WheelColumnOption[] {
  const options: WheelColumnOption[] = [];
  for (let rpe = 5.0; rpe <= 10.0; rpe += 0.5) {
    const valStr = rpe.toFixed(1);
    options.push({
      label: `RPE ${valStr}`,
      value: valStr,
    });
  }
  return options;
}

interface WheelPickerModalProps {
  open: boolean;
  onClose: () => void;
  setIndex: number;
  carico_kg: string;
  ripetizioni: string;
  rpe: string;
  onSave: (values: { carico_kg: string; ripetizioni: string; rpe: string }) => void;
}

/**
 * Modal Drawer "Zero-Tastiera" a Tamburo per il Set Completo (Carico, Reps, RPE)
 * Rispetta i canoni athletic-luxury: nero profondo (#09090b), blu #1c00ff e giallo fluo #e3ff00.
 */
export const WheelPickerModal: React.FC<WheelPickerModalProps> = ({
  open,
  onClose,
  setIndex,
  carico_kg: initialCarico,
  ripetizioni: initialReps,
  rpe: initialRpe,
  onSave,
}) => {
  const [carico, setCarico] = useState(initialCarico || "0");
  const [reps, setReps] = useState(initialReps || "8");
  const [rpe, setRpe] = useState(initialRpe || "8.0");

  useEffect(() => {
    if (open) {
      setCarico(initialCarico || "0");
      setReps(initialReps || "8");
      setRpe(initialRpe || "8.0");
    }
  }, [open, initialCarico, initialReps, initialRpe]);

  const caricoOptions = useMemo(() => generateCaricoOptions(200), []);
  const repsOptions = useMemo(() => generateRepsOptions(60), []);
  const rpeOptions = useMemo(() => generateRpeOptions(), []);

  if (!open) return null;

  // Scorciatoie rapide per il carico (+1, +2.5, +5, -2.5 kg)
  const adjustCarico = (delta: number) => {
    const current = parseFloat(carico) || 0;
    const nextVal = Math.max(0, Math.min(200, current + delta));
    setCarico(nextVal % 1 === 0 ? String(nextVal) : nextVal.toFixed(1));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
  };

  const adjustReps = (delta: number) => {
    const current = parseInt(reps, 10) || 8;
    const nextVal = Math.max(1, Math.min(60, current + delta));
    setReps(String(nextVal));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
  };

  const handleConfirm = () => {
    onSave({
      carico_kg: carico,
      ripetizioni: reps,
      rpe: rpe,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-[#09090b] text-white shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        style={{
          boxShadow: "0 -10px 40px rgba(28, 0, 255, 0.15), 0 20px 50px rgba(0, 0, 0, 0.8)",
        }}
      >
        {/* Header Drawer */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-7 items-center justify-center rounded-full text-xs font-black shadow-sm"
              style={{ background: "#1c00ff", color: "#ffffff" }}
            >
              {setIndex + 1}
            </span>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Regola Serie {setIndex + 1}
              </h3>
              <p className="text-[11px] font-bold text-[#e3ff00]">
                Ruletta Touch • Zero-Tastiera
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
            aria-label="Chiudi"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Micro-Incrementi Rapidi (Quick Chips) */}
        <div className="px-5 py-2.5 bg-zinc-900/60 border-b border-zinc-800/80 flex items-center justify-between gap-1 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Micro-Scatti:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => adjustCarico(-2.5)}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs cursor-pointer active:scale-95 transition-transform"
            >
              -2.5 kg
            </button>
            <button
              type="button"
              onClick={() => adjustCarico(2.5)}
              className="px-2 py-1 rounded-lg bg-[#1c00ff]/20 hover:bg-[#1c00ff]/30 text-[#e3ff00] border border-[#1c00ff]/40 font-bold text-xs cursor-pointer active:scale-95 transition-transform"
            >
              +2.5 kg
            </button>
            <button
              type="button"
              onClick={() => adjustCarico(5)}
              className="px-2 py-1 rounded-lg bg-[#1c00ff]/20 hover:bg-[#1c00ff]/30 text-[#e3ff00] border border-[#1c00ff]/40 font-bold text-xs cursor-pointer active:scale-95 transition-transform"
            >
              +5 kg
            </button>
            <span className="text-zinc-600">|</span>
            <button
              type="button"
              onClick={() => adjustReps(1)}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer active:scale-95 transition-transform"
            >
              +1 rep
            </button>
          </div>
        </div>

        {/* Corpo: 3 Rulette a Tamburo Touch (Carico | Reps | RPE) */}
        <div className="p-4 grid grid-cols-3 gap-2 sm:gap-3 bg-gradient-to-b from-[#09090b] to-zinc-950">
          {/* Colonna 1: Carico */}
          <WheelPickerColumn
            title="Carico"
            unit="kg"
            options={caricoOptions}
            selectedValue={carico}
            onChange={setCarico}
          />

          {/* Colonna 2: Ripetizioni */}
          <WheelPickerColumn
            title="Ripetizioni"
            unit="reps"
            options={repsOptions}
            selectedValue={reps}
            onChange={setReps}
          />

          {/* Colonna 3: RPE */}
          <WheelPickerColumn
            title="Sforzo"
            unit="RPE"
            options={rpeOptions}
            selectedValue={rpe}
            onChange={setRpe}
          />
        </div>

        {/* Footer: Conferma e Salva Set */}
        <div className="p-4 bg-zinc-900/80 border-t border-zinc-800 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer text-center"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-[2] py-3 px-4 rounded-xl text-xs sm:text-sm font-black text-white shadow-lg transition-transform active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
            style={{
              background: "#1c00ff",
              border: "1.5px solid #e3ff00",
            }}
          >
            <Check className="size-4 text-[#e3ff00]" />
            <span>Applica Valori</span>
          </button>
        </div>
      </div>
    </div>
  );
};
