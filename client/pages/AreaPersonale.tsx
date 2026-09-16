import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  useCurrentUser,
  useMovimentiCrediti,
  useEccezioniCalendario,
  useLabConfig,
} from "../lib/useUser";
import {
  CalendarCheck,
  Coins,
  Receipt,
  User,
  ShieldCheck,
  Sparkles,
  Clock,
  Lock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Building2,
  CreditCard,
  Zap,
  Info,
  KeyRound,
  ArrowRight,
  Gift,
  History,
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
  created_at: string;
}

interface Pacchetto {
  id: string;
  nome: string;
  descrizione: string;
  crediti: number;
  giorni_validita: number;
  prezzo_euro: number;
  tipo: "consumo" | "ricorrente_4mesi";
  attivo: boolean;
  badge?: string;
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

export default function AreaPersonalePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isManager, crediti, hasDebt, isZeroCredits, isExpired, switchUser } =
    useCurrentUser();
  const { config } = useLabConfig();
  const { movimenti } = useMovimentiCrediti(user?.id, user?.email);

  // Tab interna: 'prenota' | 'tariffario' | 'movimenti' | 'profilo'
  const [activeTab, setActiveTab] = useState<"prenota" | "tariffario" | "movimenti" | "profilo">(
    "prenota"
  );

  // ─── STATO PRENOTAZIONI ────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateISO(d);
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [slotDaPrenotare, setSlotDaPrenotare] = useState<string | null>(null);
  const [prenotazioneDaAnnullare, setPrenotazioneDaAnnullare] = useState<Prenotazione | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);

  // ─── STATO TARIFFARIO / CHECKOUT ───────────────────────────────────────────
  const [selectedPack, setSelectedPack] = useState<Pacchetto | null>(null);
  const [metodo, setMetodo] = useState<"carta" | "apple_pay" | "paypal" | "bonifico">("carta");
  const [codiceFiscale, setCodiceFiscale] = useState(user?.codice_fiscale || "");
  const [indirizzo, setIndirizzo] = useState(user?.indirizzo || "");
  const [completedTx, setCompletedTx] = useState<any | null>(null);

  // ─── STATO ACCESSO COACH CON PIN ──────────────────────────────────────────
  const [coachPinModal, setCoachPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // Eccezioni calendario (straordinari o chiusure)
  const { eccezioni } = useEccezioniCalendario(selectedDate);

  // Calcolo giorni della settimana
  const giorniSettimana = useMemo(() => {
    const days: { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const dayOfWeek = base.getDay();
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
  const { data: prenotazioni = [] } = useQuery<Prenotazione[]>({
    queryKey: ["prenotazioni"],
    queryFn: async () => {
      const res = await fetch("/app-api/prenotazioni");
      if (!res.ok) throw new Error("Errore recupero prenotazioni");
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Query Pacchetti (8, 12, 24, 36)
  const { data: pacchetti = [] } = useQuery<Pacchetto[]>({
    queryKey: ["tariffario"],
    queryFn: async () => {
      const res = await fetch("/app-api/tariffario");
      if (!res.ok) throw new Error("Errore tariffario");
      return res.json();
    },
  });

  // Orari del giorno (combinando orari base + slot straordinari - slot bloccati)
  const orariGiorno = useMemo(() => {
    const base = config?.orari_disponibili || [
      "07:30", "08:30", "09:30", "10:30", "11:30",
      "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
    ];

    // Verifica chiusura totale giornata
    const isGiornoChiuso = eccezioni.some(
      (e) => e.data === selectedDate && e.tipo === "chiusura_giornata"
    );
    if (isGiornoChiuso) return [];

    const setOrari = new Set(base);

    // Aggiungi straordinari
    eccezioni
      .filter((e) => e.data === selectedDate && e.tipo === "slot_straordinario" && e.orario)
      .forEach((e) => setOrari.add(e.orario!));

    // Rimuovi bloccati
    eccezioni
      .filter((e) => e.data === selectedDate && e.tipo === "slot_bloccato" && e.orario)
      .forEach((e) => setOrari.delete(e.orario!));

    return Array.from(setOrari).sort();
  }, [config, eccezioni, selectedDate]);

  const isInteroGiornoChiuso = useMemo(() => {
    return eccezioni.some((e) => e.data === selectedDate && e.tipo === "chiusura_giornata");
  }, [eccezioni, selectedDate]);

  // Prenotazioni del giorno selezionato
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

  // Policy di cancellazione personale dell'atleta (default 24h)
  const policyPersonaleOre = user?.tempo_cancellazione_ore || 24;

  // Mutation Prenotazione
  const prenotaMutation = useMutation({
    mutationFn: async ({ data, orario }: { data: string; orario: string }) => {
      const res = await fetch("/app-api/prenotazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, orario }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Impossibile completare la prenotazione.");
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      toast.success(data.messaggio || "Slot prenotato!");
      setSlotDaPrenotare(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore nella prenotazione dello slot.");
    },
  });

  // Mutation Cancellazione
  const annullaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/app-api/prenotazioni/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore cancellazione.");
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      if (data.rimborsato) {
        toast.success(data.messaggio);
      } else {
        toast.warning(data.messaggio);
      }
      setPrenotazioneDaAnnullare(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore cancellazione.");
    },
  });

  // Mutation Checkout
  const checkoutMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/app-api/transazioni/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore durante il checkout");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      queryClient.invalidateQueries({ queryKey: ["transazioni"] });
      setCompletedTx(data);
      setSelectedPack(null);
      if (data.transazione.stato === "in_attesa_bonifico") {
        toast.info("Richiesta registrata! Effettua il bonifico con la causale generata.");
      } else {
        toast.success("Carnet acquistato! Crediti accreditati nel wallet.");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore checkout");
    },
  });

  const handleVerifyCoachPin = () => {
    if (pinInput.trim() === "4646" || pinInput.trim() === "0000") {
      setCoachPinModal(false);
      setPinInput("");
      setPinError(false);
      switchUser("usr-coach-01");
      navigate("/manager/calendario");
    } else {
      setPinError(true);
      toast.error("PIN errato. Riprova.");
    }
  };

  const currentDebtCount = hasDebt ? Math.abs(crediti) : 0;

  return (
    <div className="space-y-4 pb-12">
      {/* INTESTAZIONE AREA PERSONALE */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-zinc-900 flex items-center gap-2">
            <User className="size-5 text-[#1c00ff]" />
            Area Personale
          </h1>
          <p className="text-xs text-zinc-500">
            {user?.name} • Saldo: <strong>{crediti} crediti</strong>
          </p>
        </div>

        {/* POLICY CANCELLAZIONE PERSONALE BADGE */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
            La tua policy
          </span>
          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#1c00ff]/10 text-[#1c00ff] border border-[#1c00ff]/20">
            Cancellazione {policyPersonaleOre}h
          </span>
        </div>
      </div>

      {/* TABS DI NAVIGAZIONE INTERNA */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-zinc-200/80 text-xs font-bold text-zinc-600">
        <button
          type="button"
          onClick={() => setActiveTab("prenota")}
          className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === "prenota"
              ? "bg-white text-[#1c00ff] shadow-sm font-black"
              : "hover:text-zinc-900"
          }`}
        >
          <CalendarCheck className="size-4" />
          <span className="text-[11px] truncate">Prenota</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tariffario")}
          className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === "tariffario"
              ? "bg-white text-[#1c00ff] shadow-sm font-black"
              : "hover:text-zinc-900"
          }`}
        >
          <Coins className="size-4" />
          <span className="text-[11px] truncate">Carnet</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("movimenti")}
          className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === "movimenti"
              ? "bg-white text-[#1c00ff] shadow-sm font-black"
              : "hover:text-zinc-900"
          }`}
        >
          <History className="size-4" />
          <span className="text-[11px] truncate">Storico</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profilo")}
          className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === "profilo"
              ? "bg-white text-[#1c00ff] shadow-sm font-black"
              : "hover:text-zinc-900"
          }`}
        >
          <User className="size-4" />
          <span className="text-[11px] truncate">Mio Profilo</span>
        </button>
      </div>

      {/* ─── TAB 1: PRENOTAZIONE SLOT 1:1 ────────────────────────────────────── */}
      {activeTab === "prenota" && (
        <div className="space-y-4">
          {/* LE MIE PRENOTAZIONI ATTIVE */}
          {miePrenotazioniAttive.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#1c00ff]/5 border border-[#1c00ff]/20 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#1c00ff] flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" /> Le Tue Prossime Sedute ({miePrenotazioniAttive.length})
              </span>

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
                          1 Credito scalato • Policy: {policyPersonaleOre}h
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

          {/* SELETTORE GIORNO */}
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
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

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

          {/* GRIGLIA SLOT 1:1 */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                <Clock className="size-3.5 text-[#1c00ff]" />
                Slot 1:1 • {formatGiornoItaliano(selectedDate)}
              </span>
              <span className="text-[11px] font-bold text-zinc-500">
                {isInteroGiornoChiuso ? "Lab Chiuso" : `${orariGiorno.length - prenotazioniGiorno.length} slot liberi`}
              </span>
            </div>

            {isInteroGiornoChiuso ? (
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center text-xs text-amber-900 space-y-1">
                <AlertTriangle className="size-6 mx-auto text-amber-600 mb-1" />
                <div className="font-black text-sm">Lab Chiuso in questa data</div>
                <p className="text-[11px] text-amber-800">
                  Il Lab è chiuso per ferie o pausa programmata dal Coach. Seleziona un altro giorno.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {orariGiorno.map((orario) => {
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
                      onClick={() => {
                        if (isZeroCredits || hasDebt || isExpired) {
                          setShowBlockModal(true);
                          return;
                        }
                        setSlotDaPrenotare(orario);
                      }}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-[#1c00ff] transition-all shadow-2xs group cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs group-hover:bg-[#1c00ff] group-hover:text-white transition-colors">
                          {orario}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-zinc-900">Slot Disponibile</span>
                          <span className="text-[10px] text-zinc-500">Capienza 1 persona</span>
                        </div>
                      </div>

                      <span className="text-xs font-black text-[#1c00ff] group-hover:translate-x-0.5 transition-transform">
                        Prenota &rarr;
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* REGOLE DI PRENOTAZIONE AREA46 (SINTETICHE E PULITE) */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs space-y-1.5">
            <div className="font-bold text-zinc-900 flex items-center gap-1.5">
              <Info className="size-4 text-[#1c00ff]" />
              Regole di Prenotazione Area46
            </div>
            <p className="text-[11px] leading-relaxed">
              • <strong>1 Credito = 1 Allenamento</strong> al Landmine Lab.
              <br />• <strong>La tua policy personale di cancellazione:</strong> fino a{" "}
              <strong>{policyPersonaleOre} ore prima</strong> dello slot con riaccredito automatico del credito.
              <br />• Oltre tale termine, il credito viene trattenuto.
            </p>
          </div>
        </div>
      )}

      {/* ─── TAB 2: TARIFFARIO CARNET (8, 12, 24, 36 SEDUTE) ────────────────── */}
      {activeTab === "tariffario" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500">
              Scegli il tuo Carnet
            </h2>
            <span className="text-xs font-bold text-zinc-500">
              Saldo attuale: <strong>{crediti} crediti</strong>
            </span>
          </div>

          {hasDebt && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1">
              <div className="font-black flex items-center gap-1.5 text-red-700">
                <AlertTriangle className="size-4 shrink-0" />
                REGOLARIZZAZIONE DEBITO
              </div>
              <p className="text-[11px] leading-relaxed">
                Hai <strong>{currentDebtCount} sedute a debito</strong>. Al momento dell&apos;acquisto,
                il debito verrà sanato e ti verranno accreditati i crediti rimanenti.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {pacchetti.map((pack) => {
              const creditiNetti = Math.max(0, pack.crediti - currentDebtCount);
              const isPro = pack.badge === "Pro Lab Continuativo";

              return (
                <div
                  key={pack.id}
                  className={`p-4 rounded-3xl border-2 transition-all bg-white relative ${
                    pack.badge === "Consigliato"
                      ? "border-[#1c00ff] shadow-md ring-1 ring-[#1c00ff]/20"
                      : isPro
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-md"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  {pack.badge && (
                    <div className="flex justify-end mb-1">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          pack.badge === "Consigliato"
                            ? "bg-[#e3ff00] text-zinc-950 border border-zinc-950"
                            : isPro
                            ? "bg-[#1c00ff] text-[#e3ff00]"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {pack.badge}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3
                        className={`text-base font-black ${
                          isPro ? "text-white" : "text-zinc-900"
                        }`}
                      >
                        {pack.nome}
                      </h3>
                      <p
                        className={`text-xs mt-0.5 ${
                          isPro ? "text-zinc-400" : "text-zinc-500"
                        }`}
                      >
                        {pack.descrizione}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xl font-black ${
                          isPro ? "text-[#e3ff00]" : "text-zinc-900"
                        }`}
                      >
                        {pack.prezzo_euro} €
                      </div>
                      <div
                        className={`text-[10px] font-semibold ${
                          isPro ? "text-zinc-400" : "text-zinc-500"
                        }`}
                      >
                        {(pack.prezzo_euro / pack.crediti).toFixed(1)} € / seduta
                      </div>
                    </div>
                  </div>

                  <div
                    className={`mt-3 pt-3 border-t flex items-center justify-between text-xs ${
                      isPro ? "border-zinc-800" : "border-zinc-100"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                          isPro
                            ? "bg-zinc-800 text-[#e3ff00]"
                            : "bg-[#1c00ff]/10 text-[#1c00ff]"
                        }`}
                      >
                        {pack.crediti} Allenamenti
                      </span>
                      <span className={isPro ? "text-zinc-400" : "text-zinc-500"}>
                        • Validità {pack.giorni_validita} gg
                      </span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedPack(pack);
                        setCodiceFiscale(user?.codice_fiscale || "");
                        setIndirizzo(user?.indirizzo || "");
                      }}
                      className={`rounded-xl text-xs font-black h-8 px-3.5 ${
                        isPro
                          ? "bg-[#e3ff00] text-zinc-950 hover:bg-[#d9f200]"
                          : "bg-[#1c00ff] text-white hover:bg-[#1600cc]"
                      }`}
                    >
                      Ricarica
                    </Button>
                  </div>

                  {hasDebt && (
                    <div
                      className={`mt-2 p-2 rounded-xl text-[10px] font-bold ${
                        isPro ? "bg-zinc-800 text-zinc-300" : "bg-zinc-50 text-zinc-600"
                      }`}
                    >
                      💡 Con questo carnet: {pack.crediti} acquistati - {currentDebtCount} debito ={" "}
                      <strong className="text-emerald-500">{creditiNetti} crediti netti</strong>.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 3: STORICO MOVIMENTI CREDITI (LEDGER COMPLETO) ──────────────── */}
      {activeTab === "movimenti" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500">
              Storico Transazioni Crediti
            </h2>
            <span className="text-xs font-bold text-zinc-500">
              {movimenti.length} movimenti registrati
            </span>
          </div>

          <div className="space-y-2">
            {movimenti.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-xs bg-white rounded-2xl border border-zinc-200">
                Nessun movimento registrato nel tuo wallet.
              </div>
            ) : (
              movimenti.map((m) => {
                const isPositive = m.delta_crediti > 0;
                const isBonus = m.tipo === "bonus_regalo";
                const isPenalty = m.tipo === "penalty";

                return (
                  <div
                    key={m.id}
                    className="p-3 bg-white rounded-2xl border border-zinc-200 shadow-2xs flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`size-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isBonus
                            ? "bg-purple-100 text-purple-700"
                            : isPenalty
                            ? "bg-red-100 text-red-700"
                            : isPositive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {isBonus ? (
                          <Gift className="size-4" />
                        ) : isPositive ? (
                          <Coins className="size-4" />
                        ) : (
                          <Clock className="size-4" />
                        )}
                      </div>

                      <div>
                        <div className="font-black text-zinc-900 flex items-center gap-1.5">
                          <span>{m.motivazione}</span>
                          {isBonus && (
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-bold">
                              Regalo Coach
                            </span>
                          )}
                          {isPenalty && (
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-red-100 text-red-800 font-bold">
                              Penalty
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {new Date(m.data_ora).toLocaleDateString("it-IT", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-black tabular-nums ${
                          isPositive
                            ? "text-emerald-700"
                            : m.delta_crediti < 0
                            ? "text-red-600"
                            : "text-zinc-600"
                        }`}
                      >
                        {isPositive ? `+${m.delta_crediti}` : m.delta_crediti}
                      </div>
                      <div className="text-[10px] font-bold text-zinc-400">
                        Saldo: {m.saldo_risultante}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: I MIEI DATI & ACCESSO RISERVATO COACH ────────────────────── */}
      {activeTab === "profilo" && (
        <div className="space-y-4">
          {/* SCHEDA DATI PERSONALI */}
          <div className="p-4 rounded-3xl bg-white border border-zinc-200 shadow-2xs space-y-3">
            <h2 className="text-sm font-black text-zinc-900 flex items-center gap-2">
              <User className="size-4 text-[#1c00ff]" />
              Informazioni Anagrafiche
            </h2>

            <div className="space-y-2 text-xs divide-y divide-zinc-100">
              <div className="flex justify-between pt-1">
                <span className="text-zinc-500">Nome e Cognome:</span>
                <strong className="text-zinc-900">{user?.name}</strong>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-zinc-500">Email:</span>
                <strong className="text-zinc-900">{user?.email}</strong>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-zinc-500">Telefono:</span>
                <span className="text-zinc-900">{user?.telefono || "N/D"}</span>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-zinc-500">Codice Fiscale:</span>
                <span className="font-mono text-zinc-900">{user?.codice_fiscale || "N/D"}</span>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-zinc-500">Policy Cancellazione Assegnata:</span>
                <strong className="text-[#1c00ff]">{policyPersonaleOre} ore di preavviso</strong>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-zinc-500">Scadenza Crediti:</span>
                <strong className="text-zinc-900">
                  {user?.data_scadenza_crediti || "Senza scadenza"}
                </strong>
              </div>
            </div>
          </div>

          {/* ACCESSO RISERVATO COACH / GESTORE (DISCRETO E SICURO) */}
          <div className="p-4 rounded-3xl bg-zinc-900 text-white space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-[#e3ff00] text-zinc-950 font-black">
                  <ShieldCheck className="size-4 text-[#1c00ff]" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white">Accesso Riservato Coach</h3>
                  <p className="text-[10px] text-zinc-400">Pannello di controllo e gestione Lab</p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => setCoachPinModal(true)}
                className="bg-[#1c00ff] hover:bg-[#1600cc] text-white text-xs font-black rounded-xl h-8 px-3"
              >
                <KeyRound className="size-3.5 mr-1" /> Accedi Coach
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODALE CHECKOUT PAGAMENTI ─────────────────────────────────────────── */}
      <Dialog open={!!selectedPack} onOpenChange={(open) => !open && setSelectedPack(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <CreditCard className="size-5 text-[#1c00ff]" />
              Checkout {selectedPack?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Acquisto sedute individuali 1:1 al Landmine Lab.
            </DialogDescription>
          </DialogHeader>

          {selectedPack && (
            <div className="my-3 space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                <div className="flex justify-between font-bold text-zinc-900 text-sm">
                  <span>{selectedPack.nome}</span>
                  <span className="text-[#1c00ff]">{selectedPack.prezzo_euro} €</span>
                </div>
                <div className="flex justify-between text-zinc-500 text-[11px]">
                  <span>Crediti inclusi:</span>
                  <strong>{selectedPack.crediti} allenamenti</strong>
                </div>
                {hasDebt && (
                  <div className="flex justify-between text-red-600 font-bold text-[11px]">
                    <span>Debito pregresso sanato:</span>
                    <span>- {currentDebtCount} crediti</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-700 font-black border-t border-zinc-200 pt-1.5">
                  <span>Nuovo Saldo Wallet Finale:</span>
                  <span>{Math.max(0, selectedPack.crediti - currentDebtCount)} crediti</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block mb-1.5">
                  Metodo di Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodo("carta")}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all flex items-center gap-2 cursor-pointer ${
                      metodo === "carta"
                        ? "border-[#1c00ff] bg-[#1c00ff]/5 font-black text-[#1c00ff]"
                        : "border-zinc-200 hover:border-zinc-300 font-bold text-zinc-700"
                    }`}
                  >
                    <CreditCard className="size-4" />
                    <span>Carta / Stripe</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodo("apple_pay")}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all flex items-center gap-2 cursor-pointer ${
                      metodo === "apple_pay"
                        ? "border-[#1c00ff] bg-[#1c00ff]/5 font-black text-[#1c00ff]"
                        : "border-zinc-200 hover:border-zinc-300 font-bold text-zinc-700"
                    }`}
                  >
                    <Zap className="size-4" />
                    <span>Apple / Google Pay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodo("paypal")}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all flex items-center gap-2 cursor-pointer ${
                      metodo === "paypal"
                        ? "border-[#1c00ff] bg-[#1c00ff]/5 font-black text-[#1c00ff]"
                        : "border-zinc-200 hover:border-zinc-300 font-bold text-zinc-700"
                    }`}
                  >
                    <ShieldCheck className="size-4" />
                    <span>PayPal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodo("bonifico")}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all flex items-center gap-2 cursor-pointer ${
                      metodo === "bonifico"
                        ? "border-[#1c00ff] bg-[#1c00ff]/5 font-black text-[#1c00ff]"
                        : "border-zinc-200 hover:border-zinc-300 font-bold text-zinc-700"
                    }`}
                  >
                    <Building2 className="size-4" />
                    <span>Bonifico Bancario</span>
                  </button>
                </div>
              </div>

              {metodo === "bonifico" && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <div className="font-bold">Coordinate Bonifico:</div>
                  <div className="font-mono text-[11px] select-all bg-white p-1.5 rounded border border-amber-300">
                    IBAN: {config?.iban || "IT46X0306909606100000046460"}
                  </div>
                  <div className="text-[10px] text-amber-800">
                    Intestatario: {config?.intestatario_iban}
                  </div>
                </div>
              )}

              <div className="space-y-1.5 pt-1 border-t border-zinc-100">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block">
                  Dati Ricevuta
                </label>
                <Input
                  placeholder="Codice Fiscale"
                  value={codiceFiscale}
                  onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedPack(null)}
              className="flex-1 rounded-xl"
            >
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (selectedPack) {
                  checkoutMutation.mutate({
                    id_pacchetto: selectedPack.id,
                    metodo,
                    codice_fiscale: codiceFiscale,
                    indirizzo,
                  });
                }
              }}
              disabled={checkoutMutation.isPending}
              className="flex-1 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black h-10"
            >
              {checkoutMutation.isPending
                ? "Elaborazione..."
                : metodo === "bonifico"
                ? "Genera Causale"
                : `Paga ${selectedPack?.prezzo_euro} €`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE RICEVUTA */}
      <Dialog open={!!completedTx} onOpenChange={(open) => !open && setCompletedTx(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <div className="mx-auto size-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
            <FileCheck className="size-6" />
          </div>

          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-black text-zinc-900">
              {completedTx?.transazione?.stato === "in_attesa_bonifico"
                ? "Richiesta Registrata"
                : "Pagamento Confermato"}
            </DialogTitle>
          </DialogHeader>

          {completedTx && (
            <div className="my-3 space-y-2 text-xs">
              {completedTx.transazione.stato === "in_attesa_bonifico" ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="font-bold text-amber-900">Causale Univoca Bonifico:</div>
                  <div className="p-2 rounded-xl bg-white border border-amber-300 font-mono text-xs font-bold select-all text-center">
                    {completedTx.transazione.causale_bonifico}
                  </div>
                  <div className="text-[11px] text-amber-800">
                    Importo: <strong>{completedTx.transazione.importo_euro} €</strong>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between border-b pb-1 font-sans font-bold">
                    <span>Codice:</span>
                    <span>{completedTx.ricevuta?.codice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-sans">Pacchetto:</span>
                    <span>{completedTx.ricevuta?.descrizione}</span>
                  </div>
                  <div className="flex justify-between font-sans text-emerald-700 font-bold border-t pt-1">
                    <span>Nuovo Saldo Wallet:</span>
                    <span>{completedTx.crediti_attuali} crediti</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setCompletedTx(null);
                setActiveTab("prenota");
              }}
              className="w-full rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black h-10"
            >
              Torna a Prenotare gli Slot &rarr;
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE CONFERMA ANNULLA PRENOTAZIONE */}
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
          </DialogHeader>

          {prenotazioneDaAnnullare && (
            <div className="my-3 space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                <strong>{formatGiornoItaliano(prenotazioneDaAnnullare.data)}</strong> alle{" "}
                <strong>{prenotazioneDaAnnullare.orario}</strong>
              </div>

              {(() => {
                const slotTs = new Date(
                  `${prenotazioneDaAnnullare.data}T${prenotazioneDaAnnullare.orario}:00`
                ).getTime();
                const oreDiff = (slotTs - Date.now()) / (1000 * 60 * 60);
                const isInTempo = oreDiff >= policyPersonaleOre;

                return isInTempo ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <p className="font-bold">✅ Riaccredito Immediato</p>
                    <p className="text-[11px] mt-0.5">
                      Mancano {Math.round(oreDiff)}h (la tua policy richiede almeno {policyPersonaleOre}h). Il credito ti verrà restituito.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900">
                    <p className="font-bold">⚠️ Cancellazione Tardiva</p>
                    <p className="text-[11px] mt-0.5">
                      Mancano solo {Math.max(0, Math.round(oreDiff))}h (meno delle {policyPersonaleOre}h previste). Il credito verrà trattenuto.
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
              {annullaMutation.isPending ? "Annullamento..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE CONFERMA PRENOTAZIONE */}
      <Dialog open={!!slotDaPrenotare} onOpenChange={(open) => !open && setSlotDaPrenotare(null)}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <CalendarCheck className="size-5 text-[#1c00ff]" />
              Conferma Prenotazione
            </DialogTitle>
          </DialogHeader>

          <div className="my-3 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Data:</span>
              <strong className="text-zinc-900">{formatGiornoItaliano(selectedDate)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Orario:</span>
              <strong className="text-zinc-900">{slotDaPrenotare}</strong>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-1.5">
              <span className="text-zinc-500">Crediti dopo prenotazione:</span>
              <span className="font-bold text-[#1c00ff]">{crediti - 1} crediti</span>
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
              {prenotaMutation.isPending ? "Prenotazione..." : "Conferma Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE BLOCCO CREDITI */}
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
            Per prenotare uno slot 1:1 è necessario avere un credito attivo nel wallet.
          </DialogDescription>

          <div className="mt-5 flex flex-col gap-2">
            <Button
              onClick={() => {
                setShowBlockModal(false);
                setActiveTab("tariffario");
              }}
              className="w-full rounded-xl bg-[#e3ff00] text-zinc-950 font-black border border-zinc-900 h-10"
            >
              <Sparkles className="size-4 text-[#1c00ff] mr-1" />
              Ricarica Carnet
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowBlockModal(false)}
              className="text-xs text-zinc-500"
            >
              Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODALE INSERIMENTO PIN COACH */}
      <Dialog open={coachPinModal} onOpenChange={setCoachPinModal}>
        <DialogContent className="max-w-xs bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl text-center">
          <div className="mx-auto size-11 rounded-2xl bg-zinc-900 text-[#e3ff00] flex items-center justify-center mb-2">
            <KeyRound className="size-5" />
          </div>

          <DialogTitle className="text-base font-black text-zinc-900">
            PIN Riservato Coach
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 mt-1">
            Inserisci il codice di sicurezza per accedere al pannello di controllo. (PIN demo: 4646)
          </DialogDescription>

          <div className="my-4">
            <Input
              type="password"
              placeholder="Inserisci PIN (4646)"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyCoachPin()}
              className={`text-center font-mono text-lg tracking-widest h-11 rounded-2xl ${
                pinError ? "border-red-500 ring-2 ring-red-200" : ""
              }`}
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCoachPinModal(false);
                setPinInput("");
                setPinError(false);
              }}
              className="flex-1 rounded-xl text-xs"
            >
              Annulla
            </Button>
            <Button
              onClick={handleVerifyCoachPin}
              className="flex-1 rounded-xl bg-[#1c00ff] text-white font-black text-xs h-10"
            >
              Sblocca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
