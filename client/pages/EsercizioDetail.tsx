import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  Play,
  ClipboardList,
  History,
  Dumbbell,
  PlusCircle,
  Trash2,
  X,
  Check,
  LayoutList,
} from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/Dialog";
import { toast } from "../components/Toast";

interface SetRow {
  carico_kg: string;
  ripetizioni: string;
  rpe: string;
}

const emptySet = (): SetRow => ({ carico_kg: "", ripetizioni: "", rpe: "" });

function parseRpe(rpe: string): number | null {
  const cleaned = rpe.replace(/[^0-9.]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function calcolaVolume(sets: SetRow[]): number {
  return sets.reduce((acc, s) => {
    const reps = parseInt(s.ripetizioni, 10);
    return acc + (isNaN(reps) ? 0 : reps);
  }, 0);
}

function calcolaIntensitaMedia(sets: SetRow[]): number | null {
  const valori = sets
    .map((s) => parseRpe(s.rpe))
    .filter((v): v is number => v !== null);
  if (valori.length === 0) return null;
  return valori.reduce((a, b) => a + b, 0) / valori.length;
}

interface EsercizioScheda {
  id: number;
  livello: string;
  giorno: string | number;
  settimana?: string;
  sequenza: string;
  id_esercizio: string;
  nome_esercizio: string;
  parametri: string;
  recupero: string;
  minutaggio_blocco: string;
  note_tecniche: string;
  link_video: string;
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?\s\/]+)/,
  );
  return match ? match[1] : null;
}

export default function EsercizioDetailPage() {
  const { livello, giorno, idEsercizio } = useParams<{
    livello: string;
    giorno: string;
    idEsercizio: string;
  }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [storicoOpen, setStoricoOpen] = useState(false);
  const [sets, setSets] = useState<SetRow[]>([emptySet()]);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSets, setEditSets] = useState<SetRow[]>([emptySet()]);
  const [editFeedback, setEditFeedback] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (dialogOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setDialogOpen(false);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [dialogOpen]);

  function addSet() {
    setSets((prev) => [...prev, emptySet()]);
  }

  function removeSet(i: number) {
    setSets((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateSet(i: number, field: keyof SetRow, value: string) {
    setSets((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    );
  }

  function updateEditSet(i: number, field: keyof SetRow, value: string) {
    setEditSets((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    );
  }

  function openEditMode(row: any) {
    const setsArr: any[] = row.sets_json ?? [];
    setEditSets(
      setsArr.length > 0
        ? setsArr.map((s: any) => ({
            carico_kg: s.carico_kg != null ? String(s.carico_kg) : "",
            ripetizioni: s.ripetizioni != null ? String(s.ripetizioni) : "",
            rpe: s.rpe ?? "",
          }))
        : [emptySet()],
    );
    setEditFeedback(row.feedback ?? "");
    setEditingId(row.id);
  }

  async function handleSalvaModifica() {
    if (editingId == null) return;
    const setsValidi = editSets.filter((s) => s.ripetizioni.trim() !== "");
    if (setsValidi.length === 0) {
      toast.error("Compila almeno un set con le ripetizioni.");
      return;
    }
    setEditSaving(true);
    try {
      const setsJson = setsValidi.map((s) => ({
        carico_kg: s.carico_kg ? parseFloat(s.carico_kg) : null,
        ripetizioni: parseInt(s.ripetizioni, 10),
        rpe: s.rpe.trim() || null,
      }));
      const res = await fetch(`/app-api/diario/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: editFeedback || null,
          sets_json: setsJson,
        }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      queryClient.invalidateQueries({ queryKey: ["diario-esercizio", idEsercizio] });
      toast.success("Sessione aggiornata.");
      setEditingId(null);
    } catch {
      toast.error("Errore nel salvataggio. Riprova.");
    } finally {
      setEditSaving(false);
    }
  }

  const { data: esercizi = [] } = useQuery<EsercizioScheda[]>({
    queryKey: ["allenamento-dettaglio", livello, giorno],
    queryFn: () =>
      fetch(`/app-api/allenamenti/${encodeURIComponent(livello!)}/${giorno}`).then((r) => r.json()),
    enabled: !!livello && !!giorno,
  });
  const esercizio = esercizi.find((e) => e.id_esercizio === idEsercizio);

  const currentIndex = esercizi.findIndex((e) => e.id_esercizio === idEsercizio);
  const prevEsercizio =
    currentIndex > 0 ? esercizi[currentIndex - 1] : null;
  const nextEsercizio =
    currentIndex >= 0 && currentIndex < esercizi.length - 1
      ? esercizi[currentIndex + 1]
      : null;

  const videoId = esercizio?.link_video ? getYouTubeId(esercizio.link_video) : null;

  const { data: storicoRows = [], isLoading: storicoLoading } = useQuery<any[]>({
    queryKey: ["diario-esercizio", idEsercizio],
    queryFn: () =>
      fetch(`/app-api/diario/esercizio/${encodeURIComponent(idEsercizio!)}`).then((r) => r.json()),
    enabled: storicoOpen && !!idEsercizio,
  });

  async function handleSalva() {
    if (!esercizio) return;
    const setsValidi = sets.filter((s) => s.ripetizioni.trim() !== "");
    if (setsValidi.length === 0) {
      toast.error("Compila almeno un set con le ripetizioni.");
      return;
    }
    setSaving(true);
    try {
      const setsJson = setsValidi.map((s) => ({
        carico_kg: s.carico_kg ? parseFloat(s.carico_kg) : null,
        ripetizioni: parseInt(s.ripetizioni, 10),
        rpe: s.rpe.trim() || null,
      }));
      const rpeJson = setsValidi.some((s) => s.rpe.trim())
        ? setsValidi.map((s) => s.rpe.trim() || null)
        : null;
      const res = await fetch("/app-api/diario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_esercizio: esercizio.id_esercizio,
          nome_esercizio: esercizio.nome_esercizio,
          feedback: feedback || null,
          sets_json: setsJson,
          rpe_json: rpeJson,
        }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      queryClient.invalidateQueries({ queryKey: ["diario-esercizio", idEsercizio] });
      toast.success("Carico registrato nel diario!");
      setDialogOpen(false);
      setSets([emptySet()]);
      setFeedback("");
    } catch {
      toast.error("Errore nel salvataggio. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (!esercizio) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <ClipboardList className="size-10 text-secondary" />
        <p className="text-secondary">Caricamento esercizio…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-secondary flex-wrap">
        <Link to="/" className="hover:text-primary">Allenamenti</Link>
        <ChevronRight className="size-3.5" />
        <Link to={`/allenamento/${encodeURIComponent(livello!)}/${giorno}`} className="hover:text-primary">
          {livello} — {esercizio.settimana ? `${esercizio.settimana} — ` : ""}{esercizio.giorno ? String(esercizio.giorno) : `Giorno ${giorno}`}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-primary font-medium truncate max-w-[160px]">{esercizio.nome_esercizio}</span>
      </nav>

      {/* Intestazione */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div
            className="mb-1.5 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black tracking-wider shadow-xs"
            style={{ background: "#09090b", color: "#e3ff00", border: "1.5px solid #1c00ff" }}
          >
            SEQ. {esercizio.sequenza}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 leading-tight">
            {esercizio.nome_esercizio}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setStoricoOpen(true)} variant="secondary" className="border-zinc-300 font-bold">
            <History className="size-4" />
            Storico
          </Button>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            style={{ background: "#1c00ff", color: "#ffffff", border: "1.5px solid #e3ff00" }}
          >
            <ClipboardList className="size-4 text-[#e3ff00]" />
            Registra Carico
          </button>
        </div>
      </div>

      {/* Parametri principali */}
      <div className="grid grid-cols-2 gap-2.5">
        {esercizio.parametri && (
          <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#1c00ff]" />
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">
              Parametri
            </p>
            <p className="text-[13px] sm:text-sm font-bold text-zinc-900 leading-snug break-words">
              {esercizio.parametri}
            </p>
          </div>
        )}
        {esercizio.recupero && (
          <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#e3ff00]" />
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">
              Recupero
            </p>
            <p className="text-[13px] sm:text-sm font-bold text-zinc-900 leading-snug break-words">
              {esercizio.recupero}
            </p>
          </div>
        )}
      </div>

      {/* Video YouTube */}
      {videoId && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Play className="size-4 text-[#1c00ff]" />
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-800">Video dimostrativo</h2>
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-2xl border-2 border-zinc-200 bg-black shadow-sm">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title={esercizio.nome_esercizio}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>
      )}

      {/* Note Tecniche */}
      {esercizio.note_tecniche && (
        <div className="space-y-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-800">Note Tecniche</h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
            <p className="text-sm font-medium text-zinc-800 leading-relaxed whitespace-pre-line">
              {esercizio.note_tecniche}
            </p>
          </div>
        </div>
      )}

      {/* Navigazione fondo pagina tra esercizi e scheda allenamento */}
      <div className="pt-4 pb-4 border-t border-zinc-200 space-y-2.5">
        {/* Griglia Esercizio Precedente / Esercizio Successivo */}
        <div className="grid grid-cols-2 gap-2.5">
          {prevEsercizio ? (
            <button
              onClick={() =>
                navigate(
                  `/esercizio/${encodeURIComponent(livello!)}/${giorno}/${encodeURIComponent(prevEsercizio.id_esercizio)}`,
                )
              }
              className="flex items-center gap-2 p-2.5 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 shadow-xs cursor-pointer text-left transition-all active:scale-[0.98] group"
              title={`Esercizio precedente: ${prevEsercizio.nome_esercizio}`}
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105"
                style={{
                  background: "#09090b",
                  color: "#e3ff00",
                  border: "1.5px solid #1c00ff",
                }}
              >
                <ChevronLeft className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Precedente
                  </span>
                  <span className="text-[9px] font-black px-1 rounded bg-zinc-100 text-zinc-700">
                    {prevEsercizio.sequenza}
                  </span>
                </div>
                <p className="text-xs font-bold text-zinc-900 truncate leading-tight mt-0.5">
                  {prevEsercizio.nome_esercizio}
                </p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 opacity-40 select-none">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-400">
                <ChevronLeft className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  Inizio
                </span>
                <p className="text-xs font-semibold text-zinc-400 truncate leading-tight mt-0.5">
                  1° Esercizio
                </p>
              </div>
            </div>
          )}

          {nextEsercizio ? (
            <button
              onClick={() =>
                navigate(
                  `/esercizio/${encodeURIComponent(livello!)}/${giorno}/${encodeURIComponent(nextEsercizio.id_esercizio)}`,
                )
              }
              className="flex items-center justify-between gap-2 p-2.5 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 shadow-xs cursor-pointer text-right transition-all active:scale-[0.98] group"
              title={`Esercizio successivo: ${nextEsercizio.nome_esercizio}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-[9px] font-black px-1 rounded bg-[#1c00ff]/10 text-[#1c00ff]">
                    {nextEsercizio.sequenza}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#1c00ff]">
                    Successivo
                  </span>
                </div>
                <p className="text-xs font-bold text-zinc-900 truncate leading-tight mt-0.5">
                  {nextEsercizio.nome_esercizio}
                </p>
              </div>
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105"
                style={{
                  background: "#1c00ff",
                  color: "#e3ff00",
                  border: "1.5px solid #e3ff00",
                }}
              >
                <ChevronRight className="size-5" />
              </div>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 opacity-40 select-none text-right">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  Fine
                </span>
                <p className="text-xs font-semibold text-zinc-400 truncate leading-tight mt-0.5">
                  Ultimo Esercizio
                </p>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-400">
                <ChevronRight className="size-5" />
              </div>
            </div>
          )}
        </div>

        {/* Tasto Torna alla Scheda Allenamento */}
        <button
          onClick={() =>
            navigate(`/allenamento/${encodeURIComponent(livello!)}/${giorno}`)
          }
          className="flex w-full items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 hover:text-zinc-950 text-xs font-black uppercase tracking-wider shadow-xs transition-colors cursor-pointer"
        >
          <LayoutList className="size-4 text-[#1c00ff]" />
          <span>Torna alla Scheda Allenamento</span>
        </button>
      </div>

      {/* Dialog Storico Esercizio */}
      <Dialog open={storicoOpen} onOpenChange={setStoricoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storico esercizio</DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <p className="text-sm text-secondary font-medium mb-4 truncate">
              {esercizio.nome_esercizio}
            </p>
            {storicoLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="size-6 animate-spin rounded-full border-2 border-border border-t-accent" />
              </div>
            ) : storicoRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Dumbbell className="size-8 text-secondary" />
                <p className="text-sm text-secondary">Nessun carico registrato ancora.</p>
                <p className="text-xs text-secondary">Completa la prima sessione per vedere lo storico qui.</p>
              </div>
            ) : (
              <div className="divide-y divide-border-weak max-h-[60vh] overflow-y-auto -mx-6 px-6">
                {storicoRows.map((row: any) => {
                  const data = new Date(row.data_ora);
                  const dataStr = data.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
                  const oraStr = data.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                  const setsArr: any[] = row.sets_json ?? [];
                  const isEditing = editingId === row.id;

                  if (isEditing) {
                    return (
                      <div key={row.id} className="py-3 space-y-3">
                        <p className="text-xs text-secondary font-medium">{dataStr} {oraStr}</p>
                        <div className="space-y-2">
                          {editSets.map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="flex shrink-0 size-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "#1c00ff", color: "#fff" }}>{i + 1}</span>
                              <Input type="number" placeholder="kg" value={s.carico_kg} onChange={(e) => updateEditSet(i, "carico_kg", e.target.value)} className="flex-1" />
                              <Input type="number" placeholder="reps" value={s.ripetizioni} onChange={(e) => updateEditSet(i, "ripetizioni", e.target.value)} className="flex-1" />
                              <Input type="text" placeholder="RPE" value={s.rpe} onChange={(e) => updateEditSet(i, "rpe", e.target.value)} className="w-16" />
                              {editSets.length > 1 && (
                                <button onClick={() => setEditSets((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 p-1 rounded hover:bg-inset cursor-pointer text-secondary" aria-label="Rimuovi set">
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button onClick={() => setEditSets((prev) => [...prev, emptySet()])} className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary cursor-pointer">
                          <PlusCircle className="size-3.5" /> Aggiungi set
                        </button>
                        <Textarea placeholder="Note…" value={editFeedback} onChange={(e) => setEditFeedback(e.target.value)} rows={2} />
                        <div className="flex gap-2">
                          <Button variant="primary" size="sm" onClick={handleSalvaModifica} isLoading={editSaving}>Salva</Button>
                          <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>Annulla</Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={row.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {setsArr.length > 0 ? (
                            <div className="space-y-1.5">
                              {setsArr.map((s: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 flex-wrap">
                                  <span className="flex shrink-0 size-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "#1c00ff", color: "#fff" }}>{i + 1}</span>
                                  <span className="text-sm text-primary font-bold">{s.carico_kg != null ? `${s.carico_kg} kg` : "—"}</span>
                                  <span className="text-sm font-semibold text-zinc-700">× {s.ripetizioni} rip.</span>
                                  {s.rpe && <span className="text-sm font-bold text-[#1c00ff]">RPE {s.rpe}</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-secondary italic">Solo nota</span>
                          )}
                          {row.feedback && <p className="text-sm text-secondary mt-1 leading-relaxed">{row.feedback}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <p className="text-xs text-secondary">{dataStr}</p>
                          <p className="text-xs text-secondary">{oraStr}</p>
                          <button onClick={() => openEditMode(row)} className="text-xs text-accent hover:underline cursor-pointer">Modifica</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setStoricoOpen(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schermata Fullscreen Registra Carico (Sfondo chiaro con leggera trasparenza) */}
      {dialogOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="absolute inset-0 z-40 flex flex-col w-full h-full overflow-y-auto"
            style={{
              backgroundColor: "rgba(244, 245, 248, 0.95)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div className="w-full min-h-full flex flex-col justify-between p-4 sm:p-5 py-6">
              {/* Header */}
              <div>
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-black/10">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black tracking-wider shadow-xs"
                        style={{ background: "#09090b", color: "#e3ff00", border: "1.5px solid #1c00ff" }}
                      >
                        SEQ. {esercizio.sequenza}
                      </span>
                      {esercizio.parametri && (
                        <span className="text-[12px] font-bold text-zinc-900 bg-white border border-zinc-200 px-2.5 py-1 rounded-lg shadow-xs">
                          {esercizio.parametri}
                        </span>
                      )}
                      {esercizio.recupero && (
                        <span className="text-[12px] font-bold text-[#1c00ff] bg-[#1c00ff]/10 px-2.5 py-1 rounded-lg">
                          Rec: {esercizio.recupero}
                        </span>
                      )}
                    </div>
                    <h2
                      className="text-2xl sm:text-3xl font-black tracking-tight"
                      style={{ color: "#09090b" }}
                    >
                      Registra Carico
                    </h2>
                    <p
                      className="text-base font-bold truncate mt-0.5"
                      style={{ color: "#1c00ff" }}
                    >
                      {esercizio.nome_esercizio}
                    </p>
                  </div>

                  <button
                    onClick={() => setDialogOpen(false)}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                    aria-label="Chiudi"
                    title="Chiudi schermata (ESC)"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Card Set */}
                <div className="mt-6 rounded-2xl bg-white/95 p-5 sm:p-6 shadow-xl border border-black/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-700">
                      Serie di allenamento
                    </span>
                    <span className="text-xs font-medium text-zinc-500">
                      Inserisci carichi e ripetizioni
                    </span>
                  </div>

                  {/* Intestazione Colonne */}
                  <div
                    className="grid gap-2 text-center text-xs font-extrabold uppercase tracking-wider text-zinc-700"
                    style={{ gridTemplateColumns: "36px 1fr 1fr 80px 32px" }}
                  >
                    <span>Set</span>
                    <span>Carico (kg)</span>
                    <span>Ripetizioni</span>
                    <span>RPE</span>
                    <span />
                  </div>

                  {/* Righe Serie */}
                  <div className="space-y-2.5">
                    {sets.map((s, i) => (
                      <div
                        key={i}
                        className="grid items-center gap-2"
                        style={{
                          gridTemplateColumns: "36px 1fr 1fr 80px 32px",
                        }}
                      >
                        <span
                          className="flex size-8 items-center justify-center rounded-full text-xs font-black shadow-sm"
                          style={{ background: "#1c00ff", color: "#ffffff" }}
                        >
                          {i + 1}
                        </span>
                        <input
                          type="number"
                          step="any"
                          placeholder="kg"
                          value={s.carico_kg}
                          onChange={(e) =>
                            updateSet(i, "carico_kg", e.target.value)
                          }
                          className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-center text-base font-bold text-zinc-900 placeholder:text-zinc-400 focus:border-[#1c00ff] focus:outline-none focus:ring-2 focus:ring-[#1c00ff]/20 shadow-sm"
                        />
                        <input
                          type="number"
                          placeholder="reps"
                          value={s.ripetizioni}
                          onChange={(e) =>
                            updateSet(i, "ripetizioni", e.target.value)
                          }
                          className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-center text-base font-bold text-zinc-900 placeholder:text-zinc-400 focus:border-[#1c00ff] focus:outline-none focus:ring-2 focus:ring-[#1c00ff]/20 shadow-sm"
                        />
                        <input
                          type="text"
                          placeholder="es. 8.5"
                          value={s.rpe}
                          onChange={(e) =>
                            updateSet(i, "rpe", e.target.value)
                          }
                          inputMode="decimal"
                          className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-2 text-center text-base font-bold text-zinc-900 placeholder:text-zinc-400 focus:border-[#1c00ff] focus:outline-none focus:ring-2 focus:ring-[#1c00ff]/20 shadow-sm"
                        />
                        {sets.length > 1 ? (
                          <button
                            onClick={() => removeSet(i)}
                            className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            aria-label={`Elimina set ${i + 1}`}
                            title="Elimina serie"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Statistiche Live Volume & RPE */}
                  {calcolaVolume(sets) > 0 && (
                    <div className="flex gap-3 flex-wrap pt-2">
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#1c00ff]/10 px-3 py-1.5 text-xs font-bold text-[#1c00ff]">
                        <span>Volume:</span>
                        <span className="text-zinc-950 font-black">
                          {calcolaVolume(sets)} rip.
                        </span>
                      </div>
                      {calcolaIntensitaMedia(sets) !== null && (
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#1c00ff]/10 px-3 py-1.5 text-xs font-bold text-[#1c00ff]">
                          <span>RPE medio:</span>
                          <span className="text-zinc-950 font-black">
                            {calcolaIntensitaMedia(sets)!.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottone Aggiungi Set */}
                  <button
                    onClick={addSet}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50/60 py-3 text-sm font-bold text-[#1c00ff] hover:bg-zinc-100/80 hover:border-[#1c00ff] transition-all cursor-pointer"
                  >
                    <PlusCircle className="size-4" />
                    Aggiungi Set
                  </button>

                  {/* Note e Feedback */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-200">
                    <label className="block text-xs font-black uppercase tracking-wider text-zinc-600">
                      Note / Sensazioni dell'atleta
                    </label>
                    <textarea
                      placeholder="Come ti sei sentito? Note su carico, velocità o sensazioni biomeccaniche…"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-[#1c00ff] focus:outline-none focus:ring-2 focus:ring-[#1c00ff]/20 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Footer con Azioni */}
              <div className="mt-6 pt-4 border-t border-black/10 flex items-center justify-end gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors shadow-sm cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSalva}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                  style={{ background: "#1c00ff", border: "1.5px solid #e3ff00" }}
                >
                  {saving ? (
                    <span>Salvataggio…</span>
                  ) : (
                    <>
                      <Check className="size-4 text-[#e3ff00]" />
                      <span>Salva nel Diario</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.getElementById("phone-frame") || document.body,
        )}
    </div>
  );
}