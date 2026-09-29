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
  Plus,
  Trash2,
  Clock,
  Layers,
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

type Mode = "countdown" | "interval";

export interface IntervalStep {
  id: string;
  nome: string;
  durataSecs: number;
  tipo: "work" | "rest";
}

interface TimerState {
  mode: Mode;
  running: boolean;
  minimized: boolean;
  open: boolean;
  countdownTotal: number;
  countdownLeft: number;
  // Interval Multi-Fase / Circuito
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

const DEFAULT: TimerState = {
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
function fmt(s: number) {
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export default function FloatingTimer() {
  const [state, setState] = useState<TimerState>(DEFAULT);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Posizione per finestra aperta
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  // Posizione per icona chiusa (Draggable su mobile!)
  const [iconPosition, setIconPosition] = useState<{ x: number; y: number } | null>(null);
  const iconRef = useRef<HTMLButtonElement | null>(null);
  const iconDragRef = useRef({ isDragging: false, hasMoved: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

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
      const curStep = steps[prev.currentStepIndex] || steps[0];
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

  // ==============================================================================
  // GESTIONE TRASCINAMENTO FINESTRA APERTA
  // ==============================================================================
  const onPointerDownDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("input")) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
      const phoneContainer = isMobile ? null : containerRef.current.closest("#phone-frame");
      const phoneRect = phoneContainer
        ? phoneContainer.getBoundingClientRect()
        : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
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

        const containerW = phoneContainer ? phoneContainer.clientWidth : window.innerWidth;
        const containerH = phoneContainer ? phoneContainer.clientHeight : window.innerHeight;
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

  // ==============================================================================
  // GESTIONE TRASCINAMENTO ICONA CHIUSA (DRAGGABLE SULLO SCHERMO)
  // ==============================================================================
  const onPointerDownIconDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    if (!iconRef.current) return;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const phoneContainer = isMobile ? null : iconRef.current.closest("#phone-frame");
    const phoneRect = phoneContainer
      ? phoneContainer.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const rect = iconRef.current.getBoundingClientRect();

    iconDragRef.current = {
      isDragging: true,
      hasMoved: false,
      startX: clientX,
      startY: clientY,
      initialX: rect.left - phoneRect.left,
      initialY: rect.top - phoneRect.top,
    };

    function onPointerMove(moveEvent: MouseEvent | TouchEvent) {
      if (!iconDragRef.current.isDragging) return;
      const curX = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = curX - iconDragRef.current.startX;
      const deltaY = curY - iconDragRef.current.startY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        iconDragRef.current.hasMoved = true;
      }

      const newX = iconDragRef.current.initialX + deltaX;
      const newY = iconDragRef.current.initialY + deltaY;

      const containerW = phoneContainer ? phoneContainer.clientWidth : window.innerWidth;
      const containerH = phoneContainer ? phoneContainer.clientHeight : window.innerHeight;
      const clampedX = Math.max(8, Math.min(containerW - 56, newX));
      const clampedY = Math.max(48, Math.min(containerH - 76, newY));

      setIconPosition({ x: clampedX, y: clampedY });
    }

    function onPointerUp() {
      if (!iconDragRef.current.hasMoved && iconDragRef.current.isDragging) {
        handleOpen();
      }
      iconDragRef.current.isDragging = false;
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
    }

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp);
  };

  function handleOpen() {
    ensureAudio();
    setState((s) => ({ ...s, open: true, minimized: false }));
  }
  function handleClose() {
    setState((s) => ({ ...s, open: false, running: false }));
    setIconPosition(null);
    setPosition(null);
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
  }
  function handleReset() {
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
  }
  function setMode(newMode: Mode) {
    setState((s) => {
      const first = s.steps[0] || DEFAULT_STEPS[0];
      return {
        ...s,
        mode: newMode,
        running: false,
        countdownLeft: s.countdownTotal,
        currentStepIndex: 0,
        currentRound: 1,
        phaseLeft: first.durataSecs,
      };
    });
  }

  const { mode, running, minimized, open } = state;
  const cdLeft = state.countdownLeft;
  const cdPct =
    state.countdownTotal > 0
      ? Math.round((cdLeft / state.countdownTotal) * 100)
      : 0;

  // Dati step interval corrente
  const steps = state.steps.length > 0 ? state.steps : DEFAULT_STEPS;
  const activeStep = steps[state.currentStepIndex] || steps[0];
  const totalPhaseSecs = activeStep.durataSecs;
  const phasePct =
    totalPhaseSecs > 0 ? Math.round((state.phaseLeft / totalPhaseSecs) * 100) : 0;
  const phaseColor = activeStep.tipo === "work" ? "#38bdf8" : "#fb923c";

  if (typeof document === "undefined") return null;

  // ==============================================================================
  // ICONA FLOTTANTE TRASCINABILE (QUANDO CHIUSO)
  // ==============================================================================
  if (!open) {
    const iconStyle: React.CSSProperties = iconPosition
      ? { left: `${iconPosition.x}px`, top: `${iconPosition.y}px` }
      : { bottom: "84px", right: "16px" };

    return (
      <button
        ref={iconRef}
        onMouseDown={onPointerDownIconDrag}
        onTouchStart={onPointerDownIconDrag}
        className="fixed sm:absolute flex size-13 cursor-grab active:cursor-grabbing items-center justify-center rounded-full shadow-2xl transition-transform hover:scale-105 active:scale-95 z-50 select-none"
        style={{
          ...iconStyle,
          background: "#1c00ff",
          border: "2.5px solid #e3ff00",
          color: "#e3ff00",
          boxShadow: "0 8px 24px rgba(28,0,255,0.55), 0 0 12px rgba(227,255,0,0.3)",
        }}
        aria-label="Apri o trascina timer"
        title="Tocca per aprire, o trascina per spostare l'icona"
      >
        <Timer className="size-6 text-[#e3ff00]" />
      </button>
    );
  }

  // Posizionamento finestra aperta
  const positionStyle: React.CSSProperties = position
    ? { top: `${position.y}px`, left: `${position.x}px` }
    : { bottom: "84px", left: "12px" };

  return (
    <div
      ref={containerRef}
      className="fixed sm:absolute w-[calc(100%-24px)] max-w-[416px] rounded-2xl shadow-2xl overflow-hidden select-none transition-shadow z-50 text-white"
      style={{
        ...positionStyle,
        border: "2px solid #1c00ff",
        background: "#0d0d12",
        boxShadow: "0 20px 45px -8px rgba(0,0,0,0.65), 0 0 20px rgba(28,0,255,0.3)",
      }}
    >
      {/* Header Trascinabile Finestra Aperta */}
      <div
        onMouseDown={onPointerDownDrag}
        onTouchStart={onPointerDownDrag}
        className="flex items-center justify-between px-3.5 py-2.5 cursor-grab active:cursor-grabbing"
        style={{ borderBottom: "1px solid #232332", background: "#15151e" }}
        title="Trascina per spostare il timer"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <GripHorizontal className="size-4 text-zinc-500 mr-0.5" />
          <img src="/logo-area46-transparent.png" alt="Area46" className="h-4 w-auto object-contain brightness-125" />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Timer Lab
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Test acustico fischietto */}
          <button
            onClick={() =>
              playAlert(mode === "interval" ? "final_cycle" : "phase")
            }
            className="rounded p-1 cursor-pointer hover:bg-zinc-800 transition-colors"
            title="Ascolta fischietto"
          >
            <Volume2 className="size-4 text-zinc-400 hover:text-white" />
          </button>

          {/* Riduci a pillola */}
          <button
            onClick={handleMinimize}
            className="rounded p-1 cursor-pointer hover:bg-zinc-800 transition-colors"
            title={minimized ? "Espandi" : "Riduci"}
          >
            {minimized ? (
              <Maximize2 className="size-4 text-zinc-400 hover:text-white" />
            ) : (
              <Minimize2 className="size-4 text-zinc-400 hover:text-white" />
            )}
          </button>

          {/* Chiudi */}
          <button
            onClick={handleClose}
            className="rounded p-1 cursor-pointer hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
            aria-label="Chiudi timer"
            title="Chiudi"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {minimized ? (
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-900/60 transition-colors"
          onClick={handleMinimize}
          style={{ background: "#0d0d12" }}
        >
          <span
            className="text-2xl font-black tabular-nums"
            style={{
              color:
                mode === "countdown"
                  ? cdLeft <= 5
                    ? "#ea580c"
                    : "#e3ff00"
                  : phaseColor,
            }}
          >
            {mode === "countdown" ? fmt(cdLeft) : fmt(state.phaseLeft)}
          </span>
          {mode === "interval" && (
            <span
              className="text-xs font-black rounded-full px-2.5 py-0.5"
              style={{ background: phaseColor, color: "#09090b" }}
            >
              {activeStep.nome.toUpperCase()} ({state.currentRound}/{state.rounds})
            </span>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Selettore Modalità */}
          <div
            className="flex rounded-xl overflow-hidden p-1"
            style={{ background: "#15151e", border: "1px solid #232332" }}
          >
            {(["countdown", "interval"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-1.5 text-xs font-black uppercase tracking-wider cursor-pointer transition-all rounded-lg"
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
            <CountdownPanel
              state={state}
              setState={setState}
              cdLeft={cdLeft}
              cdPct={cdPct}
            />
          ) : (
            <IntervalMultiPhasePanel
              state={state}
              setState={setState}
              activeStep={activeStep}
              phaseColor={phaseColor}
              phasePct={phasePct}
            />
          )}

          {/* Comandi Principali (Reset & Play/Pause) */}
          <div className="flex items-center justify-center gap-6 pt-1">
            <button
              onClick={handleReset}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full border transition-all hover:scale-105 active:scale-95"
              style={{
                background: "#181822",
                borderColor: "#303042",
                color: "#e4e4e7",
              }}
              aria-label="Reset"
              title="Azzera"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              onClick={handlePlayPause}
              className="flex size-14 cursor-pointer items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
              style={{
                background: "#1c00ff",
                border: "2px solid #e3ff00",
                color: "#e3ff00",
                boxShadow: "0 0 24px rgba(28,0,255,0.55)",
              }}
              aria-label={running ? "Pausa" : "Avvia"}
              title={running ? "Pausa" : "Avvia"}
            >
              {running ? (
                <Pause className="size-6 text-[#e3ff00]" />
              ) : (
                <Play className="size-6 ml-0.5 text-[#e3ff00]" />
              )}
            </button>
            <div className="size-11" />
          </div>
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// PANNELLO COUNTDOWN (Con step da 5" e 60" come richiesto dal Coach)
// ==============================================================================
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
  const alertColor = cdLeft <= 5 ? "#ea580c" : "#e3ff00";

  function adjustTime(delta: number) {
    if (state.running) return;
    setState((s) => {
      const newTotal = Math.max(5, s.countdownTotal + delta);
      return { ...s, countdownTotal: newTotal, countdownLeft: newTotal };
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1.5">
        <span
          className="text-5xl font-black tabular-nums transition-colors tracking-tight"
          style={{
            color: alertColor,
            textShadow:
              alertColor === "#e3ff00"
                ? "0 0 20px rgba(227,255,0,0.3)"
                : "0 0 20px rgba(234,88,12,0.4)",
          }}
        >
          {fmt(cdLeft)}
        </span>
        <div className="w-full h-2 rounded-full overflow-hidden bg-zinc-800 mt-1">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${cdPct}%`, background: alertColor }}
          />
        </div>
      </div>

      {/* Regolazione Rapida: -60", -5", +5", +60" (Tassativo richiesta Coach) */}
      {!state.running && (
        <div className="flex items-center justify-center gap-2">
          {[-60, -5, +5, +60].map((d) => (
            <button
              key={d}
              onClick={() => adjustTime(d)}
              className="rounded-xl px-3 py-1.5 text-xs font-black cursor-pointer transition-all hover:scale-105 active:scale-95"
              style={{
                background: d > 0 ? "rgba(28,0,255,0.3)" : "#181822",
                color: d > 0 ? "#e3ff00" : "#d4d4d8",
                border: d > 0 ? "1px solid #1c00ff" : "1px solid #2a2a3a",
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
// PANNELLO INTERVAL TRAINING MULTI-FASE / CIRCUITO (Fasi e tempi differenti)
// ==============================================================================
function IntervalMultiPhasePanel({
  state,
  setState,
  activeStep,
  phaseColor,
  phasePct,
}: {
  state: TimerState;
  setState: React.Dispatch<React.SetStateAction<TimerState>>;
  activeStep: IntervalStep;
  phaseColor: string;
  phasePct: number;
}) {
  const steps = state.steps.length > 0 ? state.steps : DEFAULT_STEPS;
  const isRunning = state.running;

  // Calcolo durata totale circuito
  const totalRoundSecs = steps.reduce((sum, s) => sum + s.durataSecs, 0);
  const totalWorkoutSecs = totalRoundSecs * state.rounds;

  function adjustStepTime(stepId: string, delta: number) {
    if (state.running) return;
    setState((s) => {
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
  }

  function toggleStepType(stepId: string) {
    if (state.running) return;
    setState((s) => ({
      ...s,
      steps: s.steps.map((st) =>
        st.id === stepId
          ? {
              ...st,
              tipo: st.tipo === "work" ? "rest" : "work",
              nome: st.tipo === "work" ? "Recupero" : `Esercizio ${st.id.replace("s", "")}`,
            }
          : st
      ),
    }));
  }

  function addStep() {
    if (state.running) return;
    setState((s) => {
      const newIndex = s.steps.length + 1;
      const newStep: IntervalStep = {
        id: `s${Date.now()}`,
        nome: `Esercizio ${newIndex}`,
        durataSecs: 30,
        tipo: "work",
      };
      return { ...s, steps: [...s.steps, newStep] };
    });
  }

  function removeStep(stepId: string) {
    if (state.running || state.steps.length <= 1) return;
    setState((s) => {
      const filtered = s.steps.filter((st) => st.id !== stepId);
      return {
        ...s,
        steps: filtered,
        currentStepIndex: 0,
        phaseLeft: filtered[0].durataSecs,
      };
    });
  }

  function adjustRounds(delta: number) {
    if (state.running) return;
    setState((s) => ({ ...s, rounds: Math.max(1, s.rounds + delta) }));
  }

  return (
    <div className="space-y-3.5">
      {isRunning ? (
        <div className="flex flex-col items-center gap-1.5 py-1">
          {/* Badge Fase Corrente */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full"
              style={{
                background: phaseColor,
                color: "#09090b",
              }}
            >
              {activeStep.tipo === "work" ? "LAVORO" : "RECUPERO"} • {activeStep.nome}
            </span>
            <span className="text-xs font-black text-zinc-400">
              Round {state.currentRound}/{state.rounds}
            </span>
          </div>

          {/* Timer Gigante */}
          <span
            className="text-5xl font-black tabular-nums tracking-tight"
            style={{
              color: phaseColor,
              textShadow: `0 0 20px ${phaseColor}40`,
            }}
          >
            {fmt(state.phaseLeft)}
          </span>

          {/* Barra di Progresso */}
          <div className="w-full h-2 rounded-full overflow-hidden bg-zinc-800 mt-1">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${phasePct}%`, background: phaseColor }}
            />
          </div>

          <div className="text-xs text-zinc-400 mt-1">
            Fase {state.currentStepIndex + 1} di {steps.length}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Header durata totale */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#15151e] border border-zinc-800">
            <div>
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Circuito ({steps.length} Fasi)
              </div>
              <div className="text-xs text-zinc-300">
                1 Round = {fmt(totalRoundSecs)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-[#e3ff00] tabular-nums leading-none">
                {fmt(totalWorkoutSecs)}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">
                Durata Totale
              </div>
            </div>
          </div>

          {/* Lista Fasi / Esercizi Differenziati (Scrollabile) */}
          <div className="max-h-[175px] overflow-y-auto space-y-1.5 pr-1 [scrollbar-width:thin]">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className="flex items-center justify-between p-2 rounded-xl border border-zinc-800 bg-[#12121a]"
              >
                {/* Nome e Toggle Tipo Lavoro/Riposo */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleStepType(step.id)}
                    className="text-[10px] font-black uppercase px-2 py-0.5 rounded cursor-pointer transition-all"
                    style={{
                      background: step.tipo === "work" ? "#38bdf8" : "#fb923c",
                      color: "#09090b",
                    }}
                    title="Clicca per invertire Lavoro / Riposo"
                  >
                    {step.tipo === "work" ? "Lavoro" : "Pausa"}
                  </button>
                  <span className="text-xs font-bold text-zinc-200 truncate max-w-[90px]">
                    {step.nome}
                  </span>
                </div>

                {/* Controlli Durata Fase (-5s / +5s) */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustStepTime(step.id, -5)}
                    className="size-6 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-black cursor-pointer active:scale-95"
                  >
                    -
                  </button>
                  <span className="text-xs font-black tabular-nums w-10 text-center text-white">
                    {step.durataSecs}"
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustStepTime(step.id, +5)}
                    className="size-6 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-black cursor-pointer active:scale-95"
                  >
                    +
                  </button>

                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(step.id)}
                      className="size-6 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 cursor-pointer ml-1"
                      title="Elimina fase"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Barra Aggiungi Fase e Regola Round */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800">
            <button
              type="button"
              onClick={addStep}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="size-3.5 text-[#e3ff00]" />
              Aggiungi Fase
            </button>

            {/* Selettore Round */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Round:
              </span>
              <div className="flex items-center gap-1 bg-[#15151e] border border-zinc-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => adjustRounds(-1)}
                  className="size-6 flex items-center justify-center rounded text-xs font-black text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                >
                  -
                </button>
                <span className="text-xs font-black text-[#e3ff00] tabular-nums w-5 text-center">
                  {state.rounds}
                </span>
                <button
                  type="button"
                  onClick={() => adjustRounds(+1)}
                  className="size-6 flex items-center justify-center rounded text-xs font-black text-zinc-300 hover:bg-zinc-700 cursor-pointer"
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