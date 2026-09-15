import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Timer,
  X,
  Play,
  Pause,
  RotateCcw,
  Minimize2,
  Maximize2,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Volume2,
} from "lucide-react";

// ==============================================================================
// SINTETIZZATORE FISCHIETTO ARBITRALE / COACH (Fox 40 Style)
// ==============================================================================
// Genera un suono incisivo, penetrante e ad alto volume tarato sulla gamma di
// massima sensibilità dell'orecchio umano (2.8 kHz - 3.3 kHz) con flutter d'aria
// a 28 Hz e compressore dinamico per sovrastare rumori di sala, musica e bilancieri.
// ==============================================================================

function createAudioCtx(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    return new AudioCtx();
  } catch {
    return null;
  }
}

export type WhistleKind = "tick" | "phase" | "final_cycle";

function playSportsWhistle(
  ctx: AudioContext,
  kind: WhistleKind | boolean = "phase",
  volume = 0.95,
) {
  const now = ctx.currentTime;
  const actualKind: WhistleKind =
    typeof kind === "boolean" ? (kind ? "phase" : "tick") : kind;

  // Compressore dinamico per massimizzare il volume e l'impatto senza saturare
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-12, now);
  compressor.knee.setValueAtTime(3, now);
  compressor.ratio.setValueAtTime(12, now);
  compressor.attack.setValueAtTime(0.002, now);
  compressor.release.setValueAtTime(0.08, now);
  compressor.connect(ctx.destination);

  function singleBlast(
    startTime: number,
    duration: number,
    blastVol: number,
    freqShift = 0,
  ) {
    // Due oscillatori acustici sintonizzati sulle frequenze tipiche del fischietto da arbitro
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();

    // LFO a 28 Hz per simulare la turbolenza d'aria/pallina interna (trillo tagliente)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(28, startTime);
    lfoGain.gain.setValueAtTime(85, startTime);
    lfo.connect(osc1.frequency);
    lfo.connect(osc2.frequency);

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(2820 + freqShift, startTime);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(3240 + freqShift, startTime);

    // Filtro passa-banda centrato sui 3000 Hz
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(3000 + freqShift, startTime);
    filter.Q.setValueAtTime(2.2, startTime);

    // Inviluppo di ampiezza secco e incisivo
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(blastVol, startTime + 0.012);
    gain.gain.setValueAtTime(blastVol * 0.95, startTime + duration - 0.03);
    gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(compressor);

    lfo.start(startTime);
    osc1.start(startTime);
    osc2.start(startTime);

    lfo.stop(startTime + duration);
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);
  }

  if (actualKind === "final_cycle") {
    // TRIPLICE FISCHIO LUNGO (Termine del Ciclo Interval - l'ultimo segnale in assoluto):
    // Due fischi corti e decisi seguiti da un fischione finale prolungato (~1.15s) ad alta intensità
    singleBlast(now, 0.16, volume * 0.95);
    singleBlast(now + 0.24, 0.16, volume);
    singleBlast(now + 0.48, 1.15, volume * 1.15, 60);
  } else if (actualKind === "phase") {
    // Doppio fischio normale di cambio fase (lavoro/riposo) o termine countdown
    singleBlast(now, 0.15, volume);
    singleBlast(now + 0.22, 0.42, volume * 1.05);
  } else {
    // Singolo fischio breve di pre-avviso (3, 2, 1)
    singleBlast(now, 0.13, volume * 0.85);
  }
}

type Mode = "countdown" | "interval";
type Phase = "work" | "rest" | "idle";

interface TimerState {
  mode: Mode;
  running: boolean;
  minimized: boolean;
  open: boolean;
  countdownTotal: number;
  countdownLeft: number;
  workSecs: number;
  restSecs: number;
  rounds: number;
  currentRound: number;
  phase: Phase;
  phaseLeft: number;
}

const DEFAULT: TimerState = {
  mode: "countdown",
  running: false,
  minimized: false,
  open: false,
  countdownTotal: 60,
  countdownLeft: 60,
  workSecs: 40,
  restSecs: 20,
  rounds: 8,
  currentRound: 1,
  phase: "idle",
  phaseLeft: 40,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmt(s: number) {
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export default function FloatingTimer() {
  const [state, setState] = useState<TimerState>(DEFAULT);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Coordinate per trascinamento finestra
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  function ensureAudio() {
    if (!audioCtxRef.current) audioCtxRef.current = createAudioCtx();
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();
  }

  function playAlert(kind: WhistleKind | boolean = "phase") {
    ensureAudio();
    if (audioCtxRef.current) {
      playSportsWhistle(audioCtxRef.current, kind);
    }
  }

  const tick = useCallback(() => {
    setState((prev) => {
      if (!prev.running) return prev;
      const ctx = audioCtxRef.current;

      if (prev.mode === "countdown") {
        const next = prev.countdownLeft - 1;
        if (ctx) {
          if (next === 3 || next === 2 || next === 1) {
            playSportsWhistle(ctx, "tick");
          } else if (next === 0) {
            playSportsWhistle(ctx, "phase");
          }
        }
        if (next <= 0) {
          // Quando termina il conteggio (arriva a 0): suona il fischietto, mostra 00:00 per 1 secondo
          // e si riposiziona autonomamente all'inizio del nuovo conteggio (countdownTotal)
          setTimeout(() => {
            setState((s) => {
              if (s.mode === "countdown" && !s.running && s.countdownLeft === 0) {
                return { ...s, countdownLeft: s.countdownTotal };
              }
              return s;
            });
          }, 1000);
          return { ...prev, countdownLeft: 0, running: false };
        }
        return { ...prev, countdownLeft: next };
      }

      // Interval mode
      const nextPhaseLeft = prev.phaseLeft - 1;
      const isLastRound = prev.currentRound >= prev.rounds;
      const isCycleEnd =
        isLastRound && (prev.phase === "rest" || prev.restSecs === 0);

      if (ctx) {
        if (nextPhaseLeft === 3 || nextPhaseLeft === 2 || nextPhaseLeft === 1) {
          playSportsWhistle(ctx, "tick");
        } else if (nextPhaseLeft === 0) {
          if (isCycleEnd) {
            // SOLO per la modalità interval: fischio di termine ciclo (l'ultimo segnale in assoluto)
            playSportsWhistle(ctx, "final_cycle");
          } else {
            // Segnale normale di transizione fase (es. fine lavoro -> riposo, fine riposo -> lavoro)
            playSportsWhistle(ctx, "phase");
          }
        }
      }

      if (nextPhaseLeft > 0) return { ...prev, phaseLeft: nextPhaseLeft };

      if (prev.phase === "work") {
        if (prev.restSecs > 0) {
          return { ...prev, phase: "rest", phaseLeft: prev.restSecs };
        }
        if (isLastRound) {
          return { ...prev, phase: "idle", phaseLeft: 0, running: false };
        }
        return {
          ...prev,
          phase: "work",
          phaseLeft: prev.workSecs,
          currentRound: prev.currentRound + 1,
        };
      }

      const nextRound = prev.currentRound + 1;
      if (nextRound > prev.rounds) {
        return { ...prev, phase: "idle", phaseLeft: 0, running: false };
      }
      return {
        ...prev,
        phase: "work",
        phaseLeft: prev.workSecs,
        currentRound: nextRound,
      };
    });
  }, []);

  useEffect(() => {
    if (state.running) {
      tickRef.current = setInterval(tick, 1000);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state.running, tick]);

  // ==============================================================================
  // GESTIONE TRASCINAMENTO (DRAGGABLE ALL'INTERNO DELLO SMARTPHONE)
  // ==============================================================================
  const onPointerDownDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // Ignora se il click proviene da un pulsante (es. X, riduci, test audio)
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("input")) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      if (!containerRef.current) return;
      const phoneContainer =
        containerRef.current.closest("#phone-frame") ||
        containerRef.current.parentElement ||
        document.body;
      const phoneRect = phoneContainer.getBoundingClientRect();
      const rect = containerRef.current.getBoundingClientRect();

      isDraggingRef.current = true;
      dragOffsetRef.current = {
        startX: clientX,
        startY: clientY,
        initialX: rect.left - phoneRect.left,
        initialY: rect.top - phoneRect.top,
      };

      function onPointerMove(moveEvent: MouseEvent | TouchEvent) {
        if (!isDraggingRef.current) return;
        const currentX =
          "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const currentY =
          "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

        const deltaX = currentX - dragOffsetRef.current.startX;
        const deltaY = currentY - dragOffsetRef.current.startY;

        const newX = dragOffsetRef.current.initialX + deltaX;
        const newY = dragOffsetRef.current.initialY + deltaY;

        // Limita rigorosamente all'interno dello smartphone (non può uscire dalla sagoma)
        const containerW = phoneContainer.clientWidth;
        const containerH = phoneContainer.clientHeight;
        const width = rect.width || 320;
        const height = containerRef.current?.offsetHeight || rect.height || 340;

        const clampedX = Math.max(6, Math.min(containerW - width - 6, newX));
        const clampedY = Math.max(38, Math.min(containerH - height - 12, newY));

        setPosition({ x: clampedX, y: clampedY });
      }

      function onPointerUp() {
        isDraggingRef.current = false;
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
        window.removeEventListener("touchmove", onPointerMove);
        window.removeEventListener("touchend", onPointerUp);
      }

      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onPointerUp);
      window.addEventListener("touchmove", onPointerMove, { passive: false });
      window.addEventListener("touchend", onPointerUp);
    },
    [],
  );

  function handleOpen() {
    ensureAudio();
    setState((s) => ({ ...s, open: true, minimized: false }));
  }
  function handleClose() {
    setState((s) => ({ ...s, open: false, running: false }));
  }
  function handleMinimize() {
    setState((s) => {
      const willExpand = s.minimized;
      if (willExpand && position && containerRef.current) {
        const phone =
          containerRef.current.closest("#phone-frame") ||
          containerRef.current.parentElement;
        if (phone) {
          const maxH = phone.clientHeight;
          if (position.y + 350 > maxH - 12) {
            setPosition((p) => (p ? { ...p, y: Math.max(38, maxH - 360) } : null));
          }
        }
      }
      return { ...s, minimized: !s.minimized };
    });
  }
  function handlePlayPause() {
    ensureAudio();
    setState((s) => {
      if (!s.running && s.mode === "interval" && s.phase === "idle")
        return {
          ...s,
          running: true,
          phase: "work",
          phaseLeft: s.workSecs,
          currentRound: 1,
        };
      if (!s.running && s.mode === "countdown" && s.countdownLeft === 0)
        return {
          ...s,
          running: true,
          countdownLeft: s.countdownTotal,
        };
      return { ...s, running: !s.running };
    });
  }
  function handleReset() {
    setState((s) => ({
      ...s,
      running: false,
      countdownLeft: s.countdownTotal,
      phase: "idle",
      phaseLeft: s.workSecs,
      currentRound: 1,
    }));
  }
  function setMode(newMode: Mode) {
    setState((s) => ({
      ...s,
      mode: newMode,
      running: false,
      phase: "idle",
      countdownLeft: s.countdownTotal,
      phaseLeft: s.workSecs,
      currentRound: 1,
    }));
  }

  const { mode, running, minimized, open } = state;
  const cdLeft = state.countdownLeft;
  const cdPct =
    state.countdownTotal > 0
      ? Math.round((cdLeft / state.countdownTotal) * 100)
      : 0;
  const totalPhase = state.phase === "work" ? state.workSecs : state.restSecs;
  const phasePct =
    totalPhase > 0 ? Math.round((state.phaseLeft / totalPhase) * 100) : 0;
  const phaseColor = state.phase === "work" ? "#1c00ff" : "#ea580c";

  if (typeof document === "undefined") return null;

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="absolute bottom-20 right-4 flex size-12 cursor-pointer items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95 z-50"
        style={{
          background: "#1c00ff",
          color: "#ffffff",
          boxShadow: "0 8px 24px rgba(28,0,255,0.45)",
        }}
        aria-label="Apri timer"
      >
        <Timer className="size-6" />
      </button>
    );
  }

  // Stile di posizionamento: se position è stato impostato tramite drag, usa top/left assoluti all'interno dello smartphone,
  // altrimenti usa il default centrato orizzontalmente in basso allo smartphone.
  const positionStyle: React.CSSProperties = position
    ? { top: `${position.y}px`, left: `${position.x}px` }
    : { bottom: "84px", left: "12px" };

  return (
    <div
      ref={containerRef}
      className="absolute w-[calc(100%-24px)] rounded-2xl shadow-2xl overflow-hidden select-none transition-shadow z-50"
      style={{
        ...positionStyle,
        border: "2px solid #1c00ff",
        background: "#ffffff",
        boxShadow: "0 16px 36px -6px rgba(0,0,0,0.28), 0 0 16px rgba(28,0,255,0.18)",
      }}
    >
      {/* Header Trascinabile */}
      <div
        onMouseDown={onPointerDownDrag}
        onTouchStart={onPointerDownDrag}
        className="flex items-center justify-between px-3 py-2.5 cursor-grab active:cursor-grabbing"
        style={{ borderBottom: "1px solid #e2e5ea", background: "#f8f9fa" }}
        title="Trascina per spostare il timer"
      >
        <div className="flex items-center gap-1.5 pointer-events-none">
          <GripHorizontal className="size-4 text-zinc-400 mr-0.5" />
          <Timer className="size-4" style={{ color: "#1c00ff" }} />
          <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
            Timer Lab
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Test acustico fischietto */}
          <button
            onClick={() =>
              playAlert(mode === "interval" ? "final_cycle" : "phase")
            }
            className="rounded p-1 cursor-pointer hover:bg-zinc-200 transition-colors"
            title={
              mode === "interval"
                ? "Test fischietto termine ciclo (triplice fischio lungo)"
                : "Test segnale acustico"
            }
            aria-label="Test segnale acustico"
          >
            <Volume2 className="size-3.5" style={{ color: "#1c00ff" }} />
          </button>

          {/* Riduci / Ingrandisci */}
          <button
            onClick={handleMinimize}
            className="rounded p-1 cursor-pointer hover:bg-zinc-200 transition-colors"
            aria-label={minimized ? "Espandi" : "Riduci"}
            title={minimized ? "Espandi" : "Riduci"}
          >
            {minimized ? (
              <Maximize2 className="size-3.5 text-zinc-600" />
            ) : (
              <Minimize2 className="size-3.5 text-zinc-600" />
            )}
          </button>

          {/* Chiudi */}
          <button
            onClick={handleClose}
            className="rounded p-1 cursor-pointer hover:bg-zinc-200 transition-colors text-zinc-600 hover:text-zinc-950"
            aria-label="Chiudi timer"
            title="Chiudi"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {minimized ? (
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-50 transition-colors"
          onClick={handleMinimize}
        >
          <span
            className="text-2xl font-black tabular-nums"
            style={{
              color:
                mode === "countdown"
                  ? cdLeft <= 5
                    ? "#ea580c"
                    : "#1c00ff"
                  : phaseColor,
            }}
          >
            {mode === "countdown" ? fmt(cdLeft) : fmt(state.phaseLeft)}
          </span>
          {mode === "interval" && (
            <span
              className="text-xs font-bold rounded-full px-2 py-0.5"
              style={{ background: phaseColor, color: "#ffffff" }}
            >
              {state.phase === "work" ? "LAVORO" : "RIPOSO"} {state.currentRound}/
              {state.rounds}
            </span>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: "1px solid #1c00ff" }}
          >
            {(["countdown", "interval"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-1.5 text-xs font-bold cursor-pointer transition-all"
                style={{
                  background: mode === m ? "#1c00ff" : "#f1f3f6",
                  color: mode === m ? "#ffffff" : "#52525b",
                }}
              >
                {m === "countdown" ? "Countdown" : "Interval"}
              </button>
            ))}
          </div>

          {mode === "countdown" ? (
            <CountdownPanel
              state={state}
              setState={setState}
              cdLeft={cdLeft}
              cdPct={cdPct}
            />
          ) : (
            <IntervalPanel
              state={state}
              setState={setState}
              phaseColor={phaseColor}
              phasePct={phasePct}
            />
          )}

          <div className="flex items-center justify-center gap-4 pt-1">
            <button
              onClick={handleReset}
              className="flex size-9 cursor-pointer items-center justify-center rounded-full border transition-all hover:border-zinc-900 hover:text-zinc-900"
              style={{ borderColor: "#d1d5db", color: "#6b7280" }}
              aria-label="Reset"
              title="Azzera"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              onClick={handlePlayPause}
              className="flex size-14 cursor-pointer items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
              style={{ background: "#1c00ff", color: "#ffffff" }}
              aria-label={running ? "Pausa" : "Avvia"}
              title={running ? "Pausa" : "Avvia"}
            >
              {running ? (
                <Pause className="size-6" />
              ) : (
                <Play className="size-6 ml-0.5" />
              )}
            </button>
            <div className="size-9" />
          </div>
        </div>
      )}
    </div>
  );
}

function CountdownPanel({
  state,
  setState,
  cdLeft,
  cdPct,
}: {
  state: TimerState;
  setState: React.Dispatch<React.SetStateAction<TimerState>>;
  cdLeft: number;
  cdPct: number;
}) {
  const alertColor = cdLeft <= 5 ? "#ea580c" : "#1c00ff";
  function adjustTime(delta: number) {
    if (state.running) return;
    setState((s) => {
      const newTotal = Math.max(5, s.countdownTotal + delta);
      return { ...s, countdownTotal: newTotal, countdownLeft: newTotal };
    });
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-5xl font-black tabular-nums transition-colors"
          style={{ color: alertColor }}
        >
          {fmt(cdLeft)}
        </span>
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-inset mt-1">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${cdPct}%`, background: alertColor }}
          />
        </div>
      </div>
      {!state.running && (
        <div className="flex items-center justify-center gap-2">
          {[-60, -10, +10, +60].map((d) => (
            <button
              key={d}
              onClick={() => adjustTime(d)}
              className="rounded px-2.5 py-1 text-xs font-bold cursor-pointer transition-all hover:scale-105"
              style={{
                background:
                  d > 0 ? "rgba(28,0,255,0.08)" : "#f1f3f6",
                color: d > 0 ? "#1c00ff" : "#52525b",
                border: d > 0 ? "1px solid rgba(28,0,255,0.3)" : "1px solid transparent",
              }}
            >
              {d > 0 ? `+${d}s` : `${d}s`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IntervalPanel({
  state,
  setState,
  phaseColor,
  phasePct,
}: {
  state: TimerState;
  setState: React.Dispatch<React.SetStateAction<TimerState>>;
  phaseColor: string;
  phasePct: number;
}) {
  function adjustSetting(
    key: "workSecs" | "restSecs" | "rounds",
    delta: number,
  ) {
    if (state.running) return;
    setState((s) => {
      const min = key === "rounds" ? 1 : 5;
      const newVal = Math.max(min, (s[key] as number) + delta);
      const update: Partial<TimerState> = { [key]: newVal };
      if (key === "workSecs") update.phaseLeft = newVal;
      return { ...s, ...update };
    });
  }
  const isRunning = state.running || state.phase !== "idle";
  return (
    <div className="space-y-3">
      {isRunning ? (
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: phaseColor }}
          >
            {state.phase === "work" ? "LAVORO" : "RIPOSO"} — Round{" "}
            {state.currentRound}/{state.rounds}
          </span>
          <span
            className="text-5xl font-black tabular-nums"
            style={{ color: phaseColor }}
          >
            {fmt(state.phaseLeft)}
          </span>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-inset mt-1">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${phasePct}%`, background: phaseColor }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-1">
          <span className="text-xs text-secondary">
            {state.rounds} round · {fmt(state.workSecs)} lavoro ·{" "}
            {fmt(state.restSecs)} riposo
          </span>
          <span
            className="text-2xl font-black tabular-nums mt-0.5"
            style={{ color: "#e3ff00" }}
          >
            {fmt(
              state.workSecs * state.rounds +
                state.restSecs * (state.rounds - 1),
            )}
          </span>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-secondary">
            Durata Totale
          </span>
        </div>
      )}
      {!state.running && state.phase === "idle" && (
        <div className="space-y-2 pt-1">
          <SettingRow
            label="Lavoro"
            value={fmt(state.workSecs)}
            onMinus={() => adjustSetting("workSecs", -5)}
            onPlus={() => adjustSetting("workSecs", +5)}
            color="#1c00ff"
          />
          <SettingRow
            label="Riposo"
            value={fmt(state.restSecs)}
            onMinus={() => adjustSetting("restSecs", -5)}
            onPlus={() => adjustSetting("restSecs", +5)}
            color="#ea580c"
          />
          <SettingRow
            label="Round"
            value={String(state.rounds)}
            onMinus={() => adjustSetting("rounds", -1)}
            onPlus={() => adjustSetting("rounds", +1)}
            color="#e3ff00"
          />
        </div>
      )}
    </div>
  );
}

function SettingRow({
  label,
  value,
  onMinus,
  onPlus,
  color,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold" style={{ color, minWidth: 56 }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onMinus}
          className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition-colors"
        >
          <ChevronDown className="size-3.5" />
        </button>
        <span className="text-sm font-bold tabular-nums w-12 text-center text-white">
          {value}
        </span>
        <button
          onClick={onPlus}
          className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition-colors"
        >
          <ChevronUp className="size-3.5" />
        </button>
      </div>
    </div>
  );
}