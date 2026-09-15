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
      className="flex w-full cursor-pointer items-center justify-between rounded-lg p-4 hover:bg-inset text-left"
      style={{ background: inWod ? "rgba(28,0,255,0.04)" : "transparent" }}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div
          className="flex min-w-[2.5rem] items-center justify-center rounded-md px-2 py-1 text-xs font-bold shrink-0"
          style={{ background: inWod ? "#e3ff00" : "#1c00ff", color: inWod ? "#1c00ff" : "#ffffff" }}
        >
          {ex.sequenza}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-primary truncate">{ex.nome_esercizio}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {ex.parametri && <span className="text-[13.5px] font-bold text-zinc-800">{ex.parametri}</span>}
            {ex.recupero && <span className="text-[13px] font-semibold text-zinc-600">Rec: {ex.recupero}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {ex.link_video && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "#1c00ff", color: "#ffffff" }}>
            <PlayCircle className="size-3" />
            Video
          </span>
        )}
        <ChevronRight className="size-5 text-secondary" />
      </div>
    </button>
  );
}

function WodBlocco({ blocco, livello, giorno }: { blocco: Blocco; livello: string; giorno: string }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "2px solid #1c00ff" }}>
      <div className="flex items-center gap-2 px-4 py-2" style={{ background: "#1c00ff" }}>
        <Zap className="size-3.5" style={{ color: "#e3ff00" }} />
        <span className="text-xs font-bold" style={{ color: "#ffffff" }}>
          {extractCircuitTitle(blocco.esercizi)} — BLOCCO {blocco.key}
        </span>
      </div>
      <div className="divide-y divide-border">
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

      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">{giornoLabel}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {livello && (
              <span
                className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold"
                style={{ background: colors.background, color: colors.color, border: `1px solid ${colors.border}` }}
              >
                {livello}
              </span>
            )}
            {cicloLabel && (
              <span
                className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold"
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
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-inset" />)}
        </div>
      ) : blocchi.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Dumbbell className="size-10 text-secondary" />
          <p className="text-secondary">Nessun esercizio trovato per questo allenamento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {blocchi.map((blocco) =>
            blocco.isWod && blocco.esercizi.length > 1 ? (
              <WodBlocco key={blocco.key} blocco={blocco} livello={livello!} giorno={giorno!} />
            ) : (
              <div key={blocco.key} className="rounded-lg border border-border bg-raised overflow-hidden">
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