import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Weight } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";

interface VoceTon {
  id: number;
  data_ora: string;
  nome_esercizio: string;
  carico_kg: number | null;
  ripetizioni: number | null;
  serie: number | null;
  tonnellaggio_voce: number;
}

function getSettimana(d: Date): string {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek = new Date(jan4.getTime() - (jan4.getDay() || 7) * 86400000);
  const weekNum = Math.floor((d.getTime() - startOfWeek.getTime()) / (7 * 86400000)) + 1;
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getMese(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMeseLabel(key: string): string {
  const [year, month] = key.split("-");
  const nomi = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  return `${nomi[parseInt(month) - 1]} ${year}`;
}

function formatSettimanaLabel(key: string): string {
  return key.replace("-W", " W");
}

function formatDataLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--color-raised)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "var(--color-primary)", fontWeight: 600, marginBottom: 2 }}>{label}</p>
      <p style={{ color: "var(--color-secondary)" }}>
        Tonnellaggio: <span style={{ color: "#1c00ff", fontWeight: 700 }}>{payload[0].value.toFixed(0)} kg</span>
      </p>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-1 shadow-xs relative overflow-hidden">
      <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#1c00ff]" />
      <p className="text-[11px] font-black text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-black text-zinc-900">{value}</p>
      {sub && <p className="text-[11px] font-semibold text-zinc-400">{sub}</p>}
    </div>
  );
}

export default function TonnellaggioPage() {
  const { data: voci = [], isLoading } = useQuery<VoceTon[]>({
    queryKey: ["tonnellaggio"],
    queryFn: () => fetch("/app-api/tonnellaggio").then((r) => r.json()),
  });

  const vociValide = useMemo(() => voci.filter((v) => v.tonnellaggio_voce > 0), [voci]);

  const perSessione = useMemo(() => {
    const map = new Map<string, { label: string; totale: number; count: number }>();
    for (const v of vociValide) {
      const d = new Date(v.data_ora);
      const key = d.toISOString().slice(0, 10);
      const label = formatDataLabel(v.data_ora);
      if (!map.has(key)) map.set(key, { label, totale: 0, count: 0 });
      map.get(key)!.totale += v.tonnellaggio_voce;
      map.get(key)!.count += 1;
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ name: v.label, tonnellaggio: Math.round(v.totale) }));
  }, [vociValide]);

  const perSettimana = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vociValide) {
      const key = getSettimana(new Date(v.data_ora));
      map.set(key, (map.get(key) ?? 0) + v.tonnellaggio_voce);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, tot]) => ({ name: formatSettimanaLabel(key), tonnellaggio: Math.round(tot) }));
  }, [vociValide]);

  const perMese = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vociValide) {
      const key = getMese(new Date(v.data_ora));
      map.set(key, (map.get(key) ?? 0) + v.tonnellaggio_voce);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, tot]) => ({ name: formatMeseLabel(key), tonnellaggio: Math.round(tot) }));
  }, [vociValide]);

  const totaleAssoluto = useMemo(() => vociValide.reduce((s, v) => s + v.tonnellaggio_voce, 0), [vociValide]);
  const maxSessione = useMemo(() => perSessione.length ? Math.max(...perSessione.map((s) => s.tonnellaggio)) : 0, [perSessione]);
  const mediaSettimanale = useMemo(() => perSettimana.length ? Math.round(perSettimana.reduce((s, w) => s + w.tonnellaggio, 0) / perSettimana.length) : 0, [perSettimana]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900">Tonnellaggio</h1>
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-200" />)}</div>
      </div>
    );
  }

  if (vociValide.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900">Tonnellaggio</h1>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Weight className="size-10 text-zinc-400" />
          <p className="text-zinc-600 font-bold">Nessun dato di tonnellaggio disponibile.</p>
          <p className="text-xs text-zinc-400">Registra carichi con Serie e Ripetizioni per vedere i grafici.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">Tonnellaggio</h1>
          <p className="text-xs font-bold text-zinc-500 mt-0.5">Analisi del carico cumulativo sollevato</p>
        </div>
        <span
          className="text-xs font-black uppercase px-2.5 py-1 rounded-full shadow-xs"
          style={{ background: "#09090b", color: "#e3ff00", border: "1px solid #1c00ff" }}
        >
          kg Totali
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Tonnellaggio totale" value={`${Math.round(totaleAssoluto).toLocaleString("it-IT")} kg`} sub={`su ${vociValide.length} sessioni`} />
        <StatCard label="Max in una sessione" value={`${maxSessione.toLocaleString("it-IT")} kg`} />
        <StatCard label="Media settimanale" value={`${mediaSettimanale.toLocaleString("it-IT")} kg`} sub={`su ${perSettimana.length} settimane`} />
      </div>

      <Tabs defaultValue="sessione">
        <TabsList>
          <TabsTrigger value="sessione">Sessione</TabsTrigger>
          <TabsTrigger value="settimana">Settimana</TabsTrigger>
          <TabsTrigger value="mese">Mese</TabsTrigger>
        </TabsList>

        <TabsContent value="sessione">
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold text-zinc-500">Tonnellaggio totale per giorno di allenamento</p>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={perSessione} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} unit=" kg" />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(28,0,255,0.05)" }} />
                  <Bar dataKey="tonnellaggio" fill="#1c00ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settimana">
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold text-zinc-500">Tonnellaggio totale per settimana</p>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={perSettimana} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} unit=" kg" />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="tonnellaggio" stroke="#1c00ff" strokeWidth={2.5} dot={{ fill: "#1c00ff", r: 4, strokeWidth: 0 }} activeDot={{ fill: "#e3ff00", stroke: "#09090b", strokeWidth: 2, r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mese">
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold text-zinc-500">Tonnellaggio totale per mese</p>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={perMese} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} unit=" kg" />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(28,0,255,0.05)" }} />
                  <Bar dataKey="tonnellaggio" fill="#1c00ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}