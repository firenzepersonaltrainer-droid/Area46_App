import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookMarked, Trash2, ChevronDown, ChevronUp, ChevronLeft,
  BarChart2, List, Search, X, Pencil,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "../components/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { toast } from "../components/Toast";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { session } from "../../auth";

interface SetEntry {
  carico_kg: number | null;
  ripetizioni: number;
  rpe?: string | null;
}

function parseRpe(rpe: string | null | undefined): number | null {
  if (!rpe) return null;
  const cleaned = rpe.replace(/[^0-9.]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function volumeVoce(v: VoceDiario): number {
  const sets = normalizeSets(v);
  return sets.reduce((acc, s) => acc + (s.ripetizioni ?? 0), 0);
}

function rpeMediaVoce(v: VoceDiario): number | null {
  const sets = normalizeSets(v);
  const valori = sets.map((s) => parseRpe(s.rpe)).filter((n): n is number => n !== null);
  if (valori.length === 0) return null;
  return valori.reduce((a, b) => a + b, 0) / valori.length;
}

interface VoceDiario {
  id: number;
  data_ora: string;
  email_cliente: string;
  id_esercizio: string;
  nome_esercizio: string;
  carico_kg: number | null;
  ripetizioni: number | null;
  serie: number | null;
  feedback: string | null;
  sets_json: SetEntry[] | null;
}

function normalizeSets(v: VoceDiario): SetEntry[] {
  if (v.sets_json && v.sets_json.length > 0) return v.sets_json;
  if (v.carico_kg != null || v.ripetizioni != null)
    return [{ carico_kg: v.carico_kg, ripetizioni: v.ripetizioni ?? v.serie ?? 0 }];
  return [];
}

function tonnellaggioVoce(v: VoceDiario): number {
  const sets = normalizeSets(v);
  return sets.reduce((acc, s) => {
    if (s.carico_kg != null && s.ripetizioni) return acc + s.carico_kg * s.ripetizioni;
    return acc;
  }, 0);
}

function maxCaricoVoce(v: VoceDiario): number | null {
  const sets = normalizeSets(v);
  const carichi = sets.map((s) => s.carico_kg).filter((k): k is number => k != null);
  return carichi.length > 0 ? Math.max(...carichi) : null;
}

interface GruppoEsercizio {
  id_esercizio: string;
  nome_esercizio: string;
  ultimaData: string;
  totaleLog: number;
  ultimoCarico: number | null;
}

function formatData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function formatOra(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function formatDataBreve(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

type PeriodoFiltro = "settimana" | "mese" | "trimestre" | "tutto";

function filtraPerPeriodo(voci: VoceDiario[], periodo: PeriodoFiltro): VoceDiario[] {
  if (periodo === "tutto") return voci;
  const ora = Date.now();
  const ms = periodo === "settimana" ? 7 * 86400000 : periodo === "mese" ? 30 * 86400000 : 90 * 86400000;
  return voci.filter((v) => ora - new Date(v.data_ora).getTime() <= ms);
}

function SottoDiario({ idEsercizio, nomeEsercizio, onBack }: { idEsercizio: string; nomeEsercizio: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mese");

  const { data: voci = [], isLoading } = useQuery<VoceDiario[]>({
    queryKey: ["diario", idEsercizio],
    queryFn: () => fetch(`/app-api/diario/esercizio/${encodeURIComponent(idEsercizio)}`).then((r) => r.json()),
  });

  async function handleElimina(id: number) {
    setDeleting(id);
    try {
      await fetch(`/app-api/diario/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      toast.success("Voce eliminata.");
    } catch { toast.error("Errore nell'eliminazione."); }
    finally { setDeleting(null); }
  }

  const vociGrafico = useMemo(() => {
    const filtrate = filtraPerPeriodo([...voci].reverse(), periodo);
    return filtrate.map((v) => ({
      data: formatDataBreve(v.data_ora),
      dataCompleta: formatData(v.data_ora),
      volume: volumeVoce(v) || null,
      rpe: rpeMediaVoce(v) != null ? parseFloat(rpeMediaVoce(v)!.toFixed(2)) : null,
    }));
  }, [voci, periodo]);

  const hasRpe = vociGrafico.some((d) => d.rpe != null);
  const hasVolume = vociGrafico.some((d) => d.volume != null);
  const maxCarico = voci.map(maxCaricoVoce).filter((k): k is number => k !== null).reduce((max, k) => Math.max(max, k), 0) || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-md p-1.5 hover:bg-inset cursor-pointer" aria-label="Torna al diario">
          <ChevronLeft className="size-5 text-secondary" />
        </button>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-primary truncate">{nomeEsercizio}</h2>
          <p className="text-xs text-secondary">{voci.length} sessioni registrate</p>
        </div>
        {maxCarico !== null && (
          <span className="ml-auto shrink-0 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold" style={{ background: "#e3ff00", color: "#1c00ff" }}>Max {maxCarico} kg</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-inset" />)}</div>
      ) : voci.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center"><BookMarked className="size-8 text-secondary" /><p className="text-secondary text-sm">Nessun dato disponibile.</p></div>
      ) : (
        <Tabs defaultValue="lista">
          <TabsList>
            <TabsTrigger value="lista"><List className="size-4 mr-1.5" />Storico</TabsTrigger>
            <TabsTrigger value="grafico" disabled={vociGrafico.length < 2}><BarChart2 className="size-4 mr-1.5" />Grafico</TabsTrigger>
          </TabsList>
          <TabsContent value="lista">
            <div className="space-y-2 mt-2">
              {voci.map((voce) => <VoceDiarioRow key={voce.id} voce={voce} deleting={deleting} onElimina={handleElimina} />)}
            </div>
          </TabsContent>
          <TabsContent value="grafico">
            <div className="mt-4 space-y-3">
              <div className="flex gap-1 flex-wrap">
                {(["settimana", "mese", "trimestre", "tutto"] as PeriodoFiltro[]).map((p) => (
                  <button key={p} onClick={() => setPeriodo(p)} className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${periodo === p ? "text-white" : "bg-inset text-secondary hover:text-primary"}`} style={periodo === p ? { background: "#1c00ff", color: "#fff" } : {}}>
                    {p === "settimana" ? "7 gg" : p === "mese" ? "30 gg" : p === "trimestre" ? "90 gg" : "Tutto"}
                  </button>
                ))}
              </div>
              {vociGrafico.length < 2 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center"><BarChart2 className="size-8 text-secondary" /><p className="text-sm text-secondary">Dati insufficienti per il periodo selezionato.</p></div>
              ) : (
                <div className="rounded-lg border border-border bg-raised p-4">
                  <div className="flex gap-4 mb-3 text-xs">
                    {hasVolume && <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-full" style={{ background: "#1c00ff" }} /><span className="text-secondary">Volume (rip.)</span></span>}
                    {hasRpe && <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-full" style={{ background: "#e3ff00", border: "1.5px solid #1c00ff" }} /><span className="text-secondary">RPE medio</span></span>}
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={vociGrafico} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
                      <CartesianGrid stroke="var(--color-border-weak)" />
                      <XAxis dataKey="data" tick={{ fill: "var(--color-secondary)", fontSize: 11 }} tickLine={false} />
                      <YAxis yAxisId="vol" tick={{ fill: "var(--color-secondary)", fontSize: 11 }} tickLine={false} axisLine={false} unit=" rip" width={48} />
                      {hasRpe && <YAxis yAxisId="rpe" orientation="right" domain={[0, 10]} tick={{ fill: "var(--color-secondary)", fontSize: 11 }} tickLine={false} axisLine={false} width={32} />}
                      <Tooltip contentStyle={{ background: "var(--color-raised)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} labelFormatter={(label, payload) => payload?.[0]?.payload?.dataCompleta ?? label} formatter={(value: number, name: string) => name === "volume" ? [`${value} rip.`, "Volume"] : [`${value}`, "RPE medio"]} />
                      {hasVolume && <Line yAxisId="vol" type="monotone" dataKey="volume" stroke="#1c00ff" strokeWidth={2.5} dot={{ fill: "#1c00ff", r: 4, strokeWidth: 0 }} connectNulls />}
                      {hasRpe && <Line yAxisId="rpe" type="monotone" dataKey="rpe" stroke="#e3ff00" strokeWidth={2.5} dot={{ fill: "#e3ff00", stroke: "#1c00ff", strokeWidth: 1.5, r: 4 }} connectNulls />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-xs text-secondary text-right">{vociGrafico.length} sessioni nel periodo</p>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function VoceDiarioRow({ voce, deleting, onElimina }: { voce: VoceDiario; deleting: number | null; onElimina: (id: number) => void }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSets, setEditSets] = useState<{ carico_kg: string; ripetizioni: string; rpe: string }[]>([]);
  const [editFeedback, setEditFeedback] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const sets = normalizeSets(voce);
  const primoSet = sets[0];
  const nSets = sets.length;
  const vol = volumeVoce(voce);
  const rpeM = rpeMediaVoce(voce);

  function openEdit() {
    setEditSets(sets.length > 0 ? sets.map((s) => ({ carico_kg: s.carico_kg != null ? String(s.carico_kg) : "", ripetizioni: s.ripetizioni != null ? String(s.ripetizioni) : "", rpe: s.rpe ?? "" })) : [{ carico_kg: "", ripetizioni: "", rpe: "" }]);
    setEditFeedback(voce.feedback ?? "");
    setEditing(true);
    setExpanded(true);
  }

  async function handleSalvaModifica() {
    const setsValidi = editSets.filter((s) => s.ripetizioni.trim() !== "");
    if (setsValidi.length === 0) { toast.error("Compila almeno un set con le ripetizioni."); return; }
    setEditSaving(true);
    try {
      const setsJson = setsValidi.map((s) => ({ carico_kg: s.carico_kg ? parseFloat(s.carico_kg) : null, ripetizioni: parseInt(s.ripetizioni, 10), rpe: s.rpe.trim() || null }));
      const res = await fetch(`/app-api/diario/${voce.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sets_json: setsJson, feedback: editFeedback || null }) });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      toast.success("Sessione aggiornata.");
      setEditing(false);
    } catch { toast.error("Errore nel salvataggio."); }
    finally { setEditSaving(false); }
  }

  return (
    <div className="rounded-lg border border-border bg-raised overflow-hidden">
      <button className="flex w-full cursor-pointer items-center justify-between p-3 hover:bg-inset" onClick={() => { if (!editing) setExpanded(!expanded); }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 text-left">
            <p className="text-sm text-secondary">{formatData(voce.data_ora)} <span className="text-xs">{formatOra(voce.data_ora)}</span></p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {primoSet ? (
                <span className="text-[14px] font-semibold text-primary">
                  {primoSet.carico_kg != null ? `${primoSet.carico_kg} kg` : "—"} &times; {primoSet.ripetizioni} rip.
                  {nSets > 1 && <span className="text-xs font-semibold text-zinc-500 ml-1.5">+{nSets - 1} set</span>}
                </span>
              ) : <span className="text-sm text-secondary italic">Solo nota</span>}
              {vol > 0 && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "#1c00ff", color: "#fff" }}>{vol} rip.</span>}
              {rpeM != null && <span className="text-xs font-bold text-[#1c00ff] bg-[#1c00ff]/10 px-1.5 py-0.5 rounded">RPE {rpeM.toFixed(1)}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); openEdit(); }} className="p-1 rounded hover:bg-inset cursor-pointer text-secondary hover:text-primary" aria-label="Modifica sessione"><Pencil className="size-3.5" /></button>
          {expanded ? <ChevronUp className="size-4 text-secondary" /> : <ChevronDown className="size-4 text-secondary" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border bg-inset px-3 py-2 space-y-2">
          {editing ? (
            <>
              <div className="space-y-2">
                {editSets.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="flex shrink-0 size-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "#1c00ff", color: "#fff" }}>{i + 1}</span>
                    <Input type="number" placeholder="kg" value={s.carico_kg} onChange={(e) => setEditSets((prev) => prev.map((x, idx) => idx === i ? { ...x, carico_kg: e.target.value } : x))} className="flex-1" />
                    <Input type="number" placeholder="reps" value={s.ripetizioni} onChange={(e) => setEditSets((prev) => prev.map((x, idx) => idx === i ? { ...x, ripetizioni: e.target.value } : x))} className="flex-1" />
                    <Input type="text" placeholder="RPE" value={s.rpe} onChange={(e) => setEditSets((prev) => prev.map((x, idx) => idx === i ? { ...x, rpe: e.target.value } : x))} className="w-16" />
                    {editSets.length > 1 && <button onClick={() => setEditSets((p) => p.filter((_, idx) => idx !== i))} className="shrink-0 cursor-pointer text-secondary hover:text-primary"><Trash2 className="size-3.5" /></button>}
                  </div>
                ))}
              </div>
              <button onClick={() => setEditSets((p) => [...p, { carico_kg: "", ripetizioni: "", rpe: "" }])} className="text-xs text-secondary hover:text-primary cursor-pointer">+ Aggiungi set</button>
              <Textarea placeholder="Note…" value={editFeedback} onChange={(e) => setEditFeedback(e.target.value)} rows={2} />
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleSalvaModifica} isLoading={editSaving}>Salva</Button>
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Annulla</Button>
              </div>
            </>
          ) : (
            <>
              {sets.length > 0 && (
                <div className="space-y-1 pb-1">
                  {sets.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <span className="flex shrink-0 size-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "#1c00ff", color: "#fff" }}>{i + 1}</span>
                      <span className="text-sm text-primary font-bold">{s.carico_kg != null ? `${s.carico_kg} kg` : "—"}</span>
                      <span className="text-sm font-semibold text-zinc-700">&times; {s.ripetizioni} rip.</span>
                      {s.rpe && <span className="text-sm font-bold text-[#1c00ff]">RPE {s.rpe}</span>}
                    </div>
                  ))}
                </div>
              )}
              {voce.feedback ? <p className="text-sm text-secondary leading-relaxed">{voce.feedback}</p> : <p className="text-sm text-secondary italic">Nessuna nota aggiunta.</p>}
              <div className="flex justify-end">
                <Button variant="tertiary" size="sm" isLoading={deleting === voce.id} onClick={() => onElimina(voce.id)}><Trash2 /> Elimina</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DiarioPage() {
  const [esercizioSelezionato, setEsercizioSelezionato] = useState<{ id: string; nome: string } | null>(null);
  const { data: user } = useQuery({ queryKey: ["session"], queryFn: () => session.get() });
  const { data: voci = [], isLoading } = useQuery<VoceDiario[]>({ queryKey: ["diario"], queryFn: () => fetch("/app-api/diario").then((r) => r.json()) });

  const gruppi: GruppoEsercizio[] = React.useMemo(() => {
    const map = new Map<string, GruppoEsercizio>();
    for (const v of voci) {
      const key = v.id_esercizio;
      if (!map.has(key)) { map.set(key, { id_esercizio: key, nome_esercizio: v.nome_esercizio || key, ultimaData: v.data_ora, totaleLog: 1, ultimoCarico: v.carico_kg }); }
      else { map.get(key)!.totaleLog += 1; }
    }
    return Array.from(map.values());
  }, [voci]);

  const [ricerca, setRicerca] = useState("");
  const gruppiFiltrati = React.useMemo(() => {
    if (!ricerca.trim()) return gruppi;
    const q = ricerca.toLowerCase();
    return gruppi.filter((g) => g.nome_esercizio.toLowerCase().includes(q) || g.id_esercizio.toLowerCase().includes(q));
  }, [gruppi, ricerca]);

  if (esercizioSelezionato) {
    return <div className="space-y-6"><SottoDiario idEsercizio={esercizioSelezionato.id} nomeEsercizio={esercizioSelezionato.nome} onBack={() => setEsercizioSelezionato(null)} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">Il Mio Diario</h1>
          {user?.email && <p className="text-xs font-bold text-zinc-500 mt-0.5">{user.email}</p>}
        </div>
        <span
          className="text-xs font-black uppercase px-2.5 py-1 rounded-full shadow-xs"
          style={{ background: "#09090b", color: "#e3ff00", border: "1px solid #1c00ff" }}
        >
          {gruppi.length} {gruppi.length === 1 ? "Esercizio" : "Esercizi"}
        </span>
      </div>
      {!isLoading && gruppi.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cerca esercizio…"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-9 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1c00ff]/20 focus:border-[#1c00ff] shadow-xs"
          />
          {ricerca && <button onClick={() => setRicerca("")} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-400 hover:text-zinc-700" aria-label="Cancella ricerca"><X className="size-4" /></button>}
        </div>
      )}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-200" />)}</div>
      ) : gruppi.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <BookMarked className="size-10 text-zinc-400" />
          <p className="text-zinc-600 font-bold">Nessun carico registrato ancora.</p>
          <p className="text-xs text-zinc-400">Apri un esercizio e premi "Registra Carico" per iniziare a tracciare i tuoi progressi.</p>
        </div>
      ) : gruppiFiltrati.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center"><Search className="size-8 text-zinc-400" /><p className="text-zinc-500 text-sm">Nessun risultato per "{ricerca}".</p></div>
      ) : (
        <div className="space-y-2">
          {gruppiFiltrati.map((g) => (
            <button
              key={g.id_esercizio}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 text-left shadow-xs transition-all relative overflow-hidden"
              onClick={() => setEsercizioSelezionato({ id: g.id_esercizio, nome: g.nome_esercizio })}
            >
              <div className="min-w-0">
                <p className="font-bold text-zinc-900 truncate leading-snug">{g.nome_esercizio}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-zinc-500 font-medium">Ultima sessione: {formatData(g.ultimaData)}</span>
                  {g.ultimoCarico !== null && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-black shadow-xs"
                      style={{ background: "#1c00ff", color: "#e3ff00" }}
                    >
                      {g.ultimoCarico} kg
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span
                  className="text-[11px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: "#09090b", color: "#ffffff" }}
                >
                  {g.totaleLog} log
                </span>
                <ChevronDown className="size-5 text-zinc-400 rotate-[-90deg]" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}