import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronRight,
  ChevronRight as Sep,
  Dumbbell,
  PlayCircle,
  Zap,
  CheckSquare,
  Square,
  Clock,
  Circle,
  Printer,
  Sparkles,
  MessageSquare,
  ThumbsUp,
  X,
  Activity,
  HeartHandshake,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ArrowLeft,
  Mic,
} from "lucide-react";
import { getLivelloColors } from "../lib/livelloStyle";
import { toast } from "sonner";
import { useAllenamentiStati, type StatoAllenamento } from "../lib/useAllenamentiStati";
import { VideoClipModal } from "../components/VideoClipModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/Dialog";
import { Textarea } from "../components/Textarea";
import { AudioFeedbackRecorder } from "../components/AudioFeedbackRecorder";
import { ExecutiveAudioPlayer } from "../components/CoachAudioFeedbackDrawer";

interface Esercizio {
  id: number;
  livello: string;
  giorno: string | number;
  settimana?: string;
  sequenza: string;
  id_esercizio: string;
  nome_esercizio: string;
  parametri: string;
  recupero: string;
  note_tecniche: string;
  link_video: string;
  pattern_motorio?: string;
  fulcro_articolare?: string;
  meridiano_miofasciale?: string;
  cue_esecutiva?: string;
}

function bloccoKey(sequenza: string): string {
  return sequenza.replace(/[A-Za-z]+$/, "").trim();
}

const CIRCUIT_KEYWORDS: { pattern: RegExp; label: string }[] = [
  { pattern: /super\s*set|\bss\b/i, label: "Super Set" },
  { pattern: /giant\s*set|\bgs\b/i, label: "Giant Set" },
  { pattern: /jump\s*set|\bjs\b/i, label: "Jump Set" },
  { pattern: /\bemom\b/i, label: "EMOM" },
  { pattern: /\bamrap\b/i, label: "AMRAP" },
  { pattern: /for\s*time/i, label: "For Time" },
  { pattern: /\bchipper\b/i, label: "Chipper" },
  { pattern: /death\s*by/i, label: "Death By" },
  { pattern: /\bhiit\b/i, label: "HIIT" },
  { pattern: /\brft\b|rounds\s*for\s*time/i, label: "RFT" },
];

function extractCircuitTitle(esercizi: Esercizio[]): string {
  if (esercizi.length === 0) return "Circuito";
  const fullText = esercizi
    .map((e) => `${e.note_tecniche ?? ""} ${e.parametri ?? ""}`)
    .join(" ");

  const amrapMatch = fullText.match(/\bamrap\b[^\d\n\r]{0,10}(\d{1,3})\s*(?:'|’|min|minuti)?/i);
  if (amrapMatch && amrapMatch[1]) {
    return `AMRAP ${amrapMatch[1]} min`;
  }
  if (/\bamrap\b/i.test(fullText)) {
    return "AMRAP";
  }

  const emomMatch = fullText.match(/\bemom\b[^\d\n\r]{0,10}(\d{1,3})\s*(?:'|’|min|minuti)?/i);
  if (emomMatch && emomMatch[1]) {
    return `EMOM ${emomMatch[1]} min`;
  }
  if (/\bemom\b/i.test(fullText)) {
    return "EMOM";
  }

  for (const { pattern, label } of CIRCUIT_KEYWORDS) {
    if (pattern.test(fullText)) return label;
  }
  return "Circuito";
}

function isWod(sequenza: string): boolean {
  return /[A-Za-z]$/.test(sequenza.trim());
}

interface Blocco {
  key: string;
  isWod: boolean;
  esercizi: Esercizio[];
}

function raggruppa(esercizi: Esercizio[]): Blocco[] {
  const blocchi: Blocco[] = [];
  const map = new Map<string, Blocco>();
  for (const ex of esercizi) {
    const key = bloccoKey(ex.sequenza);
    const wod = isWod(ex.sequenza);
    if (!map.has(key)) {
      const b: Blocco = { key, isWod: wod, esercizi: [ex] };
      map.set(key, b);
      blocchi.push(b);
    } else {
      map.get(key)!.esercizi.push(ex);
    }
  }
  return blocchi;
}

// Estrazione intelligente dei recuperi: Rec (inter-serie) e RBS (Rest Between Sides)
function parseRecuperi(ex: Esercizio) {
  const recRaw = ex.recupero || "";
  const notesRaw = ex.note_tecniche || "";
  const paramRaw = ex.parametri || "";

  let rbs: string | null = null;
  let rec: string | null = null;

  // Cerca esplicito RBS
  const rbsMatch = `${recRaw} ${notesRaw}`.match(/rbs[:\s]*(\d+["']?|\d+)/i);
  if (rbsMatch) {
    rbs = rbsMatch[1].includes('"') ? rbsMatch[1] : `${rbsMatch[1]}"`;
  } else if (paramRaw.includes("+")) {
    // Esercizio asimmetrico: se non c'è RBS esplicito ma c'è recupero breve
    if (recRaw && !recRaw.includes("+")) {
      rec = recRaw;
    }
  }

  if (recRaw) {
    rec = recRaw.replace(/rbs[:\s]*(\d+["']?|\d+)/i, "").trim();
  }

  return { rec, rbs };
}

function EsercizioRow({
  ex,
  livello,
  giorno,
  inWod,
  onOpenVideo,
}: {
  ex: Esercizio;
  livello: string;
  giorno: string;
  inWod: boolean;
  onOpenVideo: (ex: Esercizio) => void;
}) {
  const navigate = useNavigate();
  const { rec, rbs } = parseRecuperi(ex);

  return (
    <div
      onClick={() =>
        navigate(`/esercizio/${encodeURIComponent(livello)}/${giorno}/${encodeURIComponent(ex.id_esercizio)}`)
      }
      className="flex w-full cursor-pointer items-center justify-between p-3.5 hover:bg-zinc-50 text-left transition-colors print:border-b print:border-zinc-200"
      style={{ background: inWod ? "rgba(28,0,255,0.03)" : "transparent" }}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div
          className="flex min-w-[2.8rem] items-center justify-center rounded-xl px-2 py-1.5 text-xs font-black shrink-0 shadow-xs print:border print:border-black"
          style={{
            background: inWod ? "#e3ff00" : "#09090b",
            color: inWod ? "#09090b" : "#ffffff",
            border: inWod ? "1px solid #09090b" : "1.5px solid #1c00ff",
          }}
        >
          {ex.sequenza}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-zinc-900 text-[15px] sm:text-base truncate leading-snug">
            {ex.nome_esercizio}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            {ex.parametri && (
              <span className="text-xs sm:text-sm font-black text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md">
                {ex.parametri}
              </span>
            )}
            {rec && (
              <span className="text-xs font-bold text-[#1c00ff] bg-[#1c00ff]/10 px-2 py-0.5 rounded-md">
                Rec: {rec}
              </span>
            )}
            {rbs && (
              <span className="text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                RBS: {rbs}
              </span>
            )}
            {ex.cue_esecutiva && (
              <span className="hidden sm:inline-block text-[11px] font-medium text-zinc-500 italic truncate max-w-[240px]">
                🔑 {ex.cue_esecutiva}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-2 print:hidden">
        {ex.link_video && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenVideo(ex);
            }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-xs hover:scale-105 active:scale-95 transition-transform"
            style={{ background: "#1c00ff", color: "#e3ff00" }}
            title="Guarda la clip dimostrativa da 15s"
          >
            <PlayCircle className="size-3.5 text-[#e3ff00]" />
            Clip 15s
          </button>
        )}
        <ChevronRight className="size-5 text-zinc-400" />
      </div>
    </div>
  );
}

function WodBlocco({
  blocco,
  livello,
  giorno,
  onOpenVideo,
}: {
  blocco: Blocco;
  livello: string;
  giorno: string;
  onOpenVideo: (ex: Esercizio) => void;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-xs bg-white print:border print:border-black"
      style={{ border: "2px solid #1c00ff" }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 print:bg-zinc-200" style={{ background: "#1c00ff" }}>
        <Zap className="size-4" style={{ color: "#e3ff00" }} />
        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white print:text-black">
          {extractCircuitTitle(blocco.esercizi)} — BLOCCO {blocco.key}
        </span>
      </div>
      <div className="divide-y divide-zinc-100 print:divide-zinc-200">
        {blocco.esercizi.map((ex) => (
          <EsercizioRow
            key={ex.id}
            ex={ex}
            livello={livello}
            giorno={giorno}
            inWod={true}
            onOpenVideo={onOpenVideo}
          />
        ))}
      </div>
    </div>
  );
}

// Modale Feedback Seduta Post-Workout Anti-Magnesite (Touch Rapido <4 secondi)
const SENSAZIONI_RAPIDE = [
  "Ottima fluidità",
  "Affaticamento generale",
  "Fastidio spalla",
  "Tensione anca/schiena",
  "Carico leggero",
  "RPE centrato",
];

interface CoachAdviceFeedback {
  allerta?: string;
  sintesi?: string;
  propostaAzione?: string;
  consiglioCoach?: string;
}

function FeedbackSedutaModal({
  open,
  onOpenChange,
  livello,
  giorno,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  livello: string;
  giorno: string;
}) {
  const queryClient = useQueryClient();
  const [rpe, setRpe] = useState<number>(8);
  const [selectedSensazioni, setSelectedSensazioni] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [recordedAudio, setRecordedAudio] = useState<{
    blob: Blob;
    base64: string;
    durationSec: number;
    transcript?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const toggleSensazione = (s: string) => {
    setSelectedSensazioni((prev) =>
      prev.includes(s) ? prev.filter((item) => item !== s) : [...prev, s]
    );
  };

  const handleClose = () => {
    setFeedbackSubmitted(false);
    setRecordedAudio(null);
    setNote("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (recordedAudio) {
        // Invio completo tramite la pipeline audio multimodale
        const res = await fetch("/app-api/audio-note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: recordedAudio.base64,
            durata_sec: recordedAudio.durationSec,
            formato: "webm",
            contesto: "biofeedback_workout",
            livello,
            giorno,
            rpe,
            sensazioni: selectedSensazioni,
            noteTesto: note || recordedAudio.transcript || "",
            transcript: recordedAudio.transcript || undefined,
            trascrizione_live: recordedAudio.transcript || undefined,
          }),
        });
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["diario"] });
          queryClient.invalidateQueries({ queryKey: ["audio-notes"] });
          toast.success("Nota vocale e feedback recapitati al Coach!");
          setFeedbackSubmitted(true);
        } else {
          toast.error("Errore nell'invio del biofeedback vocale.");
        }
      } else {
        // Invio standard testuale con analisi biofeedback
        const res = await fetch("/app-api/diario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "feedback_seduta",
            livello,
            giorno,
            rpe_globale: rpe,
            sensazioni: selectedSensazioni,
            note_cinestesiche: note,
            feedback: `RPE ${rpe}/10 • ${selectedSensazioni.join(", ")} ${note ? `• ${note}` : ""}`.trim(),
          }),
        });
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["diario"] });
          toast.success("Feedback recapitato al Coach!");
          setFeedbackSubmitted(true);
        } else {
          toast.error("Errore nel salvataggio del feedback.");
        }
      }
    } catch {
      toast.error("Errore di connessione.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) handleClose();
        else onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-md p-5 bg-white rounded-3xl shadow-2xl border-2 border-zinc-200 max-h-[90vh] overflow-y-auto">
        {feedbackSubmitted ? (
          /* Schermata di Conferma Recapito Ufficiale al Coach Stefano */
          <div className="space-y-4 pt-2 pb-1 animate-in fade-in duration-300 text-center">
            <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1c00ff] text-[#e3ff00]">
                Feedback Inviato
              </span>
              <DialogTitle className="text-xl font-black text-zinc-900 tracking-tight">
                Recapitato al Coach Stefano
              </DialogTitle>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed font-medium max-w-sm mx-auto">
              La tua nota vocale e le tue sensazioni sono state inviate con successo a <strong>Stefano Tronconi</strong>. Il Coach valuterà quanto hai comunicato per preparare le indicazioni operative della tua <strong>prossima seduta</strong>.
            </p>

            {/* Riepilogo Sintetico Ricevuta */}
            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-left text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-200/80 pb-1.5">
                <span className="font-bold text-zinc-500 uppercase text-[10px] tracking-wider">RPE Registrato:</span>
                <span className="font-black text-zinc-900 font-mono">{rpe}/10</span>
              </div>

              {selectedSensazioni.length > 0 && (
                <div className="border-b border-zinc-200/80 pb-1.5">
                  <span className="font-bold text-zinc-500 uppercase text-[10px] tracking-wider block mb-1">Sensazioni rapide:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedSensazioni.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-md bg-zinc-200/70 text-zinc-800 text-[10px] font-bold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {recordedAudio && (
                <div className="flex items-center justify-between text-blue-700 font-bold text-[11px] pt-0.5">
                  <span className="flex items-center gap-1.5">
                    <Mic className="size-3.5" />
                    <span>Nota vocale allegata</span>
                  </span>
                  <span className="font-mono text-[10px] bg-blue-100 px-2 py-0.5 rounded-full">
                    {recordedAudio.durationSec}s
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 bg-[#1c00ff] text-white rounded-2xl text-xs font-black shadow-md hover:bg-[#1600cc] transition-colors cursor-pointer text-center"
              >
                Ho capito, grazie Coach ✓
              </button>
            </div>
          </div>
        ) : (
          /* Form di Inserimento Feedback & Audio */
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1c00ff] text-[#e3ff00]">
                  Post-Workout
                </span>
              </div>
              <DialogTitle className="text-xl font-black text-zinc-900 tracking-tight">
                Feedback Seduta & Biofeedback Audio
              </DialogTitle>
              <p className="text-xs text-zinc-500 font-medium">
                Registra le tue sensazioni post-allenamento o invia una nota vocale al Coach Stefano.
              </p>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Selettore RPE a Grandi Tasti Touch (Anti-Magnesite) */}
              <div>
                <label className="block text-xs font-black text-zinc-900 uppercase tracking-wider mb-2">
                  RPE Percepito Globale: {rpe}/10
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { val: 6, label: "6", sub: "Facile", color: "bg-emerald-50 text-emerald-800 border-emerald-300" },
                    { val: 7, label: "7", sub: "Medio", color: "bg-lime-50 text-lime-800 border-lime-300" },
                    { val: 8, label: "8", sub: "Solido", color: "bg-amber-50 text-amber-800 border-amber-300" },
                    { val: 9, label: "9", sub: "Duro", color: "bg-orange-50 text-orange-800 border-orange-300" },
                    { val: 10, label: "10", sub: "Max", color: "bg-rose-50 text-rose-800 border-rose-300" },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setRpe(item.val)}
                      className={`py-3 px-1 rounded-2xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs ${
                        rpe === item.val
                          ? "ring-2 ring-zinc-950 border-zinc-950 scale-105 bg-[#09090b] text-[#e3ff00]"
                          : `${item.color} hover:brightness-95`
                      }`}
                    >
                      <span className="text-lg font-black">{item.label}</span>
                      <span className="text-[9px] font-bold uppercase tracking-tight">{item.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chip Sensazioni Cinestesiche a 1-Tap */}
              <div>
                <label className="block text-xs font-black text-zinc-900 uppercase tracking-wider mb-2">
                  Sensazioni Rapide (1-Tap):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SENSAZIONI_RAPIDE.map((s) => {
                    const active = selectedSensazioni.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSensazione(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? "bg-[#1c00ff] text-white border-[#1c00ff] shadow-xs"
                            : "bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200"
                        }`}
                      >
                        {active ? "✓ " : "+ "}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* REGISTRATORE NOTA AUDIO INTEGRATO */}
              <div>
                <AudioFeedbackRecorder
                  label="Nota Audio Vocale per il Coach (10-60s)"
                  maxDurationSec={60}
                  onAudioRecorded={(audio) => setRecordedAudio(audio)}
                  onAudioCleared={() => setRecordedAudio(null)}
                />
              </div>

              {/* Note Cinestesiche Testuali Opzionali */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Note scritte aggiuntive (opzionali):
                </label>
                <Textarea
                  placeholder="Es. ottima coordinazione al coiled deadlift, stanchezza sul finire del WOD…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="text-xs h-18 rounded-xl"
                />
              </div>

              {/* Bottone Salvataggio */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="px-5 py-2.5 bg-[#1c00ff] text-white rounded-xl text-xs font-black shadow-md hover:bg-[#1600cc] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? "Analisi AI in corso…" : recordedAudio ? "🎙️ Invia Audio al Coach" : "Salva Feedback"}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function GiornoDetailPage() {
  const { livello, giorno } = useParams<{ livello: string; giorno: string }>();
  const navigate = useNavigate();
  const colors = getLivelloColors(livello ?? "");

  const { data: esercizi = [], isLoading } = useQuery<Esercizio[]>({
    queryKey: ["allenamento-dettaglio", livello, giorno],
    queryFn: () =>
      fetch(`/app-api/allenamenti/${encodeURIComponent(livello!)}/${giorno}`).then((r) => r.json()),
    enabled: !!livello && !!giorno,
  });

  const { data: diarioEntries = [] } = useQuery<any[]>({
    queryKey: ["diario"],
    queryFn: () => fetch("/app-api/diario").then((r) => r.json()).catch(() => []),
  });

  const blocchi = React.useMemo(() => raggruppa(esercizi), [esercizi]);
  const giornoDisplay = giorno ?? "";
  const numMatch = String(giornoDisplay).match(/[0-9]+/);
  const giornoNum = numMatch ? parseInt(numMatch[0], 10) : parseInt(giornoDisplay, 10) || 1;

  const coachAdvice = React.useMemo(() => {
    if (!diarioEntries || !Array.isArray(diarioEntries)) return null;
    // REGOLE DI STEFANO TRONCONI:
    // 1. I consigli appaiono all'atleta SOLO SU DECISIONE DEL COACH (consiglio_approvato_coach === true).
    // 2. I consigli NON vengono prescritti nella seduta appena conclusa, ma nella seduta successiva (giorno_destinazione).
    const match = diarioEntries
      .filter((e) => {
        if (!e.consiglio_approvato_coach) return false;
        if (!e.consiglio_coach && !e.coach_audio_base64 && !e.coach_audio_url) return false;
        if (e.livello && livello && e.livello !== livello) return false;

        const destNum = e.giorno_destinazione ? Number(String(e.giorno_destinazione).match(/[0-9]+/)?.[0]) : null;
        if (destNum && destNum === giornoNum) return true;
        if (e.giorno_destinazione && String(e.giorno_destinazione).trim().toLowerCase() === String(giornoDisplay).trim().toLowerCase()) return true;

        // Fallback: se proviene dalla seduta precedente (giornoNum - 1) ed è approvato dal coach
        const sorgenteNum = e.giorno ? Number(String(e.giorno).match(/[0-9]+/)?.[0]) : null;
        if (sorgenteNum && sorgenteNum === giornoNum - 1) return true;

        return false;
      })
      .sort((a, b) => new Date(b.created_at || b.data_ora || 0).getTime() - new Date(a.created_at || a.data_ora || 0).getTime())[0];
    return match || null;
  }, [diarioEntries, livello, giornoDisplay, giornoNum]);

  const primoEsercizio = esercizi[0];
  const giornoLabel = primoEsercizio?.giorno ? String(primoEsercizio.giorno) : `Giorno ${giornoDisplay}`;
  const cicloLabel = primoEsercizio?.settimana;
  const isCicloScarico = React.useMemo(() => {
    const s = (cicloLabel || "").toLowerCase();
    if (s.includes("scarico") || s.includes("deload")) return true;
    const match = s.match(/ciclo\s*(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 3 && num % 3 === 0) return true;
    }
    return false;
  }, [cicloLabel]);

  const { getStato, setStato, toggleGiorno } = useAllenamentiStati();
  const statoCorrente: StatoAllenamento = getStato(livello ?? "", giornoNum);
  const isCompletato = statoCorrente === "completato";

  // Modale Video Clip In-Place
  const [videoModal, setVideoModal] = useState<{
    open: boolean;
    url: string;
    nome: string;
    cue?: string;
    pattern?: string;
  }>({
    open: false,
    url: "",
    nome: "",
  });

  // Modale Feedback Seduta
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleToggle = async () => {
    const next = await toggleGiorno(livello ?? "", giornoNum);
    if (next === "completato") {
      toast.success(`Allenamento contrassegnato come completato!`);
    } else {
      toast.success(`Allenamento ripristinato come da svolgere.`);
    }
  };

  const handleSelectStato = async (s: StatoAllenamento) => {
    await setStato(livello ?? "", giornoNum, s);
    if (s === "completato") {
      toast.success(`Allenamento contrassegnato come completato!`);
    } else if (s === "in_corso") {
      toast.success(`Allenamento contrassegnato come in corso!`);
    } else {
      toast.success(`Allenamento ripristinato come da svolgere.`);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/?livello=${encodeURIComponent(livello || "")}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Barra Superiore: Freccia Torna al Ciclo a Sinistra & Tasto Stampa Scheda A4 a Destra (Nascosta in Stampa) */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-black text-zinc-900 shadow-xs transition-colors cursor-pointer"
          title="Torna alla schermata del ciclo"
        >
          <ArrowLeft className="size-4 text-zinc-800" />
          <span>Torna al Ciclo</span>
        </button>

        {/* Pulsante Stampa Scheda A4 (Sheet di Allenamento da portare in sala) */}
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-black text-zinc-900 shadow-xs transition-colors cursor-pointer"
          title="Stampa foglio di lavoro A4 con tabella esercizi"
        >
          <Printer className="size-3.5 text-zinc-700" />
          <span>Stampa Scheda A4</span>
        </button>
      </div>

      {/* Header Info Giorno compatto in unica linea (Massimo recupero spazio verticale e simmetria orizzontale) */}
      <div className="rounded-2xl bg-white border border-zinc-200 px-4 py-2.5 shadow-xs relative overflow-hidden print:hidden">
        <div
          className="absolute top-0 left-0 bottom-0 w-1.5"
          style={{ background: isCicloScarico ? "#3b82f6" : "#1c00ff" }}
        />
        <div className="pl-1 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-zinc-900 truncate">
              {giornoLabel}
            </h1>
            {isCompletato && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 shrink-0">
                <CheckCircle2 className="size-3" />
                Completato
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {livello && (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider"
                style={{ background: "#09090b", color: "#ffffff" }}
              >
                {livello}
              </span>
            )}
            {cicloLabel && (
              <span
                className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-black uppercase tracking-wider"
                style={{ background: isCicloScarico ? "#3b82f6" : "#1c00ff", color: "#e3ff00" }}
              >
                {cicloLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CARD CONSIGLIO DEL COACH STEFANO PER QUESTA SEDUTA (Appare SOLO se approvato da Stefano) */}
      {coachAdvice && (
        <div className="rounded-2xl bg-[#09090b] border-2 border-[#1c00ff] p-3.5 sm:p-4 text-white shadow-xl space-y-2 print:hidden animate-in fade-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#e3ff00]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#e3ff00]">
                Direttiva Operativa del Coach Stefano Tronconi
              </span>
            </div>
            {coachAdvice.tipo_intervento === "spinta" ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#e3ff00] text-zinc-950 border border-[#e3ff00] flex items-center gap-1 shadow-xs">
                <span>🚀 Spingere di Più (+Carico)</span>
              </span>
            ) : coachAdvice.tipo_intervento === "scarico" || coachAdvice.ai_allerta === "rosso" ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                <span>🛡️ Lavoro Più Leggero / Scarico</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span>🟢 Progressione Centrata</span>
              </span>
            )}
          </div>

          {/* Player Nota Vocale del Coach Stefano per questa seduta */}
          {(coachAdvice.coach_audio_base64 || coachAdvice.coach_audio_url) && (
            <div className="p-3 rounded-2xl bg-zinc-950 border border-[#e3ff00]/40 space-y-2 mt-1 shadow-inner">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#e3ff00]">
                <span className="flex items-center gap-1.5">
                  <Mic className="size-4 text-[#e3ff00]" />
                  <span>Nota Vocale di Stefano Tronconi per Te</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">Audio del Coach</span>
              </div>
              <ExecutiveAudioPlayer
                src={coachAdvice.coach_audio_base64 || coachAdvice.coach_audio_url}
                durationSec={coachAdvice.coach_audio_durata_sec || 0}
              />
              <p className="text-[11px] text-zinc-400 italic">
                Ascolta la nota vocale registrata dal Coach Stefano specificamente per guidare la tua seduta di oggi.
              </p>
            </div>
          )}

          {/* Testo Direttiva del Coach (se presente) */}
          {coachAdvice.consiglio_coach && (
            <p className="text-xs sm:text-sm text-zinc-200 font-medium leading-relaxed pt-1">
              "{coachAdvice.consiglio_coach}"
            </p>
          )}

          {coachAdvice.ai_proposta_azione && (
            <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-400">
              <span className="text-zinc-300 font-bold">Azione metodologica: </span>
              {coachAdvice.ai_proposta_azione}
            </div>
          )}
        </div>
      )}

      {/* Lista Blocchi Esercizi Web Interattiva (In primo piano, nascosta in stampa per dare spazio al foglio Sheet A4) */}
      <div className="print:hidden space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-200" />
            ))}
          </div>
        ) : blocchi.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Dumbbell className="size-10 text-zinc-400" />
            <p className="text-zinc-500 font-semibold">Nessun esercizio trovato per questo allenamento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {blocchi.map((blocco) =>
              blocco.isWod && blocco.esercizi.length > 1 ? (
                <WodBlocco
                  key={blocco.key}
                  blocco={blocco}
                  livello={livello!}
                  giorno={giorno!}
                  onOpenVideo={(ex) =>
                    setVideoModal({
                      open: true,
                      url: ex.link_video,
                      nome: ex.nome_esercizio,
                      cue: ex.cue_esecutiva,
                      pattern: ex.pattern_motorio,
                    })
                  }
                />
              ) : (
                <div
                  key={blocco.key}
                  className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs divide-y divide-zinc-100"
                >
                  {blocco.esercizi.map((ex) => (
                    <EsercizioRow
                      key={ex.id}
                      ex={ex}
                      livello={livello!}
                      giorno={giorno!}
                      inWod={false}
                      onOpenVideo={(item) =>
                        setVideoModal({
                          open: true,
                          url: item.link_video,
                          nome: item.nome_esercizio,
                          cue: item.cue_esecutiva,
                          pattern: item.pattern_motorio,
                        })
                      }
                    />
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* 1. TASTO FEEDBACK SEDUTA & RPE (Fuori dal box delle spunte, allargato a tutto schermo, spessore compatto) */}
      <div className="print:hidden">
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black bg-[#1c00ff] hover:bg-[#1600cc] text-white shadow-xs transition-all cursor-pointer select-none active:scale-[0.99]"
        >
          <MessageSquare className="size-4 text-[#e3ff00]" />
          <span>Feedback Seduta & RPE</span>
        </button>
      </div>

      {/* 2. BOX UNICO CON LE TRE SPUNTE IN UN'UNICA LINEA (Stessa forma e dimensione, colori differenti) */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-2.5 sm:p-3 shadow-xs print:hidden">
        <div className="grid grid-cols-3 gap-2 w-full">
          {[
            {
              id: "non_iniziato" as StatoAllenamento,
              label: "Da svolgere",
              color: "#ff3b30",
              bgActive: "rgba(255,59,48,0.12)",
              borderActive: "#ff3b30",
              icon: Circle,
            },
            {
              id: "in_corso" as StatoAllenamento,
              label: "In corso",
              color: "#ff9500",
              bgActive: "rgba(255,149,0,0.14)",
              borderActive: "#ff9500",
              icon: Clock,
            },
            {
              id: "completato" as StatoAllenamento,
              label: "Completato",
              color: "#16a34a",
              bgActive: "rgba(22,163,74,0.14)",
              borderActive: "#16a34a",
              icon: CheckCircle2,
            },
          ].map((cfg) => {
            const attivo = statoCorrente === cfg.id;
            const Icon = cfg.icon;
            return (
              <button
                key={cfg.id}
                type="button"
                onClick={() => handleSelectStato(cfg.id)}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none border ${
                  attivo
                    ? "border-2 font-black shadow-xs"
                    : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600"
                }`}
                style={{
                  backgroundColor: attivo ? cfg.bgActive : undefined,
                  borderColor: attivo ? cfg.borderActive : undefined,
                  color: attivo ? cfg.color : undefined,
                }}
              >
                <Icon
                  className="size-3.5 shrink-0"
                  style={{ color: attivo ? cfg.color : "#71717a" }}
                />
                <span className="truncate">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. FOGLIO TABELLARE SHEET A4 DA STAMPARE (Visibile SOLO in stampa con @media print) */}
      <div className="hidden print:block w-full font-sans text-black">
        {/* Intestazione Foglio A4 */}
        <div className="border-b-2 border-black pb-2.5 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase">
                Area46 Training Lab — Scheda di Allenamento
              </h1>
              <p className="text-[11px] text-zinc-700 font-semibold mt-0.5">
                Foglio di Lavoro da Sala Operativa • Metodo Stefano Tronconi
              </p>
            </div>
            <div className="text-right">
              <span className="border border-black px-2.5 py-0.5 text-xs font-black uppercase">
                {livello || "PRO"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-2.5 text-xs border border-black p-2 bg-zinc-50 font-medium">
            <div>
              <span className="font-bold">Seduta:</span> {giornoLabel}
            </div>
            <div>
              <span className="font-bold">Ciclo:</span> {cicloLabel || "—"}
            </div>
            <div>
              <span className="font-bold">Atleta:</span> ____________________
            </div>
            <div>
              <span className="font-bold">Data:</span> ____/____/________
            </div>
          </div>
        </div>

        {/* Tabella Esercizi Formato Sheet A4 */}
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-zinc-200 text-black border-b-2 border-black font-black text-left">
              <th className="border border-black px-2 py-1.5 w-10 text-center">Seq</th>
              <th className="border border-black px-2 py-1.5">Esercizio & Pattern Motorio</th>
              <th className="border border-black px-2 py-1.5 w-28">Target Prescritto</th>
              <th className="border border-black px-2 py-1.5 w-24">Rec / RBS</th>
              <th className="border border-black px-1 py-1.5 w-14 text-center">Set 1</th>
              <th className="border border-black px-1 py-1.5 w-14 text-center">Set 2</th>
              <th className="border border-black px-1 py-1.5 w-14 text-center">Set 3</th>
              <th className="border border-black px-1 py-1.5 w-14 text-center">Set 4</th>
              <th className="border border-black px-2 py-1.5 w-24">Note & RPE</th>
            </tr>
          </thead>
          <tbody>
            {esercizi.map((ex, idx) => {
              const { rec, rbs } = parseRecuperi(ex);
              return (
                <tr key={ex.id || idx} className="border-b border-black">
                  <td className="border border-black px-1.5 py-2 text-center font-black bg-zinc-50">
                    {ex.sequenza}
                  </td>
                  <td className="border border-black px-2 py-2">
                    <div className="font-black text-[12px] leading-tight">{ex.nome_esercizio}</div>
                    {ex.cue_esecutiva && (
                      <div className="text-[10px] text-zinc-700 italic mt-0.5">
                        🔑 {ex.cue_esecutiva}
                      </div>
                    )}
                  </td>
                  <td className="border border-black px-2 py-2 font-bold text-[11px]">
                    {ex.parametri || "—"}
                  </td>
                  <td className="border border-black px-2 py-2 font-medium text-[10px]">
                    {rec && <div>Rec: {rec}</div>}
                    {rbs && <div>RBS: {rbs}</div>}
                    {!rec && !rbs && "—"}
                  </td>
                  <td className="border border-black p-0 h-9"></td>
                  <td className="border border-black p-0 h-9"></td>
                  <td className="border border-black p-0 h-9"></td>
                  <td className="border border-black p-0 h-9"></td>
                  <td className="border border-black px-1.5 py-1 text-[10px] text-zinc-600"></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer Foglio A4 con Sezione Biofeedback Scritto */}
        <div className="mt-3.5 border border-black p-2.5 bg-zinc-50">
          <div className="flex items-center justify-between text-xs font-bold border-b border-zinc-300 pb-1.5 mb-1.5">
            <span>RPE Complessivo Seduta (cerchiare):</span>
            <span className="font-black tracking-widest">[ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ] [ 6 ] [ 7 ] [ 8 ] [ 9 ] [ 10 ]</span>
          </div>
          <div className="text-xs">
            <span className="font-bold">Note e sensazioni da comunicare al Coach:</span>
            <div className="border-b border-dotted border-zinc-400 mt-2.5 h-3.5"></div>
            <div className="border-b border-dotted border-zinc-400 mt-2.5 h-3.5"></div>
          </div>
        </div>

        <div className="mt-2.5 text-center text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
          Area46 Training Lab • Firenze • personaltrainer.firenze.it
        </div>
      </div>

      {/* Modale Video Clip In-Place (Zero Redirect a YouTube) */}
      <VideoClipModal
        open={videoModal.open}
        onOpenChange={(open) => setVideoModal((prev) => ({ ...prev, open }))}
        videoUrl={videoModal.url}
        nomeEsercizio={videoModal.nome}
        cueEsecutiva={videoModal.cue}
        patternMotorio={videoModal.pattern}
      />

      {/* Modale Feedback Post-Seduta */}
      <FeedbackSedutaModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        livello={livello || ""}
        giorno={String(giornoNum)}
      />
    </div>
  );
}