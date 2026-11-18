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
} from "lucide-react";
import { getLivelloColors } from "../lib/livelloStyle";
import { toast } from "sonner";
import { useAllenamentiStati, type StatoAllenamento } from "../lib/useAllenamentiStati";
import { VideoClipModal } from "../components/VideoClipModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/Dialog";
import { Textarea } from "../components/Textarea";
import { AudioFeedbackRecorder } from "../components/AudioFeedbackRecorder";

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
  const [receivedAdvice, setReceivedAdvice] = useState<CoachAdviceFeedback | null>(null);

  const toggleSensazione = (s: string) => {
    setSelectedSensazioni((prev) =>
      prev.includes(s) ? prev.filter((item) => item !== s) : [...prev, s]
    );
  };

  const handleClose = () => {
    setReceivedAdvice(null);
    setRecordedAudio(null);
    setNote("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let adviceData: CoachAdviceFeedback | null = null;

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
          const data = await res.json();
          const noteObj = data.audio_note || {};
          adviceData = {
            allerta: noteObj.ai_allerta,
            sintesi: noteObj.ai_sintesi,
            propostaAzione: noteObj.ai_proposta_azione,
            consiglioCoach: noteObj.consiglio_coach,
          };
          queryClient.invalidateQueries({ queryKey: ["diario"] });
          queryClient.invalidateQueries({ queryKey: ["audio-notes"] });
          toast.success("Nota vocale e biofeedback analizzati con successo!");
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
          const data = await res.json();
          const itemObj = data.item || {};
          adviceData = {
            allerta: itemObj.ai_allerta,
            sintesi: itemObj.ai_sintesi,
            propostaAzione: itemObj.ai_proposta_azione,
            consiglioCoach: itemObj.consiglio_coach,
          };
          queryClient.invalidateQueries({ queryKey: ["diario"] });
          toast.success("Feedback seduta registrato nel tuo diario!");
        } else {
          toast.error("Errore nel salvataggio del feedback.");
        }
      }

      if (adviceData && (adviceData.consiglioCoach || adviceData.sintesi)) {
        setReceivedAdvice(adviceData);
      } else {
        handleClose();
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
        {receivedAdvice ? (
          /* Schermata Responso & Consiglio del Coach Stefano */
          <div className="space-y-4 pt-1 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1c00ff] text-[#e3ff00]">
                Analisi AI Biofeedback
              </span>
              {receivedAdvice.allerta && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    receivedAdvice.allerta === "rosso"
                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                      : receivedAdvice.allerta === "giallo"
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  }`}
                >
                  {receivedAdvice.allerta === "rosso"
                    ? "🔴 Allerta Sovraccarico"
                    : receivedAdvice.allerta === "giallo"
                    ? "🟡 Attenzione / Scarico"
                    : "🟢 Segnale Ottimale"}
                </span>
              )}
            </div>

            <DialogTitle className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <Bot className="size-5 text-[#1c00ff]" />
              Risposta del Coach Stefano
            </DialogTitle>

            {receivedAdvice.sintesi && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block mb-1">
                  Sintesi Rilevata
                </span>
                <p className="text-xs text-zinc-700 leading-relaxed font-medium">
                  {receivedAdvice.sintesi}
                </p>
              </div>
            )}

            {receivedAdvice.consiglioCoach && (
              <div className="bg-[#09090b] text-white border-2 border-[#1c00ff] rounded-2xl p-4 shadow-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="size-4 text-[#e3ff00]" />
                  <span className="text-xs font-black uppercase tracking-wider text-[#e3ff00]">
                    Consiglio Operativo del Coach:
                  </span>
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed font-semibold">
                  "{receivedAdvice.consiglioCoach}"
                </p>
                {receivedAdvice.propostaAzione && (
                  <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-400">
                    <span className="text-zinc-300 font-bold">Azione raccomandata: </span>
                    {receivedAdvice.propostaAzione}
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end">
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
    const match = diarioEntries
      .filter(
        (e) =>
          (e.livello === livello || !e.livello) &&
          (String(e.giorno) === String(giornoDisplay) || String(e.giorno) === String(giornoNum)) &&
          (e.tipo === "feedback_seduta" || e.tipo === "audio_note") &&
          Boolean(e.consiglio_coach)
      )
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    return match;
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb e Azioni Handout (Nascosto in Stampa) */}
      <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
        <nav className="flex items-center gap-1 text-sm text-secondary flex-wrap">
          <Link to="/" className="hover:text-primary">
            Allenamenti
          </Link>
          <Sep className="size-3.5" />
          <span className="text-primary font-medium">
            {cicloLabel ? `${cicloLabel} — ${giornoLabel}` : giornoLabel}
          </span>
        </nav>

        {/* Pulsante Stampa Handout / Esporta PDF */}
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-800 shadow-xs transition-colors cursor-pointer"
          title="Stampa la scheda allenamento o salvala in PDF"
        >
          <Printer className="size-3.5 text-zinc-600" />
          <span>Stampa Handout</span>
        </button>
      </div>

      {/* Header Info Giorno compatto in unica linea (Massimo recupero spazio verticale e simmetria orizzontale) */}
      <div className="rounded-2xl bg-white border border-zinc-200 px-4 py-2.5 shadow-xs relative overflow-hidden print:border-black print:shadow-none">
        <div
          className="absolute top-0 left-0 bottom-0 w-1.5 print:hidden"
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
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider print:border print:border-black print:bg-white print:text-black"
                style={{ background: "#09090b", color: "#ffffff" }}
              >
                {livello}
              </span>
            )}
            {cicloLabel && (
              <span
                className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-black uppercase tracking-wider print:border print:border-black print:bg-zinc-100 print:text-black"
                style={{ background: isCicloScarico ? "#3b82f6" : "#1c00ff", color: "#e3ff00" }}
              >
                {cicloLabel}
              </span>
            )}
            <span className="hidden print:inline-block text-xs font-black uppercase text-zinc-600">
              Area46 Handout
            </span>
          </div>
        </div>
      </div>

      {/* CARD CONSIGLIO DEL COACH STEFANO PER QUESTA SEDUTA (Se presente) */}
      {coachAdvice && (
        <div className="rounded-2xl bg-[#09090b] border-2 border-[#1c00ff] p-3.5 sm:p-4 text-white shadow-xl space-y-2 print:hidden animate-in fade-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#e3ff00]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#e3ff00]">
                Consiglio del Coach Stefano per questa Seduta
              </span>
            </div>
            {coachAdvice.ai_allerta && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  coachAdvice.ai_allerta === "rosso"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : coachAdvice.ai_allerta === "giallo"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {coachAdvice.ai_allerta === "rosso"
                  ? "🔴 Modalità B / Cautela"
                  : coachAdvice.ai_allerta === "giallo"
                  ? "🟡 Affaticamento Rilevato"
                  : "🟢 Progressione Libera"}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-200 font-medium leading-relaxed">
            "{coachAdvice.consiglio_coach}"
          </p>
          {coachAdvice.ai_proposta_azione && (
            <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-400">
              <span className="text-zinc-300 font-bold">Azione raccomandata: </span>
              {coachAdvice.ai_proposta_azione}
            </div>
          )}
        </div>
      )}

      {/* Lista Blocchi Esercizi (In primo piano per azzerare lo scorrimento e lo spreco verticale) */}
      {isLoading ? (
        <div className="space-y-3 print:hidden">
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
        <div className="space-y-3 print:space-y-2">
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
                className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs divide-y divide-zinc-100 print:border-black print:rounded-none"
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

      {/* CONTROLLO STATO ALLENAMENTO & PULSANTE FEEDBACK POST-SEDUTA A FINE SCHERMATA (Ergonomia di chiusura seduta) */}
      <div
        className="rounded-2xl border-2 bg-white p-3.5 sm:p-4 shadow-sm transition-all print:hidden"
        style={{
          borderColor: isCompletato ? "#34c759" : statoCorrente === "in_corso" ? "#ff9500" : "#e4e4e7",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Tasto Principale di Completamento Seduta */}
          <button
            type="button"
            onClick={handleToggle}
            className={`flex items-center justify-center sm:justify-start gap-2.5 px-4 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer shadow-xs select-none w-full sm:w-auto ${
              isCompletato
                ? "bg-[#e3ff00] text-zinc-950 border-2 border-zinc-950 hover:bg-[#d6f000]"
                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-2 border-zinc-300"
            }`}
            title={isCompletato ? "Clicca per deselezionare l'allenamento" : "Clicca per segnare come completato"}
          >
            <span
              className={`size-5 rounded-md flex items-center justify-center border-2 transition-all ${
                isCompletato
                  ? "bg-zinc-950 border-zinc-950 text-[#e3ff00]"
                  : "bg-white border-zinc-400 text-transparent"
              }`}
            >
              {isCompletato ? <CheckSquare className="size-3.5 stroke-[3]" /> : <Square className="size-3.5" />}
            </span>
            <span>{isCompletato ? "Allenamento Completato" : "Segna come completato"}</span>
          </button>

          {/* Controlli Secondari: Feedback & RPE + Selettore di Stato (Simmetria orizzontale, 1 linea su desktop, 2ª linea su mobile) */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* Pulsante Rapido Feedback Seduta Post-Workout */}
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-[#1c00ff] text-white hover:bg-[#1600cc] shadow-xs transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <MessageSquare className="size-3.5 text-[#e3ff00]" />
              <span>Feedback & RPE</span>
            </button>

            {/* Selettore Rapido Stati */}
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { id: "non_iniziato" as StatoAllenamento, label: "Da svolgere", color: "#ff3b30", bg: "rgba(255,59,48,0.10)", icon: Circle },
                { id: "in_corso" as StatoAllenamento, label: "In corso", color: "#ff9500", bg: "rgba(255,149,0,0.12)", icon: Clock },
              ].map((cfg) => {
                const attivo = statoCorrente === cfg.id;
                const Icon = cfg.icon;
                return (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={() => handleSelectStato(cfg.id)}
                    className={`inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      attivo ? "ring-2 ring-offset-1 font-black" : "opacity-75 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: attivo ? cfg.bg : "#ffffff",
                      borderColor: cfg.color,
                      color: cfg.color,
                    }}
                  >
                    <Icon className="size-3" />
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
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