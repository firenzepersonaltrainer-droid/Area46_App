import React from "react";
import { useQuery } from "@tanstack/react-query";
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
  ArrowLeft,
} from "lucide-react";
import { getLivelloColors } from "../lib/livelloStyle";
import { toast } from "../components/Toast";
import { useAllenamentiStati, type StatoAllenamento } from "../lib/useAllenamentiStati";

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
  // Combina i testi di tutti gli esercizi del blocco
  const fullText = esercizi
    .map((e) => `${e.note_tecniche ?? ""} ${e.parametri ?? ""}`)
    .join(" ");

  // 1. Rileva durata per AMRAP (es. "AMRAP 12'", "AMRAP - 20 minuti", "AMRAP 5 min")
  const amrapMatch = fullText.match(/\bamrap\b[^\d\n\r]{0,10}(\d{1,3})\s*(?:'|’|min|minuti)?/i);
  if (amrapMatch && amrapMatch[1]) {
    return `AMRAP ${amrapMatch[1]} min`;
  }
  if (/\bamrap\b/i.test(fullText)) {
    return "AMRAP";
  }

  // 2. Rileva durata per EMOM (es. "6 x EMOM 10'", "EMOM 12 min", "EMOM 8'")
  const emomMatch = fullText.match(/\bemom\b[^\d\n\r]{0,10}(\d{1,3})\s*(?:'|’|min|minuti)?/i);
  if (emomMatch && emomMatch[1]) {
    return `EMOM ${emomMatch[1]} min`;
  }
  if (/\bemom\b/i.test(fullText)) {
    return "EMOM";
  }

  // 3. Altre tipologie di circuito
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

function EsercizioRow({ ex, livello, giorno, inWod }: {
  ex: Esercizio;
  livello: string;
  giorno: string;
  inWod: boolean;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() =>
        navigate(`/esercizio/${encodeURIComponent(livello)}/${giorno}/${encodeURIComponent(ex.id_esercizio)}`)
      }
      className="flex w-full cursor-pointer items-center justify-between p-3.5 hover:bg-zinc-50 text-left transition-colors"
      style={{ background: inWod ? "rgba(28,0,255,0.03)" : "transparent" }}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div
          className="flex min-w-[2.8rem] items-center justify-center rounded-xl px-2 py-1.5 text-xs font-black shrink-0 shadow-xs"
          style={{
            background: inWod ? "#e3ff00" : "#09090b",
            color: inWod ? "#09090b" : "#ffffff",
            border: inWod ? "1px solid #09090b" : "1.5px solid #1c00ff",
          }}
        >
          {ex.sequenza}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-zinc-900 text-[15px] sm:text-base truncate leading-snug">{ex.nome_esercizio}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {ex.parametri && <span className="text-xs sm:text-sm font-semibold text-zinc-700">{ex.parametri}</span>}
            {ex.recupero && (
              <span className="text-xs font-bold text-[#1c00ff] bg-[#1c00ff]/10 px-2 py-0.5 rounded-md">
                Rec: {ex.recupero}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {ex.link_video && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-xs"
            style={{ background: "#1c00ff", color: "#e3ff00" }}
          >
            <PlayCircle className="size-3.5 text-[#e3ff00]" />
            Video
          </span>
        )}
        <ChevronRight className="size-5 text-zinc-400" />
      </div>
    </button>
  );
}

function WodBlocco({ blocco, livello, giorno }: { blocco: Blocco; livello: string; giorno: string }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xs bg-white" style={{ border: "2px solid #1c00ff" }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#1c00ff" }}>
        <Zap className="size-4" style={{ color: "#e3ff00" }} />
        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
          {extractCircuitTitle(blocco.esercizi)} — BLOCCO {blocco.key}
        </span>
      </div>
      <div className="divide-y divide-zinc-100">
        {blocco.esercizi.map((ex) => (
          <EsercizioRow key={ex.id} ex={ex} livello={livello} giorno={giorno} inWod={true} />
        ))}
      </div>
    </div>
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

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-secondary flex-wrap">
        <Link to="/" className="hover:text-primary">Allenamenti</Link>
        <Sep className="size-3.5" />
        <span className="text-primary font-medium">{cicloLabel ? `${cicloLabel} — ${giornoLabel}` : giornoLabel}</span>
      </nav>

      {/* Header Info Giorno */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-4 shadow-xs relative overflow-hidden">
        <div
          className="absolute top-0 left-0 bottom-0 w-1.5"
          style={{ background: isCicloScarico ? "#3b82f6" : "#1c00ff" }}
        />
        <div className="pl-1">
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">{giornoLabel}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
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

      {/* CASELLA DI SPUNTA E CONTROLLO STATO ALLENAMENTO */}
      <div
        className="rounded-2xl border-2 bg-white p-4 shadow-xs transition-all"
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
            <span>
              {isCompletato ? "Allenamento Completato" : "Segna come completato"}
            </span>
          </button>

          {/* Selettore 3 Stati Rapido */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-zinc-500 uppercase mr-1">Stato:</span>
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                    attivo
                      ? "ring-2 ring-offset-1 font-black"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: attivo ? cfg.bg : "#ffffff",
                    borderColor: cfg.color,
                    color: cfg.color,
                  }}
                >
                  <Icon className="size-3.5" />
                  {cfg.label}
                  {attivo && <span className="ml-1 text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-200" />)}
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
              <WodBlocco key={blocco.key} blocco={blocco} livello={livello!} giorno={giorno!} />
            ) : (
              <div key={blocco.key} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs divide-y divide-zinc-100">
                {blocco.esercizi.map((ex) => (
                  <EsercizioRow key={ex.id} ex={ex} livello={livello!} giorno={giorno!} inWod={false} />
                ))}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}