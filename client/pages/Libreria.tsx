import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Play,
  Share2,
  Copy,
  Sparkles,
  Layers,
  Crosshair,
  Activity,
  Check,
  X,
} from "lucide-react";
import { Input } from "../components/Input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/Select";
import { VideoClipModal } from "../components/VideoClipModal";
import { toast } from "sonner";

interface VaultEsercizio {
  id: number;
  id_esercizio: string;
  nome_reale: string;
  attrezzo: string;
  pattern_motorio: string;
  fulcro_articolare: string;
  meridiano_miofasciale: string;
  cue_esecutiva: string;
  tag_biomeccanici: string;
  link_video: string;
  whatsapp_text: string;
  whatsapp_share_url: string;
}

interface VaultMeta {
  patterns: string[];
  fulcri: string[];
  meridiani: string[];
  cues: string[];
}

export default function LibreriaPage() {
  const [query, setQuery] = useState("");
  const [attrezzo, setAttrezzo] = useState("");
  const [pattern, setPattern] = useState("");
  const [fulcro, setFulcro] = useState("");
  const [meridiano, setMeridiano] = useState("");

  // Stato per il player video in overlay
  const [selectedVideo, setSelectedVideo] = useState<{
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

  // Metadati per chip di filtro
  const { data: meta } = useQuery<VaultMeta>({
    queryKey: ["vault-meta"],
    queryFn: () => fetch("/app-api/vault/meta").then((r) => r.json()),
  });

  const { data: attrezzi = [] } = useQuery<string[]>({
    queryKey: ["attrezzi"],
    queryFn: () => fetch("/app-api/libreria/attrezzi").then((r) => r.json()),
  });

  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (attrezzo) params.set("attrezzo", attrezzo);
  if (pattern) params.set("pattern", pattern);
  if (fulcro) params.set("fulcro", fulcro);
  if (meridiano) params.set("meridiano", meridiano);

  const { data: searchResponse, isLoading } = useQuery<{
    ok: boolean;
    duration_ms: number;
    total: number;
    data: VaultEsercizio[];
  }>({
    queryKey: ["vault-search", query, attrezzo, pattern, fulcro, meridiano],
    queryFn: () =>
      fetch(`/app-api/vault/search?${params.toString()}`).then((r) => r.json()),
  });

  const esercizi = searchResponse?.data || [];
  const durationMs = searchResponse?.duration_ms ?? 0;

  const handleCopyClip = (ex: VaultEsercizio) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(ex.whatsapp_text);
      toast.success("Dettagli clip copiati negli appunti!");
    }
  };

  const hasActiveFilters = Boolean(query || attrezzo || pattern || fulcro || meridiano);

  const resetFilters = () => {
    setQuery("");
    setAttrezzo("");
    setPattern("");
    setFulcro("");
    setMeridiano("");
  };

  return (
    <div className="space-y-5">
      {/* Intestazione Video Vault */}
      <div
        className="rounded-3xl p-5 shadow-lg relative overflow-hidden"
        style={{ background: "#1c00ff", borderLeft: "8px solid #e3ff00" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#09090b] text-[#e3ff00] mb-1.5 shadow-xs">
              <Sparkles className="size-3 text-[#e3ff00]" /> Video Vault Landmine Lab
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Ricerca Semantica Rapida
            </h1>
            <p className="text-xs font-semibold text-zinc-200 mt-0.5">
              Tassonomia biomeccanica, fulcri articolari e clip dimostrative da 15s
            </p>
          </div>
          <div className="text-right">
            <span
              className="text-xs font-black px-3 py-1.5 rounded-2xl shadow-xs block"
              style={{ background: "#09090b", color: "#ffffff" }}
            >
              {esercizi.length} Esercizi
            </span>
            {durationMs > 0 && (
              <span className="text-[10px] font-bold text-[#e3ff00] mt-1 block">
                ⚡ {durationMs} ms
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Barra di Ricerca Vocale / Testuale Rapida */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-zinc-400 pointer-events-none" />
          <Input
            type="search"
            placeholder="Cerca per nome, pattern, cue (es. 'coiling', 'presa a tenaglia', 'spalla')…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11 pr-10 py-3.5 bg-white rounded-2xl border-2 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 text-sm focus:border-[#1c00ff] shadow-xs"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Filtri Avanzati a Tendina */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Attrezzo */}
          <Select
            value={attrezzo || "ALL"}
            onValueChange={(val) => setAttrezzo(val === "ALL" ? "" : val)}
          >
            <SelectTrigger className="bg-white rounded-xl border-zinc-200 text-xs font-bold h-10">
              <SelectValue placeholder="Attrezzo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutti gli attrezzi</SelectItem>
              {attrezzi.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Pattern Motorio */}
          <Select
            value={pattern || "ALL"}
            onValueChange={(val) => setPattern(val === "ALL" ? "" : val)}
          >
            <SelectTrigger className="bg-white rounded-xl border-zinc-200 text-xs font-bold h-10">
              <SelectValue placeholder="Pattern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutti i pattern</SelectItem>
              {(meta?.patterns || []).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Fulcro Articolare */}
          <Select
            value={fulcro || "ALL"}
            onValueChange={(val) => setFulcro(val === "ALL" ? "" : val)}
          >
            <SelectTrigger className="bg-white rounded-xl border-zinc-200 text-xs font-bold h-10">
              <SelectValue placeholder="Fulcro Articolare" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutti i fulcri</SelectItem>
              {(meta?.fulcri || []).map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Meridiano Miofasciale */}
          <Select
            value={meridiano || "ALL"}
            onValueChange={(val) => setMeridiano(val === "ALL" ? "" : val)}
          >
            <SelectTrigger className="bg-white rounded-xl border-zinc-200 text-xs font-bold h-10">
              <SelectValue placeholder="Meridiano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutti i meridiani</SelectItem>
              {(meta?.meridiani || []).map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs pt-1 px-1">
            <span className="text-zinc-500 font-semibold">
              Filtri attivi applicati
            </span>
            <button
              onClick={resetFilters}
              className="text-[#1c00ff] hover:underline font-black cursor-pointer"
            >
              Azzera tutti i filtri
            </button>
          </div>
        )}
      </div>

      {/* Lista Esercizi */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-200" />
          ))}
        </div>
      ) : esercizi.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center bg-white rounded-3xl border border-zinc-200 p-6">
          <Layers className="size-10 text-zinc-300" />
          <div>
            <p className="text-zinc-800 font-bold text-base">Nessun esercizio trovato</p>
            <p className="text-zinc-500 text-xs mt-1">
              Prova ad affinare la ricerca vocale o reimposta i filtri di selezione.
            </p>
          </div>
          <button
            onClick={resetFilters}
            className="mt-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800"
          >
            Azzera filtri
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {esercizi.map((ex) => (
            <div
              key={ex.id}
              className="rounded-2xl border-2 border-zinc-200 bg-white p-4 shadow-xs hover:border-[#1c00ff]/40 transition-all space-y-3"
            >
              {/* Header Card: Codice, Nome, Attrezzo */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-zinc-950 text-[#e3ff00]">
                      #{ex.id_esercizio}
                    </span>
                    {ex.attrezzo && (
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700">
                        {ex.attrezzo}
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-zinc-950 text-base leading-snug truncate">
                    {ex.nome_reale}
                  </h3>
                </div>

                {/* Badge Pattern */}
                {ex.pattern_motorio && (
                  <span className="shrink-0 text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-[#1c00ff]/10 text-[#1c00ff]">
                    {ex.pattern_motorio}
                  </span>
                )}
              </div>

              {/* Box Cue Esecutiva */}
              {ex.cue_esecutiva && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-zinc-900 flex items-start gap-2">
                  <Sparkles className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-black text-amber-900 uppercase tracking-wider block text-[10px]">
                      Cue Esecutiva Coach
                    </span>
                    <span className="font-semibold text-zinc-800 leading-snug">
                      {ex.cue_esecutiva}
                    </span>
                  </div>
                </div>
              )}

              {/* Tag Ontologici Rapidi */}
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-600">
                {ex.fulcro_articolare && (
                  <span className="inline-flex items-center gap-1 font-semibold bg-zinc-100 px-2 py-0.5 rounded-md">
                    <Crosshair className="size-3 text-zinc-400" />
                    Fulcro: {ex.fulcro_articolare}
                  </span>
                )}
                {ex.meridiano_miofasciale && (
                  <span className="inline-flex items-center gap-1 font-semibold bg-zinc-100 px-2 py-0.5 rounded-md">
                    <Activity className="size-3 text-zinc-400" />
                    {ex.meridiano_miofasciale}
                  </span>
                )}
              </div>

              {/* Bottoni Azioni Rapide per Coach & Atleta */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-100">
                {/* 1. Guarda Clip 15s in-place */}
                {ex.link_video ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedVideo({
                        open: true,
                        url: ex.link_video,
                        nome: ex.nome_reale,
                        cue: ex.cue_esecutiva,
                        pattern: ex.pattern_motorio,
                      })
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black shadow-xs bg-[#1c00ff] text-white hover:bg-[#1600cc] transition-colors cursor-pointer"
                  >
                    <Play className="size-3.5 text-[#e3ff00]" />
                    Clip 15s
                  </button>
                ) : (
                  <span className="flex-1 text-center py-2 text-xs text-zinc-400 font-medium">
                    Video non disponibile
                  </span>
                )}

                {/* 2. Invia WhatsApp al volo */}
                <a
                  href={ex.whatsapp_share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold border-2 border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                  title="Invia video e cue su WhatsApp"
                >
                  <Share2 className="size-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>

                {/* 3. Copia Link & Cue */}
                <button
                  type="button"
                  onClick={() => handleCopyClip(ex)}
                  className="flex items-center justify-center rounded-xl p-2 text-xs font-bold border border-zinc-300 text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Copia dettagli clip"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale Video Clip In-Place */}
      <VideoClipModal
        open={selectedVideo.open}
        onOpenChange={(open) => setSelectedVideo((prev) => ({ ...prev, open }))}
        videoUrl={selectedVideo.url}
        nomeEsercizio={selectedVideo.nome}
        cueEsecutiva={selectedVideo.cue}
        patternMotorio={selectedVideo.pattern}
      />
    </div>
  );
}