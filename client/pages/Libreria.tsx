import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, Play } from "lucide-react";
import { Input } from "../components/Input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/Select";

interface Esercizio {
  id: number;
  id_esercizio: string;
  nome_reale: string;
  attrezzo: string;
  tag_biomeccanici: string;
  link_video: string;
}

export default function LibreriaPage() {
  const [query, setQuery] = useState("");
  const [attrezzo, setAttrezzo] = useState("");

  const { data: attrezzi = [] } = useQuery<string[]>({
    queryKey: ["attrezzi"],
    queryFn: () => fetch("/app-api/libreria/attrezzi").then((r) => r.json()),
  });

  const params = new URLSearchParams();
  if (attrezzo) params.set("attrezzo", attrezzo);
  if (query) params.set("q", query);

  const { data: esercizi = [], isLoading } = useQuery<Esercizio[]>({
    queryKey: ["libreria", attrezzo, query],
    queryFn: () =>
      fetch(`/app-api/libreria?${params.toString()}`).then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl px-5 py-4 shadow-md relative overflow-hidden"
        style={{ background: "#1c00ff", borderLeft: "6px solid #e3ff00" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Database Esercizi
            </h1>
            <p className="text-xs font-bold text-[#e3ff00] mt-0.5 uppercase tracking-wider">
              Catalogo PRO Landmine Lab
            </p>
          </div>
          <span
            className="text-xs font-black px-2.5 py-1 rounded-full shadow-xs"
            style={{ background: "#09090b", color: "#ffffff" }}
          >
            {esercizi.length} Esercizi
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
          <Input
            type="search"
            placeholder="Cerca esercizio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-white rounded-xl border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-[#1c00ff]"
          />
        </div>
        <Select value={attrezzo} onValueChange={setAttrezzo}>
          <SelectTrigger className="w-full sm:w-48 bg-white rounded-xl border-zinc-200">
            <SelectValue placeholder="Tutti gli attrezzi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tutti gli attrezzi</SelectItem>
            {attrezzi.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-200" />)}
        </div>
      ) : esercizi.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <BookOpen className="size-10 text-zinc-400" />
          <p className="text-zinc-500 font-bold">Nessun esercizio trovato.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {esercizi.map((ex) => (
            <div
              key={ex.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 flex items-center justify-between gap-3 shadow-xs hover:border-zinc-300 transition-all"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-zinc-900 truncate leading-snug">{ex.nome_reale}</p>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  {ex.attrezzo && (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
                      style={{ background: "#09090b", color: "#e3ff00" }}
                    >
                      {ex.attrezzo}
                    </span>
                  )}
                  {ex.tag_biomeccanici && (
                    <span className="text-xs text-zinc-500 font-medium truncate max-w-[280px]">
                      {ex.tag_biomeccanici}
                    </span>
                  )}
                </div>
              </div>
              {ex.link_video ? (
                <a
                  href={ex.link_video}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Guarda il video di ${ex.nome_reale}`}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black shadow-xs transition-transform hover:scale-105 active:scale-95"
                  style={{ background: "#1c00ff", color: "#ffffff", border: "1px solid #e3ff00" }}
                >
                  <Play className="size-3.5 text-[#e3ff00]" />
                  Video
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}