import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Sparkles, Check, X, Loader2, Volume2 } from "lucide-react";
import { toast } from "./Toast";

interface VoiceSetLoggerModalProps {
  open: boolean;
  onClose: () => void;
  setIndex: number;
  targetPrescrizione?: string;
  onApplyParsedSet: (result: {
    carico_kg: number | null;
    ripetizioni: number | null;
    rpe: string | null;
    note: string | null;
  }) => void;
}

export const VoiceSetLoggerModal: React.FC<VoiceSetLoggerModalProps> = ({
  open,
  onClose,
  setIndex,
  targetPrescrizione,
  onApplyParsedSet,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsedPreview, setParsedPreview] = useState<{
    carico_kg: number | null;
    ripetizioni: number | null;
    rpe: string | null;
    note: string | null;
  } | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup alla chiusura
  useEffect(() => {
    if (!open) {
      stopRecording();
      setTranscript("");
      setParsedPreview(null);
      setIsAnalyzing(false);
    }
  }, [open]);

  const startRecording = async () => {
    setTranscript("");
    setParsedPreview(null);
    audioChunksRef.current = [];

    // 1. Prova Web Speech API se disponibile nel browser
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    let speechStarted = false;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "it-IT";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let currentText = "";
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript + " ";
          }
          setTranscript(currentText.trim());
        };

        recognition.onerror = (e: any) => {
          console.warn("Speech recognition notice:", e.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
        speechStarted = true;
      } catch (e) {
        console.warn("Web Speech API non avviata, fallback a MediaRecorder:", e);
      }
    }

    // 2. Avvia MediaRecorder per cattura audio se microfono consentito
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
    } catch (e) {
      console.warn("MediaRecorder mic non disponibile o non autorizzato:", e);
    }

    setIsRecording(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(25);
      } catch {}
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  const handleStopAndAnalyze = async () => {
    stopRecording();
    setIsAnalyzing(true);

    try {
      let audioBase64 = "";
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        audioBase64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      }

      const res = await fetch("/app-api/ai-parse-voice-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript.trim() || undefined,
          audioBase64: audioBase64 || undefined,
          mimeType: "audio/webm",
          targetPrescrizione: targetPrescrizione || undefined,
        }),
      });

      if (!res.ok) throw new Error("Errore chiamata endpoint AI");
      const data = await res.json();

      if (data.success) {
        setParsedPreview({
          carico_kg: data.carico_kg,
          ripetizioni: data.ripetizioni,
          rpe: data.rpe,
          note: data.note,
        });

        // Se abbiamo estrapolato i parametri, li applichiamo direttamente o permettiamo conferma
        toast.success(`Set ${setIndex + 1} interpretato dall'Agente AI!`);
      } else {
        toast.error("Nessun parametro rilevato con chiarezza. Riprova dettando carico e ripetizioni.");
      }
    } catch (e) {
      toast.error("Errore nell'analisi della registrazione vocale.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (parsedPreview) {
      onApplyParsedSet(parsedPreview);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-[#09090b] text-white shadow-2xl p-5 flex flex-col items-center text-center relative overflow-hidden"
        style={{
          boxShadow: "0 0 50px rgba(28, 0, 255, 0.25), 0 20px 40px rgba(0, 0, 0, 0.9)",
        }}
      >
        {/* Glow circolare di fondo */}
        <div className="absolute -top-12 -right-12 size-36 rounded-full bg-[#1c00ff]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 size-36 rounded-full bg-[#e3ff00]/10 blur-3xl pointer-events-none" />

        {/* Tasto Chiudi */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c00ff]/20 border border-[#1c00ff]/40 mb-3 text-[11px] font-black uppercase tracking-wider text-[#e3ff00]">
          <Sparkles className="size-3 text-[#e3ff00]" />
          <span>Agente Voice Workout • Serie {setIndex + 1}</span>
        </div>

        <h3 className="text-lg font-black text-white tracking-tight">
          Dettatura Rapida Set
        </h3>
        <p className="text-xs text-zinc-400 mt-1 max-w-[280px]">
          Tocca il microfono e detta durante il recupero.
          <br />
          <span className="italic text-zinc-500">
            Es: “6 ripetizioni con 50 kg, RPE credo fra 7.5 e 8.5”
          </span>
        </p>

        {/* Pulsante Microfono Pulsante Athletic-Luxury */}
        <div className="my-6 relative flex items-center justify-center">
          {isRecording && (
            <>
              <div className="absolute size-28 rounded-full bg-[#1c00ff]/30 animate-ping duration-1000" />
              <div className="absolute size-24 rounded-full border-2 border-[#e3ff00] animate-pulse" />
            </>
          )}

          <button
            type="button"
            onClick={isRecording ? handleStopAndAnalyze : startRecording}
            disabled={isAnalyzing}
            className={`relative size-20 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer active:scale-95 ${
              isRecording
                ? "bg-red-600 text-white shadow-red-600/50"
                : "text-white hover:scale-105"
            }`}
            style={{
              background: isRecording ? "#dc2626" : "#1c00ff",
              border: isRecording ? "2px solid #ffffff" : "2.5px solid #e3ff00",
            }}
          >
            {isAnalyzing ? (
              <Loader2 className="size-8 animate-spin text-[#e3ff00]" />
            ) : isRecording ? (
              <MicOff className="size-8 text-white" />
            ) : (
              <Mic className="size-8 text-[#e3ff00]" />
            )}
          </button>
        </div>

        {/* Testo Stato / Trascrizione Live */}
        <div className="w-full min-h-[48px] rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3 mb-4 text-xs text-left">
          {isRecording ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#e3ff00] font-bold">
                <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                <span>In ascolto... Parla ora</span>
              </div>
              <p className="text-zinc-200 font-medium italic">
                {transcript || "Dì ad esempio: '8 colpi a 45 kg RPE 8'..."}
              </p>
            </div>
          ) : isAnalyzing ? (
            <div className="flex items-center gap-2 text-zinc-300 font-medium">
              <Loader2 className="size-4 animate-spin text-[#1c00ff]" />
              <span>Analisi clinico-metodologica e calcolo RPE in corso…</span>
            </div>
          ) : parsedPreview ? (
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Parametri Rilevati:
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
                <div className="bg-zinc-800 p-1.5 rounded-lg">
                  <div className="text-[10px] text-zinc-400 font-bold">CARICO</div>
                  <div className="text-sm font-black text-white">
                    {parsedPreview.carico_kg !== null ? `${parsedPreview.carico_kg} kg` : "N/D"}
                  </div>
                </div>
                <div className="bg-zinc-800 p-1.5 rounded-lg">
                  <div className="text-[10px] text-zinc-400 font-bold">REPS</div>
                  <div className="text-sm font-black text-white">
                    {parsedPreview.ripetizioni !== null ? `${parsedPreview.ripetizioni}` : "N/D"}
                  </div>
                </div>
                <div className="bg-zinc-800 p-1.5 rounded-lg">
                  <div className="text-[10px] text-zinc-400 font-bold">RPE</div>
                  <div className="text-sm font-black text-[#e3ff00]">
                    {parsedPreview.rpe || "N/D"}
                  </div>
                </div>
              </div>
              {parsedPreview.note && (
                <p className="text-[11px] text-zinc-400 italic pt-1">
                  Note: “{parsedPreview.note}”
                </p>
              )}
            </div>
          ) : (
            <p className="text-zinc-500 text-center font-medium">
              Tocca il pulsante per avviare la dettatura
            </p>
          )}
        </div>

        {/* Azioni */}
        <div className="w-full flex gap-2">
          {parsedPreview ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setParsedPreview(null);
                  startRecording();
                }}
                className="flex-1 py-3 px-3 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-bold uppercase hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Riprova
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-[2] py-3 px-3 rounded-xl text-xs font-black text-white shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
                style={{
                  background: "#1c00ff",
                  border: "1.5px solid #e3ff00",
                }}
              >
                <Check className="size-4 text-[#e3ff00]" />
                <span>Applica alla Serie</span>
              </button>
            </>
          ) : isRecording ? (
            <button
              type="button"
              onClick={handleStopAndAnalyze}
              className="w-full py-3 px-4 rounded-xl text-xs font-black text-white shadow-lg cursor-pointer flex items-center justify-center gap-2"
              style={{
                background: "#1c00ff",
                border: "1.5px solid #e3ff00",
              }}
            >
              <Check className="size-4 text-[#e3ff00]" />
              <span>Ferma e Analizza con AI</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-bold uppercase hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Annulla
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
