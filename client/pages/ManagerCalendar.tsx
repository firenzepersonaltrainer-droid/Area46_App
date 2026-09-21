import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useProfili, useLabConfig, useEccezioniCalendario } from "../lib/useUser";
import { CalendarioMeseNavigabile } from "../components/CalendarioMeseNavigabile";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Plus,
  Phone,
  Trash2,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Ban,
  Sun,
  Sparkles,
} from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/Dialog";
import { toast } from "sonner";

interface Prenotazione {
  id: string;
  data: string;
  orario: string;
  email_cliente: string;
  nome_cliente: string;
  telefono_cliente?: string;
  stato: "confermata" | "cancellata_in_tempo" | "cancellata_tardiva" | "completata";
  credito_scalato: boolean;
  note?: string;
  created_at: string;
}

function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatGiornoItaliano(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function ManagerCalendarPage() {
  const queryClient = useQueryClient();
  const { profili } = useProfili();
  const { config } = useLabConfig();

  // Data visualizzata
  const [selectedDate, setSelectedDate] = useState(() => formatDateISO(new Date()));

  // Eccezioni calendario per la data (aperture straordinarie / blocchi / ferie)
  const { eccezioni, aggiungiEccezione, rimuoviEccezione } = useEccezioniCalendario();

  // Modali
  const [selectedBooking, setSelectedBooking] = useState<Prenotazione | null>(null);
  const [manualSlot, setManualSlot] = useState<string | null>(null);
  const [selectedAtletaId, setSelectedAtletaId] = useState("");
  const [manualNote, setManualNote] = useState("");

  // Modale Aggiungi Slot Straordinario
  const [extraSlotModal, setExtraSlotModal] = useState(false);
  const [extraOrario, setExtraOrario] = useState("12:30");
  const [extraMotivo, setExtraMotivo] = useState("Apertura straordinaria");

  // Modale Blocca Slot / Chiusura Ferie
  const [blockModal, setBlockModal] = useState(false);
  const [blockTipo, setBlockTipo] = useState<"chiusura_giornata" | "slot_bloccato">("slot_bloccato");
  const [blockOrariSelezionati, setBlockOrariSelezionati] = useState<string[]>([]);
  const [blockMotivo, setBlockMotivo] = useState("Chiusura per ferie / imprevisto");

  // Query Prenotazioni
  const { data: prenotazioni = [] } = useQuery<Prenotazione[]>({
    queryKey: ["prenotazioni"],
    queryFn: async () => {
      const res = await fetch("/app-api/prenotazioni");
      if (!res.ok) throw new Error("Errore recupero prenotazioni");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const orariBase = config?.orari_disponibili || [
    "07:30", "08:30", "09:30", "10:30", "11:30",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
  ];

  // Eccezioni relative al giorno selezionato
  const eccezioniGiorno = useMemo(() => {
    return eccezioni.filter((e) => e.data === selectedDate);
  }, [eccezioni, selectedDate]);

  const isGiornoChiuso = useMemo(() => {
    return eccezioniGiorno.some((e) => e.tipo === "chiusura_giornata");
  }, [eccezioniGiorno]);

  // Lista unificata orari del giorno
  const orariGiorno = useMemo(() => {
    const setOrari = new Set(orariBase);
    eccezioniGiorno.forEach((e) => {
      if (e.tipo === "slot_straordinario" && e.orario) {
        setOrari.add(e.orario);
      }
    });
    return Array.from(setOrari).sort();
  }, [orariBase, eccezioniGiorno]);

  // Prenotazioni attive del giorno
  const prenotazioniGiorno = useMemo(() => {
    return prenotazioni.filter((p) => p.data === selectedDate && p.stato === "confermata");
  }, [prenotazioni, selectedDate]);

  // Mutation Nuova Prenotazione Manuale Coach
  const prenotaManualeMutation = useMutation({
    mutationFn: async ({ data, orario, atleta_id, note }: any) => {
      const res = await fetch("/app-api/prenotazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, orario, atleta_id, note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore prenotazione manuale");
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      toast.success(data.messaggio || "Slot assegnato!");
      setManualSlot(null);
      setSelectedAtletaId("");
      setManualNote("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante l'assegnazione dello slot");
    },
  });

  // Mutation Cancellazione Coach
  const cancellaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/app-api/prenotazioni/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore cancellazione");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      toast.success("Prenotazione annullata dal Coach. Credito ripristinato.");
      setSelectedBooking(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore cancellazione");
    },
  });

  const handleStepDay = (step: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + step);
    setSelectedDate(formatDateISO(d));
  };

  const handleToday = () => {
    setSelectedDate(formatDateISO(new Date()));
  };

  const handleSaveExtraSlot = async () => {
    if (!extraOrario) return;
    await aggiungiEccezione({
      data: selectedDate,
      orario: extraOrario,
      tipo: "slot_straordinario",
      motivo: extraMotivo,
    });
    setExtraSlotModal(false);
  };

  const handleSaveBlock = async () => {
    try {
      if (blockTipo === "chiusura_giornata") {
        await aggiungiEccezione({
          data: selectedDate,
          tipo: "chiusura_giornata",
          motivo: blockMotivo || "Chiusura intera giornata",
        });
      } else {
        if (blockOrariSelezionati.length === 0) {
          toast.error("Seleziona almeno uno slot da bloccare");
          return;
        }
        await aggiungiEccezione({
          data: selectedDate,
          orari: blockOrariSelezionati,
          tipo: "slot_bloccato",
          motivo: blockMotivo || "Slot bloccati dal Coach",
        });
      }
      setBlockModal(false);
      setBlockOrariSelezionati([]);
    } catch {
      // toast gestito da hook
    }
  };

  const atleti = profili.filter((p) => p.ruolo === "atleta");

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER AMMINISTRAZIONE */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#09090b] text-[#e3ff00] border border-[#e3ff00]/40">
              Pannello Manager
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-zinc-900 mt-1 flex items-center gap-2">
            <CalendarIcon className="size-5 text-[#1c00ff]" />
            Calendario Lab
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/manager/atleti"
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors"
          >
            Atleti
          </Link>
          <Link
            to="/manager/fisco"
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors"
          >
            Fisco & Lab
          </Link>
        </div>
      </div>

      {/* CALENDARIO MENSILE & SETTIMANALE NAVIGABILE COACH */}
      <CalendarioMeseNavigabile
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        prenotazioni={prenotazioni}
        eccezioni={eccezioni}
        isManager={true}
      />

      {/* PULSANTI CONTROLLO FLESSIBILE COACH (+ SLOT / BLOCCO / FERIE) */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => setExtraSlotModal(true)}
          className="flex-1 bg-[#1c00ff] text-white hover:bg-[#1600cc] text-xs font-bold rounded-xl h-9"
        >
          <Plus className="size-3.5 mr-1" /> Slot Straordinario
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setBlockModal(true)}
          className="flex-1 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold rounded-xl h-9"
        >
          <Ban className="size-3.5 mr-1 text-amber-700" /> Blocca Slot / Ferie
        </Button>
      </div>

      {/* LISTA ECCEZIONI ATTIVE PER QUESTA DATA (SE PRESENTI) */}
      {eccezioniGiorno.length > 0 && (
        <div className="p-3 rounded-2xl bg-zinc-100 border border-zinc-200 space-y-1.5 text-xs">
          <div className="font-bold text-zinc-700 text-[11px] uppercase tracking-wider">
            Variazioni Orario per questa data:
          </div>
          {eccezioniGiorno.map((exc) => (
            <div
              key={exc.id}
              className="flex items-center justify-between p-2 rounded-xl bg-white border border-zinc-200"
            >
              <div className="flex items-center gap-2">
                {exc.tipo === "slot_straordinario" ? (
                  <Sparkles className="size-3.5 text-[#1c00ff]" />
                ) : (
                  <Ban className="size-3.5 text-red-600" />
                )}
                <div>
                  <strong>
                    {exc.tipo === "chiusura_giornata"
                      ? "Intera Giornata Chiusa"
                      : `${exc.orario} (${exc.tipo === "slot_straordinario" ? "Straordinario" : "Bloccato"})`}
                  </strong>
                  {exc.motivo && <span className="text-zinc-500 ml-1.5">• {exc.motivo}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => rimuoviEccezione(exc.id)}
                className="text-red-600 hover:text-red-800 text-[11px] font-bold cursor-pointer"
              >
                Rimuovi
              </button>
            </div>
          ))}
        </div>
      )}

      {/* GRIGLIA ORARIA (SLOT LIBERI, OCCUPATI, BLOCCATI) */}
      <div className="space-y-2">
        {isGiornoChiuso ? (
          <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-2">
            <Ban className="size-8 text-amber-600 mx-auto" />
            <div className="font-black text-sm">Giornata Chiusa dal Coach</div>
            <p className="text-xs text-amber-800">
              Nessun atleta può prenotare in questa data. Puoi rimuovere la chiusura dall&apos;elenco variazioni in alto.
            </p>
          </div>
        ) : (
          orariGiorno.map((orario) => {
            const booking = prenotazioniGiorno.find((p) => p.orario === orario);
            const isOccupato = !!booking;
            const isBloccato = eccezioniGiorno.some(
              (e) => e.tipo === "slot_bloccato" && e.orario === orario
            );
            const isStraordinario = eccezioniGiorno.some(
              (e) => e.tipo === "slot_straordinario" && e.orario === orario
            );

            if (isBloccato) {
              return (
                <div
                  key={orario}
                  className="p-3 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-400 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Ban className="size-4 text-zinc-400" />
                    <span className="text-xs font-bold">{orario}</span>
                    <span className="text-[10px] font-bold text-zinc-500">
                      Slot Bloccato dal Coach (Non prenotabile)
                    </span>
                  </div>
                </div>
              );
            }

            if (isOccupato) {
              return (
                <div
                  key={orario}
                  onClick={() => setSelectedBooking(booking)}
                  className="p-3.5 rounded-2xl bg-white border-2 border-[#1c00ff] shadow-xs flex items-center justify-between cursor-pointer hover:bg-blue-50/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-[#1c00ff] text-white flex flex-col items-center justify-center font-black leading-tight shadow-xs">
                      <Clock className="size-3.5" />
                      <span className="text-xs">{orario}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-zinc-900">
                          {booking.nome_cliente}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Prenotazione Confermata
                        </span>
                      </div>

                      <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                        <span>{booking.email_cliente}</span>
                        {booking.telefono_cliente && <span>• Tel: {booking.telefono_cliente}</span>}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-[#1c00ff] hover:underline">
                    Dettagli &rarr;
                  </span>
                </div>
              );
            }

            return (
              <div
                key={orario}
                onClick={() => {
                  setManualSlot(orario);
                  if (atleti.length > 0) setSelectedAtletaId(atleti[0].id);
                }}
                className={`p-3 rounded-2xl border border-dashed flex items-center justify-between transition-colors cursor-pointer group ${
                  isStraordinario
                    ? "bg-purple-50/50 border-purple-300 hover:border-purple-600"
                    : "bg-zinc-50 hover:bg-white border-zinc-300 hover:border-[#1c00ff]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs group-hover:bg-[#1c00ff] group-hover:text-white transition-colors">
                    {orario}
                  </div>
                  <div className="text-xs text-zinc-600 font-semibold flex items-center gap-1.5">
                    <span>Slot Libero (1 posto)</span>
                    {isStraordinario && (
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-black">
                        Straordinario
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-xs font-bold text-zinc-400 group-hover:text-[#1c00ff] flex items-center gap-1">
                  <Plus className="size-3.5" /> Assegna ad Atleta
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* MODALE SLOT STRAORDINARIO */}
      <Dialog open={extraSlotModal} onOpenChange={setExtraSlotModal}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Plus className="size-5 text-[#1c00ff]" />
              Aggiungi Slot Straordinario
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Aggiungi un orario non previsto nella routine per il {formatGiornoItaliano(selectedDate)}.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-3 text-xs">
            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Orario Slot (es. 12:15 o 16:30)
              </label>
              <Input
                value={extraOrario}
                onChange={(e) => setExtraOrario(e.target.value)}
                placeholder="HH:mm"
                className="font-mono text-base font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Motivazione / Nota
              </label>
              <Input
                value={extraMotivo}
                onChange={(e) => setExtraMotivo(e.target.value)}
                placeholder="es. Pausa pranzo, apertura extra"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setExtraSlotModal(false)} className="flex-1 rounded-xl">
              Annulla
            </Button>
            <Button
              onClick={handleSaveExtraSlot}
              className="flex-1 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black"
            >
              Crea Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE BLOCCA / FERIE (SELEZIONE MULTIPLA SLOT) */}
      <Dialog open={blockModal} onOpenChange={setBlockModal}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Ban className="size-5 text-amber-600" />
              Blocco Slot o Chiusura Lab
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Spunta uno o più orari contemporaneamente per il giorno selezionato oppure imposta chiusura totale.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-3.5 text-xs">
            {/* SELETTORE DATA DIRETTO DENTRO IL MODALE */}
            <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-2xl p-2 px-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleStepDay(-1);
                  setBlockOrariSelezionati([]);
                }}
                className="h-7 w-7 p-0 rounded-lg hover:bg-zinc-200 text-zinc-700"
                title="Giorno precedente"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="text-center">
                <div className="text-xs font-black text-zinc-900 capitalize">
                  {formatGiornoItaliano(selectedDate)}
                </div>
                <div className="text-[10px] text-zinc-500 font-medium">
                  {selectedDate}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleStepDay(1);
                  setBlockOrariSelezionati([]);
                }}
                className="h-7 w-7 p-0 rounded-lg hover:bg-zinc-200 text-zinc-700"
                title="Giorno successivo"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBlockTipo("chiusura_giornata")}
                className={`p-2.5 rounded-2xl border-2 text-left transition-all ${
                  blockTipo === "chiusura_giornata"
                    ? "border-[#1c00ff] bg-[#1c00ff]/5 font-black text-[#1c00ff] shadow-xs"
                    : "border-zinc-200 font-bold text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sun className="size-3.5 text-amber-600" />
                  <span>Intera Giornata</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-normal">
                  Ferie o chiusura completa
                </div>
              </button>
              <button
                type="button"
                onClick={() => setBlockTipo("slot_bloccato")}
                className={`p-2.5 rounded-2xl border-2 text-left transition-all ${
                  blockTipo === "slot_bloccato"
                    ? "border-[#1c00ff] bg-[#1c00ff]/5 font-black text-[#1c00ff] shadow-xs"
                    : "border-zinc-200 font-bold text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Clock className="size-3.5 text-[#1c00ff]" />
                  <span>Slot Multipli</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-normal">
                  Spunta gli orari a scelta
                </div>
              </button>
            </div>

            {blockTipo === "slot_bloccato" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-zinc-500">
                    Spunta gli orari da bloccare:
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const liberi = orariGiorno.filter(
                          (o) =>
                            !prenotazioniGiorno.some((p) => p.orario === o) &&
                            !eccezioniGiorno.some(
                              (e) => e.orario === o && e.tipo === "slot_bloccato"
                            )
                        );
                        setBlockOrariSelezionati(liberi);
                      }}
                      className="text-[#1c00ff] font-black hover:underline"
                    >
                      Tutti liberi
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      type="button"
                      onClick={() => setBlockOrariSelezionati([])}
                      className="text-zinc-500 font-bold hover:underline"
                    >
                      Deseleziona
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto p-1.5 bg-zinc-50 rounded-2xl border border-zinc-200 [scrollbar-width:thin]">
                  {orariGiorno.map((o) => {
                    const booking = prenotazioniGiorno.find((p) => p.orario === o);
                    const isGiaBloccato = eccezioniGiorno.some(
                      (e) => e.orario === o && e.tipo === "slot_bloccato"
                    );
                    const isChecked = blockOrariSelezionati.includes(o);

                    return (
                      <label
                        key={o}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                          isGiaBloccato
                            ? "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed opacity-75"
                            : isChecked
                            ? "bg-amber-50 border-amber-400 font-black text-amber-900 shadow-2xs cursor-pointer ring-1 ring-amber-400"
                            : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isGiaBloccato}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBlockOrariSelezionati((prev) => [...prev, o]);
                              } else {
                                setBlockOrariSelezionati((prev) => prev.filter((h) => h !== o));
                              }
                            }}
                            className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 size-3.5 cursor-pointer"
                          />
                          <span className="tabular-nums font-black">{o}</span>
                        </div>
                        {isGiaBloccato ? (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-600">
                            Bloccato
                          </span>
                        ) : booking ? (
                          <span
                            className="text-[9px] font-bold text-zinc-500 truncate max-w-[65px]"
                            title={booking.nome_cliente}
                          >
                            {booking.nome_cliente.split(" ")[0]}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>

                <div className="text-[10px] text-zinc-500 font-bold text-right">
                  <strong>{blockOrariSelezionati.length}</strong> slot selezionati per il blocco
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Motivazione del blocco (visibile ad atleti e manager)
              </label>
              <Input
                value={blockMotivo}
                onChange={(e) => setBlockMotivo(e.target.value)}
                placeholder="es. Ferie Coach, manutenzione, festivo"
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setBlockModal(false);
                setBlockOrariSelezionati([]);
              }}
              className="flex-1 rounded-xl"
            >
              Annulla
            </Button>
            <Button
              onClick={handleSaveBlock}
              className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black"
            >
              {blockTipo === "chiusura_giornata"
                ? "Chiudi Intera Giornata"
                : `Blocca i ${blockOrariSelezionati.length} Slot`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE ASSEGNAZIONE MANUALE A UN ATLETA */}
      <Dialog open={!!manualSlot} onOpenChange={(open) => !open && setManualSlot(null)}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Plus className="size-5 text-[#1c00ff]" />
              Assegna Slot ad Atleta
            </DialogTitle>
          </DialogHeader>

          <div className="my-3 space-y-3 text-xs">
            <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
              Slot: <strong>{formatGiornoItaliano(selectedDate)}</strong> alle{" "}
              <strong>{manualSlot}</strong>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-1">
                Seleziona Atleta
              </label>
              <select
                value={selectedAtletaId}
                onChange={(e) => setSelectedAtletaId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-300 bg-white font-bold text-xs"
              >
                {atleti.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} {a.cognome} (Crediti: {a.crediti} • Policy: {a.tempo_cancellazione_ore || 24}h)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setManualSlot(null)} className="flex-1 rounded-xl">
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (manualSlot && selectedAtletaId) {
                  prenotaManualeMutation.mutate({
                    data: selectedDate,
                    orario: manualSlot,
                    atleta_id: selectedAtletaId,
                    note: manualNote,
                  });
                }
              }}
              disabled={prenotaManualeMutation.isPending || !selectedAtletaId}
              className="flex-1 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black"
            >
              {prenotaManualeMutation.isPending ? "Salvataggio..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE DETTAGLIO PRENOTAZIONE */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <User className="size-5 text-[#1c00ff]" />
              Dettaglio Seduta
            </DialogTitle>
          </DialogHeader>

          {selectedBooking && (
            <div className="my-3 space-y-2 text-xs">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Atleta:</span>
                  <strong className="text-zinc-900">{selectedBooking.nome_cliente}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Email:</span>
                  <span>{selectedBooking.email_cliente}</span>
                </div>
                {selectedBooking.telefono_cliente && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Telefono:</span>
                    <a
                      href={`tel:${selectedBooking.telefono_cliente}`}
                      className="font-bold text-[#1c00ff] underline flex items-center gap-1"
                    >
                      <Phone className="size-3" /> {selectedBooking.telefono_cliente}
                    </a>
                  </div>
                )}
                <div className="flex justify-between border-t border-zinc-200 pt-1.5">
                  <span className="text-zinc-500">Orario:</span>
                  <strong className="text-zinc-900">
                    {formatGiornoItaliano(selectedBooking.data)} alle {selectedBooking.orario}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedBooking(null)} className="flex-1 rounded-xl">
              Chiudi
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedBooking) {
                  cancellaMutation.mutate(selectedBooking.id);
                }
              }}
              disabled={cancellaMutation.isPending}
              className="flex-1 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
            >
              {cancellaMutation.isPending ? "Annullamento..." : "Annulla Seduta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
