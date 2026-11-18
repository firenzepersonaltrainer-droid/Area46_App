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
function ExecutiveAudioPlayer({
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
      if (vars.stato === "cestino") toast.success("Nota spostata nel cestino");
      else if (vars.stato === "nuovo") toast.success("Nota ripristinata");
      else toast.success("Stato nota aggiornato");
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

                    {/* Proposta d'Azione Socrate (Modalità B) */}
                    {note.ai_proposta_azione && (
                      <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          <span>Consiglio Operativo (Socrate - Modalità B):</span>
                        </div>
                        <p className="text-emerald-950 font-medium leading-relaxed">
                          {note.ai_proposta_azione}
                        </p>
                      </div>
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

                            {note.stato !== "applicato" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateAudioStatusMutation.mutate({
                                    id: note.id,
                                    stato: "applicato",
                                  })
                                }
                                className="px-3 py-1.5 bg-[#1c00ff] hover:bg-[#1600cc] text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <CheckCircle2 className="size-3.5 text-[#e3ff00]" />
                                <span>Applica Scarico</span>
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
