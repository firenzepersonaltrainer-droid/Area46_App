import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  useProfili,
  useLabConfig,
  useEccezioniCalendario,
  useAttivita,
  useRegolePalinsesto,
  saveDeletedBookingId,
  isBookingDeleted,
} from "../lib/useUser";
import { calcolaSlotPerGiorno } from "../lib/palinsesto";
import { CalendarioMeseNavigabile } from "../components/CalendarioMeseNavigabile";
import { ManagerPalinsestoModal } from "../components/ManagerPalinsestoModal";
import {
  Calendar as CalendarIcon,
  CalendarRange,
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
  Mail,
  MessageCircle,
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

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  // Modale Notifica Atleta (Email + WhatsApp)
  const [notifyModalData, setNotifyModalData] = useState<{
    tipo: "inserimento" | "cancellazione";
    nome: string;
    email: string;
    telefono?: string;
    data: string;
    orario: string;
  } | null>(null);

  // Modale Blocca Slot / Chiusura Ferie
  const [blockModal, setBlockModal] = useState(false);
  const [blockTipo, setBlockTipo] = useState<"chiusura_giornata" | "slot_bloccato" | "chiusura_periodo">("slot_bloccato");
  const [blockOrariSelezionati, setBlockOrariSelezionati] = useState<string[]>([]);
  const [blockMotivo, setBlockMotivo] = useState("Chiusura per ferie / imprevisto");
  const [periodoFine, setPeriodoFine] = useState(selectedDate);
  const [prorogaScadenze, setProrogaScadenze] = useState(true);

  // Modale Eliminazione con Scelta Proroga
  const [prorogaScadenzaChoice, setProrogaScadenzaChoice] = useState(false);

  // Modale Palinsesto & Attività
  const [palinsestoModalOpen, setPalinsestoModalOpen] = useState(false);

  // Dati Attività e Palinsesto Ricorrente
  const { attivita } = useAttivita();
  const { regole } = useRegolePalinsesto();

  // Query Prenotazioni
  const { data: prenotazioni = [] } = useQuery<Prenotazione[]>({
    queryKey: ["prenotazioni"],
    queryFn: async () => {
      const res = await fetch("/app-api/prenotazioni");
      if (!res.ok) throw new Error("Errore recupero prenotazioni");
      const list: Prenotazione[] = await res.json();
      return list.filter(
        (p) =>
          !isBookingDeleted(p.id) &&
          (p.stato === "confermata" || !p.stato || p.stato === "attiva") &&
          !p.stato?.startsWith("cancellata")
      );
    },
    refetchInterval: 10000,
  });

  // Eccezioni relative al giorno selezionato
  const eccezioniGiorno = useMemo(() => {
    return eccezioni.filter((e) => e.data === selectedDate);
  }, [eccezioni, selectedDate]);

  // Calcolo dinamico degli slot a scaglioni di 15 min basati su palinsesto attivo
  const {
    slots: slotDinamici,
    isChiuso: isGiornoChiuso,
    motivoChiusura,
    hasPalinsesto,
  } = useMemo(() => {
    return calcolaSlotPerGiorno(selectedDate, regole, eccezioni, attivita);
  }, [selectedDate, regole, eccezioni, attivita]);

  // Lista orari del giorno generati dinamicamente
  const orariGiorno = useMemo(() => {
    return slotDinamici.map((s) => s.orario);
  }, [slotDinamici]);

  // Prenotazioni attive del giorno
  const prenotazioniGiorno = useMemo(() => {
    return prenotazioni.filter(
      (p) =>
        !isBookingDeleted(p.id) &&
        p.data === selectedDate &&
        (p.stato === "confermata" || !p.stato || p.stato === "attiva") &&
        !p.stato?.startsWith("cancellata")
    );
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

      const atletaObj = profili.find((a) => a.id === selectedAtletaId);
      setNotifyModalData({
        tipo: "inserimento",
        nome: atletaObj ? `${atletaObj.nome} ${atletaObj.cognome}`.trim() : (data.notifica?.nome_destinatario || "Atleta"),
        email: atletaObj?.email || data.notifica?.email_destinatario || "",
        telefono: atletaObj?.telefono || data.notifica?.telefono_destinatario || "",
        data: selectedDate,
        orario: manualSlot || "",
      });

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
    mutationFn: async ({ id, proroga }: { id: string; proroga: boolean }) => {
      saveDeletedBookingId(id);
      queryClient.setQueryData<Prenotazione[]>(["prenotazioni"], (old) =>
        (old || []).filter((p) => p.id !== id)
      );
      const res = await fetch(`/app-api/prenotazioni/${id}?proroga=${proroga}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proroga }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore cancellazione");
      return json;
    },
    onSuccess: (data, variables) => {
      saveDeletedBookingId(variables.id);
      queryClient.setQueryData<Prenotazione[]>(["prenotazioni"], (old) =>
        (old || []).filter((p) => p.id !== variables.id)
      );
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      toast.success(data.messaggio || "Prenotazione annullata dal Coach. Credito ripristinato.");

      if (selectedBooking) {
        setNotifyModalData({
          tipo: "cancellazione",
          nome: selectedBooking.nome_cliente,
          email: selectedBooking.email_cliente,
          telefono: selectedBooking.telefono_cliente || data.notifica?.telefono_destinatario || "",
          data: selectedBooking.data,
          orario: selectedBooking.orario,
        });
      }
      setSelectedBooking(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore cancellazione");
    },
  });

  const handleStepDay = (step: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d + step);
    setSelectedDate(formatDateISO(date));
  };

  const handleToday = () => {
    setSelectedDate(formatDateISO(new Date()));
  };

  const handleSaveBlock = async () => {
    try {
      if (blockTipo === "chiusura_periodo") {
        if (!periodoFine || periodoFine < selectedDate) {
          toast.error("La data di fine periodo deve essere uguale o successiva alla data di inizio");
          return;
        }
        const res = await fetch("/app-api/eccezioni-calendario/chiusura-periodo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data_inizio: selectedDate,
            data_fine: periodoFine,
            motivo: blockMotivo || "Chiusura studio / Ferie",
            proroga_scadenze: prorogaScadenze,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore chiusura periodo");
        queryClient.invalidateQueries({ queryKey: ["eccezioni-calendario"] });
        queryClient.invalidateQueries({ queryKey: ["profili"] });
        queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
        queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
        toast.success(data.messaggio || "Periodo di chiusura registrato!");
      } else if (blockTipo === "chiusura_giornata") {
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
        regole={regole}
        isManager={true}
      />

      {/* PULSANTI CONTROLLO COACH (PALINSESTO / BLOCCO / FERIE) */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        <Button
          size="sm"
          onClick={() => setPalinsestoModalOpen(true)}
          className="flex-1 bg-zinc-900 text-[#e3ff00] hover:bg-zinc-800 text-xs font-black rounded-xl h-9 border border-zinc-800 shadow-xs flex items-center justify-center gap-1.5"
        >
          <CalendarRange className="size-3.5 text-[#e3ff00]" /> Palinsesto & Attività
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setBlockModal(true)}
          className="flex-1 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold rounded-xl h-9 flex items-center justify-center"
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

              <Button
                variant="ghost"
                size="sm"
                onClick={() => rimuoviEccezione(exc.id)}
                className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 rounded-lg"
                title="Rimuovi variazione"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* DETTAGLIO DELLA GIORNATA SELEZIONATA */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-zinc-700">
            Slot Programmati • {formatGiornoItaliano(selectedDate)}
          </span>
          <span className="text-xs font-bold text-zinc-500">
            {orariGiorno.length > 0
              ? `${prenotazioniGiorno.length} / ${orariGiorno.length} occupati`
              : "0 slot programmati"}
          </span>
        </div>

        {isGiornoChiuso ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
            <div className="font-black text-sm">Giornata Chiusa dal Coach</div>
            <p className="text-xs text-amber-800">
              Nessun atleta può prenotare in questa data. Puoi rimuovere la chiusura dall&apos;elenco variazioni in alto.
            </p>
          </div>
        ) : orariGiorno.length === 0 ? (
          <div className="p-6 rounded-3xl bg-white border border-dashed border-zinc-300 text-center space-y-2">
            <CalendarIcon className="size-6 text-zinc-400 mx-auto" />
            <div className="text-xs font-black text-zinc-800">
              Nessun palinsesto ordinario per {formatGiornoItaliano(selectedDate)}
            </div>
            <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
              Questa data non prevede sessioni di palinsesto ordinario (es. martedì/giovedì/weekend).
              Puoi comunque aprire uno slot straordinario con il pulsante in alto.
            </p>
          </div>
        ) : (
          orariGiorno.map((orario) => {
            const slotInfo = slotDinamici.find((s) => s.orario === orario);
            const booking = prenotazioniGiorno.find((p) => p.orario === orario);
            const isOccupato = !!booking;
            const isBloccato = eccezioniGiorno.some(
              (e) => e.tipo === "slot_bloccato" && e.orario === orario
            );
            const isStraordinario = slotInfo?.is_straordinario;

            if (isBloccato) {
              return (
                <div
                  key={orario}
                  className="p-3 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-400 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Ban className="size-4 text-zinc-400" />
                    <span className="text-xs sm:text-sm font-bold">{orario}</span>
                    <span className="text-xs font-semibold text-zinc-500">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-black text-zinc-900">
                          {booking.nome_cliente}
                        </span>
                        <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Prenotazione Confermata
                        </span>
                      </div>

                      <div className="text-xs sm:text-sm text-zinc-500 flex items-center gap-2 mt-0.5">
                        <span>{booking.email_cliente}</span>
                        {booking.telefono_cliente && <span>• Tel: {booking.telefono_cliente}</span>}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs sm:text-sm font-bold text-[#1c00ff] hover:underline">
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
                  <div className="size-9 rounded-xl bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs sm:text-sm group-hover:bg-[#1c00ff] group-hover:text-white transition-colors">
                    {orario}
                  </div>
                  <div className="text-xs sm:text-sm text-zinc-600 font-semibold flex items-center gap-1.5">
                    <span>Slot Libero (1 posto)</span>
                    {isStraordinario && (
                      <span className="text-[11px] uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-black">
                        Straordinario
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-xs sm:text-sm font-bold text-zinc-400 group-hover:text-[#1c00ff] flex items-center gap-1">
                  <Plus className="size-4" /> Assegna ad Atleta
                </span>
              </div>
            );
          })
        )}
      </div>

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
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStepDay(-1);
                  setBlockOrariSelezionati([]);
                }}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-zinc-200 text-zinc-700 active:scale-95 transition-all cursor-pointer"
                title="Giorno precedente"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="text-center select-none">
                <div className="text-xs font-black text-zinc-900 capitalize">
                  {formatGiornoItaliano(selectedDate)}
                </div>
                <div className="text-[10px] text-zinc-500 font-medium">
                  {selectedDate}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStepDay(1);
                  setBlockOrariSelezionati([]);
                }}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-zinc-200 text-zinc-700 active:scale-95 transition-all cursor-pointer"
                title="Giorno successivo"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setBlockTipo("chiusura_giornata")}
                className={`p-2 rounded-2xl border-2 text-left transition-all ${
                  blockTipo === "chiusura_giornata"
                    ? "border-[#1c00ff] bg-[#1c00ff]/5 font-black text-[#1c00ff] shadow-xs"
                    : "border-zinc-200 font-bold text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sun className="size-3.5 text-amber-600" />
                  <span className="text-xs sm:text-sm font-bold">1 Giorno</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-medium leading-tight">
                  Chiusura singola
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBlockTipo("chiusura_periodo");
                  if (!periodoFine || periodoFine < selectedDate) setPeriodoFine(selectedDate);
                }}
                className={`p-2 rounded-2xl border-2 text-left transition-all ${
                  blockTipo === "chiusura_periodo"
                    ? "border-[#1c00ff] bg-[#1c00ff]/5 font-black text-[#1c00ff] shadow-xs"
                    : "border-zinc-200 font-bold text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <CalendarRange className="size-3.5 text-purple-600" />
                  <span className="text-xs sm:text-sm font-bold">Ferie / Periodo</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-medium leading-tight">
                  Agosto, Natale...
                </div>
              </button>

              <button
                type="button"
                onClick={() => setBlockTipo("slot_bloccato")}
                className={`p-2 rounded-2xl border-2 text-left transition-all ${
                  blockTipo === "slot_bloccato"
                    ? "border-[#1c00ff] bg-[#1c00ff]/5 font-black text-[#1c00ff] shadow-xs"
                    : "border-zinc-200 font-bold text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Clock className="size-3.5 text-[#1c00ff]" />
                  <span className="text-xs sm:text-sm font-bold">Slot Orari</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-medium leading-tight">
                  Spunta gli orari
                </div>
              </button>
            </div>

            {blockTipo === "chiusura_periodo" && (
              <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-purple-900">
                  <CalendarRange className="size-4 text-purple-700" />
                  Intervallo Date Chiusura Studio
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                      Data Inizio
                    </label>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                      Data Fine (inclusa)
                    </label>
                    <Input
                      type="date"
                      value={periodoFine}
                      min={selectedDate}
                      onChange={(e) => setPeriodoFine(e.target.value)}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                </div>

                {(() => {
                  const s = new Date(selectedDate);
                  const e = new Date(periodoFine);
                  const diff = e.getTime() - s.getTime();
                  const gg = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
                  return (
                    <div className="text-[11px] text-purple-900 font-bold bg-purple-100/70 p-2 rounded-xl flex items-center justify-between">
                      <span>Durata Chiusura:</span>
                      <span className="font-black text-xs text-purple-950">{gg} giorni consecutivi</span>
                    </div>
                  );
                })()}

                <label className="flex items-start gap-2 p-2 rounded-xl bg-white border border-purple-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prorogaScadenze}
                    onChange={(e) => setProrogaScadenze(e.target.checked)}
                    className="mt-0.5 rounded text-[#1c00ff] focus:ring-[#1c00ff]"
                  />
                  <div className="text-[11px] leading-tight">
                    <span className="font-black text-zinc-900 block">
                      Proroga automatica scadenze atleti (+N giorni)
                    </span>
                    <span className="text-zinc-500 text-[10px]">
                      Slitta automaticamente la scadenza dei crediti di tutti gli atleti attivi del numero di giorni di chiusura dello studio.
                    </span>
                  </div>
                </label>
              </div>
            )}

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
      <Dialog
        open={!!selectedBooking}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBooking(null);
            setProrogaScadenzaChoice(false);
          }
        }}
      >
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <User className="size-5 text-[#1c00ff]" />
              Dettaglio & Gestione Seduta
            </DialogTitle>
          </DialogHeader>

          {selectedBooking && (
            <div className="my-3 space-y-3 text-xs">
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

              {/* OPZIONI PROROGA SCADENZA CARNET (NESSUN AUTOMATISMO) */}
              <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-zinc-900 text-xs">Proroga Scadenza Carnet</span>
                  <span className="text-[10px] text-zinc-500 font-bold">Controllo Coach</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-tight">
                  Seleziona l'azione desiderata per la data di scadenza del pacchetto dell'atleta:
                </p>
                <div className="space-y-1.5 pt-0.5">
                  <label
                    onClick={() => setProrogaScadenzaChoice(false)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      !prorogaScadenzaChoice
                        ? "bg-white border-[#1c00ff] ring-1 ring-[#1c00ff] shadow-2xs text-zinc-900"
                        : "bg-white/60 border-zinc-200 text-zinc-600 hover:bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="proroga-choice"
                      checked={!prorogaScadenzaChoice}
                      onChange={() => setProrogaScadenzaChoice(false)}
                      className="mt-0.5 text-[#1c00ff]"
                    />
                    <div>
                      <div className="font-black text-zinc-900">Nessuna proroga (Consigliato per spostamento)</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        1 credito ripristinato al wallet per riprenotare. La scadenza del pacchetto resta <strong>invariata</strong>.
                      </div>
                    </div>
                  </label>

                  <label
                    onClick={() => setProrogaScadenzaChoice(true)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      prorogaScadenzaChoice
                        ? "bg-amber-50/70 border-amber-500 ring-1 ring-amber-500 shadow-2xs text-amber-950 font-bold"
                        : "bg-white/60 border-zinc-200 text-zinc-600 hover:bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="proroga-choice"
                      checked={prorogaScadenzaChoice}
                      onChange={() => setProrogaScadenzaChoice(true)}
                      className="mt-0.5 text-amber-600"
                    />
                    <div>
                      <div className="font-black text-amber-900">Proroga scadenza carnet (+7 giorni)</div>
                      <div className="text-[11px] text-amber-800 mt-0.5">
                        1 credito ripristinato e la data di scadenza viene posticipata di 7 giorni (per recupero straordinario).
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedBooking(null);
                setProrogaScadenzaChoice(false);
              }}
              className="flex-1 rounded-xl"
            >
              Chiudi
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedBooking) {
                  cancellaMutation.mutate({
                    id: selectedBooking.id,
                    proroga: prorogaScadenzaChoice,
                  });
                }
              }}
              disabled={cancellaMutation.isPending}
              className="flex-1 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              {cancellaMutation.isPending ? "Annullamento..." : "Annulla Seduta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE PALINSESTO RICORRENTE & ATTIVITÀ STILE BOOKYWAY */}
      <ManagerPalinsestoModal
        open={palinsestoModalOpen}
        onOpenChange={setPalinsestoModalOpen}
      />

      {/* MODALE CONFERMA NOTIFICA ATLETA (EMAIL + WHATSAPP) */}
      <Dialog open={!!notifyModalData} onOpenChange={(open) => !open && setNotifyModalData(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="size-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                <CheckCircle className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-zinc-900">
                  {notifyModalData?.tipo === "inserimento"
                    ? "Seduta Assegnata & Notificata"
                    : "Seduta Annullata & Notificata"}
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 font-medium">
                  Operazione completata con successo
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {notifyModalData && (
            <div className="my-3 space-y-3">
              {/* Box Riepilogo Dati */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-medium">Atleta:</span>
                  <strong className="text-zinc-900 font-bold text-sm">{notifyModalData.nome}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-medium">Data e Ora:</span>
                  <span className="text-zinc-900 font-bold capitalize">
                    {formatGiornoItaliano(notifyModalData.data)} ore {notifyModalData.orario}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-medium">Recapito Tel:</span>
                  <span className="text-zinc-800 font-semibold">{notifyModalData.telefono || "Non specificato"}</span>
                </div>
              </div>

              {/* Status Notifica Email automatica */}
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5">
                <Mail className="size-4 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-900">Notifica Email Inviata</p>
                  <p className="text-emerald-700 text-[11px] leading-tight">
                    Inviata a <span className="font-semibold underline">{notifyModalData.email}</span>
                  </p>
                </div>
              </div>

              {/* Azione Rapida WhatsApp */}
              <div className="p-3.5 rounded-2xl bg-zinc-900 text-white space-y-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-[#25D366]" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Notifica WhatsApp Diretta
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-snug">
                  Invia o inoltra il messaggio di riepilogo al contatto WhatsApp dell'atleta con 1 tocco:
                </p>
                <a
                  href={(() => {
                    const { tipo, nome, data, orario, telefono } = notifyModalData;
                    const msg = tipo === "inserimento"
                      ? `Ciao ${nome}, ti confermo l'assegnazione della tua seduta di allenamento per ${formatGiornoItaliano(data)} alle ore ${orario} presso Area46 Training Lab. Buona preparazione!`
                      : `Ciao ${nome}, ti confermo che la seduta del ${formatGiornoItaliano(data)} alle ore ${orario} è stata annullata dal Coach. Il tuo credito è stato ripristinato integralmente sul tuo profilo Area46.`;
                    const cleanPhone = (telefono || "").replace(/[^0-9]/g, "");
                    const phoneFormatted = cleanPhone.length === 10 && cleanPhone.startsWith("3") ? `39${cleanPhone}` : cleanPhone;
                    return phoneFormatted
                      ? `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(msg)}`
                      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-zinc-950 font-black text-xs transition-colors shadow-md cursor-pointer"
                >
                  <MessageCircle className="size-4 fill-zinc-950 text-zinc-950" />
                  Apri Chat WhatsApp con Atleta
                </a>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setNotifyModalData(null)}
              className="w-full rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold"
            >
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
