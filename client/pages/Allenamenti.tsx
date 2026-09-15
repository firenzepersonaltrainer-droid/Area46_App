import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  Dumbbell,
  CheckCircle2,
  Clock,
  Circle,
  Archive,
  ArrowLeft,
  AlertTriangle,
  Trash2,
  PlayCircle,
  BookOpen,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/Select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/Dialog";
import { Button } from "../components/Button";
import { toast } from "../components/Toast";
import { getLivelloColors } from "../lib/livelloStyle";
import { useLivelloMemoria } from "../lib/useLivelloMemoria";

type Stato = "non_iniziato" | "in_corso" | "completato";

interface GiornoItem {
  giorno: string;
  giorno_num: number;
  settimana: string;
  livello?: string;
}

interface StatoRecord {
  livello: string;
  giorno: number;
  stato: Stato;
  updated_at: string;
}

function labelGiornoTesto(item: GiornoItem): string {
  return item.giorno || `Giorno ${item.giorno_num}`;
}

function statoKey(livello: string, giornoNum: number): string {
  return `${livello}-${giornoNum}`;
}

interface ApprofondimentoItem {
  nome_esercizio: string;
  note_tecniche: string;
  link_video: string;
  data_pubblicazione: string | null;
}

function isNuovo(dataPubblicazione: string | null): boolean {
  if (!dataPubblicazione) return false;
  const pub = new Date(String(dataPubblicazione).slice(0, 10));
  const oggi = new Date();
  const diffGiorni = (oggi.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24);
  return diffGiorni <= 30;
}

function statoConfig(stato: Stato) {
  switch (stato) {
    case "completato":
      return { label: "Completato", color: "#34c759", bg: "rgba(52,199,89,0.12)", icon: CheckCircle2 };
    case "in_corso":
      return { label: "In corso", color: "#ff9500", bg: "rgba(255,149,0,0.12)", icon: Clock };
    default:
      return { label: "Da svolgere", color: "#ff3b30", bg: "rgba(255,59,48,0.10)", icon: Circle };
  }
}

interface ResetPending {
  livello: string;
  giornoNum: number;
  countLog: number;
}

function useResetConfirm(queryClient: ReturnType<typeof useQueryClient>) {
  const [pending, setPending] = useState<ResetPending | null>(null);
  const [resetting, setResetting] = useState(false);

  async function richiediReset(livello: string, giornoNum: number) {
    const res = await fetch(
      `/app-api/stati/reset-preview?livello=${encodeURIComponent(livello)}&giorno=${giornoNum}`,
    );
    const data = await res.json();
    setPending({ livello, giornoNum, countLog: data.count ?? 0 });
  }

  async function confermaReset() {
    if (!pending) return;
    setResetting(true);
    try {
      const res = await fetch("/app-api/stati/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livello: pending.livello, giorno: pending.giornoNum }),
      });
      const data = await res.json();
      const eliminati = data.eliminati ?? 0;
      queryClient.invalidateQueries({ queryKey: ["stati"] });
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      queryClient.invalidateQueries({ queryKey: ["tonnellaggio"] });
      if (eliminati > 0) {
        toast.success(`Allenamento ripristinato. ${eliminati} registrazion${eliminati === 1 ? "e eliminata" : "i eliminate"} dal Diario.`);
      } else {
        toast.success("Allenamento ripristinato come Da svolgere.");
      }
    } catch {
      toast.error("Errore durante il ripristino. Riprova.");
    } finally {
      setResetting(false);
      setPending(null);
    }
  }

  return { pending, resetting, richiediReset, confermaReset, annullaReset: () => setPending(null) };
}

function DialogConfermaReset({ pending, resetting, onConferma, onAnnulla }: {
  pending: ResetPending | null;
  resetting: boolean;
  onConferma: () => void;
  onAnnulla: () => void;
}) {
  return (
    <Dialog open={!!pending} onOpenChange={(open) => !open && onAnnulla()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-5" style={{ color: "#ff3b30" }} />
              Ripristina allenamento
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.25)" }}>
            <p className="font-semibold" style={{ color: "#ff3b30" }}>Questa azione è irreversibile.</p>
            <p className="mt-1 text-secondary leading-relaxed">
              Ripristinando l'allenamento come <strong style={{ color: "#ff3b30" }}>Da svolgere</strong>, tutti i carichi registrati per questo giorno verranno eliminati dal Diario.
            </p>
          </div>
          {pending && pending.countLog > 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-raised px-3 py-2.5">
              <Trash2 className="size-4 shrink-0" style={{ color: "#ff3b30" }} />
              <p className="text-sm text-primary">
                Verranno eliminate <strong>{pending.countLog}</strong> registrazion{pending.countLog === 1 ? "e" : "i"} dal Diario.
              </p>
            </div>
          ) : (
            <p className="text-sm text-secondary">Nessun dato nel Diario per questo giorno — lo stato verrà solo ripristinato.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onAnnulla} disabled={resetting}>Annulla</Button>
          <Button variant="primary" onClick={onConferma} isLoading={resetting} style={{ background: "#ff3b30", borderColor: "#ff3b30" }}>
            <Trash2 />
            Sì, elimina e ripristina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatoBadge({ stato }: { stato: Stato }) {
  const cfg = statoConfig(stato);
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="size-3" />
      {cfg.label}
    </span>
  );
}

function ApprofondimentiSection() {
  const { data: items = [], isLoading } = useQuery<ApprofondimentoItem[]>({
    queryKey: ["approfondimenti"],
    queryFn: () => fetch("/app-api/approfondimenti").then((r) => r.json()),
  });

  function getYouTubeId(url: string): string | null {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([^&?\s]+)/);
    return m ? m[1] : null;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-inset" />)}
      </div>
    );
  }

  const haNewVideo = (items || []).some((item) => isNuovo(item.data_pubblicazione));

  return (
    <div className="space-y-3">
      {haNewVideo && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(227,255,0,0.12)", border: "1.5px solid #e3ff00" }}>
          <span className="text-lg" role="img" aria-label="fuoco">🔥</span>
          <p className="text-sm font-bold" style={{ color: "#e3ff00", textShadow: "0 0 8px rgba(227,255,0,0.4)" }}>Nuovo Video Caricato!</p>
        </div>
      )}
      {(items || []).map((item, i) => {
        const ytId = getYouTubeId(item.link_video ?? "");
        const nuovo = isNuovo(item.data_pubblicazione);
        return (
          <div key={i} className="rounded-lg border bg-raised p-4 flex items-start gap-4" style={{ borderColor: nuovo ? "#e3ff00" : "var(--color-border)", borderWidth: nuovo ? 1.5 : 1 }}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: "#374151" }}>
              <BookOpen className="size-5" style={{ color: "#ffffff" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-primary text-sm">{item.nome_esercizio}</p>
                {nuovo && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "#e3ff00", color: "#1c00ff" }}>Nuovo</span>
                )}
              </div>
              {item.note_tecniche && <p className="text-xs text-secondary mt-0.5 leading-relaxed">{item.note_tecniche}</p>}
            </div>
            {ytId && (
              <a href={item.link_video} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer" style={{ background: "#1c00ff", color: "#ffffff" }}>
                  <PlayCircle className="size-3.5" />
                  Video
                </button>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GiornoCard({ livello, giornoNum, label, stato, showLivello, onStatoChange }: {
  livello: string;
  giornoNum: number;
  label: string;
  stato: Stato;
  showLivello: boolean;
  onStatoChange: (livello: string, giornoNum: number, stato: Stato) => void;
}) {
  const navigate = useNavigate();
  const cfg = statoConfig(stato);
  const [menuAperto, setMenuAperto] = useState(false);

  return (
    <div className="relative">
      <div
        className="flex w-full items-center justify-between rounded-xl border bg-white p-3.5 cursor-pointer hover:bg-zinc-50 shadow-xs transition-all"
        style={{ borderColor: stato !== "non_iniziato" ? cfg.color : "#e4e4e7", borderWidth: stato !== "non_iniziato" ? 2 : 1 }}
        onClick={() => navigate(`/allenamento/${encodeURIComponent(livello)}/${giornoNum}`)}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-black shadow-xs"
            style={{
              background: "#09090b",
              color: "#ffffff",
              border: `2px solid ${cfg.color}`,
            }}
          >
            {giornoNum}
          </div>
          <div className="min-w-0 text-left">
            <p className="font-bold text-zinc-900 leading-snug">{label}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {showLivello && livello && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{ background: "#1c00ff", color: "#e3ff00" }}
                >
                  {livello}
                </span>
              )}
              <StatoBadge stato={stato} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button onClick={(e) => { e.stopPropagation(); setMenuAperto((v) => !v); }} className="rounded-md p-1.5 cursor-pointer hover:opacity-70" aria-label="Cambia stato">
            <cfg.icon className="size-5" style={{ color: cfg.color }} />
          </button>
          <ChevronRight className="size-5 text-zinc-400" />
        </div>
      </div>
      {menuAperto && (
        <div className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden shadow-2xl border border-zinc-200 bg-white" style={{ minWidth: 160 }}>
          {(["non_iniziato", "in_corso", "completato"] as Stato[]).map((s) => {
            const c = statoConfig(s);
            const attivo = stato === s;
            return (
              <button key={s} onClick={(e) => { e.stopPropagation(); setMenuAperto(false); onStatoChange(livello, giornoNum, s); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-semibold cursor-pointer hover:opacity-80" style={{ background: attivo ? c.bg : "transparent", color: c.color }}>
                <c.icon className="size-4" />
                {c.label}
                {attivo && <span className="ml-auto text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function raggruppaPerSettimana(giorni: GiornoItem[]): Array<[string, GiornoItem[]]> {
  const map = new Map<string, GiornoItem[]>();
  for (const item of giorni || []) {
    const key = item.settimana || "Allenamenti";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries());
}

function ListaGiorni({ giorni, livelloFiltro, statoMap, onStatoChange }: {
  giorni: GiornoItem[];
  livelloFiltro: string;
  statoMap: Map<string, Stato>;
  onStatoChange: (livello: string, giornoNum: number, stato: Stato) => void;
}) {
  const gruppi = raggruppaPerSettimana(giorni);
  if (giorni.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <Dumbbell className="size-10 text-zinc-400" />
        <p className="text-zinc-500">Nessun allenamento disponibile.</p>
      </div>
    );
  }
  const mostraHeader = gruppi.length > 1 || (gruppi.length === 1 && gruppi[0][0] !== "Allenamenti");
  return (
    <div className="space-y-6">
      {gruppi.map(([settimana, items]) => (
        <div key={settimana}>
          {mostraHeader && (
            <div
              className="rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between shadow-xs"
              style={{ background: "#1c00ff", borderLeft: "5px solid #e3ff00" }}
            >
              <span className="text-sm font-black uppercase tracking-wider text-white">
                {settimana}
              </span>
              <span
                className="text-[11px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "#09090b", color: "#e3ff00" }}
              >
                {items.length} {items.length === 1 ? "giorno" : "giorni"}
              </span>
            </div>
          )}
          <div className="space-y-2">
            {items.map((item) => {
              const lv = livelloFiltro || item.livello || "";
              const stato = (statoMap.get(statoKey(lv, item.giorno_num)) as Stato) || "non_iniziato";
              return (
                <GiornoCard key={statoKey(lv, item.giorno_num)} livello={lv} giornoNum={item.giorno_num} label={labelGiornoTesto(item)} stato={stato} showLivello={!livelloFiltro} onStatoChange={onStatoChange} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ArchivioAllenamentiPage() {
  const { livello, setLivello } = useLivelloMemoria();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const reset = useResetConfirm(queryClient);
  const [searchParams] = useSearchParams();
  const livelloParam = searchParams.get("livello");
  const livelloEffettivo = livelloParam ?? livello;

  const { data: livelli = [] } = useQuery<string[]>({ queryKey: ["livelli"], queryFn: () => fetch("/app-api/livelli").then((r) => r.json()) });
  const livelliAllenamento = (livelli || []).filter((l) => l !== "Approfondimenti ed extra");
  const { data: giorni = [], isLoading } = useQuery<GiornoItem[]>({
    queryKey: ["allenamenti", livelloEffettivo],
    queryFn: () => fetch(`/app-api/allenamenti${livelloEffettivo ? `?livello=${encodeURIComponent(livelloEffettivo)}` : ""}`).then((r) => r.json()),
  });
  const { data: stati = [] } = useQuery<StatoRecord[]>({ queryKey: ["stati"], queryFn: () => fetch("/app-api/stati").then((r) => r.json()) });
  const statoMap = new Map<string, Stato>((stati || []).map((s) => [statoKey(s.livello, s.giorno), s.stato]));

  async function handleStatoChange(lv: string, giornoNum: number, stato: Stato) {
    const statoCorrente = statoMap.get(statoKey(lv, giornoNum)) ?? "non_iniziato";
    if (stato === "non_iniziato" && statoCorrente !== "non_iniziato") { await reset.richiediReset(lv, giornoNum); return; }
    await fetch("/app-api/stati", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ livello: lv, giorno: giornoNum, stato }) });
    queryClient.invalidateQueries({ queryKey: ["stati"] });
  }

  return (
    <>
      <DialogConfermaReset pending={reset.pending} resetting={reset.resetting} onConferma={reset.confermaReset} onAnnulla={reset.annullaReset} />
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="rounded-md p-1.5 hover:bg-inset cursor-pointer" aria-label="Torna alla home"><ArrowLeft className="size-5 text-secondary" /></button>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Archivio Allenamenti</h1>
        </div>
        <Select value={livelloEffettivo} onValueChange={setLivello}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tutti i livelli" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tutti i livelli</SelectItem>
            {livelliAllenamento.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-secondary"><CheckCircle2 className="size-3.5" style={{ color: "#16a34a" }} />Completato</span>
          <span className="flex items-center gap-1.5 text-xs text-secondary"><Clock className="size-3.5" style={{ color: "#ea580c" }} />In corso</span>
          <span className="flex items-center gap-1.5 text-xs text-secondary"><Circle className="size-3.5 text-secondary" />Da svolgere</span>
        </div>
        {isLoading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-inset" />)}</div>
        ) : (
          <ListaGiorni giorni={giorni} livelloFiltro={livelloEffettivo} statoMap={statoMap} onStatoChange={handleStatoChange} />
        )}
      </div>
    </>
  );
}

export default function AllenamentiPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { livello, setLivello } = useLivelloMemoria();
  const reset = useResetConfirm(queryClient);

  const { data: livelli = [] } = useQuery<string[]>({ queryKey: ["livelli"], queryFn: () => fetch("/app-api/livelli").then((r) => r.json()) });
  const livelliAllenamento = (livelli || []).filter((l) => l !== "Approfondimenti ed extra");
  const { data: giorni = [], isLoading: loadingGiorni } = useQuery<GiornoItem[]>({
    queryKey: ["allenamenti", livello],
    queryFn: () => fetch(`/app-api/allenamenti${livello ? `?livello=${encodeURIComponent(livello)}` : ""}`).then((r) => r.json()),
  });
  const { data: stati = [], isLoading: loadingStati } = useQuery<StatoRecord[]>({ queryKey: ["stati"], queryFn: () => fetch("/app-api/stati").then((r) => r.json()) });
  const isLoading = loadingGiorni || loadingStati;
  const statoMap = new Map<string, Stato>((stati || []).map((s) => [statoKey(s.livello, s.giorno), s.stato]));

  async function handleStatoChange(lv: string, giornoNum: number, stato: Stato) {
    const statoCorrente = statoMap.get(statoKey(lv, giornoNum)) ?? "non_iniziato";
    if (stato === "non_iniziato" && statoCorrente !== "non_iniziato") { await reset.richiediReset(lv, giornoNum); return; }
    await fetch("/app-api/stati", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ livello: lv, giorno: giornoNum, stato }) });
    queryClient.invalidateQueries({ queryKey: ["stati"] });
  }

  const lista = giorni || [];
  const correnteItem = React.useMemo(() => {
    const inCorso = lista.find((item) => { const lv = livello || item.livello || ""; return statoMap.get(statoKey(lv, item.giorno_num)) === "in_corso"; });
    if (inCorso) return { item: inCorso, tipo: "in_corso" as Stato };
    const prossimo = lista.find((item) => { const lv = livello || item.livello || ""; const s = statoMap.get(statoKey(lv, item.giorno_num)); return !s || s === "non_iniziato"; });
    if (prossimo) return { item: prossimo, tipo: "non_iniziato" as Stato };
    return null;
  }, [giorni, stati, livello]);

  const tuttiCompletati = !isLoading && lista.length > 0 && lista.every((item) => { const lv = livello || item.livello || ""; return statoMap.get(statoKey(lv, item.giorno_num)) === "completato"; });
  const completati = lista.filter((item) => { const lv = livello || item.livello || ""; return statoMap.get(statoKey(lv, item.giorno_num)) === "completato"; }).length;
  const isApprofondimenti = livello === "Approfondimenti ed extra";
  const archivioHref = livello ? `/archivio?livello=${encodeURIComponent(livello)}` : "/archivio";

  return (
    <>
      <DialogConfermaReset pending={reset.pending} resetting={reset.resetting} onConferma={reset.confermaReset} onAnnulla={reset.annullaReset} />
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Allenamenti</h1>
          <Link to={archivioHref}><Button variant="secondary" size="sm"><Archive className="size-4" />Archivio completo</Button></Link>
        </div>
        {(livelli || []).length > 1 && (
          <Select value={livello} onValueChange={setLivello}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Tutti i livelli" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tutti i livelli</SelectItem>
              {livelliAllenamento.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              {(livelli || []).includes("Approfondimenti ed extra") && <SelectItem value="Approfondimenti ed extra">Approfondimenti ed extra</SelectItem>}
            </SelectContent>
          </Select>
        )}
        {isApprofondimenti ? (
          <div className="space-y-4">
            <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "#374151" }}>
              <BookOpen className="size-5" style={{ color: "#ffffff" }} />
              <p className="text-sm font-semibold" style={{ color: "#ffffff" }}>Video teorici e contenuti extra del Lab</p>
            </div>
            <ApprofondimentiSection />
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            <div className="h-32 animate-pulse rounded-xl bg-inset" />
            <div className="h-6 w-40 animate-pulse rounded bg-inset" />
          </div>
        ) : tuttiCompletati ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CheckCircle2 className="size-12" style={{ color: "#16a34a" }} />
            <p className="text-lg font-semibold text-primary">Tutti gli allenamenti completati!</p>
            <p className="text-sm text-secondary">{lista.length} allenamenti su {lista.length} completati.</p>
            <Link to={archivioHref}><Button variant="secondary" size="sm"><Archive />Vedi archivio</Button></Link>
          </div>
        ) : (
          <div className="space-y-6">
            {correnteItem && (
              <div className="space-y-2">
                <p className="text-xs font-black text-zinc-500 uppercase tracking-wider">{correnteItem.tipo === "in_corso" ? "In corso" : "Prossimo allenamento"}</p>
                <div
                  className="rounded-2xl border-2 p-5 cursor-pointer hover:shadow-md transition-all relative overflow-hidden bg-white"
                  style={{
                    borderColor: correnteItem.tipo === "in_corso" ? "#ea580c" : "#1c00ff",
                  }}
                  onClick={() => {
                    const lv = livello || correnteItem.item.livello || "";
                    navigate(`/allenamento/${encodeURIComponent(lv)}/${correnteItem.item.giorno_num}`);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black shadow-md"
                        style={{
                          background: "#09090b",
                          color: "#e3ff00",
                          border: `2px solid ${correnteItem.tipo === "in_corso" ? "#ea580c" : "#1c00ff"}`,
                        }}
                      >
                        {correnteItem.item.giorno_num}
                      </div>
                      <div>
                        <p className="text-xl font-black text-zinc-900 tracking-tight leading-tight">
                          {labelGiornoTesto(correnteItem.item)}
                        </p>
                        {(livello || correnteItem.item.livello) && (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wider mt-1"
                            style={{ background: "#1c00ff", color: "#e3ff00" }}
                          >
                            {livello || correnteItem.item.livello}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-6 shrink-0" style={{ color: correnteItem.tipo === "in_corso" ? "#ea580c" : "#1c00ff" }} />
                  </div>
                  {lista.length > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-bold text-zinc-500 mb-1.5">
                        <span>Avanzamento Ciclo</span>
                        <span className="text-zinc-900 font-black">{completati}/{lista.length} completati</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round((completati / lista.length) * 100)}%`,
                            background: "linear-gradient(90deg, #1c00ff 0%, #e3ff00 100%)",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["non_iniziato", "in_corso", "completato"] as Stato[]).map((s) => {
                    const cfg = statoConfig(s);
                    const lv = livello || correnteItem.item.livello || "";
                    const attivo = (statoMap.get(statoKey(lv, correnteItem.item.giorno_num)) || "non_iniziato") === s;
                    return (
                      <button key={s} onClick={() => handleStatoChange(lv, correnteItem.item.giorno_num, s)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border-2 cursor-pointer transition-all" style={{ background: attivo ? cfg.color : "transparent", color: attivo ? "#ffffff" : cfg.color, borderColor: cfg.color, opacity: attivo ? 1 : 0.65 }}>
                        <cfg.icon className="size-3" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {(() => {
              const recenti = lista.filter((item) => { const lv = livello || item.livello || ""; const s = statoMap.get(statoKey(lv, item.giorno_num)); return s === "in_corso" || s === "completato"; }).slice(-4).reverse();
              if (recenti.length === 0) return null;
              return (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Recenti</p>
                  <div className="space-y-2">
                    {recenti.map((item) => {
                      const lv = livello || item.livello || "";
                      const stato = (statoMap.get(statoKey(lv, item.giorno_num)) as Stato) || "non_iniziato";
                      return <GiornoCard key={statoKey(lv, item.giorno_num)} livello={lv} giornoNum={item.giorno_num} label={labelGiornoTesto(item)} stato={stato} showLivello={!livello} onStatoChange={handleStatoChange} />;
                    })}
                  </div>
                  <Link to={archivioHref} className="block">
                    <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm text-secondary hover:bg-inset cursor-pointer"><Archive className="size-4" />Vedi tutti gli allenamenti</button>
                  </Link>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}