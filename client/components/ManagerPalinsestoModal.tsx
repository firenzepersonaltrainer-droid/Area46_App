import React, { useState } from "react";
import {
  CalendarRange,
  Clock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Layers,
  Sparkles,
  AlertTriangle,
  X,
  CalendarDays,
  Info,
} from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import {
  useAttivita,
  useRegolePalinsesto,
  AttivitaLab,
  RegolaPalinsesto,
} from "../lib/useUser";
import {
  FasciaOraria,
  timeToMinutes,
  minutesToTime,
  ATTIVITA_DEFAULT_LANDMINE,
} from "../lib/palinsesto";
import { toast } from "sonner";

const GIORNI_CONFIG = [
  { id: 1, label: "Lun", full: "Lunedì" },
  { id: 2, label: "Mar", full: "Martedì" },
  { id: 3, label: "Mer", full: "Mercoledì" },
  { id: 4, label: "Gio", full: "Giovedì" },
  { id: 5, label: "Ven", full: "Venerdì" },
  { id: 6, label: "Sab", full: "Sabato" },
  { id: 0, label: "Dom", full: "Domenica" },
];

const COLORI_PRESET = [
  { hex: "#1c00ff", label: "Blu Area46" },
  { hex: "#e3ff00", label: "Giallo Fluo" },
  { hex: "#10b981", label: "Verde Emerald" },
  { hex: "#f59e0b", label: "Ambra" },
  { hex: "#ef4444", label: "Rosso" },
  { hex: "#8b5cf6", label: "Viola" },
  { hex: "#09090b", label: "Nero Dark" },
];

interface ManagerPalinsestoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagerPalinsestoModal({
  open,
  onOpenChange,
}: ManagerPalinsestoModalProps) {
  const [activeTab, setActiveTab] = useState<"regole" | "attivita">("regole");

  // Hooks dati
  const {
    attivita,
    creaAttivita,
    aggiornaAttivita,
    eliminaAttivita,
  } = useAttivita();

  const {
    regole,
    creaRegola,
    aggiornaRegola,
    eliminaRegola,
  } = useRegolePalinsesto();

  // Stato editing Regola
  const [editingRegola, setEditingRegola] = useState<Partial<RegolaPalinsesto> | null>(null);
  const [isNewRegola, setIsNewRegola] = useState(false);

  // Stato editing Attività
  const [editingAttivita, setEditingAttivita] = useState<Partial<AttivitaLab> | null>(null);
  const [isNewAttivita, setIsNewAttivita] = useState(false);

  // Helper calcolo anteprima slot generati per una fascia
  const calcolaAnteprimaFascia = (f: FasciaOraria): string[] => {
    const start = timeToMinutes(f.ora_inizio);
    const end = timeToMinutes(f.ultimo_accesso);
    const step = f.intervallo_minuti || 15;
    if (start > end || step <= 0) return [];
    const list: string[] = [];
    for (let m = start; m <= end; m += step) {
      list.push(minutesToTime(m));
    }
    return list;
  };

  // Inizializza form nuova regola
  const handleNuovaRegola = () => {
    setEditingRegola({
      nome: "Palinsesto Stagionale",
      id_attivita: attivita[0]?.id || ATTIVITA_DEFAULT_LANDMINE.id,
      data_inizio: new Date().toISOString().slice(0, 10),
      data_fine: "2027-07-31",
      giorni_settimana: [1, 3, 5],
      fasce_orarie: [
        {
          nome: "Mattina",
          ora_inizio: "09:00",
          ultimo_accesso: "11:00",
          ora_fine_finestra: "12:30",
          intervallo_minuti: 15,
        },
        {
          nome: "Pomeriggio",
          ora_inizio: "17:00",
          ultimo_accesso: "19:00",
          ora_fine_finestra: "20:30",
          intervallo_minuti: 15,
        },
      ],
      attiva: true,
    });
    setIsNewRegola(true);
  };

  // Salva regola
  const handleSaveRegola = async () => {
    if (!editingRegola || !editingRegola.nome) {
      toast.error("Inserisci un nome per il palinsesto");
      return;
    }
    if (!editingRegola.giorni_settimana || editingRegola.giorni_settimana.length === 0) {
      toast.error("Seleziona almeno un giorno della settimana");
      return;
    }
    if (!editingRegola.fasce_orarie || editingRegola.fasce_orarie.length === 0) {
      toast.error("Aggiungi almeno una fascia oraria");
      return;
    }

    try {
      if (isNewRegola) {
        await creaRegola(editingRegola);
      } else if (editingRegola.id) {
        await aggiornaRegola(editingRegola as RegolaPalinsesto);
      }
      setEditingRegola(null);
    } catch {
      // toast gestito da hook
    }
  };

  // Inizializza form nuova attività
  const handleNuovaAttivita = () => {
    setEditingAttivita({
      nome: "Nuova Attività",
      descrizione: "Descrizione della tipologia di allenamento",
      costo_crediti: 1,
      max_partecipanti: 1,
      durata_minuti: 60,
      colore: "#1c00ff",
      attiva: true,
    });
    setIsNewAttivita(true);
  };

  // Salva attività
  const handleSaveAttivita = async () => {
    if (!editingAttivita || !editingAttivita.nome) {
      toast.error("Inserisci un nome per l'attività");
      return;
    }
    try {
      if (isNewAttivita) {
        await creaAttivita(editingAttivita);
      } else if (editingAttivita.id) {
        await aggiornaAttivita(editingAttivita as AttivitaLab);
      }
      setEditingAttivita(null);
    } catch {
      // toast gestito da hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] bg-white rounded-3xl p-5 border border-zinc-200 shadow-2xl flex flex-col overflow-hidden">
        {/* HEADER MODALE */}
        <DialogHeader className="shrink-0 pb-2 border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-[#1c00ff]/10 text-[#1c00ff] flex items-center justify-center font-black">
                <CalendarRange className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-zinc-900 leading-tight">
                  Palinsesto & Attività Lab
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                  Programmazione ricorrente e orari a scaglioni stile Bookyway
                </DialogDescription>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-zinc-100 p-0.5 rounded-xl border border-zinc-200">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("regole");
                  setEditingRegola(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                  activeTab === "regole"
                    ? "bg-white text-[#1c00ff] shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Palinsesti ({regole.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("attivita");
                  setEditingAttivita(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                  activeTab === "attivita"
                    ? "bg-white text-[#1c00ff] shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Attività ({attivita.length})
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* CONTENUTO SCORREVOLE */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 [scrollbar-width:thin] pr-1">
          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1: GESTIONE REGOLE PALINSESTO
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "regole" && !editingRegola && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-700">
                  Periodi e Ricorrenze Attive
                </span>
                <Button
                  size="sm"
                  onClick={handleNuovaRegola}
                  className="bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black text-xs h-7 px-2.5 rounded-xl flex items-center gap-1"
                >
                  <Plus className="size-3.5" /> Nuovo Periodo
                </Button>
              </div>

              {regole.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 text-zinc-500 text-xs">
                  Nessun palinsesto programmato. Clicca su &quot;Nuovo Periodo&quot; per iniziare.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {regole.map((rule) => {
                    const act = attivita.find((a) => a.id === rule.id_attivita);
                    const giorniLabels = GIORNI_CONFIG.filter((g) =>
                      rule.giorni_settimana.includes(g.id)
                    ).map((g) => g.label);

                    return (
                      <div
                        key={rule.id}
                        className="p-3.5 rounded-2xl bg-white border border-zinc-200 shadow-2xs hover:border-[#1c00ff]/50 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-zinc-900 text-sm">
                                {rule.nome}
                              </span>
                              <span
                                className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${act?.colore || "#1c00ff"}15`,
                                  color: act?.colore || "#1c00ff",
                                  border: `1px solid ${act?.colore || "#1c00ff"}40`,
                                }}
                              >
                                {act?.nome || "Landmine Lab"}
                              </span>
                              {rule.attiva ? (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                                  Attivo
                                </span>
                              ) : (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-zinc-200 text-zinc-600">
                                  Sospeso
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                              Valido dal <strong>{rule.data_inizio}</strong> al{" "}
                              <strong>{rule.data_fine || "Indefinito"}</strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingRegola(rule);
                                setIsNewRegola(false);
                              }}
                              className="h-7 w-7 p-0 rounded-lg hover:bg-zinc-100 text-zinc-600"
                              title="Modifica periodo"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Sei sicuro di voler eliminare il palinsesto "${rule.nome}"?`
                                  )
                                ) {
                                  eliminaRegola(rule.id);
                                }
                              }}
                              className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 text-red-600"
                              title="Elimina periodo"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* GIORNI E FASCE */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-100 text-xs">
                          <div className="flex items-center gap-1">
                            {GIORNI_CONFIG.map((g) => {
                              const isAttivo = rule.giorni_settimana.includes(g.id);
                              return (
                                <span
                                  key={g.id}
                                  className={`size-6 rounded-lg text-[10px] font-black flex items-center justify-center ${
                                    isAttivo
                                      ? "bg-[#1c00ff] text-white"
                                      : "bg-zinc-100 text-zinc-400"
                                  }`}
                                  title={g.full}
                                >
                                  {g.label.slice(0, 1)}
                                </span>
                              );
                            })}
                          </div>

                          <span className="text-zinc-300">|</span>

                          {rule.fasce_orarie.map((f, idx) => {
                            const slots = calcolaAnteprimaFascia(f);
                            return (
                              <div
                                key={idx}
                                className="px-2 py-0.5 rounded-lg bg-zinc-50 border border-zinc-200 text-[10px] text-zinc-700"
                                title={`Ingressi ogni ${f.intervallo_minuti}m: ${slots.join(", ")}`}
                              >
                                <strong>{f.nome || `Fascia ${idx + 1}`}</strong>: {f.ora_inizio} -{" "}
                                {f.ultimo_accesso} ({slots.length} slot da {f.intervallo_minuti}m)
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              FORM CREAZIONE / MODIFICA REGOLA PALINSESTO
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "regole" && editingRegola && (
            <div className="space-y-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                <span className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <CalendarRange className="size-4 text-[#1c00ff]" />
                  {isNewRegola ? "Crea Nuovo Palinsesto" : "Modifica Palinsesto"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingRegola(null)}
                  className="h-6 text-[11px] text-zinc-500"
                >
                  Annulla
                </Button>
              </div>

              {/* CAMPI BASE: NOME E ATTIVITÀ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                    Nome Periodo
                  </label>
                  <Input
                    value={editingRegola.nome || ""}
                    onChange={(e) =>
                      setEditingRegola((prev) => ({ ...prev, nome: e.target.value }))
                    }
                    placeholder="es. Orario Ordinario Landmine Lab"
                    className="text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                    Attività Associata
                  </label>
                  <select
                    value={editingRegola.id_attivita || ""}
                    onChange={(e) =>
                      setEditingRegola((prev) => ({ ...prev, id_attivita: e.target.value }))
                    }
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white font-bold text-xs"
                  >
                    {attivita.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome} ({a.costo_crediti} Credito/i)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DATE VALIDITÀ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                    Data Inizio Validità
                  </label>
                  <Input
                    type="date"
                    value={editingRegola.data_inizio || ""}
                    onChange={(e) =>
                      setEditingRegola((prev) => ({ ...prev, data_inizio: e.target.value }))
                    }
                    className="text-xs bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase text-zinc-500 block">
                      Data Fine Validità
                    </label>
                    <label className="text-[10px] text-zinc-500 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!editingRegola.data_fine}
                        onChange={(e) =>
                          setEditingRegola((prev) => ({
                            ...prev,
                            data_fine: e.target.checked ? null : "2027-07-31",
                          }))
                        }
                        className="rounded border-zinc-300 size-3 text-[#1c00ff]"
                      />
                      Perenne (senza fine)
                    </label>
                  </div>
                  {editingRegola.data_fine ? (
                    <Input
                      type="date"
                      value={editingRegola.data_fine}
                      onChange={(e) =>
                        setEditingRegola((prev) => ({ ...prev, data_fine: e.target.value }))
                      }
                      className="text-xs bg-white"
                    />
                  ) : (
                    <div className="p-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-400 text-xs italic">
                      Attivo a tempo indeterminato
                    </div>
                  )}
                </div>
              </div>

              {/* GIORNI DELLA SETTIMANA */}
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1.5">
                  Giorni della Settimana Attivi
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {GIORNI_CONFIG.map((g) => {
                    const isChecked = (editingRegola.giorni_settimana || []).includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          const curr = editingRegola.giorni_settimana || [];
                          const updated = isChecked
                            ? curr.filter((id) => id !== g.id)
                            : [...curr, g.id];
                          setEditingRegola((prev) => ({
                            ...prev,
                            giorni_settimana: updated,
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all border cursor-pointer ${
                          isChecked
                            ? "bg-[#1c00ff] text-white border-[#1c00ff] shadow-2xs"
                            : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        {g.full}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FASCE ORARIE ED INTERVALLI */}
              <div className="space-y-2 pt-2 border-t border-zinc-200">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-zinc-500">
                    Fasce Orarie & Ingressi a Scaglioni
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const curr = editingRegola.fasce_orarie || [];
                      setEditingRegola((prev) => ({
                        ...prev,
                        fasce_orarie: [
                          ...curr,
                          {
                            nome: `Fascia ${curr.length + 1}`,
                            ora_inizio: "14:00",
                            ultimo_accesso: "16:00",
                            ora_fine_finestra: "17:30",
                            intervallo_minuti: 15,
                          },
                        ],
                      }));
                    }}
                    className="text-[#1c00ff] text-[11px] font-black hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="size-3" /> Aggiungi Fascia
                  </button>
                </div>

                <div className="space-y-2">
                  {(editingRegola.fasce_orarie || []).map((f, fIdx) => {
                    const slots = calcolaAnteprimaFascia(f);
                    return (
                      <div
                        key={fIdx}
                        className="p-3 rounded-2xl bg-white border border-zinc-200 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            value={f.nome || ""}
                            onChange={(e) => {
                              const next = [...(editingRegola.fasce_orarie || [])];
                              next[fIdx] = { ...next[fIdx], nome: e.target.value };
                              setEditingRegola((prev) => ({ ...prev, fasce_orarie: next }));
                            }}
                            placeholder="Nome fascia (es. Mattina, Pomeriggio)"
                            className="font-black text-xs h-7 max-w-[200px]"
                          />
                          {(editingRegola.fasce_orarie || []).length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const next = (editingRegola.fasce_orarie || []).filter(
                                  (_, idx) => idx !== fIdx
                                );
                                setEditingRegola((prev) => ({ ...prev, fasce_orarie: next }));
                              }}
                              className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
                              title="Rimuovi fascia"
                            >
                              <X className="size-3.5" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-zinc-400 block mb-0.5">
                              Primo Ingresso
                            </label>
                            <Input
                              type="time"
                              value={f.ora_inizio}
                              onChange={(e) => {
                                const next = [...(editingRegola.fasce_orarie || [])];
                                next[fIdx] = { ...next[fIdx], ora_inizio: e.target.value };
                                setEditingRegola((prev) => ({ ...prev, fasce_orarie: next }));
                              }}
                              className="text-xs h-8"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-zinc-400 block mb-0.5">
                              Ultimo Ingresso
                            </label>
                            <Input
                              type="time"
                              value={f.ultimo_accesso}
                              onChange={(e) => {
                                const next = [...(editingRegola.fasce_orarie || [])];
                                next[fIdx] = { ...next[fIdx], ultimo_accesso: e.target.value };
                                setEditingRegola((prev) => ({ ...prev, fasce_orarie: next }));
                              }}
                              className="text-xs h-8"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-zinc-400 block mb-0.5">
                              Uscita Massima Lab
                            </label>
                            <Input
                              type="time"
                              value={f.ora_fine_finestra || ""}
                              onChange={(e) => {
                                const next = [...(editingRegola.fasce_orarie || [])];
                                next[fIdx] = { ...next[fIdx], ora_fine_finestra: e.target.value };
                                setEditingRegola((prev) => ({ ...prev, fasce_orarie: next }));
                              }}
                              className="text-xs h-8"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-zinc-400 block mb-0.5">
                              Scaglioni Ogni
                            </label>
                            <select
                              value={f.intervallo_minuti}
                              onChange={(e) => {
                                const next = [...(editingRegola.fasce_orarie || [])];
                                next[fIdx] = {
                                  ...next[fIdx],
                                  intervallo_minuti: parseInt(e.target.value, 10),
                                };
                                setEditingRegola((prev) => ({ ...prev, fasce_orarie: next }));
                              }}
                              className="w-full h-8 px-2 rounded-lg border border-zinc-300 bg-white font-bold text-xs"
                            >
                              <option value={15}>15 Minuti</option>
                              <option value={30}>30 Minuti</option>
                              <option value={45}>45 Minuti</option>
                              <option value={60}>60 Minuti</option>
                            </select>
                          </div>
                        </div>

                        {/* ANTEPRIMA SLOT GENERATI */}
                        <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100 text-[10px]">
                          <div className="font-bold text-zinc-500 mb-1 flex items-center justify-between">
                            <span>Anteprima Slot ({slots.length} ingressi):</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {slots.map((s) => (
                              <span
                                key={s}
                                className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 font-mono font-bold text-zinc-800"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PULSANTI SALVATAGGIO */}
              <div className="flex gap-2 pt-2 border-t border-zinc-200">
                <Button
                  variant="outline"
                  onClick={() => setEditingRegola(null)}
                  className="flex-1 rounded-xl"
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleSaveRegola}
                  className="flex-1 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black"
                >
                  {isNewRegola ? "Salva Nuovo Palinsesto" : "Aggiorna Palinsesto"}
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 2: GESTIONE ATTIVITÀ LAB
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "attivita" && !editingAttivita && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-700">
                  Tipologie di Attività & Corsi
                </span>
                <Button
                  size="sm"
                  onClick={handleNuovaAttivita}
                  className="bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black text-xs h-7 px-2.5 rounded-xl flex items-center gap-1"
                >
                  <Plus className="size-3.5" /> Nuova Attività
                </Button>
              </div>

              <div className="space-y-2">
                {attivita.map((act) => (
                  <div
                    key={act.id}
                    className="p-3.5 rounded-2xl bg-white border border-zinc-200 shadow-2xs hover:border-[#1c00ff]/40 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="size-9 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-xs"
                        style={{ backgroundColor: act.colore || "#1c00ff" }}
                      >
                        <Layers className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-zinc-900">
                            {act.nome}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {act.costo_crediti} {act.costo_crediti === 1 ? "Credito" : "Crediti"}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {act.descrizione || "Nessuna descrizione"} • Max {act.max_partecipanti} pers. • {act.durata_minuti}m
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingAttivita(act);
                          setIsNewAttivita(false);
                        }}
                        className="h-7 w-7 p-0 rounded-lg hover:bg-zinc-100 text-zinc-600"
                        title="Modifica attività"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      {attivita.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Sei sicuro di voler eliminare l'attività "${act.nome}"?`
                              )
                            ) {
                              eliminaAttivita(act.id);
                            }
                          }}
                          className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 text-red-600"
                          title="Elimina attività"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              FORM CREAZIONE / MODIFICA ATTIVITÀ
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "attivita" && editingAttivita && (
            <div className="space-y-3.5 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                <span className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <Layers className="size-4 text-[#1c00ff]" />
                  {isNewAttivita ? "Nuova Attività" : "Modifica Attività"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingAttivita(null)}
                  className="h-6 text-[11px] text-zinc-500"
                >
                  Annulla
                </Button>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                  Nome Attività
                </label>
                <Input
                  value={editingAttivita.nome || ""}
                  onChange={(e) =>
                    setEditingAttivita((prev) => ({ ...prev, nome: e.target.value }))
                  }
                  placeholder="es. Landmine Lab, Personal 1:1, Mobility"
                  className="text-xs bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                  Descrizione
                </label>
                <Input
                  value={editingAttivita.descrizione || ""}
                  onChange={(e) =>
                    setEditingAttivita((prev) => ({ ...prev, descrizione: e.target.value }))
                  }
                  placeholder="es. Sessione condivisa con assistenza Coach"
                  className="text-xs bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                    Crediti Scalati
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={editingAttivita.costo_crediti ?? 1}
                    onChange={(e) =>
                      setEditingAttivita((prev) => ({
                        ...prev,
                        costo_crediti: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                    Max Persone
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={editingAttivita.max_partecipanti ?? 1}
                    onChange={(e) =>
                      setEditingAttivita((prev) => ({
                        ...prev,
                        max_partecipanti: parseInt(e.target.value, 10) || 1,
                      }))
                    }
                    className="text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                    Durata (Min)
                  </label>
                  <Input
                    type="number"
                    min={15}
                    step={15}
                    value={editingAttivita.durata_minuti ?? 60}
                    onChange={(e) =>
                      setEditingAttivita((prev) => ({
                        ...prev,
                        durata_minuti: parseInt(e.target.value, 10) || 60,
                      }))
                    }
                    className="text-xs bg-white"
                  />
                </div>
              </div>

              {/* SELEZIONE COLORE */}
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1.5">
                  Colore Badge
                </label>
                <div className="flex items-center gap-2">
                  {COLORI_PRESET.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() =>
                        setEditingAttivita((prev) => ({ ...prev, colore: c.hex }))
                      }
                      className={`size-6 rounded-full transition-transform cursor-pointer border ${
                        editingAttivita.colore === c.hex
                          ? "ring-2 ring-offset-1 ring-zinc-900 scale-110"
                          : "opacity-75 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* PULSANTI SALVATAGGIO */}
              <div className="flex gap-2 pt-2 border-t border-zinc-200">
                <Button
                  variant="outline"
                  onClick={() => setEditingAttivita(null)}
                  className="flex-1 rounded-xl"
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleSaveAttivita}
                  className="flex-1 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black"
                >
                  {isNewAttivita ? "Crea Attività" : "Aggiorna Attività"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER MODALE */}
        <DialogFooter className="shrink-0 pt-2 border-t border-zinc-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl text-xs"
          >
            Chiudi Gestione Palinsesto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
