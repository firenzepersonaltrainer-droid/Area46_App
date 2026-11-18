import React, { useState } from "react";
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
  Filter,
  RefreshCw,
  Play,
  Pause,
} from "lucide-react";
import { toast } from "sonner";

interface CoachAudioFeedbackDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CoachAudioFeedbackDrawer({
  open,
  onClose,
}: CoachAudioFeedbackDrawerProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"workout" | "bug">("workout");
  const [filterStato, setFilterStato] = useState<string>("tutti");

  // Query note audio
  const { data: audioNotes = [], isLoading: isLoadingNotes, refetch: refetchNotes } = useQuery<any[]>({
    queryKey: ["audio-notes"],
    queryFn: async () => {
      const res = await fetch("/app-api/audio-notes");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000, // Polling ogni 10s per nuove note in tempo reale
  });

  // Query segnalazioni bug
  const { data: bugReports = [], isLoading: isLoadingBugs, refetch: refetchBugs } = useQuery<any[]>({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audio-notes"] });
      toast.success("Stato nota aggiornato");
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segnalazioni-bug"] });
      toast.success("Stato segnalazione aggiornato");
    },
  });

  if (!open) return null;

  // Filtraggio note workout
  const workoutNotes = audioNotes.filter((n) => {
    if (n.contesto !== "biofeedback_workout") return false;
    if (filterStato === "nuovo") return n.stato === "nuovo";
    if (filterStato === "gestito") return n.stato !== "nuovo";
    return true;
  });

  // Filtraggio segnalazioni bug
  const filteredBugs = bugReports.filter((b) => {
    if (filterStato === "nuovo") return b.stato === "aperto";
    if (filterStato === "gestito") return b.stato !== "aperto";
    return true;
  });

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
                toast.success("Aggiornato");
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

        {/* TAB SWITCHER */}
        <div className="p-3 bg-zinc-100 border-b border-zinc-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-zinc-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("workout")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "workout"
                  ? "bg-[#1c00ff] text-white shadow-md shadow-[#1c00ff]/20"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <Flame className="size-3.5" />
              <span>Biofeedback ({workoutNotes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("bug")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "bug"
                  ? "bg-[#1c00ff] text-white shadow-md shadow-[#1c00ff]/20"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <Bug className="size-3.5" />
              <span>Idee & Bug ({filteredBugs.length})</span>
            </button>
          </div>

          {/* Filtro Stato Rapido */}
          <div className="flex items-center gap-1 text-[11px] font-bold">
            <span className="text-zinc-400 text-[10px] uppercase tracking-wider mr-1">Stato:</span>
            {["tutti", "nuovo", "gestito"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStato(s)}
                className={`px-2 py-0.5 rounded-lg capitalize transition-colors cursor-pointer ${
                  filterStato === s
                    ? "bg-zinc-900 text-white font-black"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENUTO SCROLLABILE */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8f9fc] [scrollbar-width:thin]">
          {/* TAB 1: BIOFEEDBACK WORKOUT */}
          {activeTab === "workout" && (
            <>
              {workoutNotes.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 rounded-3xl bg-white border border-dashed border-zinc-200 mt-6">
                  <Mic className="size-8 mx-auto text-zinc-300 mb-2 opacity-50" />
                  <p className="text-xs font-bold text-zinc-600">Nessuna nota vocale post-workout trovata.</p>
                  <p className="text-[10px] text-zinc-400 mt-1">Le note vocali registrate dagli allievi compariranno qui con trascrizione e sintesi AI.</p>
                </div>
              ) : (
                workoutNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-4 rounded-3xl bg-white border-2 shadow-xs transition-all space-y-3 ${
                      note.ai_allerta === "rosso"
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
                            {note.email_cliente || "Atleta Lab"}
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 font-medium">
                            <Clock className="size-3" />
                            <span>{new Date(note.data_creazione).toLocaleString("it-IT")}</span>
                            <span>• Durata: {note.durata_sec || 0}s</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {getAlertBadge(note.ai_allerta)}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${
                            note.stato === "nuovo"
                              ? "bg-blue-100 text-[#1c00ff] border border-blue-200"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {note.stato}
                        </span>
                      </div>
                    </div>

                    {/* Player Audio Fisico HTML5 Nativo */}
                    <div className="p-2.5 rounded-2xl bg-zinc-950 text-white flex items-center justify-between gap-3 shadow-inner">
                      <div className="flex items-center gap-2 shrink-0">
                        <Volume2 className="size-4 text-[#e3ff00]" />
                        <span className="text-[11px] font-bold text-zinc-300">Nota Vocale</span>
                      </div>
                      <audio
                        controls
                        src={note.audio_url}
                        className="w-full h-8 max-w-[340px] [&::-webkit-media-controls-panel]:bg-zinc-900"
                      />
                    </div>

                    {/* Trascrizione Fedele */}
                    {note.trascrizione_testo && (
                      <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-800 leading-relaxed font-medium">
                        <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-0.5">
                          Trascrizione fedele audio:
                        </div>
                        &ldquo;{note.trascrizione_testo}&rdquo;
                      </div>
                    )}

                    {/* Sintesi & Proposta d'Azione Socrates Modalità B */}
                    <div className="space-y-1.5 p-3 rounded-2xl bg-[#f1f4ff] border border-[#1c00ff]/20 text-xs">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#1c00ff]">
                        <Sparkles className="size-3.5 text-[#1c00ff]" />
                        <span>Sintesi & Consiglio Socrates (Modalità B)</span>
                      </div>
                      <div className="font-bold text-zinc-900">{note.ai_sintesi}</div>
                      <div className="text-[11px] text-zinc-700 leading-snug">
                        {note.ai_proposta_azione}
                      </div>
                    </div>

                    {/* Azioni del Coach */}
                    <div className="pt-1 flex items-center justify-end gap-2 border-t border-zinc-100">
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
                          <span>Applica Scarico / Variazione</span>
                        </button>
                      )}

                      {note.stato !== "archiviato" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAudioStatusMutation.mutate({
                              id: note.id,
                              stato: "archiviato",
                            })
                          }
                          className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
                          title="Archivia"
                        >
                          <Archive className="size-3.5" />
                        </button>
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
                  <p className="text-xs font-bold text-zinc-600">Nessuna segnalazione di bug o consiglio.</p>
                  <p className="text-[10px] text-zinc-400 mt-1">I feedback degli allievi compariranno qui con diagnosi tecnica preventiva.</p>
                </div>
              ) : (
                filteredBugs.map((bug) => (
                  <div
                    key={bug.id}
                    className="p-4 rounded-3xl bg-white border-2 border-zinc-200 shadow-xs space-y-3"
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
                          bug.stato === "aperto"
                            ? "bg-rose-100 text-rose-700 border border-rose-200"
                            : bug.stato === "risolto"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {bug.stato}
                      </span>
                    </div>

                    {/* Descrizione Testuale */}
                    <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 leading-relaxed font-medium">
                      {bug.descrizione}
                    </div>

                    {/* Audio allegato (se presente) */}
                    {bug.audio_url && (
                      <div className="p-2.5 rounded-2xl bg-zinc-950 text-white flex items-center justify-between gap-3 shadow-inner">
                        <div className="flex items-center gap-2 shrink-0">
                          <Mic className="size-4 text-[#e3ff00]" />
                          <span className="text-[11px] font-bold text-zinc-300">Spiegazione Vocale</span>
                        </div>
                        <audio
                          controls
                          src={bug.audio_url}
                          className="w-full h-8 max-w-[320px] [&::-webkit-media-controls-panel]:bg-zinc-900"
                        />
                      </div>
                    )}

                    {/* Diagnosi Tecnica Preventiva AI */}
                    {bug.ai_diagnosi_tecnica && (
                      <div className="p-3 rounded-2xl bg-[#09090b] text-white border border-zinc-800 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#e3ff00]">
                          <Sparkles className="size-3 text-[#e3ff00]" />
                          <span>Diagnosi Tecnica Preventiva AI</span>
                        </div>
                        <div className="text-[11px] text-zinc-300 leading-snug font-mono">
                          {bug.ai_diagnosi_tecnica}
                        </div>
                        {bug.device_info && (
                          <div className="text-[9px] text-zinc-500 font-mono pt-1">
                            Context: {bug.device_info}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Azioni Segnalazione */}
                    <div className="pt-1 flex items-center justify-end gap-2 border-t border-zinc-100">
                      {bug.stato !== "risolto" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateBugStatusMutation.mutate({
                              id: bug.id,
                              stato: "risolto",
                            })
                          }
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="size-3.5" />
                          <span>Segna come Risolto</span>
                        </button>
                      )}

                      {bug.stato !== "scartato" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateBugStatusMutation.mutate({
                              id: bug.id,
                              stato: "scartato",
                            })
                          }
                          className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Scarta
                        </button>
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
