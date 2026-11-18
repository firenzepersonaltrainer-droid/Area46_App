import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mic,
  Bell,
  X,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Bug,
  Lightbulb,
  HelpCircle,
  EyeOff,
  User,
  Clock,
  Sparkles,
  Smartphone,
  Check,
  Archive,
  RefreshCw,
  Play,
  Pause,
  Trash2,
  RotateCcw,
  Square,
} from "lucide-react";
import { toast } from "sonner";

interface CoachAudioFeedbackDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Lettore Audio Executive Tattile ad alta affidabilita
 * Funziona nativamente con data URI Base64 e file URL senza dipendere da Safari controls
 */
export function ExecutiveAudioPlayer({
  src,
  durationSec = 0,
}: {
  src?: string | null;
  durationSec?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !src) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Impossibile riprodurre audio:", err);
          toast.error("Impossibile riprodurre la nota vocale.");
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (!src) {
    return (
      <div className="p-2.5 rounded-2xl bg-zinc-100 text-zinc-400 text-xs italic flex items-center gap-2">
        <Volume2 className="size-4 opacity-50" />
        Nessun file audio registrato
      </div>
    );
  }

  return (
    <div className="p-3 rounded-2xl bg-zinc-950 text-white flex items-center gap-3 shadow-inner">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        className="size-9 rounded-xl bg-[#e3ff00] text-zinc-950 flex items-center justify-center font-black shrink-0 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
        title={isPlaying ? "Metti in pausa" : "Ascolta nota vocale"}
      >
        {isPlaying ? <Pause className="size-4 fill-zinc-950" /> : <Play className="size-4 fill-zinc-950 ml-0.5" />}
      </button>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-400">
          <span className="text-[#e3ff00]">{formatTime(currentTime)}</span>
          <span>{formatTime(duration || durationSec || 0)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={duration || durationSec || 1}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#e3ff00]"
        />
      </div>

      <Volume2 className="size-4 text-zinc-500 shrink-0" />
    </div>
  );
}

/**
 * Sezione Decisionale Coach Stefano per Prescrizione Seduta Successiva
 * Consente al Coach di scegliere se spingere o alleggerire e pubblicare solo su sua decisione
 */
function CoachAdviceDecisionSection({
  note,
  onSaveAdvice,
  isPending,
}: {
  note: any;
  onSaveAdvice: (data: {
    id: number;
    consiglio_coach?: string;
    consiglio_approvato_coach: boolean;
    giorno_destinazione: string | number;
    tipo_intervento: "spinta" | "scarico" | "consolidamento";
    coach_audio_base64?: string | null;
    coach_audio_url?: string | null;
    coach_audio_durata_sec?: number | null;
  }) => void;
  isPending: boolean;
}) {
  const rawGiorno = note.giorno || "";
  const matchNum = String(rawGiorno).match(/\d+/);
  const nextNum = matchNum ? parseInt(matchNum[0], 10) + 1 : 2;
  const defaultDest = note.giorno_destinazione || nextNum;

  const [tipo, setTipo] = useState<"spinta" | "scarico" | "consolidamento">(
    note.tipo_intervento || (note.ai_allerta === "rosso" || note.ai_allerta === "giallo" ? "scarico" : "spinta")
  );
  const [consiglio, setConsiglio] = useState<string>(
    note.consiglio_coach || note.ai_proposta_azione || ""
  );
  const destGiorno = defaultDest;
  const isApproved = note.consiglio_approvato_coach === true;

  // Stato Registratore Audio Vocale Coach
  const [coachAudioUrl, setCoachAudioUrl] = useState<string | null>(
    note.coach_audio_url || note.coach_audio_base64 || null
  );
  const [coachAudioBase64, setCoachAudioBase64] = useState<string | null>(
    note.coach_audio_base64 || null
  );
  const [coachAudioDuration, setCoachAudioDuration] = useState<number>(
    note.coach_audio_durata_sec || 0
  );
  const [isRecordingCoach, setIsRecordingCoach] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  };

  const startCoachRecording = async () => {
    audioChunksRef.current = [];
    setRecordingSeconds(0);
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
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        const finalUrl = URL.createObjectURL(audioBlob);
        setCoachAudioUrl(finalUrl);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setCoachAudioBase64(base64String);
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecordingCoach(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 90) {
            stopCoachRecording();
            return 90;
          }
          const nextVal = prev + 1;
          setCoachAudioDuration(nextVal);
          return nextVal;
        });
      }, 1000);
    } catch (err) {
      console.error("Errore accesso microfono Coach:", err);
      toast.error("Impossibile accedere al microfono. Verifica i permessi del browser.");
    }
  };

  const stopCoachRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingCoach(false);
  };

  const handleApplyPreset = (newTipo: "spinta" | "scarico" | "consolidamento") => {
    setTipo(newTipo);
    if (newTipo === "spinta") {
      setConsiglio("Ottima risposta: la seduta è risultata agevole e il pattern solido. Nella prossima seduta concediti un incremento di sovraccarico progressivo (+1.25/+2.5 kg) sui movimenti chiave per continuare a spingere.");
    } else if (newTipo === "scarico") {
      setConsiglio("Ho ascoltato la tua nota sull'affaticamento/fastidio avvertito. Per la prossima seduta applicheremo un lavoro più leggero con Modalità B e mobilità a terra per farti recuperare senza stress articolare.");
    } else {
      setConsiglio("Sessione chiusa con successo e ottimo controllo sul pattern motorio! Per la prossima seduta mantieni la stessa qualità e concentrazione esecutiva.");
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="p-3.5 rounded-2xl bg-[#09090b] text-white border-2 border-[#1c00ff] space-y-3 shadow-md">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#e3ff00]">
          <Sparkles className="size-4" />
          <span>Decisione Coach Stefano per Seduta {destGiorno}</span>
        </div>
        {isApproved && (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white flex items-center gap-1 shadow-xs">
            <CheckCircle2 className="size-3" /> Approvato & Visibile all'Atleta
          </span>
        )}
      </div>

      {/* Selezione Rapida Orientamento: Spinta vs Scarico vs Consolida */}
      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => handleApplyPreset("spinta")}
          className={`py-1.5 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
            tipo === "spinta"
              ? "bg-[#e3ff00] text-zinc-950 shadow-md ring-2 ring-[#e3ff00]"
              : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
          }`}
        >
          <span>🚀 Spingi (+Carico)</span>
        </button>

        <button
          type="button"
          onClick={() => handleApplyPreset("scarico")}
          className={`py-1.5 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
            tipo === "scarico"
              ? "bg-rose-500 text-white shadow-md ring-2 ring-rose-400"
              : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
          }`}
        >
          <span>🛡️ Scarico / Cautela</span>
        </button>

        <button
          type="button"
          onClick={() => handleApplyPreset("consolidamento")}
          className={`py-1.5 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
            tipo === "consolidamento"
              ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
              : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
          }`}
        >
          <span>⚖️ Consolida</span>
        </button>
      </div>

      {/* SEZIONE NOTA VOCALE REGISTRATA DAL COACH PER LA SEDUTA SUCCESSIVA */}
      <div className="space-y-1.5 pt-1 border-t border-zinc-800">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1 text-[#e3ff00]">
            <Mic className="size-3.5" /> Risposta Vocale di Stefano per Seduta {destGiorno}:
          </span>
          {coachAudioUrl && (
            <span className="text-[9px] text-emerald-400 font-bold">Nota audio pronta</span>
          )}
        </label>

        {isRecordingCoach ? (
          <div className="p-3 rounded-xl bg-red-950/70 border border-red-500 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-red-500 animate-ping" />
              <div className="text-xs font-mono font-black text-red-200">
                Registrazione Coach: {formatTimer(recordingSeconds)} / 1:30
              </div>
            </div>
            <button
              type="button"
              onClick={stopCoachRecording}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
            >
              <Square className="size-3.5 fill-white" />
              <span>Ferma e Salva</span>
            </button>
          </div>
        ) : coachAudioUrl ? (
          <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-300">
              <span className="text-xs font-bold text-[#e3ff00] flex items-center gap-1">
                🎙️ Nota Vocale Pronta per l'Atleta
              </span>
              <button
                type="button"
                onClick={() => {
                  setCoachAudioUrl(null);
                  setCoachAudioBase64(null);
                  setCoachAudioDuration(0);
                }}
                className="text-[10px] text-zinc-400 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
                title="Elimina nota vocale registrata"
              >
                <Trash2 className="size-3" />
                <span>Ri-registra</span>
              </button>
            </div>
            <ExecutiveAudioPlayer
              src={coachAudioUrl}
              durationSec={coachAudioDuration}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={startCoachRecording}
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 hover:border-[#e3ff00] transition-all cursor-pointer flex items-center justify-center gap-2 text-xs font-bold shadow-xs active:scale-98"
          >
            <Mic className="size-4 text-[#e3ff00]" />
            <span>Registra Nota Vocale di risposta per la Seduta {destGiorno}</span>
          </button>
        )}
      </div>

      {/* Testo del consiglio editabile da Stefano */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
          <span>Testo direttiva per la Seduta {destGiorno}:</span>
          <span className="text-[9px] text-[#e3ff00] font-normal">Modificabile liberamente</span>
        </label>
        <textarea
          value={consiglio}
          onChange={(e) => setConsiglio(e.target.value)}
          rows={2}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-100 font-medium focus:outline-none focus:border-[#1c00ff] leading-relaxed resize-none"
        />
      </div>

      {/* Tasto Approvazione & Pubblicazione Ufficiale */}
      <button
        type="button"
        disabled={isPending || isRecordingCoach}
        onClick={() => {
          onSaveAdvice({
            id: note.id,
            consiglio_coach: consiglio,
            consiglio_approvato_coach: true,
            giorno_destinazione: destGiorno,
            tipo_intervento: tipo,
            coach_audio_base64: coachAudioBase64,
            coach_audio_url: coachAudioUrl,
            coach_audio_durata_sec: coachAudioDuration,
          });
        }}
        className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md ${
          isApproved
            ? "bg-zinc-800 hover:bg-zinc-700 text-[#e3ff00]"
            : "bg-[#1c00ff] hover:bg-[#1600cc] text-white"
        }`}
      >
        <CheckCircle2 className="size-4" />
        <span>
          {isApproved
            ? `Aggiorna Direttiva & Audio per Seduta ${destGiorno} ✓`
            : `Approva e Mostra all'Atleta per Seduta ${destGiorno} ✓`}
        </span>
      </button>
    </div>
  );
}

export function CoachAudioFeedbackDrawer({
  open,
  onClose,
}: CoachAudioFeedbackDrawerProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"workout" | "bug">("workout");
  const [filterStato, setFilterStato] = useState<string>("tutti");

  // Query note audio (tutte dal backend)
  const { data: audioNotes = [], refetch: refetchNotes } = useQuery<any[]>({
    queryKey: ["audio-notes"],
    queryFn: async () => {
      const res = await fetch("/app-api/audio-notes");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Query segnalazioni bug
  const { data: bugReports = [], refetch: refetchBugs } = useQuery<any[]>({
    queryKey: ["segnalazioni-bug"],
    queryFn: async () => {
      const res = await fetch("/app-api/segnalazioni-bug");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Mutazione aggiornamento stato nota audio
  const updateAudioStatusMutation = useMutation({
    mutationFn: async ({ id, stato }: { id: number; stato: string }) => {
      const res = await fetch(`/app-api/audio-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato }),
      });
      if (!res.ok) throw new Error("Errore aggiornamento");
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["audio-notes"] });
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      if (vars.stato === "cestino") toast.success("Nota spostata nel cestino");
      else if (vars.stato === "nuovo") toast.success("Nota ripristinata");
      else toast.success("Stato nota aggiornato");
    },
  });

  // Mutazione approvazione e pubblicazione consiglio Coach Stefano per la seduta successiva
  const saveCoachAdviceMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      consiglio_coach?: string;
      consiglio_approvato_coach: boolean;
      giorno_destinazione: string | number;
      tipo_intervento: "spinta" | "scarico" | "consolidamento";
      coach_audio_base64?: string | null;
      coach_audio_url?: string | null;
      coach_audio_durata_sec?: number | null;
    }) => {
      const res = await fetch(`/app-api/audio-notes/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stato: "applicato",
          consiglio_coach: payload.consiglio_coach,
          consiglio_approvato_coach: payload.consiglio_approvato_coach,
          giorno_destinazione: payload.giorno_destinazione,
          tipo_intervento: payload.tipo_intervento,
          coach_audio_base64: payload.coach_audio_base64,
          coach_audio_url: payload.coach_audio_url,
          coach_audio_durata_sec: payload.coach_audio_durata_sec,
        }),
      });
      if (!res.ok) throw new Error("Errore salvataggio direttiva");
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["audio-notes"] });
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      toast.success(`Direttiva approvata e inviata all'atleta per la Seduta ${vars.giorno_destinazione}!`);
    },
    onError: () => {
      toast.error("Errore nell'invio della direttiva.");
    },
  });

  // Mutazione eliminazione definitiva nota audio
  const deleteAudioPermanentlyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/app-api/audio-notes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Errore eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audio-notes"] });
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      toast.success("Nota eliminata definitivamente");
    },
  });

  // Mutazione aggiornamento stato bug
  const updateBugStatusMutation = useMutation({
    mutationFn: async ({ id, stato }: { id: number; stato: string }) => {
      const res = await fetch(`/app-api/segnalazioni-bug/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato }),
      });
      if (!res.ok) throw new Error("Errore aggiornamento");
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["segnalazioni-bug"] });
      if (vars.stato === "cestino") toast.success("Segnalazione spostata nel cestino");
      else if (vars.stato === "aperto") toast.success("Segnalazione ripristinata");
      else toast.success("Stato segnalazione aggiornato");
    },
  });

  // Mutazione eliminazione definitiva bug
  const deleteBugPermanentlyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/app-api/segnalazioni-bug/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Errore eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segnalazioni-bug"] });
      toast.success("Segnalazione eliminata definitivamente");
    },
  });

  if (!open) return null;

  // Conteggi note workout
  const rawWorkoutNotes = audioNotes.filter((n) => n.contesto === "biofeedback_workout");
  const workoutActiveCount = rawWorkoutNotes.filter((n) => n.stato !== "cestino").length;
  const workoutNewCount = rawWorkoutNotes.filter((n) => n.stato === "nuovo").length;
  const workoutManagedCount = rawWorkoutNotes.filter((n) => ["ascoltato", "applicato", "archiviato"].includes(n.stato)).length;
  const workoutTrashCount = rawWorkoutNotes.filter((n) => n.stato === "cestino").length;

  // Conteggi segnalazioni bug
  const bugActiveCount = bugReports.filter((b) => b.stato !== "cestino").length;
  const bugNewCount = bugReports.filter((b) => b.stato === "aperto").length;
  const bugManagedCount = bugReports.filter((b) => ["in_valutazione", "risolto", "scartato"].includes(b.stato)).length;
  const bugTrashCount = bugReports.filter((b) => b.stato === "cestino").length;

  // Filtraggio effettivo
  const filteredWorkoutNotes = rawWorkoutNotes.filter((n) => {
    if (filterStato === "nuovo") return n.stato === "nuovo";
    if (filterStato === "gestito") return ["ascoltato", "applicato", "archiviato"].includes(n.stato);
    if (filterStato === "cestino") return n.stato === "cestino";
    return n.stato !== "cestino"; // tutti (escluso cestino)
  });

  const filteredBugs = bugReports.filter((b) => {
    if (filterStato === "nuovo") return b.stato === "aperto";
    if (filterStato === "gestito") return ["in_valutazione", "risolto", "scartato"].includes(b.stato);
    if (filterStato === "cestino") return b.stato === "cestino";
    return b.stato !== "cestino"; // tutti (escluso cestino)
  });

  const currentAllCount = activeTab === "workout" ? workoutActiveCount : bugActiveCount;
  const currentNewCount = activeTab === "workout" ? workoutNewCount : bugNewCount;
  const currentManagedCount = activeTab === "workout" ? workoutManagedCount : bugManagedCount;
  const currentTrashCount = activeTab === "workout" ? workoutTrashCount : bugTrashCount;

  const getAlertBadge = (allerta: string) => {
    switch (allerta) {
      case "rosso":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500 text-white flex items-center gap-1 shadow-xs animate-pulse">
            <span className="size-1.5 rounded-full bg-white" /> Allerta Critica
          </span>
        );
      case "giallo":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-zinc-950 flex items-center gap-1 shadow-xs">
            <span className="size-1.5 rounded-full bg-zinc-950" /> Attenzione / Compenso
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white flex items-center gap-1 shadow-xs">
            <span className="size-1.5 rounded-full bg-white" /> Regolare
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-300">
        {/* TOPBAR DRAWER EXECUTIVE */}
        <div className="p-4 bg-zinc-950 text-white border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-[#1c00ff] text-[#e3ff00] flex items-center justify-center font-black shadow-md">
              <Mic className="size-5" />
            </div>
            <div>
              <div className="text-xs font-black tracking-wide uppercase text-[#e3ff00] flex items-center gap-1.5">
                <span>Bacheca Live Coach</span>
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <h2 className="text-base font-black text-white tracking-tight">
                Note Vocali, Biofeedback & Bug
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                refetchNotes();
                refetchBugs();
                toast.success("Bacheca aggiornata");
              }}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Ricarica"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* CONTROLLI FILTRI ARTISTICAMENTE BILANCIATI */}
        <div className="p-3 bg-white border-b border-zinc-200 shrink-0 shadow-2xs">
          {/* RIGA 1: SELETTORE TAB PRINCIPALE 50/50 (PULITO, RIGA SINGOLA) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-2xl border border-zinc-200/80">
            <button
              type="button"
              onClick={() => setActiveTab("workout")}
              className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === "workout"
                  ? "bg-[#1c00ff] text-white shadow-md shadow-[#1c00ff]/20"
                  : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/50"
              }`}
            >
              <Flame className="size-4 text-[#e3ff00]" />
              <span>Biofeedback ({workoutActiveCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("bug")}
              className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === "bug"
                  ? "bg-[#1c00ff] text-white shadow-md shadow-[#1c00ff]/20"
                  : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/50"
              }`}
            >
              <Bug className="size-4 text-[#e3ff00]" />
              <span>Idee & Bug ({bugActiveCount})</span>
            </button>
          </div>

          {/* RIGA 2: STRISCIA DEDICATA OPZIONI STATO E CESTINO */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] py-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mr-1 shrink-0">
              Stato:
            </span>
            {[
              { key: "tutti", label: "Tutti", count: currentAllCount },
              { key: "nuovo", label: "Nuovi", count: currentNewCount, dot: true },
              { key: "gestito", label: "Gestiti", count: currentManagedCount },
              { key: "cestino", label: "Cestino", count: currentTrashCount, isTrash: true },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStato(tab.key)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  filterStato === tab.key
                    ? "bg-zinc-950 text-[#e3ff00] font-black shadow-xs ring-1 ring-zinc-800"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 border border-zinc-200/80"
                }`}
              >
                {tab.dot && tab.count > 0 && (
                  <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                )}
                {tab.isTrash && <Trash2 className="size-3 text-zinc-400" />}
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    filterStato === tab.key
                      ? "bg-[#1c00ff] text-white"
                      : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* CONTENUTO SCROLLABILE */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8f9fc] [scrollbar-width:thin]">
          {/* TAB 1: BIOFEEDBACK WORKOUT */}
          {activeTab === "workout" && (
            <>
              {filteredWorkoutNotes.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 rounded-3xl bg-white border border-dashed border-zinc-200 mt-6">
                  <Mic className="size-8 mx-auto text-zinc-300 mb-2 opacity-50" />
                  <p className="text-xs font-bold text-zinc-600">
                    {filterStato === "cestino"
                      ? "Il cestino dei biofeedback e vuoto."
                      : "Nessuna nota vocale trovata per questo filtro."}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {filterStato === "cestino"
                      ? "Le note eliminate compariranno qui e potranno essere ripristinate in qualsiasi momento."
                      : "Le note vocali registrate dagli allievi compariranno qui con player e analisi AI."}
                  </p>
                </div>
              ) : (
                filteredWorkoutNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-4 rounded-3xl bg-white border-2 shadow-xs transition-all space-y-3 ${
                      note.stato === "cestino"
                        ? "border-zinc-300 bg-zinc-50 opacity-75"
                        : note.ai_allerta === "rosso"
                        ? "border-red-400 bg-red-50/20"
                        : note.ai_allerta === "giallo"
                        ? "border-amber-300 bg-amber-50/10"
                        : "border-zinc-200"
                    }`}
                  >
                    {/* Header Card Atleta & Allerta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-[#1c00ff] text-[#e3ff00] flex items-center justify-center font-black text-xs shrink-0">
                          {note.email_cliente ? note.email_cliente.substring(0, 2).toUpperCase() : "AT"}
                        </div>
                        <div>
                          <div className="text-xs font-black text-zinc-900 truncate">
                            {note.nome_cliente || note.email_cliente || "Atleta Lab"}
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 font-medium">
                            <Clock className="size-3" />
                            <span>{new Date(note.data_creazione).toLocaleString("it-IT")}</span>
                            <span>• Durata: {note.durata_sec || 0}s</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {note.stato !== "cestino" && getAlertBadge(note.ai_allerta)}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${
                            note.stato === "cestino"
                              ? "bg-zinc-200 text-zinc-600 border border-zinc-300"
                              : note.stato === "nuovo"
                              ? "bg-blue-100 text-[#1c00ff] border border-blue-200"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {note.stato === "cestino" ? "Nel Cestino" : note.stato}
                        </span>
                      </div>
                    </div>

                    {/* Player Audio Tattile Executive */}
                    <ExecutiveAudioPlayer
                      src={note.audio_base64 || note.audio_url}
                      durationSec={note.durata_sec || 0}
                    />

                    {/* Trascrizione Fedele */}
                    {note.trascrizione_testo && (
                      <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-800 leading-relaxed font-medium">
                        <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-0.5">
                          Trascrizione fedele audio:
                        </div>
                        <p className="italic font-normal">"{note.trascrizione_testo}"</p>
                      </div>
                    )}

                    {/* Sintesi & Allerta AI */}
                    {note.ai_sintesi && (
                      <div className="p-3 rounded-2xl bg-[#1c00ff]/5 border border-[#1c00ff]/20 text-xs space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#1c00ff]">
                          <Sparkles className="size-3" />
                          <span>Sintesi Clinico-Semantica:</span>
                        </div>
                        <p className="text-zinc-900 font-bold">{note.ai_sintesi}</p>
                      </div>
                    )}

                    {/* SEZIONE DECISIONALE COACH STEFANO PER SEDUTA SUCCESSIVA */}
                    {note.stato !== "cestino" && (
                      <CoachAdviceDecisionSection
                        note={note}
                        onSaveAdvice={(data) => saveCoachAdviceMutation.mutate(data)}
                        isPending={saveCoachAdviceMutation.isPending}
                      />
                    )}

                    {/* Azioni del Coach */}
                    <div className="pt-1 flex items-center justify-between border-t border-zinc-100">
                      {note.stato === "cestino" ? (
                        <div className="w-full flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateAudioStatusMutation.mutate({
                                id: note.id,
                                stato: "nuovo",
                              })
                            }
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="size-3.5" />
                            <span>Ripristina Nota</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Vuoi eliminare definitivamente questa nota dal database?")) {
                                deleteAudioPermanentlyMutation.mutate(note.id);
                              }
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Elimina Definitivamente</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              updateAudioStatusMutation.mutate({
                                id: note.id,
                                stato: "cestino",
                              })
                            }
                            className="p-1.5 text-zinc-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                            title="Sposta nel Cestino"
                          >
                            <Trash2 className="size-4" />
                          </button>

                          <div className="flex items-center gap-2">
                            {note.stato === "nuovo" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateAudioStatusMutation.mutate({
                                    id: note.id,
                                    stato: "ascoltato",
                                  })
                                }
                                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="size-3.5 text-emerald-400" />
                                <span>Segna come Ascoltato</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* TAB 2: IDEE & BUG REPORT */}
          {activeTab === "bug" && (
            <>
              {filteredBugs.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 rounded-3xl bg-white border border-dashed border-zinc-200 mt-6">
                  <Bug className="size-8 mx-auto text-zinc-300 mb-2 opacity-50" />
                  <p className="text-xs font-bold text-zinc-600">
                    {filterStato === "cestino"
                      ? "Il cestino delle segnalazioni e vuoto."
                      : "Nessuna segnalazione trovata per questo filtro."}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {filterStato === "cestino"
                      ? "I bug e suggerimenti eliminati compariranno qui e potranno essere ripristinati."
                      : "I feedback degli allievi compariranno qui con diagnosi tecnica preventiva."}
                  </p>
                </div>
              ) : (
                filteredBugs.map((bug) => (
                  <div
                    key={bug.id}
                    className={`p-4 rounded-3xl bg-white border-2 shadow-xs space-y-3 ${
                      bug.stato === "cestino"
                        ? "border-zinc-300 bg-zinc-50 opacity-75"
                        : "border-zinc-200"
                    }`}
                  >
                    {/* Header Bug */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`size-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                            bug.tipo === "bug"
                              ? "bg-rose-100 text-rose-700"
                              : bug.tipo === "consiglio"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {bug.tipo === "bug" ? (
                            <Bug className="size-4" />
                          ) : bug.tipo === "consiglio" ? (
                            <Lightbulb className="size-4" />
                          ) : (
                            <HelpCircle className="size-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-black text-zinc-900">{bug.titolo}</div>
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 font-medium">
                            {bug.anonimo ? (
                              <span className="flex items-center gap-1 text-purple-600 font-bold">
                                <EyeOff className="size-3" /> Utente Anonimo
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-zinc-600 font-medium">
                                <User className="size-3" /> {bug.email_cliente || "Atleta"}
                              </span>
                            )}
                            <span>• {new Date(bug.data_creazione).toLocaleString("it-IT")}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${
                          bug.stato === "cestino"
                            ? "bg-zinc-200 text-zinc-600"
                            : bug.stato === "aperto"
                            ? "bg-rose-100 text-rose-700 border border-rose-200"
                            : bug.stato === "risolto"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {bug.stato === "cestino" ? "Nel Cestino" : bug.stato}
                      </span>
                    </div>

                    {/* Descrizione Testuale */}
                    <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-800 font-medium leading-relaxed">
                      {bug.descrizione}
                    </div>

                    {/* Player Audio Allegato se presente */}
                    {(bug.audio_base64 || bug.audio_url) && (
                      <ExecutiveAudioPlayer
                        src={bug.audio_base64 || bug.audio_url}
                        durationSec={bug.durata_sec || 0}
                      />
                    )}

                    {/* Dispositivo e Diagnosi Tecnica AI */}
                    <div className="space-y-1.5">
                      {bug.device_info && (
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                          <Smartphone className="size-3" />
                          <span className="truncate">{bug.device_info}</span>
                        </div>
                      )}

                      {bug.ai_diagnosi_tecnica && (
                        <div className="p-2.5 rounded-2xl bg-zinc-900 text-zinc-200 text-[11px] space-y-1 shadow-inner">
                          <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#e3ff00]">
                            <Sparkles className="size-3" />
                            <span>Diagnosi Tecnica Preliminare (AI):</span>
                          </div>
                          <p className="leading-relaxed font-mono text-[10.5px]">
                            {bug.ai_diagnosi_tecnica}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Azioni Coach Bug */}
                    <div className="pt-1 flex items-center justify-between border-t border-zinc-100">
                      {bug.stato === "cestino" ? (
                        <div className="w-full flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateBugStatusMutation.mutate({
                                id: bug.id,
                                stato: "aperto",
                              })
                            }
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="size-3.5" />
                            <span>Ripristina Segnalazione</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Vuoi eliminare definitivamente questa segnalazione?")) {
                                deleteBugPermanentlyMutation.mutate(bug.id);
                              }
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Elimina Definitivamente</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              updateBugStatusMutation.mutate({
                                id: bug.id,
                                stato: "cestino",
                              })
                            }
                            className="p-1.5 text-zinc-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                            title="Sposta nel Cestino"
                          >
                            <Trash2 className="size-4" />
                          </button>

                          <div className="flex items-center gap-2">
                            {bug.stato !== "in_valutazione" && bug.stato !== "risolto" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateBugStatusMutation.mutate({
                                    id: bug.id,
                                    stato: "in_valutazione",
                                  })
                                }
                                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <span>Prendi in Carico</span>
                              </button>
                            )}

                            {bug.stato !== "risolto" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateBugStatusMutation.mutate({
                                    id: bug.id,
                                    stato: "risolto",
                                  })
                                }
                                className="px-3 py-1.5 bg-[#1c00ff] hover:bg-[#1600cc] text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Check className="size-3.5 text-[#e3ff00]" />
                                <span>Segna come Risolto</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
