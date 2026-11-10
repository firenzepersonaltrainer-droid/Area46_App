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
} from "lucide-react";
import { getLivelloColors } from "../lib/livelloStyle";
import { toast } from "sonner";
import { useAllenamentiStati, type StatoAllenamento } from "../lib/useAllenamentiStati";
import { VideoClipModal } from "../components/VideoClipModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/Dialog";
import { Textarea } from "../components/Textarea";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSensazione = (s: string) => {
    setSelectedSensazioni((prev) =>
      prev.includes(s) ? prev.filter((item) => item !== s) : [...prev, s]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
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
        toast.success("Feedback seduta registrato nel tuo diario!");
        queryClient.invalidateQueries({ queryKey: ["diario"] });
        onOpenChange(false);
      } else {
        toast.error("Errore nel salvataggio del feedback.");
      }
    } catch {
      toast.error("Errore di connessione.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 bg-white rounded-3xl shadow-2xl border-2 border-zinc-200">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1c00ff] text-[#e3ff00]">
              Post-Workout
            </span>
          </div>
          <DialogTitle className="text-xl font-black text-zinc-900 tracking-tight">
            Feedback Seduta & RPE
          </DialogTitle>
          <p className="text-xs text-zinc-500 font-medium">
            Registra le tue sensazioni in 3 secondi per orientare il carico del prossimo ciclo.
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

          {/* Note Cinestesiche Opzionali */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Note o commento per il Coach (opzionale):
            </label>
            <Textarea
              placeholder="Es. ottima coordinazione al coiled deadlift, stanchezza sul finire del WOD…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs h-20 rounded-xl"
            />
          </div>

          {/* Bottone Salvataggio */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="px-5 py-2.5 bg-[#1c00ff] text-white rounded-xl text-xs font-black shadow-md hover:bg-[#1600cc] transition-colors cursor-pointer"
            >
              {isSubmitting ? "Salvataggio…" : "Salva Feedback"}
            </button>
          </div>
        </div>
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

  const blocchi = React.useMemo(() => raggruppa(esercizi), [esercizi]);
  const giornoDisplay = giorno ?? "";
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

  // Estrazione del numero giorno intero
  const numMatch = String(giornoDisplay).match(/[0-9]+/);
  const giornoNum = numMatch ? parseInt(numMatch[0], 10) : parseInt(giornoDisplay, 10) || 1;

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

      {/* Header Info Giorno (Elegante anche per la stampa) */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-4 shadow-xs relative overflow-hidden print:border-black print:shadow-none">
        <div
          className="absolute top-0 left-0 bottom-0 w-1.5 print:hidden"
          style={{ background: isCicloScarico ? "#3b82f6" : "#1c00ff" }}
        />
        <div className="pl-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">{giornoLabel}</h1>
            <span className="hidden print:inline-block text-xs font-black uppercase text-zinc-600">
              Area46 Training Lab Handout
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
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
          </div>
        </div>
      </div>

      {/* CONTROLLO STATO ALLENAMENTO & PULSANTE FEEDBACK POST-SEDUTA (Nascosto in Stampa) */}
      <div
        className="rounded-2xl border-2 bg-white p-4 shadow-xs transition-all print:hidden"
        style={{
          borderColor: isCompletato ? "#34c759" : statoCorrente === "in_corso" ? "#ff9500" : "#e4e4e7",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Casella di Spunta Principale */}
          <button
            type="button"
            onClick={handleToggle}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer shadow-xs select-none ${
              isCompletato
                ? "bg-[#e3ff00] text-zinc-950 border-2 border-zinc-950 hover:bg-[#d6f000]"
                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-2 border-zinc-300"
            }`}
            title={isCompletato ? "Clicca per deselezionare l'allenamento" : "Clicca per segnare come completato"}
          >
            <span
              className={`size-6 rounded-lg flex items-center justify-center border-2 transition-all ${
                isCompletato
                  ? "bg-zinc-950 border-zinc-950 text-[#e3ff00]"
                  : "bg-white border-zinc-400 text-transparent"
              }`}
            >
              {isCompletato ? <CheckSquare className="size-4.5 stroke-[3]" /> : <Square className="size-4.5" />}
            </span>
            <span>{isCompletato ? "Allenamento Completato" : "Segna come completato"}</span>
          </button>

          {/* Pulsante Rapido Feedback Seduta Post-Workout */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-[#1c00ff] text-white hover:bg-[#1600cc] shadow-xs transition-colors cursor-pointer"
            >
              <MessageSquare className="size-3.5 text-[#e3ff00]" />
              <span>Feedback & RPE</span>
            </button>

            {/* Selettore 3 Stati Rapido */}
            <div className="flex items-center gap-1">
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                      attivo ? "ring-2 ring-offset-1 font-black" : "opacity-70 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: attivo ? cfg.bg : "#ffffff",
                      borderColor: cfg.color,
                      color: cfg.color,
                    }}
                  >
                    <Icon className="size-3" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Lista Blocchi Esercizi */}
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