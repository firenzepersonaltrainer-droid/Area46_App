import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronRight,
  ChevronRight as Sep,
  Dumbbell,
  PlayCircle,
  Zap,
} from "lucide-react";
import { getLivelloColors } from "../lib/livelloStyle";

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
  const primo = esercizi[0];
  const haystack = `${primo.note_tecniche ?? ""} ${primo.parametri ?? ""}`;
  for (const { pattern, label } of CIRCUIT_KEYWORDS) {
    if (pattern.test(haystack)) return label;
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
          className="flex min-w-[2.6rem] items-center justify-center rounded-lg px-2 py-1 text-xs font-black shrink-0 shadow-xs"
          style={{
            background: inWod ? "#e3ff00" : "#09090b",
            color: inWod ? "#09090b" : "#ffffff",
            border: inWod ? "1px solid #09090b" : "1.5px solid #1c00ff",
          }}
        >
          {ex.sequenza}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-zinc-900 truncate leading-snug">{ex.nome_esercizio}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {ex.parametri && <span className="text-xs font-bold text-zinc-700">{ex.parametri}</span>}
            {ex.recupero && (
              <span className="text-[11px] font-bold text-[#1c00ff] bg-[#1c00ff]/10 px-1.5 py-0.5 rounded">
                Rec: {ex.recupero}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {ex.link_video && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shadow-xs"
            style={{ background: "#1c00ff", color: "#e3ff00" }}
          >
            <PlayCircle className="size-3 text-[#e3ff00]" />
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
        <Zap className="size-3.5" style={{ color: "#e3ff00" }} />
        <span className="text-xs font-black uppercase tracking-wider text-white">
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

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-secondary flex-wrap">
        <Link to="/" className="hover:text-primary">Allenamenti</Link>
        <Sep className="size-3.5" />
        <span className="text-primary font-medium">{cicloLabel ? `${cicloLabel} — ${giornoLabel}` : giornoLabel}</span>
      </nav>

      <div className="rounded-2xl bg-white border border-zinc-200 p-4 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#1c00ff]" />
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
                style={{ background: "#1c00ff", color: "#e3ff00" }}
              >
                {cicloLabel}
              </span>
            )}
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