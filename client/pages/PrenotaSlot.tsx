import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useCurrentUser, useLabConfig } from "../lib/useUser";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Lock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  CalendarCheck,
  XCircle,
} from "lucide-react";
import { Button } from "../components/Button";
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
  data: string; // YYYY-MM-DD
  orario: string; // HH:mm
  email_cliente: string;
  nome_cliente: string;
  telefono_cliente?: string;
  stato: "confermata" | "cancellata_in_tempo" | "cancellata_tardiva" | "completata";
  credito_scalato: boolean;
  created_at: string;
}

function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatGiornoItaliano(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function PrenotaSlotPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, crediti, hasDebt, isZeroCredits, isExpired } = useCurrentUser();
  const { config } = useLabConfig();

  // Data selezionata (default: domani o oggi)
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateISO(d);
  });

  // Settimana corrente offset
  const [weekOffset, setWeekOffset] = useState(0);

  // Modali
  const [slotDaPrenotare, setSlotDaPrenotare] = useState<string | null>(null);
  const [prenotazioneDaAnnullare, setPrenotazioneDaAnnullare] = useState<Prenotazione | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);

  // Calcolo giorni della settimana visibili (dal lunedì al sabato)
  const giorniSettimana = useMemo(() => {
    const days: { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    // Trova lunedì della settimana corrente + offset
    const dayOfWeek = base.getDay(); // 0 è domenica
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    base.setDate(base.getDate() + diffToMonday + weekOffset * 7);

    for (let i = 0; i < 6; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const str = formatDateISO(d);
      const isToday = str === formatDateISO(new Date());
      days.push({
        dateStr: str,
        dayName: d.toLocaleDateString("it-IT", { weekday: "short" }),
        dayNum: d.getDate(),
        isToday,
      });
    }
    return days;
  }, [weekOffset]);

  // Query prenotazioni
  const { data: prenotazioni = [], isLoading: loadingPrenotazioni } = useQuery<Prenotazione[]>({
    queryKey: ["prenotazioni"],
    queryFn: async () => {
      const res = await fetch("/app-api/prenotazioni");
      if (!res.ok) throw new Error("Errore caricamento prenotazioni");
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Mappa slot occupati per la data selezionata
  const prenotazioniGiorno = useMemo(() => {
    return prenotazioni.filter((p) => p.data === selectedDate && p.stato === "confermata");
  }, [prenotazioni, selectedDate]);

  // Le mie prenotazioni attive
  const miePrenotazioniAttive = useMemo(() => {
    if (!user) return [];
    return prenotazioni
      .filter((p) => p.email_cliente === user.email && p.stato === "confermata")
      .sort((a, b) => (a.data + a.orario).localeCompare(b.data + b.orario));
  }, [prenotazioni, user]);

  // Mutation Prenotazione
  const prenotaMutation = useMutation({
    mutationFn: async ({ data, orario }: { data: string; orario: string }) => {
      const res = await fetch("/app-api/prenotazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, orario }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Impossibile completare la prenotazione.");
      }
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      toast.success(data.messaggio || "Slot prenotato con successo!");
      setSlotDaPrenotare(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore nella prenotazione dello slot.");
    },
  });

  // Mutation Cancellazione
  const annullaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/app-api/prenotazioni/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Errore durante la cancellazione.");
      }
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      if (data.rimborsato) {
        toast.success(data.messaggio);
      } else {
        toast.warning(data.messaggio);
      }
      setPrenotazioneDaAnnullare(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore nella cancellazione dello slot.");
    },
  });

  const handleSlotClick = (orario: string) => {
    // Controllo se l'utente ha crediti sufficienti e validi
    if (isZeroCredits || hasDebt || isExpired) {
      setShowBlockModal(true);
      return;
    }
    setSlotDaPrenotare(orario);
  };

  const orariDisponibili = config?.orari_disponibili || [
    "07:30", "08:30", "09:30", "10:30", "11:30",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
  ];

  const policyOre = config?.tempo_cancellazione_ore || 24;

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER TITOLO PAGINA */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-zinc-900 flex items-center gap-2">
            <CalendarCheck className="size-5 text-[#1c00ff]" />
            Prenotazione Slot 1:1
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            1 persona per slot esclusivo al Landmine Lab.
          </p>
        </div>

        {/* CANCELLATION POLICY BADGE */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
            Policy Annullamento
          </span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
            Fino a {policyOre}h prima
          </span>
        </div>
      </div>

      {/* SEZIONE LE MIE PRENOTAZIONI ATTIVE */}
      {miePrenotazioniAttive.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-[#1c00ff]/5 border border-[#1c00ff]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#1c00ff] flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" /> Le Tue Prossime Sedute ({miePrenotazioniAttive.length})
            </span>
          </div>

          <div className="space-y-2">
            {miePrenotazioniAttive.map((bk) => (
              <div
                key={bk.id}
                className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-zinc-200 shadow-2xs text-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-[#1c00ff] text-white flex flex-col items-center justify-center font-black leading-none">
                    <span className="text-[9px] uppercase">
                      {new Date(bk.data).toLocaleDateString("it-IT", { weekday: "short" })}
                    </span>
                    <span className="text-xs font-bold">{new Date(bk.data).getDate()}</span>
                  </div>
                  <div>
                    <div className="font-bold text-zinc-900">
                      {formatGiornoItaliano(bk.data)} alle {bk.orario}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Slot 1:1 con Coach • Valido per diario
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrenotazioneDaAnnullare(bk)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-[11px] h-7 px-2"
                >
                  Annulla
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SELETTORE SETTIMANA & GIORNI */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-3 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black text-zinc-900 uppercase tracking-wide">
            Seleziona Giorno
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
              disabled={weekOffset === 0}
              className="h-7 w-7 p-0"
              aria-label="Settimana precedente"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs font-bold text-zinc-600 px-1">
              {weekOffset === 0 ? "Questa settimana" : `Settimana +${weekOffset}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="h-7 w-7 p-0"
              aria-label="Settimana successiva"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* BOTTONI GIORNI LUN-SAB */}
        <div className="grid grid-cols-6 gap-1.5">
          {giorniSettimana.map((g) => {
            const isSelected = g.dateStr === selectedDate;
            return (
              <button
                key={g.dateStr}
                type="button"
                onClick={() => setSelectedDate(g.dateStr)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#1c00ff] text-white shadow-sm ring-2 ring-[#1c00ff]/30 font-black"
                    : "bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-bold border border-zinc-200"
                }`}
              >
                <span className="text-[10px] uppercase">{g.dayName}</span>
                <span className="text-sm tabular-nums mt-0.5">{g.dayNum}</span>
                {g.isToday && (
                  <span
                    className={`size-1 rounded-full mt-1 ${
                      isSelected ? "bg-[#e3ff00]" : "bg-[#1c00ff]"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* GRIGLIA ORARI SLOT 1:1 */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-black uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
            <Clock className="size-3.5 text-[#1c00ff]" />
            Orari Disponibili • {formatGiornoItaliano(selectedDate)}
          </span>
          <span className="text-[11px] font-bold text-zinc-500">
            {orariDisponibili.length - prenotazioniGiorno.length} slot liberi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {orariDisponibili.map((orario) => {
            const booking = prenotazioniGiorno.find((p) => p.orario === orario);
            const isOccupato = !!booking;
            const isMio = booking?.email_cliente === user?.email;

            if (isMio) {
              return (
                <div
                  key={orario}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#1c00ff]/10 border-2 border-[#1c00ff] shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-black text-[#1c00ff] tabular-nums">
                      {orario}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#1c00ff] text-white">
                      Tuo Slot
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPrenotazioneDaAnnullare(booking)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-bold h-8 px-2.5"
                  >
                    Annulla
                  </Button>
                </div>
              );
            }

            if (isOccupato) {
              return (
                <div
                  key={orario}
                  className="flex items-center justify-between p-3 rounded-2xl bg-zinc-100/70 border border-zinc-200 text-zinc-400 select-none"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-zinc-300" />
                    <span className="text-sm font-bold tabular-nums line-through decoration-zinc-300">
                      {orario}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-200 text-zinc-500 flex items-center gap-1">
                    <Lock className="size-3" /> Occupato (1:1)
                  </span>
                </div>
              );
            }

            return (
              <button
                key={orario}
                type="button"
                onClick={() => handleSlotClick(orario)}
                className="flex items-center justify-between p-3 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-[#1c00ff] transition-all shadow-2xs group cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs group-hover:bg-[#1c00ff] group-hover:text-white transition-colors">
                    {orario}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-zinc-900">
                      Slot Disponibile
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      1 Posto esclusivo
                    </span>
                  </div>
                </div>

                <span className="text-xs font-black text-[#1c00ff] group-hover:translate-x-0.5 transition-transform">
                  Prenota &rarr;
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* REGOLAMENTO LAB BOX INFORMATIVO */}
      <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-600 text-xs space-y-1.5">
        <div className="font-bold text-zinc-900 flex items-center gap-1.5">
          <Info className="size-4 text-[#1c00ff]" />
          Regole di Prenotazione Area46
        </div>
        <p className="text-[11px] leading-relaxed">
          • <strong>1 Credito = 1 Seduta 1:1</strong> con programmazione e assistenza Coach.
          <br />• <strong>Cancellazione gratuita</strong> fino a <strong>{policyOre} ore</strong> prima dell&apos;inizio dello slot con riaccredito automatico.
          <br />• Oltre tale termine, il credito viene trattenuto per rispetto della pianificazione del Lab.
        </p>
      </div>

      {/* MODALE CONFERMA PRENOTAZIONE */}
      <Dialog open={!!slotDaPrenotare} onOpenChange={(open) => !open && setSlotDaPrenotare(null)}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <CalendarCheck className="size-5 text-[#1c00ff]" />
              Conferma Prenotazione
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Verifica i dettagli della seduta prima di confermare.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Data:</span>
              <strong className="text-zinc-900">{formatGiornoItaliano(selectedDate)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Orario:</span>
              <strong className="text-zinc-900">{slotDaPrenotare}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Crediti prima:</span>
              <span className="font-bold text-emerald-700">{crediti} crediti</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2">
              <span className="text-zinc-500">Crediti dopo:</span>
              <span className="font-bold text-zinc-900">{crediti - 1} crediti</span>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSlotDaPrenotare(null)}
              className="flex-1 rounded-xl"
            >
              Indietro
            </Button>
            <Button
              onClick={() => {
                if (slotDaPrenotare) {
                  prenotaMutation.mutate({ data: selectedDate, orario: slotDaPrenotare });
                }
              }}
              disabled={prenotaMutation.isPending}
              className="flex-1 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black"
            >
              {prenotaMutation.isPending ? "Conferma..." : "Conferma Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE CONFERMA ANNULLAMENTO */}
      <Dialog
        open={!!prenotazioneDaAnnullare}
        onOpenChange={(open) => !open && setPrenotazioneDaAnnullare(null)}
      >
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-red-600 flex items-center gap-2">
              <XCircle className="size-5 text-red-600" />
              Annulla Prenotazione
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Sei sicuro di voler cancellare questo slot?
            </DialogDescription>
          </DialogHeader>

          {prenotazioneDaAnnullare && (
            <div className="my-4 space-y-3">
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
                <div>
                  <strong>{formatGiornoItaliano(prenotazioneDaAnnullare.data)}</strong> alle{" "}
                  <strong>{prenotazioneDaAnnullare.orario}</strong>
                </div>
              </div>

              {/* CALCOLO PREAVVISO */}
              {(() => {
                const slotTs = new Date(
                  `${prenotazioneDaAnnullare.data}T${prenotazioneDaAnnullare.orario}:00`
                ).getTime();
                const oreDiff = (slotTs - Date.now()) / (1000 * 60 * 60);
                const isInTempo = oreDiff >= policyOre;

                return isInTempo ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                    <p className="font-bold">✅ Riaccredito Immediato</p>
                    <p className="text-[11px] mt-0.5">
                      Mancano {Math.round(oreDiff)}h allo slot (limite richiesto: {policyOre}h). Il tuo
                      credito ti verrà restituito al 100%.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
                    <p className="font-bold">⚠️ Cancellazione Tardiva</p>
                    <p className="text-[11px] mt-0.5">
                      Mancano solo {Math.max(0, Math.round(oreDiff))}h allo slot (meno delle {policyOre}h
                      previste dal regolamento). Il credito della seduta verrà trattenuto.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPrenotazioneDaAnnullare(null)}
              className="flex-1 rounded-xl"
            >
              Mantieni Slot
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (prenotazioneDaAnnullare) {
                  annullaMutation.mutate(prenotazioneDaAnnullare.id);
                }
              }}
              disabled={annullaMutation.isPending}
              className="flex-1 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
            >
              {annullaMutation.isPending ? "Annullamento..." : "Conferma Annulla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE DI BLOCCO CREDITI INSUFFICIENTI O SCADUTI */}
      <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl text-center">
          <div className="mx-auto size-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-3">
            <Lock className="size-6" />
          </div>

          <DialogTitle className="text-lg font-black text-zinc-900">
            {hasDebt
              ? "Saldo a Debito"
              : isExpired
              ? "Carnet Scaduto"
              : "Crediti Esauriti"}
          </DialogTitle>

          <DialogDescription className="text-xs text-zinc-600 mt-2 leading-relaxed">
            {hasDebt ? (
              <>
                Il tuo wallet presenta un saldo negativo di{" "}
                <strong>{crediti} crediti</strong>. Ricarica un nuovo carnet per sanare il debito e
                sbloccare le prenotazioni al Lab.
              </>
            ) : isExpired ? (
              <>
                I tuoi crediti sono scaduti il{" "}
                <strong>{user?.data_scadenza_crediti}</strong>. Rinnova il pacchetto per continuare ad
                allenarti 1:1 con il Coach.
              </>
            ) : (
              <>
                Hai <strong>0 crediti disponibili</strong>. Per prenotare uno slot esclusivo 1:1 è
                necessario acquistare una seduta singola o un carnet.
              </>
            )}
          </DialogDescription>

          <div className="mt-6 flex flex-col gap-2">
            <Button
              onClick={() => {
                setShowBlockModal(false);
                navigate("/tariffario");
              }}
              className="w-full rounded-xl bg-[#e3ff00] text-zinc-950 hover:bg-[#d9f200] font-black border border-zinc-900 h-11"
            >
              <Sparkles className="size-4 text-[#1c00ff] mr-1.5" />
              Scegli Pacchetto & Ricarica
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowBlockModal(false)}
              className="text-xs text-zinc-500"
            >
              Continua a consultare il diario
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
