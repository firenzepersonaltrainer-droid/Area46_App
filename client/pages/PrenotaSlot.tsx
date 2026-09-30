import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useCurrentUser, useLabConfig, saveDeletedBookingId, isBookingDeleted } from "../lib/useUser";
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
  Target,
  ArrowRight,
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

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  // Scanner e congelamento temporaneo (15 minuti) per utenti con 0 crediti o scaduti
  const [scannerSlot, setScannerSlot] = useState<{ data: string; orario: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [countdownSec, setCountdownSec] = useState<number>(15 * 60);

  useEffect(() => {
    if (!scannerSlot) return;
    const interval = setInterval(() => {
      setCountdownSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [scannerSlot]);

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
      const list: Prenotazione[] = await res.json();
      return list.filter(
        (p) =>
          !isBookingDeleted(p.id) &&
          (p.stato === "confermata" || !p.stato || p.stato === "attiva") &&
          !p.stato?.startsWith("cancellata")
      );
    },
    refetchInterval: 15000,
  });

  // Mappa slot occupati per la data selezionata
  const prenotazioniGiorno = useMemo(() => {
    return prenotazioni.filter((p) => !isBookingDeleted(p.id) && p.data === selectedDate && (p.stato === "confermata" || !p.stato || p.stato === "attiva"));
  }, [prenotazioni, selectedDate]);

  // Le mie prenotazioni attive
  const miePrenotazioniAttive = useMemo(() => {
    if (!user) return [];
    return prenotazioni
      .filter((p) => !isBookingDeleted(p.id) && p.email_cliente === user.email && (p.stato === "confermata" || !p.stato || p.stato === "attiva"))
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
      saveDeletedBookingId(id);
      queryClient.setQueryData<Prenotazione[]>(["prenotazioni"], (old) =>
        (old || []).filter((p) => p.id !== id)
      );
      const res = await fetch(`/app-api/prenotazioni/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Errore durante la cancellazione.");
      }
      return json;
    },
    onSuccess: (data, id) => {
      saveDeletedBookingId(id);
      queryClient.setQueryData<Prenotazione[]>(["prenotazioni"], (old) =>
        (old || []).filter((p) => p.id !== id)
      );
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

  // Calcolo cadenza settimanale dell'atleta
  const targetSettimanale = user?.tipo_abbonamento === "lab_continuativo_3x" ? 3 : 2;
  const sedutePrenotateInSettimana = useMemo(() => {
    if (!miePrenotazioniAttive.length) return [];
    const dateSet = new Set(giorniSettimana.map((g) => g.dateStr));
    return miePrenotazioniAttive.filter((p) => dateSet.has(p.data));
  }, [miePrenotazioniAttive, giorniSettimana]);

  const seduteFissate = sedutePrenotateInSettimana.length;
  const percentualeCompletamento = Math.min(100, Math.round((seduteFissate / targetSettimanale) * 100));

  const handleSlotClick = (orario: string) => {
    // Controllo debito (priorità assoluta di regolarizzazione)
    if (hasDebt) {
      setShowBlockModal(true);
      return;
    }
    // Controllo anticipo minimo di prenotazione
    const slotTs = new Date(`${selectedDate}T${orario}:00`).getTime();
    const oreDiff = (slotTs - Date.now()) / (1000 * 60 * 60);
    if (anticipoOre > 0 && oreDiff < anticipoOre) {
      toast.error(`Prenotazione non consentita: la policy richiede almeno ${anticipoOre} ore di preavviso prima dello slot.`);
      return;
    }
    // Utente senza crediti o con pacchetto scaduto: attiva scanner e congelamento 15 min
    if (isZeroCredits || isExpired) {
      setScannerSlot({ data: selectedDate, orario });
      setIsScanning(true);
      setCountdownSec(15 * 60);
      setTimeout(() => {
        setIsScanning(false);
      }, 1200);
      return;
    }
    setSlotDaPrenotare(orario);
  };

  const orariDisponibili = config?.orari_disponibili || [
    "07:30", "08:30", "09:30", "10:30", "11:30",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
  ];

  const policyOre = user?.tempo_cancellazione_ore || config?.tempo_cancellazione_ore || 24;
  const anticipoOre = user?.tempo_anticipo_prenotazione_ore ?? config?.tempo_anticipo_prenotazione_ore ?? 24;

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER TITOLO PAGINA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo-area46-transparent.png"
            alt="Area46"
            className="h-10 w-auto object-contain drop-shadow-2xs"
          />
          <div>
            <h1 className="text-xl font-black tracking-tight text-zinc-900">
              Prenotazione Slot
            </h1>
            <p className="text-xs text-zinc-500 font-medium">
              Postazioni Landmine con assistenza del Coach.
            </p>
          </div>
        </div>

        {/* POLICIES BADGE */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400">Disdetta:</span>
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
              {policyOre}h prima
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400">Anticipo:</span>
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-[#1c00ff] border border-blue-200">
              {anticipoOre}h prima
            </span>
          </div>
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
                      Slot con Coach • Valido per diario
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

      {/* CADENCE ASSISTANT (SALVA-SCADENZA & MONITORAGGIO FREQUENZA) */}
      {!isZeroCredits && !isExpired && !hasDebt && (
        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-lg bg-[#1c00ff]/10 text-[#1c00ff] flex items-center justify-center font-bold">
                <Target className="size-3.5" />
              </div>
              <span className="text-xs font-bold text-zinc-900">
                Tabella di Marcia Settimanale
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                seduteFissate >= targetSettimanale
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-blue-50 text-[#1c00ff] border border-blue-200"
              }`}
            >
              {seduteFissate} di {targetSettimanale} sedute fissate
            </span>
          </div>

          <div className="w-full bg-zinc-200/70 rounded-full h-1.5 overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-300 ${
                seduteFissate >= targetSettimanale ? "bg-emerald-600" : "bg-[#1c00ff]"
              }`}
              style={{ width: `${percentualeCompletamento}%` }}
            />
          </div>

          <p className="text-[11px] text-zinc-600 leading-relaxed">
            {seduteFissate >= targetSettimanale ? (
              <>
                <span className="font-semibold text-emerald-700">Frequenza ottimale raggiunta per questa settimana.</span> Il tuo ritmo è allineato con la scadenza del pacchetto.
              </>
            ) : (
              <>
                Ti raccomandiamo di bloccare il tuo {seduteFissate === 0 ? "1° e 2° slot" : "prossimo slot"}{" "}
                <span className="font-semibold text-zinc-800">prima dell&apos;esaurimento postazioni</span> per garantire la frequenza di {targetSettimanale}x a settimana e rispettare la scadenza
                {user?.data_scadenza_crediti ? ` del ${formatGiornoItaliano(user.data_scadenza_crediti)}` : ""}.
              </>
            )}
          </p>
        </div>
      )}

      {/* SCANNER DI DISPONIBILITA' PRE-ACQUISTO PER UTENTI A ZERO CREDITI */}
      {(isZeroCredits || isExpired) && !hasDebt && (
        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/90 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="size-4 text-amber-600" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900">
                Scanner Disponibilità Postazioni
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                Tocca un orario libero per verificare la capienza e congelare la tua pedana per 15 minuti prima dell&apos;acquisto.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/tariffario")}
            className="text-xs font-bold h-8 px-3 bg-zinc-900 text-white hover:bg-black rounded-xl shrink-0"
          >
            Tariffario
          </Button>
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

      {/* BARRA SCARSITA' & CAPIENZA GIORNALIERA LAB */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
            🔥
          </div>
          <div>
            <div className="text-xs font-black text-amber-950 flex items-center gap-2 flex-wrap">
              <span>Affluenza Lab Elevata</span>
              <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-amber-200/90 text-amber-900 border border-amber-300">
                80% capienza impegnata
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80 leading-tight mt-0.5">
              Postazioni Landmine contate: blocca il tuo turno prima dell&apos;esaurimento pedane.
            </p>
          </div>
        </div>
      </div>

      {/* GRIGLIA ORARI SLOT */}
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
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-600 flex items-center gap-1">
                    <Lock className="size-3 text-zinc-500" /> Completo • Capienza esaurita
                  </span>
                </div>
              );
            }

            const slotTs = new Date(`${selectedDate}T${orario}:00`).getTime();
            const oreDiff = (slotTs - Date.now()) / (1000 * 60 * 60);
            const isTroppoVicino = anticipoOre > 0 && oreDiff < anticipoOre;

            if (isTroppoVicino) {
              return (
                <div
                  key={orario}
                  className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-400 select-none opacity-80"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-xl bg-zinc-100 text-zinc-400 flex items-center justify-center font-bold text-xs">
                      {orario}
                    </div>
                    <span className="text-xs font-semibold text-zinc-500">
                      Termine anticipo superato
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200 flex items-center gap-1">
                    <Clock className="size-3 text-zinc-400" /> Preavviso min {anticipoOre}h
                  </span>
                </div>
              );
            }

            // Heuristic discreta e credibile per "postazioni limitate" (orari di punta)
            const isPeak = ["07:30", "13:00", "17:00", "18:00", "19:00"].includes(orario);

            return (
              <button
                key={orario}
                type="button"
                onClick={() => handleSlotClick(orario)}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all shadow-2xs group cursor-pointer text-left ${
                  isPeak
                    ? "bg-amber-50/40 hover:bg-amber-50/70 border-amber-200/90 hover:border-amber-400"
                    : "bg-white hover:bg-zinc-50 border-zinc-200 hover:border-[#1c00ff]/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`size-8 rounded-xl flex items-center justify-center font-bold text-xs transition-colors ${
                      isPeak
                        ? "bg-amber-200/80 text-amber-950 font-black group-hover:bg-[#1c00ff] group-hover:text-white"
                        : "bg-zinc-100 text-zinc-800 group-hover:bg-[#1c00ff] group-hover:text-white"
                    }`}
                  >
                    {orario}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-zinc-900">
                        {isPeak ? "Postazioni Limitate" : "Disponibile"}
                      </span>
                      {isPeak && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          ⚡ 1 sola pedana rimasta
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      {isPeak ? "Capienza quasi esaurita per questo turno" : "Postazione Landmine • 2 rimaste"}
                    </span>
                  </div>
                </div>

                <span className="text-xs font-bold text-[#1c00ff] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  {isZeroCredits || isExpired ? "Verifica" : "Prenota"} &rarr;
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
          • <strong>1 Credito = 1 Allenamento</strong> con programmazione e assistenza Coach.
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

      {/* MODALE SCANNER & CONGELAMENTO POSTAZIONE (15 MINUTI) */}
      <Dialog
        open={!!scannerSlot}
        onOpenChange={(open) => {
          if (!open) setScannerSlot(null);
        }}
      >
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          {isScanning ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative size-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
                <div className="absolute inset-1 rounded-full border-2 border-dashed border-amber-500 animate-spin" />
                <div className="size-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold border border-amber-200">
                  <Sparkles className="size-6 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-base font-black text-zinc-900">Verifica Pedana in corso...</p>
                <p className="text-xs text-zinc-500">
                  Interrogazione registro capienza turno <strong className="text-zinc-800">{scannerSlot?.orario}</strong>
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 rounded-full text-[11px] font-medium text-zinc-600 mt-2">
                  <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                  Scansione disponibilità Landmine...
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mx-auto size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 border border-emerald-200">
                <CheckCircle2 className="size-6" />
              </div>

              <DialogHeader className="text-center">
                <DialogTitle className="text-lg font-black text-zinc-900">
                  Postazione Individuata!
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 mt-1">
                  Capienza verificata con successo per questo turno.
                </DialogDescription>
              </DialogHeader>

              {scannerSlot && (
                <div className="my-4 space-y-3">
                  <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Data Seduta:</span>
                      <strong className="text-zinc-900 capitalize">{formatGiornoItaliano(scannerSlot.data)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Orario Turno:</span>
                      <strong className="text-zinc-900">{scannerSlot.orario}</strong>
                    </div>
                    <div className="flex justify-between border-t border-zinc-200 pt-1.5">
                      <span className="text-zinc-500">Stato Postazione:</span>
                      <span className="font-bold text-amber-800 flex items-center gap-1">
                        <Clock className="size-3 text-amber-700" /> Congelata provvisoriamente
                      </span>
                    </div>
                  </div>

                  {/* TIMER COUNTDOWN BOX */}
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-center">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                      Tempo Rimanente per Confermare
                    </div>
                    <div className="text-2xl font-black font-mono tracking-tight text-amber-900 my-0.5">
                      {Math.floor(countdownSec / 60)}:{(countdownSec % 60).toString().padStart(2, "0")}
                    </div>
                    <p className="text-[11px] text-amber-800/90 leading-tight">
                      La postazione è riservata a tuo nome per 15 minuti. Scegli il tuo pacchetto per attivarla in via definitiva.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    if (scannerSlot) {
                      localStorage.setItem(
                        "area46_frozen_slot",
                        JSON.stringify({
                          data: scannerSlot.data,
                          orario: scannerSlot.orario,
                          expiresAt: Date.now() + 15 * 60 * 1000,
                        })
                      );
                      setScannerSlot(null);
                      navigate("/tariffario");
                    }
                  }}
                  className="w-full rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black h-11"
                >
                  Attiva Pacchetto & Conferma Postazione &rarr;
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setScannerSlot(null)}
                  className="text-xs text-zinc-500 h-8"
                >
                  Annulla e torna al calendario
                </Button>
              </DialogFooter>
            </>
          )}
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
              ? "Pacchetto Scaduto"
              : "Crediti Esauriti"}
          </DialogTitle>

          <DialogDescription className="text-xs text-zinc-600 mt-2 leading-relaxed">
            {hasDebt ? (
              <>
                Il tuo wallet presenta un saldo negativo di{" "}
                <strong>{crediti} crediti</strong>. Acquista un nuovo pacchetto lab per sanare il debito e
                sbloccare le prenotazioni al Lab.
              </>
            ) : isExpired ? (
              <>
                I tuoi crediti sono scaduti il{" "}
                <strong>{user?.data_scadenza_crediti}</strong>. Rinnova il pacchetto per continuare ad
                allenarti al Lab con il Coach.
              </>
            ) : (
              <>
                Hai <strong>0 crediti disponibili</strong>. Per prenotare uno slot al Lab è
                necessario acquistare una seduta singola o un pacchetto lab.
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
