import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useProfili, useLabConfig } from "../lib/useUser";
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
  Filter,
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

  // Data correntemente visualizzata (default oggi)
  const [selectedDate, setSelectedDate] = useState(() => formatDateISO(new Date()));

  // Modale Dettaglio / Cancellazione Prenotazione Esistente
  const [selectedBooking, setSelectedBooking] = useState<Prenotazione | null>(null);

  // Modale Nuova Prenotazione Manuale del Coach
  const [manualSlot, setManualSlot] = useState<string | null>(null);
  const [selectedAtletaId, setSelectedAtletaId] = useState("");
  const [manualNote, setManualNote] = useState("");

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

  const orariDisponibili = config?.orari_disponibili || [
    "07:30", "08:30", "09:30", "10:30", "11:30",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
  ];

  // Prenotazioni per la data selezionata
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
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success(data.messaggio || "Prenotazione registrata!");
      setManualSlot(null);
      setSelectedAtletaId("");
      setManualNote("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante l'inserimento dello slot");
    },
  });

  // Mutation Cancellazione Coach
  const cancellaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/app-api/prenotazioni/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore cancellazione");
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Prenotazione annullata dal Coach. Credito ripristinato.");
      setSelectedBooking(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore nella cancellazione");
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
            Calendario Lab 1:1
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/manager/atleti"
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors"
          >
            Gestione Atleti
          </Link>
          <Link
            to="/manager/fisco"
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors"
          >
            Fisco & Policy
          </Link>
        </div>
      </div>

      {/* BARRA NAVIGATORE DATA (GOOGLE CALENDAR STYLE) */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-3 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStepDay(-1)}
            className="h-8 w-8 p-0"
            aria-label="Giorno precedente"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs font-black h-8 px-2.5"
          >
            Oggi
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStepDay(1)}
            className="h-8 w-8 p-0"
            aria-label="Giorno successivo"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="text-right">
          <div className="text-sm font-black text-zinc-900 capitalize leading-tight">
            {formatGiornoItaliano(selectedDate)}
          </div>
          <div className="text-[10px] font-bold text-zinc-500">
            {prenotazioniGiorno.length} sedute pianificate
          </div>
        </div>
      </div>

      {/* GRIGLIA ORARIA (SLOT LIBERI VS OCCUPATI) */}
      <div className="space-y-2">
        {orariDisponibili.map((orario) => {
          const booking = prenotazioniGiorno.find((p) => p.orario === orario);
          const isOccupato = !!booking;

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
                        1:1 Confermato
                      </span>
                    </div>

                    <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                      <span>{booking.email_cliente}</span>
                      {booking.telefono_cliente && (
                        <span>• Tel: {booking.telefono_cliente}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-[#1c00ff] hover:underline">
                    Dettagli &rarr;
                  </span>
                </div>
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
              className="p-3 rounded-2xl bg-zinc-50 hover:bg-white border border-dashed border-zinc-300 hover:border-[#1c00ff] flex items-center justify-between transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-zinc-200 text-zinc-600 flex items-center justify-center font-bold text-xs group-hover:bg-[#1c00ff] group-hover:text-white transition-colors">
                  {orario}
                </div>
                <div className="text-xs text-zinc-500 group-hover:text-zinc-900 font-semibold">
                  Slot Libero (1 posto disponibile)
                </div>
              </div>

              <span className="text-xs font-bold text-zinc-400 group-hover:text-[#1c00ff] flex items-center gap-1">
                <Plus className="size-3.5" /> Inserisci Atleta
              </span>
            </div>
          );
        })}
      </div>

      {/* MODALE DETTAGLIO PRENOTAZIONE MANAGER */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <User className="size-5 text-[#1c00ff]" />
              Dettaglio Seduta 1:1
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Gestione della prenotazione da pannello coach.
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="my-3 space-y-2.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Atleta:</span>
                  <strong className="text-zinc-900 text-sm">{selectedBooking.nome_cliente}</strong>
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
                  <span className="text-zinc-500">Data & Ora:</span>
                  <strong className="text-zinc-900">
                    {formatGiornoItaliano(selectedBooking.data)} alle {selectedBooking.orario}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedBooking(null)}
              className="flex-1 rounded-xl"
            >
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

      {/* MODALE INSERIMENTO MANUALE COACH */}
      <Dialog open={!!manualSlot} onOpenChange={(open) => !open && setManualSlot(null)}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Plus className="size-5 text-[#1c00ff]" />
              Assegna Slot Manuale
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Prenota direttamente uno slot per un atleta del Lab.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-3 text-xs">
            <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
              Slot: <strong>{formatGiornoItaliano(selectedDate)}</strong> alle{" "}
              <strong>{manualSlot}</strong>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block mb-1">
                Seleziona Atleta
              </label>
              <select
                value={selectedAtletaId}
                onChange={(e) => setSelectedAtletaId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-300 bg-white font-bold text-xs"
              >
                {atleti.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} {a.cognome} (Crediti: {a.crediti})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setManualSlot(null)}
              className="flex-1 rounded-xl"
            >
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
              {prenotaManualeMutation.isPending ? "Salvataggio..." : "Conferma Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
