import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Play, Pause, RefreshCw, Volume2, AlertCircle } from "lucide-react";

interface AudioFeedbackRecorderProps {
  onAudioRecorded: (audioData: { blob: Blob; base64: string; durationSec: number }) => void;
  onAudioCleared?: () => void;
  maxDurationSec?: number;
  label?: string;
  className?: string;
}

export function AudioFeedbackRecorder({
  onAudioRecorded,
  onAudioCleared,
  maxDurationSec = 60,
  label = "Registra impressione vocale a caldo",
  className = "",
}: AudioFeedbackRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [totalRecordedSec, setTotalRecordedSec] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Pulisci risorse al dismount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  const getBestMimeType = (): string => {
    if (typeof MediaRecorder === "undefined") return "";
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
      "audio/ogg;codecs=opus",
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return "";
  };

  const startRecording = async () => {
    setPermissionError(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setPermissionError("Il tuo browser non supporta la registrazione vocale diretta.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Chiudi le tracce del microfono
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Converti in Base64 per invio API deterministico
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64 = reader.result as string;
          onAudioRecorded({
            blob,
            base64,
            durationSec: recordingSeconds || 1,
          });
        };
      };

      mediaRecorder.start(250); // Raccogli dati ogni 250ms
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= maxDurationSec) {
            stopRecording();
            return maxDurationSec;
          }
          return next;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Errore accesso microfono:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionError("Permesso microfono negato. Concedi l'accesso per registrare.");
      } else {
        setPermissionError("Impossibile accedere al microfono: " + (err.message || "Errore sconosciuto"));
      }
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setTotalRecordedSec(recordingSeconds);
    setIsRecording(false);
  };

  const clearRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingSeconds(0);
    setTotalRecordedSec(0);
    setIsPlaying(false);
    if (onAudioCleared) onAudioCleared();
  };

  const togglePlayback = () => {
    if (!audioElementRef.current) return;
    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className={`p-3.5 rounded-2xl bg-zinc-950 text-white border border-zinc-800 shadow-md ${className}`}>
      {/* Intestazione */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-[#1c00ff] text-[#e3ff00]">
            <Mic className="size-3.5" />
          </div>
          <span className="text-xs font-black tracking-tight text-zinc-100">{label}</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-400">
          Max {maxDurationSec}s
        </span>
      </div>

      {permissionError && (
        <div className="mb-2.5 p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-red-400" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* STATO 1: IDLE (Inizia a registrare) */}
      {!isRecording && !audioUrl && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-zinc-400 max-w-[210px] leading-snug">
            Tocca il microfono per parlare a voce libera (verrà trascritta e analizzata dall'AI).
          </p>
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1c00ff] hover:bg-[#1600cc] text-white font-black text-xs shadow-md shadow-[#1c00ff]/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <Mic className="size-4 text-[#e3ff00]" />
            <span>Registra</span>
          </button>
        </div>
      )}

      {/* STATO 2: RECORDING IN CORSO */}
      {isRecording && (
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            {/* Animazione Onde Sonore Athletic Fluo */}
            <div className="flex items-end gap-1 h-5">
              <span className="w-1 bg-[#e3ff00] rounded-full animate-bounce h-3" />
              <span className="w-1 bg-[#e3ff00] rounded-full animate-bounce h-5 [animation-delay:150ms]" />
              <span className="w-1 bg-[#e3ff00] rounded-full animate-bounce h-2 [animation-delay:300ms]" />
              <span className="w-1 bg-[#e3ff00] rounded-full animate-bounce h-4 [animation-delay:450ms]" />
            </div>

            <div className="text-xs font-mono font-black text-[#e3ff00] tabular-nums">
              REC {formatTime(recordingSeconds)} / {formatTime(maxDurationSec)}
            </div>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition-all cursor-pointer animate-pulse"
          >
            <Square className="size-3.5 fill-current" />
            <span>Ferma</span>
          </button>
        </div>
      )}

      {/* STATO 3: REGISTRAZIONE COMPLETATA (Player & Gestione) */}
      {!isRecording && audioUrl && (
        <div className="space-y-2 pt-1">
          <audio
            ref={audioElementRef}
            src={audioUrl}
            onTimeUpdate={(e) => setPlaybackTime(Math.floor(e.currentTarget.currentTime))}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayback}
                className="size-8 rounded-lg bg-[#1c00ff] text-[#e3ff00] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                title={isPlaying ? "Pausa" : "Ascolta"}
              >
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
              </button>

              <div className="text-xs font-mono text-zinc-300">
                <span>{formatTime(playbackTime)}</span>
                <span className="text-zinc-500"> / {formatTime(totalRecordedSec)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={startRecording}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1"
                title="Ricomincia registrazione"
              >
                <RefreshCw className="size-3.5" />
                <span>Rifai</span>
              </button>

              <button
                type="button"
                onClick={clearRecording}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Elimina nota audio"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold px-1">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Audio pronto • Verrà allegato e analizzato al salvataggio
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
