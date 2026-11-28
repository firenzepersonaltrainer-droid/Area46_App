import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from "react";
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
  Plus,
  Trash2,
} from "lucide-react";

// ==============================================================================
// SINTETIZZATORE FISCHIETTO ARBITRALE / COACH (Fox 40 Style)
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
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();

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

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(3000 + freqShift, startTime);
    filter.Q.setValueAtTime(2.2, startTime);

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
    singleBlast(now, 0.16, volume * 0.95);
    singleBlast(now + 0.24, 0.16, volume);
    singleBlast(now + 0.48, 1.15, volume * 1.15, 60);
  } else if (actualKind === "phase") {
    singleBlast(now, 0.15, volume);
    singleBlast(now + 0.22, 0.42, volume * 1.05);
  } else {
    singleBlast(now, 0.13, volume * 0.85);
  }
}

export type Mode = "countdown" | "interval";

export interface IntervalStep {
  id: string;
  nome: string;
  durataSecs: number;
  tipo: "work" | "rest";
}

export interface TimerState {
  mode: Mode;
  running: boolean;
  minimized: boolean;
  open: boolean;
  countdownTotal: number;
  countdownLeft: number;
  steps: IntervalStep[];
  currentStepIndex: number;
  rounds: number;
  currentRound: number;
  phaseLeft: number;
}

const DEFAULT_STEPS: IntervalStep[] = [
  { id: "s1", nome: "Esercizio 1", durataSecs: 30, tipo: "work" },
  { id: "s2", nome: "Esercizio 2", durataSecs: 40, tipo: "work" },
  { id: "s3", nome: "Esercizio 3", durataSecs: 30, tipo: "work" },
  { id: "s4", nome: "Recupero", durataSecs: 60, tipo: "rest" },
];

const DEFAULT_STATE: TimerState = {
  mode: "countdown",
  running: false,
  minimized: false,
  open: false,
  countdownTotal: 60,
  countdownLeft: 60,
  steps: DEFAULT_STEPS,
  currentStepIndex: 0,
  rounds: 4,
  currentRound: 1,
  phaseLeft: DEFAULT_STEPS[0].durataSecs,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function fmt(s: number) {
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

// ==============================================================================
// CONTEXT E STATE MANAGEMENT DEL TIMER
// ==============================================================================
interface TimerContextValue {
  state: TimerState;
  setState: React.Dispatch<React.SetStateAction<TimerState>>;
  handleOpen: () => void;
  handleClose: () => void;
  handleMinimize: () => void;
  handlePlayPause: () => void;
  handleReset: () => void;
  setMode: (newMode: Mode) => void;
  adjustCountdown: (delta: number) => void;
  adjustStepTime: (stepId: string, delta: number) => void;
  toggleStepType: (stepId: string) => void;
  addStep: (tipo?: "work" | "rest") => void;
  removeStep: (stepId: string) => void;
  moveStep: (index: number, direction: "up" | "down") => void;
  adjustRounds: (delta: number) => void;
  playAlert: (kind?: WhistleKind | boolean) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return ctx;
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TimerState>(DEFAULT_STATE);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

      // ── MODALITÀ COUNTDOWN ────────────────────────────────────────────────
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

      // ── MODALITÀ INTERVAL MULTI-FASE / CIRCUITO ────────────────────────────
      const steps = prev.steps.length > 0 ? prev.steps : DEFAULT_STEPS;
      const nextPhaseLeft = prev.phaseLeft - 1;

      const isLastStep = prev.currentStepIndex >= steps.length - 1;
      const isLastRound = prev.currentRound >= prev.rounds;
      const isCycleEnd = isLastRound && isLastStep;

      if (ctx) {
        if (nextPhaseLeft === 3 || nextPhaseLeft === 2 || nextPhaseLeft === 1) {
          playSportsWhistle(ctx, "tick");
        } else if (nextPhaseLeft === 0) {
          if (isCycleEnd) {
            playSportsWhistle(ctx, "final_cycle");
          } else {
            playSportsWhistle(ctx, "phase");
          }
        }
      }

      if (nextPhaseLeft > 0) {
        return { ...prev, phaseLeft: nextPhaseLeft };
      }

      // Transizione fase successiva
      if (isCycleEnd) {
        return {
          ...prev,
          running: false,
          currentStepIndex: 0,
          currentRound: 1,
          phaseLeft: steps[0].durataSecs,
        };
      }

      let nextStepIndex = prev.currentStepIndex + 1;
      let nextRound = prev.currentRound;

      if (nextStepIndex >= steps.length) {
        nextStepIndex = 0;
        nextRound = prev.currentRound + 1;
      }

      const nextStepData = steps[nextStepIndex];
      return {
        ...prev,
        currentStepIndex: nextStepIndex,
        currentRound: nextRound,
        phaseLeft: nextStepData.durataSecs,
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

  const handleOpen = useCallback(() => {
    ensureAudio();
    setState((s) => ({ ...s, open: true, minimized: false }));
  }, []);

  const handleClose = useCallback(() => {
    setState((s) => ({ ...s, open: false, running: false, minimized: false }));
  }, []);

  const handleMinimize = useCallback(() => {
    setState((s) => {
      // Se era minimizzato, al tap si espande e apre
      if (s.minimized) {
        return { ...s, minimized: false, open: true };
      }
      // Altrimenti si riduce a linguetta nell'header
      return { ...s, minimized: true };
    });
  }, []);

  const handlePlayPause = useCallback(() => {
    ensureAudio();
    setState((s) => {
      if (!s.running && s.mode === "interval" && s.phaseLeft === 0) {
        const first = s.steps[0] || DEFAULT_STEPS[0];
        return {
          ...s,
          running: true,
          currentStepIndex: 0,
          currentRound: 1,
          phaseLeft: first.durataSecs,
        };
      }
      if (!s.running && s.mode === "countdown" && s.countdownLeft === 0) {
        return {
          ...s,
          running: true,
          countdownLeft: s.countdownTotal,
        };
      }
      return { ...s, running: !s.running };
    });
  }, []);

  const handleReset = useCallback(() => {
    setState((s) => {
      const first = s.steps[0] || DEFAULT_STEPS[0];
      return {
        ...s,
        running: false,
        countdownLeft: s.countdownTotal,
        currentStepIndex: 0,
        currentRound: 1,
        phaseLeft: first.durataSecs,
      };
    });
  }, []);

  const setMode = useCallback((newMode: Mode) => {
    setState((s) => ({ ...s, mode: newMode }));
  }, []);

  const adjustCountdown = useCallback((delta: number) => {
    setState((s) => {
      if (s.running) return s;
      const newTotal = Math.max(5, s.countdownTotal + delta);
      return { ...s, countdownTotal: newTotal, countdownLeft: newTotal };
    });
  }, []);

  const adjustStepTime = useCallback((stepId: string, delta: number) => {
    setState((s) => {
      if (s.running) return s;
      const updatedSteps = s.steps.map((st) => {
        if (st.id === stepId) {
          const newDur = Math.max(5, st.durataSecs + delta);
          return { ...st, durataSecs: newDur };
        }
        return st;
      });
      const first = updatedSteps[0];
      return {
        ...s,
        steps: updatedSteps,
        phaseLeft: s.currentStepIndex === 0 ? first.durataSecs : s.phaseLeft,
      };
    });
  }, []);

  const toggleStepType = useCallback((stepId: string) => {
    setState((s) => {
      if (s.running) return s;
      return {
        ...s,
        steps: s.steps.map((st) =>
          st.id === stepId
            ? {
                ...st,
                tipo: st.tipo === "work" ? "rest" : "work",
                nome: st.tipo === "work" ? "Recupero" : `Lavoro ${st.id.replace("s", "")}`,
              }
            : st,
        ),
      };
    });
  }, []);

  const addStep = useCallback((tipo: "work" | "rest" = "work") => {
    setState((s) => {
      if (s.running) return s;
      const workCount = s.steps.filter((st) => st.tipo === "work").length;
      const restCount = s.steps.filter((st) => st.tipo === "rest").length;
      const newStep: IntervalStep = {
        id: `s${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        nome: tipo === "work" ? `Lavoro ${workCount + 1}` : `Recupero ${restCount + 1}`,
        durataSecs: tipo === "work" ? 30 : 60,
        tipo,
      };
      return { ...s, steps: [...s.steps, newStep] };
    });
  }, []);

  const removeStep = useCallback((stepId: string) => {
    setState((s) => {
      if (s.running || s.steps.length <= 1) return s;
      const filtered = s.steps.filter((st) => st.id !== stepId);
      return {
        ...s,
        steps: filtered,
        currentStepIndex: 0,
        phaseLeft: filtered[0].durataSecs,
      };
    });
  }, []);

  const moveStep = useCallback((index: number, direction: "up" | "down") => {
    setState((s) => {
      if (s.running) return s;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= s.steps.length) return s;

      const newSteps = [...s.steps];
      const temp = newSteps[index];
      newSteps[index] = newSteps[targetIndex];
      newSteps[targetIndex] = temp;

      return {
        ...s,
        steps: newSteps,
        currentStepIndex: 0,
        phaseLeft: newSteps[0].durataSecs,
      };
    });
  }, []);

  const adjustRounds = useCallback((delta: number) => {
    setState((s) => {
      if (s.running) return s;
      return { ...s, rounds: Math.max(1, s.rounds + delta) };
    });
  }, []);

  const value: TimerContextValue = {
    state,
    setState,
    handleOpen,
    handleClose,
    handleMinimize,
    handlePlayPause,
    handleReset,
    setMode,
    adjustCountdown,
    adjustStepTime,
    toggleStepType,
    addStep,
    removeStep,
    moveStep,
    adjustRounds,
    playAlert,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

// ==============================================================================
// 1. WIDGET FASCIA ATTIVA (A TUTTA ALTEZZA, COPRE IL LOGO A SINISTRA QUANDO IN FUNZIONE)
// ==============================================================================
export function HeaderActiveTimerBanner() {
  const { state, handleMinimize } = useTimer();
  const { mode, running, minimized, countdownLeft, countdownTotal, phaseLeft, steps, currentStepIndex } = state;

  if (!minimized) return null;

  const stepsSafe = Array.isArray(steps) && steps.length > 0 ? steps : DEFAULT_STEPS;
  const safeIdx =
    typeof currentStepIndex === "number" && currentStepIndex >= 0 && currentStepIndex < stepsSafe.length
      ? currentStepIndex
      : 0;
  const activeStep = stepsSafe[safeIdx] || DEFAULT_STEPS[0];
  const phaseColor = activeStep.tipo === "work" ? "#38bdf8" : "#10b981";

  const phaseLeftSafe =
    typeof phaseLeft === "number" && !isNaN(phaseLeft) ? phaseLeft : activeStep.durataSecs;
  const countdownLeftSafe =
    typeof countdownLeft === "number" && !isNaN(countdownLeft) ? countdownLeft : (countdownTotal || 60);

  const timeDisplay = mode === "countdown" ? fmt(countdownLeftSafe) : fmt(phaseLeftSafe);
  const isWarning = mode === "countdown" && countdownLeftSafe <= 5;
  const digitsColor = isWarning ? "#ea580c" : mode === "countdown" ? "#e3ff00" : phaseColor;

  const badgeText =
    mode === "countdown"
      ? "COUNTDOWN"
      : activeStep.tipo === "work"
      ? "🔥 LAVORO"
      : "⏸️ RECUPERO";
  const subText =
    mode === "countdown"
      ? running
        ? "IN CORSO"
        : "IN PAUSA"
      : `ROUND ${state.currentRound || 1}/${state.rounds || 4}`;

  return (
    <button
      type="button"
      onClick={handleMinimize}
      className="absolute inset-y-0 left-0 right-[125px] sm:right-[155px] z-30 flex items-center justify-between px-3 sm:px-4 bg-[#09090b] text-white border-r-2 border-[#1c00ff] shadow-md cursor-pointer select-none transition-all hover:bg-[#121218] active:scale-[0.99] group overflow-hidden"
      title="Tocca la fascia per espandere il Timer Lab"
      aria-label="Espandi timer"
    >
      {/* Indicatore visivo fase e icona */}
      <div className="flex items-center gap-2 min-w-0 pr-1">
        <div
          className="size-8 rounded-lg flex items-center justify-center shrink-0 border"
          style={{
            background: mode === "countdown" ? "#1c00ff" : phaseColor,
            borderColor: mode === "countdown" ? "#e3ff00" : "#ffffff",
          }}
        >
          <Timer
            className={`size-4.5 ${
              mode === "countdown" ? "text-[#e3ff00]" : "text-[#09090b]"
            } ${running ? "animate-pulse" : ""}`}
          />
        </div>
        <div className="flex flex-col text-left min-w-0">
          <span
            className="text-[11px] sm:text-xs font-black uppercase tracking-wider truncate leading-tight"
            style={{ color: mode === "countdown" ? "#e3ff00" : phaseColor }}
          >
            {badgeText}
          </span>
          <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400 font-bold truncate leading-tight mt-0.5">
            {subText}
          </span>
        </div>
      </div>

      {/* Cifre Giganti del Cronometro ad altissima visibilità e icona espansione */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="font-mono font-black text-2xl sm:text-3xl tabular-nums tracking-tight leading-none"
          style={{
            color: digitsColor,
            textShadow: isWarning
              ? "0 0 16px rgba(234,88,12,0.6)"
              : mode === "countdown"
              ? "0 0 16px rgba(227,255,0,0.4)"
              : `0 0 16px ${phaseColor}60`,
          }}
        >
          {timeDisplay}
        </span>
        <div className="p-1 rounded-md bg-zinc-800/80 text-zinc-400 group-hover:text-white group-hover:bg-[#1c00ff] transition-all">
          <Maximize2 className="size-3.5" />
        </div>
      </div>
    </button>
  );
}

// ==============================================================================
// 2. ICONA TIMER QUADRATA A RIPOSO NELL'HEADER (QUANDO IL TIMER NON È RIDOTTO A FASCIA)
// ==============================================================================
export function HeaderTimerWidget() {
  const { state, handleOpen } = useTimer();
  const { running, minimized, open } = state;

  // Se minimizzato, la fascia HeaderActiveTimerBanner copre la sinistra; nascondi il bottone singolo a destra
  if (minimized) return null;

  // Stato normale: Icona quadrata ad angoli stondati pulita e integrata nella barra
  const isTimerActive = running || open;

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={`size-8 sm:size-9 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 border ${
        isTimerActive
          ? "bg-[#1c00ff] text-[#e3ff00] border-[#1c00ff] shadow-xs"
          : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-200 shadow-2xs"
      }`}
      title="Apri Timer & Intervalli Lab"
      aria-label="Apri timer"
    >
      <Timer className={`size-4 ${isTimerActive ? "text-[#e3ff00]" : "text-[#1c00ff]"}`} />
    </button>
  );
}

// ==============================================================================
// 2. MODALE / FINESTRA COMPLETA DEL TIMER (QUANDO APERTA)
// ==============================================================================
export function FloatingTimerModal() {
  const {
    state,
    handleClose,
    handleMinimize,
    handlePlayPause,
    handleReset,
    setMode,
    playAlert,
  } = useTimer();

  const { mode, running, minimized, open, countdownLeft, countdownTotal, steps, currentStepIndex } =
    state;

  if (!open || minimized) return null;

  const cdPct =
    countdownTotal > 0 ? Math.round((countdownLeft / countdownTotal) * 100) : 0;

  const activeStep = steps[currentStepIndex] || steps[0] || DEFAULT_STEPS[0];
  const totalPhaseSecs = activeStep.durataSecs;
  const phasePct =
    totalPhaseSecs > 0 ? Math.round((state.phaseLeft / totalPhaseSecs) * 100) : 0;
  const phaseColor = activeStep.tipo === "work" ? "#38bdf8" : "#10b981";

  return (
    <div className="fixed inset-0 sm:absolute z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-[400px] rounded-2xl shadow-2xl overflow-hidden text-white border border-[#1c00ff] mt-2 sm:mt-0 max-h-[92vh] sm:max-h-[85vh] flex flex-col"
        style={{
          background: "#0d0d12",
          boxShadow: "0 25px 60px -15px rgba(0,0,0,0.85), 0 0 24px rgba(28,0,255,0.35)",
        }}
      >
        {/* Header Finestra Timer */}
        <div
          className="flex items-center justify-between px-3.5 py-2.5 shrink-0"
          style={{ borderBottom: "1px solid #232332", background: "#15151e" }}
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <GripHorizontal className="size-4 text-zinc-500 mr-0.5" />
            <img
              src="/logo-area46-transparent.png"
              alt="Area46"
              className="h-4 w-auto object-contain brightness-125"
            />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Timer Lab
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Test fischietto */}
            <button
              type="button"
              onClick={() => playAlert(mode === "interval" ? "final_cycle" : "phase")}
              className="rounded-lg p-1.5 cursor-pointer hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Ascolta fischietto"
            >
              <Volume2 className="size-4" />
            </button>

            {/* Riduci a Linguetta / Segnalibro nell'Header */}
            <button
              type="button"
              onClick={handleMinimize}
              className="rounded-lg p-1.5 cursor-pointer hover:bg-zinc-800 text-zinc-400 hover:text-[#e3ff00] transition-colors"
              title="Riduci a linguetta nell'Header"
            >
              <Minimize2 className="size-4" />
            </button>

            {/* Chiudi */}
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1.5 cursor-pointer hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              aria-label="Chiudi timer"
              title="Chiudi"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Contenuto Timer Scrollabile internamente */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 [scrollbar-width:thin]">
          {/* Selettore Modalità */}
          <div
            className="flex rounded-xl overflow-hidden p-1 shrink-0"
            style={{ background: "#15151e", border: "1px solid #232332" }}
          >
            {(["countdown", "interval"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="flex-1 py-2 text-xs font-black uppercase tracking-wider cursor-pointer transition-all rounded-lg"
                style={{
                  background: mode === m ? "#1c00ff" : "transparent",
                  color: mode === m ? "#ffffff" : "#a1a1aa",
                }}
              >
                {m === "countdown" ? "Countdown" : "Circuito / Interval"}
              </button>
            ))}
          </div>

          {mode === "countdown" ? (
            <CountdownPanel cdLeft={countdownLeft} cdPct={cdPct} />
          ) : (
            <IntervalMultiPhasePanel
              activeStep={activeStep}
              phaseColor={phaseColor}
              phasePct={phasePct}
            />
          )}

          {/* Comandi Principali (Reset & Play/Pause) */}
          <div className="flex items-center justify-center gap-6 pt-2 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="size-12 cursor-pointer flex items-center justify-center rounded-full border transition-all hover:scale-105 active:scale-95"
              style={{
                background: "#181822",
                borderColor: "#303042",
                color: "#e4e4e7",
              }}
              aria-label="Reset"
              title="Azzera"
            >
              <RotateCcw className="size-5" />
            </button>

            <button
              type="button"
              onClick={handlePlayPause}
              className="size-16 cursor-pointer flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
              style={{
                background: "#1c00ff",
                border: "2.5px solid #e3ff00",
                color: "#e3ff00",
                boxShadow: "0 0 24px rgba(28,0,255,0.55)",
              }}
              aria-label={running ? "Pausa" : "Avvia"}
              title={running ? "Pausa" : "Avvia"}
            >
              {running ? (
                <Pause className="size-7 text-[#e3ff00]" />
              ) : (
                <Play className="size-7 ml-0.5 text-[#e3ff00]" />
              )}
            </button>

            <div className="size-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// 3. PANNELLO COUNTDOWN (Con step rapidi da 5" e 60")
// ==============================================================================
function CountdownPanel({ cdLeft, cdPct }: { cdLeft: number; cdPct: number }) {
  const { state, adjustCountdown } = useTimer();
  const alertColor = cdLeft <= 5 ? "#ea580c" : "#e3ff00";

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1.5 py-2">
        <span
          className="text-6xl font-black tabular-nums transition-colors tracking-tight font-mono"
          style={{
            color: alertColor,
            textShadow:
              alertColor === "#e3ff00"
                ? "0 0 24px rgba(227,255,0,0.35)"
                : "0 0 24px rgba(234,88,12,0.5)",
          }}
        >
          {fmt(cdLeft)}
        </span>
        <div className="w-full h-2.5 rounded-full overflow-hidden bg-zinc-800 mt-2">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${cdPct}%`, background: alertColor }}
          />
        </div>
      </div>

      {/* Regolazione Rapida: -60", -5", +5", +60" (Touch target generoso) */}
      {!state.running && (
        <div className="flex items-center justify-center gap-2">
          {[-60, -5, +5, +60].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => adjustCountdown(d)}
              className="h-11 px-3.5 rounded-xl font-mono text-sm font-black tracking-wide cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
              style={{
                background: d > 0 ? "rgba(28,0,255,0.3)" : "#181822",
                color: d > 0 ? "#e3ff00" : "#d4d4d8",
                border: d > 0 ? "1.5px solid #1c00ff" : "1.5px solid #2a2a3a",
              }}
            >
              {d > 0 ? `+${d}"` : `${d}"`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// 4. PANNELLO INTERVAL TRAINING MULTI-FASE / CIRCUITO
// ==============================================================================
function IntervalMultiPhasePanel({
  activeStep,
  phaseColor,
  phasePct,
}: {
  activeStep: IntervalStep;
  phaseColor: string;
  phasePct: number;
}) {
  const {
    state,
    adjustStepTime,
    toggleStepType,
    addStep,
    removeStep,
    moveStep,
    adjustRounds,
  } = useTimer();

  const steps = state.steps.length > 0 ? state.steps : DEFAULT_STEPS;
  const isRunning = state.running;

  // Calcolo durata totale circuito
  const totalRoundSecs = steps.reduce((sum, s) => sum + s.durataSecs, 0);
  const totalWorkoutSecs = totalRoundSecs * state.rounds;

  return (
    <div className="space-y-3.5">
      {isRunning ? (
        <div className="flex flex-col items-center gap-2 py-2">
          {/* Badge Fase Corrente */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-xs"
              style={{
                background: phaseColor,
                color: "#09090b",
              }}
            >
              {activeStep.tipo === "work" ? "🔥 LAVORO" : "⏸️ RECUPERO"} • {activeStep.nome}
            </span>
            <span className="text-xs font-black text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded-full">
              Round {state.currentRound}/{state.rounds}
            </span>
          </div>

          {/* Timer Gigante */}
          <span
            className="text-6xl sm:text-7xl font-black tabular-nums tracking-tight font-mono"
            style={{
              color: phaseColor,
              textShadow: `0 0 24px ${phaseColor}50`,
            }}
          >
            {fmt(state.phaseLeft)}
          </span>

          {/* Barra di Progresso */}
          <div className="w-full h-2.5 rounded-full overflow-hidden bg-zinc-800 mt-1">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${phasePct}%`, background: phaseColor }}
            />
          </div>

          <div className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-wider">
            Fase {state.currentStepIndex + 1} di {steps.length}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Header durata totale */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#15151e] border border-zinc-800">
            <div>
              <div className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                Circuito ({steps.length} Fasi)
              </div>
              <div className="text-xs font-bold text-zinc-300 mt-0.5">
                1 Round = <span className="font-mono text-white">{fmt(totalRoundSecs)}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-[#e3ff00] tabular-nums font-mono leading-none">
                {fmt(totalWorkoutSecs)}
              </div>
              <div className="text-[10px] text-zinc-400 uppercase font-black tracking-wider mt-1">
                Durata Totale
              </div>
            </div>
          </div>

          {/* Lista Fasi / Strisce con Riordinamento Touch e Pulsanti Maggiorati 44-48px */}
          <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 [scrollbar-width:thin]">
            {steps.map((step, idx) => {
              const isWork = step.tipo === "work";
              const isFirst = idx === 0;
              const isLast = idx === steps.length - 1;

              return (
                <div
                  key={step.id}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isWork
                      ? "border-sky-500/40 bg-[#0f172a]/80"
                      : "border-emerald-500/40 bg-[#064e3b]/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Controlli Riordinamento Touch (Frecce Su/Giù) + Toggle Lavoro/Riposo */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Pulsanti Rapidi Touch Riordinamento */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveStep(idx, "up")}
                          disabled={isFirst}
                          className={`size-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
                            isFirst
                              ? "opacity-20 cursor-not-allowed text-zinc-600"
                              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 active:scale-90"
                          }`}
                          title="Sposta blocco in su"
                          aria-label="Sposta blocco in su"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(idx, "down")}
                          disabled={isLast}
                          className={`size-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
                            isLast
                              ? "opacity-20 cursor-not-allowed text-zinc-600"
                              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 active:scale-90"
                          }`}
                          title="Sposta blocco in giù"
                          aria-label="Sposta blocco in giù"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </div>

                      {/* Toggle Lavoro / Riposo */}
                      <button
                        type="button"
                        onClick={() => toggleStepType(step.id)}
                        className="text-[11px] font-black uppercase px-2.5 py-1 rounded-md cursor-pointer transition-all shadow-xs shrink-0"
                        style={{
                          background: isWork ? "#38bdf8" : "#10b981",
                          color: "#09090b",
                        }}
                        title="Tocca per invertire Lavoro / Recupero"
                      >
                        {isWork ? "Lavoro" : "Pausa"}
                      </button>

                      {/* Nome Striscia */}
                      <span className="text-xs font-bold text-zinc-200 truncate max-w-[85px] sm:max-w-[110px]">
                        {step.nome}
                      </span>
                    </div>

                    {/* Controlli Durata Fase: Pulsanti + e - touch target 44-48px ben distanziati */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => adjustStepTime(step.id, -5)}
                        className="size-11 flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xl font-black cursor-pointer active:scale-90 transition-transform border border-zinc-700"
                        aria-label="Riduci 5 secondi"
                      >
                        -
                      </button>

                      <span className="text-base font-black tabular-nums w-10 text-center text-white font-mono">
                        {step.durataSecs}"
                      </span>

                      <button
                        type="button"
                        onClick={() => adjustStepTime(step.id, +5)}
                        className="size-11 flex items-center justify-center rounded-xl bg-[#1c00ff] hover:bg-[#1600cc] text-white text-xl font-black cursor-pointer active:scale-90 transition-transform border border-blue-500 shadow-xs"
                        aria-label="Aumenta 5 secondi"
                      >
                        +
                      </button>

                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(step.id)}
                          className="size-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 cursor-pointer ml-0.5 transition-colors"
                          title="Elimina fase"
                          aria-label="Elimina fase"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barra Aggiungi Lavoro, Aggiungi Rec e Regola Round */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addStep("work")}
                className="h-11 px-3 text-xs font-black uppercase tracking-wider rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                title="Aggiungi fase di lavoro"
              >
                <Plus className="size-4 text-sky-400" />
                + Lavoro
              </button>

              <button
                type="button"
                onClick={() => addStep("rest")}
                className="h-11 px-3 text-xs font-black uppercase tracking-wider rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                title="Aggiungi fase di recupero"
              >
                <Plus className="size-4 text-emerald-400" />
                + Pausa
              </button>
            </div>

            {/* Selettore Round con pulsanti ergonomici */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                Giri:
              </span>
              <div className="flex items-center gap-1 bg-[#15151e] border border-zinc-800 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => adjustRounds(-1)}
                  className="size-9 flex items-center justify-center rounded-lg text-lg font-black text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:scale-90 cursor-pointer"
                  aria-label="Riduci rounds"
                >
                  -
                </button>
                <span className="text-sm font-black text-[#e3ff00] tabular-nums font-mono w-6 text-center">
                  {state.rounds}
                </span>
                <button
                  type="button"
                  onClick={() => adjustRounds(+1)}
                  className="size-9 flex items-center justify-center rounded-lg text-lg font-black text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:scale-90 cursor-pointer"
                  aria-label="Aumenta rounds"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Default export di retrocompatibilità
export default FloatingTimerModal;