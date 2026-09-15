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
      <div className="rounded-xl px-5 py-4" style={{ background: "#1c00ff" }}>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#ffffff" }}>
          Archivio Esercizi
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>
          {esercizi.length > 0 ? `${esercizi.length} esercizi` : "Catalogo completo"}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-secondary pointer-events-none" />
          <Input
            type="search"
            placeholder="Cerca esercizio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={attrezzo} onValueChange={setAttrezzo}>
          <SelectTrigger className="w-full sm:w-48">
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
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-inset" />)}
        </div>
      ) : esercizi.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <BookOpen className="size-10 text-secondary" />
          <p className="text-secondary">Nessun esercizio trovato.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {esercizi.map((ex) => (
            <div
              key={ex.id}
              className="rounded-lg border p-4 flex items-center justify-between gap-3"
              style={{ borderColor: "#1c00ff", background: "var(--color-raised)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-primary truncate leading-snug">{ex.nome_reale}</p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {ex.attrezzo && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: "#e3ff00", color: "#1c00ff" }}
                    >
                      {ex.attrezzo}
                    </span>
                  )}
                  {ex.tag_biomeccanici && (
                    <span className="text-xs text-secondary truncate max-w-[400px]">
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
                  className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "#1c00ff", color: "#ffffff" }}
                >
                  <Play className="size-3.5" />
                  Video
                </a>
              ) : (
                <span
                  className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium"
                  style={{ background: "var(--color-inset)", color: "var(--color-secondary)" }}
                >
                  No video
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}