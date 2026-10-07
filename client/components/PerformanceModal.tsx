import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserProfile } from "../lib/useUser";
import {
  TrendingUp,
  Activity,
  Sparkles,
  Brain,
  Flame,
  Calendar,
  Dumbbell,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  BarChart3,
  ChevronRight,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { Button } from "./Button";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface SetEntry {
  set?: number;
  carico_kg?: number | null;
  ripetizioni?: number | null;
  rpe?: string | number | null;
}

function parseSafeDate(iso: any): Date {
  if (!iso) return new Date();
  if (typeof iso === "string" && (iso.includes("T") || iso.includes("-") || iso.includes("/"))) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  const num = typeof iso === "number" ? iso : parseFloat(String(iso));
  if (!isNaN(num) && num > 20000 && num < 70000) {
    const epochMs = (num - 25569) * 86400 * 1000;
    const d = new Date(epochMs);
    if (!isNaN(d.getTime())) return d;
  }
  const fallback = new Date(iso);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
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

interface PerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  atleta: UserProfile | null;
}

function parseRpe(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(String(val).replace(",", "."));
  return isNaN(n) ? null : n;
}

function normalizeSets(v: VoceDiario): SetEntry[] {
  if (v.sets_json && v.sets_json.length > 0) return v.sets_json;
  if (v.carico_kg != null || v.ripetizioni != null) {
    return [{ carico_kg: v.carico_kg, ripetizioni: v.ripetizioni ?? v.serie ?? 0 }];
  }
  return [];
}

function computeTonnellaggio(v: VoceDiario): number {
  const sets = normalizeSets(v);
  return sets.reduce((acc, s) => {
    if (s.carico_kg != null && s.ripetizioni) return acc + s.carico_kg * s.ripetizioni;
    return acc;
  }, 0);
}

function computeCaricoMax(v: VoceDiario): number {
  const sets = normalizeSets(v);
  if (sets.length === 0) return v.carico_kg || 0;
  return Math.max(...sets.map((s) => s.carico_kg || 0));
}

function computeRpeMedio(v: VoceDiario): number | null {
  const sets = normalizeSets(v);
  const valori = sets.map((s) => parseRpe(s.rpe)).filter((n): n is number => n !== null);
  if (valori.length === 0) return null;
  return valori.reduce((a, b) => a + b, 0) / valori.length;
}

export function PerformanceModal({ isOpen, onClose, atleta }: PerformanceModalProps) {
  const [activeTab, setActiveTab] = useState<"ai" | "grafico" | "diario">("ai");
  const [selectedExId, setSelectedExId] = useState<string>("all");
  const [metric, setMetric] = useState<"carico" | "tonnellaggio" | "rpe">("carico");

  // Query Diario Atleta
  const {
    data: diario = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<VoceDiario[]>({
    queryKey: ["diario", atleta?.email],
    queryFn: async () => {
      if (!atleta?.email) return [];
      const res = await fetch(`/app-api/diario?email=${encodeURIComponent(atleta.email)}`);
      if (!res.ok) throw new Error("Errore recupero diario");
      return res.json();
    },
    enabled: isOpen && !!atleta?.email,
  });

  // Ordina per data crescente per i grafici
  const sortedDiarioAsc = useMemo(() => {
    return [...diario].sort(
      (a, b) => parseSafeDate(a.data_ora).getTime() - parseSafeDate(b.data_ora).getTime()
    );
  }, [diario]);

  // Lista esercizi univoci registrati
  const eserciziUnivoci = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; count: number }>();
    diario.forEach((v) => {
      const key = v.id_esercizio || v.nome_esercizio;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          id: key,
          nome: v.nome_esercizio || key,
          count: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [diario]);

  // Statistiche complessive
  const totalTonnellaggio = useMemo(() => {
    return diario.reduce((acc, v) => acc + computeTonnellaggio(v), 0);
  }, [diario]);

  const allRpes = useMemo(() => {
    return diario
      .map((v) => computeRpeMedio(v))
      .filter((n): n is number => n !== null);
  }, [diario]);

  const avgRpeOverall = useMemo(() => {
    if (allRpes.length === 0) return null;
    return allRpes.reduce((a, b) => a + b, 0) / allRpes.length;
  }, [allRpes]);

  // Dati per il Grafico
  const chartData = useMemo(() => {
    const filtered =
      selectedExId === "all"
        ? sortedDiarioAsc
        : sortedDiarioAsc.filter((v) => v.id_esercizio === selectedExId || v.nome_esercizio === selectedExId);

    return filtered.map((v) => {
      const d = parseSafeDate(v.data_ora);
      const dataLabel = d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
      const caricoMax = computeCaricoMax(v);
      const tonn = computeTonnellaggio(v);
      const rpe = computeRpeMedio(v);

      return {
        id: v.id,
        date: dataLabel,
        fullDate: d.toLocaleDateString("it-IT"),
        nome: v.nome_esercizio,
        caricoMax: caricoMax > 0 ? caricoMax : null,
        tonnellaggio: tonn,
        rpe: rpe !== null ? Number(rpe.toFixed(1)) : null,
      };
    });
  }, [sortedDiarioAsc, selectedExId]);

  // ───────────────────────────────────────────────────────────────────────────
  // SINTESI INTELLIGENTE I.A. COACH ASSISTANT (Basata sulle regole Area46 PRO)
  // ───────────────────────────────────────────────────────────────────────────
  const aiAnalysis = useMemo(() => {
    if (diario.length === 0) return null;

    // 1. Analisi RPE e Fatica Neurale
    const recentEntries = sortedDiarioAsc.slice(-6);
    const recentRpes = recentEntries
      .map((v) => computeRpeMedio(v))
      .filter((n): n is number => n !== null);
    const recentAvgRpe =
      recentRpes.length > 0
        ? recentRpes.reduce((a, b) => a + b, 0) / recentRpes.length
        : avgRpeOverall;

    let rpeStatus = "normale";
    let rpeBadge = "Fase di Regime / Accumulo";
    let rpeColor = "text-blue-700 bg-blue-50 border-blue-200";
    let rpeDescription = "";
    let scaricoSuggerito = false;

    if (recentAvgRpe && recentAvgRpe >= 8.5) {
      rpeStatus = "picco";
      rpeBadge = "Picco d'Intensità Neurale (RPE 8.5-10)";
      rpeColor = "text-red-700 bg-red-50 border-red-200";
      rpeDescription = `L'atleta si trova a ridosso del picco dell'onda di intensità (RPE medio recente: ${recentAvgRpe.toFixed(
        1
      )}). La capacità di buffer (RIR 0-1) è quasi esaurita. Come da metodologia Area46 PRO, è fortemente consigliato programmare lo SCARICO SELETTIVO (MODALITÀ B) nel prossimo ciclo: azzerare il carico pesante sui fondamentali di questo pattern e sostituirlo con propedeutica tecnica, destrezza o mobilità attiva.`;
      scaricoSuggerito = true;
    } else if (recentAvgRpe && recentAvgRpe >= 7.5) {
      rpeStatus = "intensificazione";
      rpeBadge = "Intensificazione a Regime (RPE 7.5-8.4)";
      rpeColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
      rpeDescription = `L'atleta esprime uno stimolo allenante ottimale (RPE ${recentAvgRpe.toFixed(
        1
      )}) con adeguata velocità esecutiva e buffer residuo (1-2 ripetizioni in riserva). La progressione è stabile.`;
    } else if (recentAvgRpe) {
      rpeStatus = "adattamento";
      rpeBadge = "Accumulo & Volume (RPE < 7.5)";
      rpeColor = "text-zinc-700 bg-zinc-100 border-zinc-200";
      rpeDescription = `Intensità percepita contenuta (RPE ${recentAvgRpe.toFixed(
        1
      )}). C'è ampio margine per incrementare gradualmente il sovraccarico progressivo (+1.25 / +2.5 kg) sui fondamentali al Landmine.`;
    }

    // 2. Progressioni di Carico
    const progressioni: { nome: string; delta: number; prima: number; ultima: number }[] = [];
    eserciziUnivoci.forEach((ex) => {
      const records = sortedDiarioAsc.filter((v) => v.id_esercizio === ex.id);
      if (records.length >= 2) {
        const prima = computeCaricoMax(records[0]);
        const ultima = computeCaricoMax(records[records.length - 1]);
        if (prima > 0 && ultima > 0 && ultima !== prima) {
          progressioni.push({
            nome: ex.nome,
            delta: Math.round((ultima - prima) * 10) / 10,
            prima,
            ultima,
          });
        }
      }
    });

    // 3. Analisi Biofeedback & Note Atleta
    const feedbacks = diario
      .map((v) => v.feedback?.trim())
      .filter((f): f is string => !!f);

    const paroleAllerta = ["dolore", "male", "fastidio", "schiena", "spalla", "ginocchio", "gomito", "polso", "cedimento", "pesante", "fatica", "bloccato"];
    const parolePositive = ["ottimo", "fluido", "leggero", "facile", "esplosivo", "veloce", "buono", "controllo", "energia", "perfetto"];

    const alertNotes: string[] = [];
    const positiveNotes: string[] = [];

    feedbacks.forEach((fb) => {
      const lower = fb.toLowerCase();
      if (paroleAllerta.some((p) => lower.includes(p))) {
        if (!alertNotes.includes(fb) && alertNotes.length < 3) alertNotes.push(fb);
      }
      if (parolePositive.some((p) => lower.includes(p))) {
        if (!positiveNotes.includes(fb) && positiveNotes.length < 3) positiveNotes.push(fb);
      }
    });

    // 4. Consigli Operativi per il Coach
    const consigli: string[] = [];
    if (scaricoSuggerito) {
      consigli.push(
        "Attiva la Modalità B di Scarico Selettivo nel prossimo ciclo: mantieni il volume attivo ma converti i movimenti pesanti in destrezza e mobilità."
      );
    } else {
      consigli.push(
        "Continua la scaletta a onda: se le ripetizioni calano nel prossimo ciclo, puoi concedere un piccolo incremento del carico sui fondamentali (+1.25/2.5kg)."
      );
    }

    if (alertNotes.length > 0) {
      consigli.push(
        `Attenzione ai feedback riportati: verificare assetto articolare e mobilità specifica (segnalate sensazioni di affaticamento o fastidio).`
      );
    } else {
      consigli.push(
        "Ottima aderenza biomeccanica: l'atleta non lamenta compensi o dolori articolari nei feedback."
      );
    }

    if (progressioni.length > 0) {
      const topProg = progressioni.sort((a, b) => b.delta - a.delta)[0];
      if (topProg.delta > 0) {
        consigli.push(
          `Miglioramento marcato: su "${topProg.nome}" il carico è salito da ${topProg.prima}kg a ${topProg.ultima}kg (+${topProg.delta}kg).`
        );
      }
    }

    return {
      recentAvgRpe,
      rpeStatus,
      rpeBadge,
      rpeColor,
      rpeDescription,
      scaricoSuggerito,
      progressioni,
      alertNotes,
      positiveNotes,
      consigli,
      totalSessions: diario.length,
    };
  }, [diario, sortedDiarioAsc, avgRpeOverall, eserciziUnivoci]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-2xl max-h-[88vh] flex flex-col">
        <DialogHeader className="pb-3 border-b border-zinc-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-[#1c00ff] text-white shadow-xs">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
                  Performance & Diario: {atleta?.nome} {atleta?.cognome}
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  {atleta?.email} • Pacchetto:{" "}
                  <strong className="text-zinc-800 uppercase text-[11px]">
                    {atleta?.tipo_abbonamento || "standard"}
                  </strong>
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-xs font-bold h-8 px-2.5 rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              title="Aggiorna dati diario"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* KPI CARDS BAR */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
            <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                Voci Diario
              </span>
              <div className="text-base font-black text-zinc-900 mt-0.5">
                {diario.length}
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                Tonnellaggio Tot.
              </span>
              <div className="text-base font-black text-[#1c00ff] mt-0.5 tabular-nums">
                {Math.round(totalTonnellaggio).toLocaleString("it-IT")} kg
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                RPE Medio
              </span>
              <div className="text-base font-black text-zinc-900 mt-0.5 tabular-nums">
                {avgRpeOverall !== null ? `${avgRpeOverall.toFixed(1)} / 10` : "N/D"}
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                Esercizi Univoci
              </span>
              <div className="text-base font-black text-zinc-900 mt-0.5">
                {eserciziUnivoci.length}
              </div>
            </div>
          </div>

          {/* TAB SWITCHER */}
          <div className="flex items-center gap-1.5 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "ai"
                  ? "bg-[#09090b] text-[#e3ff00] shadow-xs"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              <Sparkles className="size-3.5 text-[#e3ff00]" />
              <span>I.A. Coach Assistant</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("grafico")}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "grafico"
                  ? "bg-[#1c00ff] text-white shadow-xs"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              <BarChart3 className="size-3.5" />
              <span>Grafico Performance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("diario")}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "diario"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              <Dumbbell className="size-3.5" />
              <span>Diario Completo ({diario.length})</span>
            </button>
          </div>
        </DialogHeader>

        {/* CONTENUTO SCORREVOLE */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 text-xs">
          {isLoading ? (
            <div className="py-12 text-center text-zinc-400">
              <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[#1c00ff]" />
              Caricamento dati performance e diario...
            </div>
          ) : diario.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 space-y-2">
              <Dumbbell className="size-8 mx-auto text-zinc-300" />
              <div className="font-bold text-zinc-700">Nessuna voce di diario registrata</div>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                L&apos;atleta non ha ancora inserito serie, ripetizioni o carichi nei suoi allenamenti. I dati appariranno qui automaticamente dopo la prima seduta.
              </p>
            </div>
          ) : (
            <>
              {/* ───────────────────────────────────────────────────────────── */}
              {/* TAB 1: I.A. COACH ASSISTANT */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeTab === "ai" && aiAnalysis && (
                <div className="space-y-3">
                  {/* BOX STATO RPE & FATICA */}
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Brain className="size-4 text-[#1c00ff]" />
                        <span className="font-black text-xs text-zinc-900 uppercase tracking-wide">
                          Monitoraggio Onda di Carico & RPE
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${aiAnalysis.rpeColor}`}
                      >
                        {aiAnalysis.rpeBadge}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-700 leading-relaxed">
                      {aiAnalysis.rpeDescription}
                    </p>

                    {aiAnalysis.scaricoSuggerito && (
                      <div className="p-2.5 rounded-xl bg-red-100/70 border border-red-200 text-red-900 font-bold text-[11px] flex items-center gap-2">
                        <AlertCircle className="size-4 text-red-600 shrink-0" />
                        <span>
                          Consigliata attivazione <strong>Scarico Selettivo Modalità B</strong> nel ciclo imminente.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* BOX BIOFEEDBACK & SENSAZIONI SCRITTE DALL'ATLETA */}
                  <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-2xs space-y-2.5">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="size-4 text-[#1c00ff]" />
                      <span className="font-black text-xs text-zinc-900 uppercase tracking-wide">
                        Analisi Biofeedback & Sensazioni Soggettive
                      </span>
                    </div>

                    {aiAnalysis.alertNotes.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                          Segnali di Fatica / Punti di Attenzione segnalati:
                        </span>
                        {aiAnalysis.alertNotes.map((note, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 text-[11px] italic"
                          >
                            &ldquo;{note}&rdquo;
                          </div>
                        ))}
                      </div>
                    )}

                    {aiAnalysis.positiveNotes.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                          Riscontri Positivi & Efficacia:
                        </span>
                        {aiAnalysis.positiveNotes.map((note, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-[11px] italic"
                          >
                            &ldquo;{note}&rdquo;
                          </div>
                        ))}
                      </div>
                    )}

                    {aiAnalysis.alertNotes.length === 0 && aiAnalysis.positiveNotes.length === 0 && (
                      <div className="text-zinc-500 text-[11px] italic">
                        Nessuna annotazione particolare nei feedback recenti.
                      </div>
                    )}
                  </div>

                  {/* BOX CONSIGLI OPERATIVI PER IL COACH */}
                  <div className="p-4 rounded-2xl bg-[#09090b] text-white border border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center gap-2 text-[#e3ff00]">
                      <Sparkles className="size-4" />
                      <span className="font-black text-xs uppercase tracking-wide">
                        3 Consigli Operativi per il Coach
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px] text-zinc-300">
                      {aiAnalysis.consigli.map((c, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="size-4 rounded-full bg-[#1c00ff] text-white font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-snug">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* TAB 2: GRAFICO PERFORMANCE (RECHARTS) */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeTab === "grafico" && (
                <div className="space-y-3">
                  {/* SELETTORE ESERCIZIO & METRICA */}
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
                    <div className="flex-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                        Filtra per Esercizio
                      </label>
                      <select
                        value={selectedExId}
                        onChange={(e) => setSelectedExId(e.target.value)}
                        className="w-full text-xs font-bold bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 text-zinc-800 cursor-pointer focus:outline-[#1c00ff]"
                      >
                        <option value="all">Tutti gli esercizi ({diario.length} registrazioni)</option>
                        {eserciziUnivoci.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.nome} ({ex.count} sessioni)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                        Metrica Visualizzata
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setMetric("carico")}
                          className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            metric === "carico"
                              ? "bg-[#1c00ff] text-white border-[#1c00ff]"
                              : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          Carico Max (kg)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMetric("tonnellaggio")}
                          className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            metric === "tonnellaggio"
                              ? "bg-[#1c00ff] text-white border-[#1c00ff]"
                              : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          Tonnellaggio (kg)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMetric("rpe")}
                          className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            metric === "rpe"
                              ? "bg-[#1c00ff] text-white border-[#1c00ff]"
                              : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          RPE
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* GRAFICO AREA CHART */}
                  <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
                    <div className="text-xs font-bold text-zinc-900 mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Activity className="size-4 text-[#1c00ff]" />
                        Andamento Temporale:{" "}
                        <strong className="text-zinc-800">
                          {metric === "carico"
                            ? "Carico Massimo Sollevato (kg)"
                            : metric === "tonnellaggio"
                            ? "Volume / Tonnellaggio Complessivo (kg)"
                            : "Sforzo Percepito (RPE)"}
                        </strong>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {chartData.length} campioni
                      </span>
                    </div>

                    {chartData.length < 2 ? (
                      <div className="py-12 text-center text-zinc-400 italic">
                        Servono almeno 2 registrazioni per mostrare la linea di andamento.
                      </div>
                    ) : (
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1c00ff" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#1c00ff" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="date"
                              stroke="#94a3b8"
                              fontSize={10}
                              tickLine={false}
                              axisLine={{ stroke: "#e2e8f0" }}
                            />
                            <YAxis
                              stroke="#94a3b8"
                              fontSize={10}
                              tickLine={false}
                              axisLine={{ stroke: "#e2e8f0" }}
                              domain={metric === "rpe" ? [5, 10] : ["auto", "auto"]}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-zinc-950 text-white p-2.5 rounded-xl shadow-xl border border-zinc-800 text-[11px] space-y-1">
                                      <div className="font-bold text-[#e3ff00]">{data.nome}</div>
                                      <div className="text-zinc-400 text-[10px]">Data: {data.fullDate}</div>
                                      <div className="pt-1 border-t border-zinc-800 flex items-center justify-between gap-3">
                                        <span className="text-zinc-300">
                                          {metric === "carico"
                                            ? "Carico Max:"
                                            : metric === "tonnellaggio"
                                            ? "Tonnellaggio:"
                                            : "RPE:"}
                                        </span>
                                        <span className="font-black text-white">
                                          {metric === "carico"
                                            ? `${data.caricoMax || 0} kg`
                                            : metric === "tonnellaggio"
                                            ? `${data.tonnellaggio} kg`
                                            : `${data.rpe || "N/D"}`}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey={
                                metric === "carico"
                                  ? "caricoMax"
                                  : metric === "tonnellaggio"
                                  ? "tonnellaggio"
                                  : "rpe"
                              }
                              stroke="#1c00ff"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#areaColor)"
                              dot={{ r: 3, fill: "#1c00ff", strokeWidth: 1, stroke: "#fff" }}
                              activeDot={{ r: 5, fill: "#e3ff00", stroke: "#1c00ff", strokeWidth: 2 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* TAB 3: DIARIO COMPLETO DETTAGLIATO */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeTab === "diario" && (
                <div className="space-y-2.5">
                  {diario.map((v) => {
                    const sets = normalizeSets(v);
                    const caricoMax = computeCaricoMax(v);
                    const tonn = computeTonnellaggio(v);
                    const rpe = computeRpeMedio(v);
                    const dateFormatted = parseSafeDate(v.data_ora).toLocaleDateString("it-IT", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <div
                        key={v.id}
                        className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/90 shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[10px] text-zinc-400 uppercase font-mono font-bold">
                              {dateFormatted}
                            </div>
                            <h4 className="text-xs font-black text-zinc-900 mt-0.5">
                              {v.nome_esercizio}
                            </h4>
                          </div>

                          <div className="text-right">
                            {caricoMax > 0 && (
                              <div className="text-xs font-black text-[#1c00ff]">
                                Max: {caricoMax} kg
                              </div>
                            )}
                            <div className="text-[10px] text-zinc-500">
                              Vol: {tonn} kg {rpe !== null ? `• RPE ${rpe.toFixed(1)}` : ""}
                            </div>
                          </div>
                        </div>

                        {/* ELENCO SERIE DETTAGLIATE */}
                        {sets.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {sets.map((s, idx) => (
                              <div
                                key={idx}
                                className="px-2 py-1 rounded-lg bg-white border border-zinc-200 text-[10px] font-bold text-zinc-700 flex items-center gap-1 shadow-2xs"
                              >
                                <span className="text-zinc-400">S{idx + 1}:</span>
                                <span>{s.ripetizioni || 0} reps</span>
                                {s.carico_kg != null && s.carico_kg > 0 && (
                                  <span className="text-[#1c00ff]">@{s.carico_kg}kg</span>
                                )}
                                {s.rpe && (
                                  <span className="text-amber-800 bg-amber-50 px-1 rounded text-[9px]">
                                    RPE {s.rpe}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* FEEDBACK DELL'ATLETA */}
                        {v.feedback && (
                          <div className="p-2 rounded-xl bg-white/80 border border-zinc-200 text-zinc-700 text-[11px] flex items-start gap-1.5 italic">
                            <MessageSquare className="size-3 text-[#1c00ff] shrink-0 mt-0.5" />
                            <span>&ldquo;{v.feedback}&rdquo;</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="pt-3 border-t border-zinc-100 flex justify-end">
          <Button
            onClick={onClose}
            className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-black text-xs px-4"
          >
            Chiudi Schermata
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
