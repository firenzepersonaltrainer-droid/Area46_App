import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  useCurrentUser,
  useMovimentiCrediti,
  useEccezioniCalendario,
  useLabConfig,
  useAttivita,
  useRegolePalinsesto,
  getStripeHeaders,
  saveDeletedBookingId,
  isBookingDeleted,
} from "../lib/useUser";
import { calcolaSlotPerGiorno, timeToMinutes } from "../lib/palinsesto";
import { CalendarioMeseNavigabile } from "../components/CalendarioMeseNavigabile";
import {
  Calendar as CalendarIcon,
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
  CheckSquare,
  Square,
  Filter,
  SlidersHorizontal,
  ListChecks,
  Check,
  Bot,
  BookOpen,
  LogOut,
  Share2,
  Crown,
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
import { AIBookingConcierge } from "../components/AIBookingConcierge";
import { InfoContinuativoModal } from "../components/InfoContinuativoModal";
import { ManualeUtenteModal } from "../components/ManualeUtenteModal";
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
  tipo: "consumo" | "abbonamento" | "ricorrente_4mesi" | string;
  attivo: boolean;
  badge?: string;
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

function formatGiornoEstesoItaliano(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const GIORNI_SETTIMANA_LAB = [
  { id: 1, sigla: "Lun", nome: "Lunedì" },
  { id: 2, sigla: "Mar", nome: "Martedì" },
  { id: 3, sigla: "Mer", nome: "Mercoledì" },
  { id: 4, sigla: "Gio", nome: "Giovedì" },
  { id: 5, sigla: "Ven", nome: "Venerdì" },
  { id: 6, sigla: "Sab", nome: "Sabato" },
  { id: 0, sigla: "Dom", nome: "Domenica" },
];

const ORARI_DISPONIBILI_BATCH = [
  "08:00", "08:15", "08:30", "08:45",
  "09:00", "09:15", "09:30", "09:45",
  "10:00", "10:15", "10:30", "10:45",
  "11:00", "11:15", "11:30", "11:45",
  "12:00", "12:15", "12:30",
  "16:30", "16:45",
  "17:00", "17:15", "17:30", "17:45",
  "18:00", "18:15", "18:30", "18:45",
  "19:00", "19:15", "19:30", "19:45",
  "20:00", "20:15", "20:30",
];

export default function AreaPersonalePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isManager, crediti, hasDebt, isZeroCredits, isExpired, switchUser, logout, isLoggingOut } =
    useCurrentUser();
  const { config } = useLabConfig();
  const { movimenti } = useMovimentiCrediti(user?.id, user?.email);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

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

  // ─── SCANNER & CONGELAMENTO TEMPORANEO POSTAZIONE (15 MINUTI) ───────────────
  const [scannerSlot, setScannerSlot] = useState<{ data: string; orario: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [countdownSec, setCountdownSec] = useState<number>(15 * 60);

  // Gestione postazione congelata (15 minuti) per il tariffario
  const [frozenSlot, setFrozenSlot] = useState<{ data: string; orario: string; expiresAt: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

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

  useEffect(() => {
    const raw = localStorage.getItem("area46_frozen_slot");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.expiresAt > Date.now()) {
          setFrozenSlot(parsed);
          setSecondsLeft(Math.floor((parsed.expiresAt - Date.now()) / 1000));
        } else {
          localStorage.removeItem("area46_frozen_slot");
        }
      } catch {
        localStorage.removeItem("area46_frozen_slot");
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (!frozenSlot) return;
    const interval = setInterval(() => {
      const remaining = Math.floor((frozenSlot.expiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setFrozenSlot(null);
        localStorage.removeItem("area46_frozen_slot");
        clearInterval(interval);
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [frozenSlot]);

  // ─── STATO PRENOTAZIONE MULTIPLA RAPIDA (A BLOCCHI CON SPUNTA) ────────────
  const [bookingMode, setBookingMode] = useState<"singola" | "multipla">("singola");
  const [batchGiorni, setBatchGiorni] = useState<number[]>([3, 5]); // Mercoledì e Venerdì di default
  const [batchOraInizio, setBatchOraInizio] = useState("17:00");
  const [batchSettimane, setBatchSettimane] = useState(4); // 4 settimane di orizzonte (1 mese)
  const [selectedBatchSlots, setSelectedBatchSlots] = useState<Array<{ data: string; orario: string }>>([]);
  const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);

  // ─── STATO TARIFFARIO / CHECKOUT ───────────────────────────────────────────
  const [selectedPack, setSelectedPack] = useState<Pacchetto | null>(null);
  const [metodo, setMetodo] = useState<"carta" | "apple_pay" | "paypal" | "bonifico">("carta");
  const [codiceFiscale, setCodiceFiscale] = useState(user?.codice_fiscale || "");
  const [indirizzo, setIndirizzo] = useState(user?.indirizzo || "");
  const [completedTx, setCompletedTx] = useState<any | null>(null);

  // ─── STATO MODALI (AI CONCIERGE, CONTINUATIVO INFO, MANUALE UTENTE) ────────
  const [showAIModal, setShowAIModal] = useState(false);
  const [showContinuativoModal, setShowContinuativoModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // ─── STATO ACCESSO COACH CON PIN ──────────────────────────────────────────
  const [coachPinModal, setCoachPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // Eccezioni calendario complessive (ferie, chiusure e aperture per tutto il periodo)
  const { eccezioni } = useEccezioniCalendario();

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

  // Query Pacchetti (8, 12, 24, 36)
  const { data: pacchetti = [] } = useQuery<Pacchetto[]>({
    queryKey: ["tariffario"],
    queryFn: async () => {
      const res = await fetch("/app-api/tariffario");
      if (!res.ok) throw new Error("Errore tariffario");
      return res.json();
    },
  });

  // Dati Attività e Palinsesto Ricorrente
  const { attivita } = useAttivita();
  const { regole } = useRegolePalinsesto();

  // Calcolo dinamico degli slot a scaglioni di 15 min basati su palinsesto attivo
  const {
    slots: slotDinamici,
    isChiuso: isInteroGiornoChiuso,
    motivoChiusura,
    hasPalinsesto,
  } = useMemo(() => {
    return calcolaSlotPerGiorno(selectedDate, regole, eccezioni, attivita);
  }, [selectedDate, regole, eccezioni, attivita]);

  // Orari del giorno depurati da eventuali blocchi singoli del Coach
  const orariGiorno = useMemo(() => {
    if (isInteroGiornoChiuso) return [];
    const bloccati = new Set(
      eccezioni
        .filter((e) => e.data === selectedDate && e.tipo === "slot_bloccato" && e.orario)
        .map((e) => e.orario!)
    );
    return slotDinamici
      .filter((s) => !bloccati.has(s.orario))
      .map((s) => s.orario);
  }, [slotDinamici, isInteroGiornoChiuso, eccezioni, selectedDate]);

  // Prenotazioni del giorno selezionato
  const prenotazioniGiorno = useMemo(() => {
    return prenotazioni.filter((p) => !isBookingDeleted(p.id) && p.data === selectedDate && (p.stato === "confermata" || !p.stato || p.stato === "attiva"));
  }, [prenotazioni, selectedDate]);

  // Le mie prenotazioni attive
  const miePrenotazioniAttive = useMemo(() => {
    if (!user) return [];
    return prenotazioni
      .filter(
        (p) =>
          !isBookingDeleted(p.id) &&
          (p.email_cliente?.toLowerCase() === user.email?.toLowerCase() ||
            (p.atleta_id && p.atleta_id === user.id)) &&
          (p.stato === "confermata" || !p.stato || p.stato === "attiva")
      )
      .sort((a, b) => (a.data + a.orario).localeCompare(b.data + b.orario));
  }, [prenotazioni, user]);

  // Policy di cancellazione personale dell'atleta (default 24h)
  const policyPersonaleOre = user?.tempo_cancellazione_ore || 24;
  // Policy di anticipo minimo per prenotare (default dal lab config)
  const policyAnticipoOre = config?.tempo_anticipo_prenotazione_ore ?? 12;

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

  // Mutation Prenotazione Multipla Rapida
  const batchPrenotaMutation = useMutation({
    mutationFn: async (slots: Array<{ data: string; orario: string }>) => {
      const res = await fetch("/app-api/prenotazioni/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Impossibile completare le prenotazioni multiple.");
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      toast.success(data.messaggio || `${data.count} sessioni prenotate con successo!`);
      setSelectedBatchSlots([]);
      setShowBatchConfirmModal(false);
      setBookingMode("singola");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore nella prenotazione multipla.");
    },
  });

  // Calcolo dinamico degli slot che corrispondono ai filtri scelti
  const batchSlotResults = useMemo(() => {
    if (bookingMode !== "multipla") return [];
    const results: Array<{
      key: string;
      data: string;
      orario: string;
      nome_attivita: string;
      isMio: boolean;
      isOccupato: boolean;
      isBloccato: boolean;
      isTroppoVicino: boolean;
      disponibile: boolean;
    }> = [];

    const now = new Date();
    const todayISO = formatDateISO(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const totalDays = batchSettimane * 7;

    for (let offset = 0; offset <= totalDays; offset++) {
      const [y, m, d] = todayISO.split("-").map(Number);
      const targetDate = new Date(y, m - 1, d + offset);
      const dateStr = formatDateISO(targetDate);
      const dayOfWeek = targetDate.getDay();

      if (!batchGiorni.includes(dayOfWeek)) continue;

      const { slots, isChiuso } = calcolaSlotPerGiorno(dateStr, regole, eccezioni, attivita);
      if (isChiuso) continue;

      const dayBookings = prenotazioni.filter(
        (p) => p.data === dateStr && p.stato === "confermata"
      );
      const bloccati = new Set(
        eccezioni
          .filter((e) => e.data === dateStr && e.tipo === "slot_bloccato" && e.orario)
          .map((e) => e.orario!)
      );

      for (const slot of slots) {
        if (slot.orario !== batchOraInizio) continue;

        const slotMin = timeToMinutes(slot.orario);
        if (dateStr === todayISO && slotMin <= currentMinutes) continue;

        const booking = dayBookings.find((p) => p.orario === slot.orario);
        const isMio =
          !!booking &&
          (booking.email_cliente?.toLowerCase() === user?.email?.toLowerCase() ||
            (booking.atleta_id && booking.atleta_id === user?.id));
        const isOccupato = !!booking && !isMio;
        const isBloccato = bloccati.has(slot.orario);

        const slotTs = new Date(`${dateStr}T${slot.orario}:00`).getTime();
        const oreDiff = (slotTs - now.getTime()) / (1000 * 60 * 60);
        const isTroppoVicino = policyAnticipoOre > 0 && oreDiff < policyAnticipoOre;

        const disponibile = !isMio && !isOccupato && !isBloccato && !isTroppoVicino;

        results.push({
          key: `${dateStr}|${slot.orario}`,
          data: dateStr,
          orario: slot.orario,
          nome_attivita: slot.nome_attivita || "Landmine Lab",
          isMio,
          isOccupato,
          isBloccato,
          isTroppoVicino,
          disponibile,
        });
      }
    }

    return results;
  }, [
    bookingMode,
    batchSettimane,
    batchGiorni,
    batchOraInizio,
    regole,
    eccezioni,
    attivita,
    prenotazioni,
    user?.email,
    user?.id,
    policyAnticipoOre,
  ]);

  const handleToggleBatchSlot = (data: string, orario: string) => {
    setSelectedBatchSlots((prev) => {
      const exists = prev.some((s) => s.data === data && s.orario === orario);
      if (exists) {
        return prev.filter((s) => !(s.data === data && s.orario === orario));
      } else {
        return [...prev, { data, orario }];
      }
    });
  };

  const handleSelectAllBatch = () => {
    const freeSlots = batchSlotResults
      .filter((s) => s.disponibile)
      .map((s) => ({ data: s.data, orario: s.orario }));
    setSelectedBatchSlots(freeSlots);
  };

  const handleDeselectAllBatch = () => {
    setSelectedBatchSlots([]);
  };

  const handleToggleBatchDay = (dayNum: number) => {
    setBatchGiorni((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort((a, b) => a - b)
    );
    setSelectedBatchSlots([]);
  };

  // Mutation Cancellazione
  const annullaMutation = useMutation({
    mutationFn: async (id: string) => {
      saveDeletedBookingId(id);
      queryClient.setQueryData<Prenotazione[]>(["prenotazioni"], (old) =>
        (old || []).filter((p) => p.id !== id)
      );
      const res = await fetch(`/app-api/prenotazioni/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore cancellazione.");
      return json;
    },
    onSuccess: (data, id) => {
      saveDeletedBookingId(id);
      queryClient.setQueryData<Prenotazione[]>(["prenotazioni"], (old) =>
        (old || []).filter((p) => p.id !== id)
      );
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

  // Gestione ritorno da Stripe Checkout (?session_id=...&success=true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const isSuccess = params.get("success") === "true";
    const isCanceled = params.get("canceled") === "true";

    if (isCanceled) {
      toast.info("Operazione di pagamento Stripe annullata.");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (sessionId && isSuccess) {
      fetch("/app-api/pagamenti/stripe-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getStripeHeaders() },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.transazione) {
            queryClient.invalidateQueries({ queryKey: ["current-user"] });
            queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
            queryClient.invalidateQueries({ queryKey: ["transazioni"] });
            setCompletedTx(data);
            toast.success("Pagamento confermato! Crediti aggiunti al tuo wallet.");
          } else {
            toast.error(data.error || "Impossibile verificare il pagamento Stripe.");
          }
        })
        .catch(() => {
          toast.error("Errore durante la verifica del pagamento.");
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, [queryClient]);

  // Mutation Checkout
  const checkoutMutation = useMutation({
    mutationFn: async (payload: any) => {
      // Se metodo è digitale (carta, apple_pay, paypal): passa da Stripe Checkout
      if (payload.metodo !== "bonifico") {
        const res = await fetch("/app-api/pagamenti/stripe-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getStripeHeaders() },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore durante il checkout");
        return data;
      }

      // Altrimenti bonifico bancario tradizionale
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
      // Se Stripe restituisce checkout_url, reindirizza
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      queryClient.invalidateQueries({ queryKey: ["transazioni"] });
      setCompletedTx(data);
      setSelectedPack(null);
      if (data.transazione?.stato === "in_attesa_bonifico") {
        toast.info("Richiesta registrata! Effettua il bonifico con la causale generata.");
      } else {
        toast.success("Pacchetto Lab acquistato! Crediti accreditati nel wallet.");
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
        <div className="flex items-center gap-3">
          <img
            src="/logo-area46-transparent.png"
            alt="Area46"
            className="h-10 w-auto object-contain shrink-0 drop-shadow-2xs"
          />
          <div>
            <h1 className="text-xl font-black tracking-tight text-zinc-900">
              Area Personale
            </h1>
            <p className="text-xs text-zinc-500 font-medium">
              {user?.name} • Saldo: <strong className="text-[#1c00ff] font-black">{crediti} crediti</strong>
            </p>
          </div>
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

      {/* BANNER INFORMATIVO BORSELLINO CONDIVISO */}
      {user?.is_shared_wallet && (
        <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex items-start gap-2.5 shadow-2xs">
          <Share2 className="size-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-indigo-900">Borsellino Condiviso attivo:</span> Condividi il pacchetto crediti con{" "}
            <strong>{user.shared_master_nome || "il Titolare"}</strong>. Le tue prenotazioni scalano automaticamente dal monte crediti comune, mentre il tuo calendario, i tuoi allenamenti e il diario restano 100% personali e privati.
          </div>
        </div>
      )}

      {user?.is_wallet_master && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2.5 shadow-2xs">
          <Crown className="size-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-amber-900">Sei Titolare del Borsellino Condiviso:</span> Hai{" "}
            <strong>{user.shared_partners_count} partner collegat{user.shared_partners_count === 1 ? "o" : "i"}</strong>{" "}
            {user.shared_partner_names?.length ? `(${user.shared_partner_names.join(", ")})` : ""} che attinge al tuo pacchetto crediti. Le ricevute e i pagamenti sono intestati al tuo profilo.
          </div>
        </div>
      )}

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
          <span className="text-[11px] truncate">Pacchetti Lab</span>
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

      {/* ─── TAB 1: PRENOTAZIONE SLOT ────────────────────────────────────────── */}
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

          {/* ASSISTENTE AI BOOKING CONCIERGE BANNER */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 text-white border-2 border-[#e3ff00] shadow-[0_0_20px_rgba(227,255,0,0.18)] flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-[#e3ff00] text-zinc-950 font-black shrink-0 border border-zinc-900 shadow-xs">
                <Bot className="size-4.5 text-[#1c00ff]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-white truncate">
                  Assistente AI Booking Concierge
                </div>
                <p className="text-[10px] sm:text-[11px] text-zinc-400 leading-tight mt-0.5">
                  Pianifica o modifica intere settimane a voce o con un messaggio.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                onClick={() => setShowAIModal(true)}
                className="bg-[#1c00ff] hover:bg-[#1500cc] text-white font-black text-xs sm:text-sm px-3.5 h-9 rounded-xl border border-blue-400/50 shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Sparkles className="size-3.5 sm:size-4 text-white shrink-0" />
                <span>Usa A.I.</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowManualModal(true)}
                className="text-xs font-bold h-9 px-2 text-zinc-400 hover:text-white rounded-xl"
                title="Guida & Manuale App"
              >
                <BookOpen className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* SELETTORE MODALITÀ: SINGOLO GIORNO vs MULTIPLA (A BLOCCHI CON SPUNTA) */}
          <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setBookingMode("singola")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                bookingMode === "singola"
                  ? "bg-white text-[#1c00ff] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <CalendarIcon className="size-3.5" /> Calendario Singolo Giorno
            </button>
            <button
              type="button"
              onClick={() => setBookingMode("multipla")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                bookingMode === "multipla"
                  ? "bg-zinc-900 text-[#e3ff00] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Sparkles className="size-3.5 text-[#e3ff00]" /> Prenotazione Multipla (Filtri)
            </button>
          </div>

          {bookingMode === "singola" ? (
            <>
              {/* CALENDARIO MENSILE & SETTIMANALE NAVIGABILE */}
              <CalendarioMeseNavigabile
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                prenotazioni={prenotazioni}
                eccezioni={eccezioni}
                regole={regole}
                userEmail={user?.email}
                isManager={false}
              />

              {/* SCANNER DI DISPONIBILITA' PRE-ACQUISTO PER UTENTI A ZERO CREDITI */}
              {(isZeroCredits || isExpired || crediti <= 0) && !hasDebt && (
                <div className="p-3.5 mb-3 rounded-2xl bg-zinc-50 border border-zinc-200/90 shadow-2xs flex items-center justify-between gap-3">
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
                  <button
                    type="button"
                    onClick={() => setActiveTab("tariffario")}
                    className="text-xs font-bold h-8 px-3 bg-zinc-900 text-white hover:bg-black rounded-xl shrink-0 cursor-pointer"
                  >
                    Tariffario
                  </button>
                </div>
              )}

              {/* GRIGLIA SLOT */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-[#1c00ff]" />
                    Slot • {formatGiornoItaliano(selectedDate)}
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
                      {motivoChiusura || "Il Lab è chiuso per ferie o pausa programmata dal Coach. Seleziona un altro giorno."}
                    </p>
                  </div>
                ) : orariGiorno.length === 0 ? (
                  <div className="p-6 rounded-3xl bg-zinc-50 border border-dashed border-zinc-200 text-center text-xs text-zinc-500 space-y-2">
                    <CalendarIcon className="size-6 mx-auto text-zinc-400" />
                    <div className="font-black text-xs text-zinc-800">
                      Nessuna sessione di palinsesto ordinario
                    </div>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                      Il palinsesto ordinario del Lab è attivo il Lunedì, Mercoledì e Venerdì (09:00 - 12:30 e 17:00 - 20:30).
                      Seleziona uno dei giorni attivi sul calendario.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {orariGiorno.map((orario) => {
                      const slotInfo = slotDinamici.find((s) => s.orario === orario);
                      const booking = prenotazioniGiorno.find((p) => p.orario === orario);
                      const isOccupato = !!booking;
                      const isMio =
                        !!booking &&
                        (booking.email_cliente?.toLowerCase() === user?.email?.toLowerCase() ||
                          (booking.atleta_id && booking.atleta_id === user?.id));

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
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-bold h-8 px-2.5 cursor-pointer"
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
                      const isTroppoVicino = policyAnticipoOre > 0 && oreDiff < policyAnticipoOre;

                      if (isTroppoVicino) {
                        return (
                          <div
                            key={orario}
                            className="flex items-center justify-between p-3 rounded-2xl bg-zinc-100/60 border border-zinc-200/80 text-zinc-400 select-none"
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="size-4 text-zinc-300" />
                              <span className="text-sm font-bold tabular-nums text-zinc-500">
                                {orario}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-200 text-zinc-600 flex items-center gap-1">
                              <Lock className="size-3" /> Chiuso (&lt;{policyAnticipoOre}h)
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
                          onClick={() => {
                            if (hasDebt) {
                              setShowBlockModal(true);
                              return;
                            }
                            if (isZeroCredits || isExpired || crediti <= 0) {
                              setScannerSlot({ data: selectedDate, orario });
                              setIsScanning(true);
                              setCountdownSec(15 * 60);
                              setTimeout(() => {
                                setIsScanning(false);
                              }, 1200);
                              return;
                            }
                            setSlotDaPrenotare(orario);
                          }}
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
                                <span className="text-xs font-black text-zinc-900">
                                  {isPeak ? "Postazioni Limitate" : (slotInfo?.nome_attivita || "Landmine Lab")}
                                </span>
                                {isPeak && (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                    ⚡ 1 sola pedana rimasta
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500">
                                {isPeak
                                  ? "Capienza quasi esaurita per questo turno"
                                  : `1 Posto • ${slotInfo?.costo_crediti ?? 1} Credito`}
                              </span>
                            </div>
                          </div>

                          <span className="text-xs font-black text-[#1c00ff] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            {isZeroCredits || isExpired || crediti <= 0 ? "Verifica" : "Prenota"} &rarr;
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ══════════════════════════════════════════════════════════════════════
                MODALITÀ 2: PRENOTAZIONE MULTIPLA A BLOCCHI CON FILTRI
               ══════════════════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              {/* CARD 1: PANNELLO FILTRI RAPIDI */}
              <div className="p-4 rounded-3xl bg-zinc-50 border border-zinc-200 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-xl bg-[#1c00ff] text-white flex items-center justify-center font-black">
                      <SlidersHorizontal className="size-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900">
                        Filtri di Ricerca Multipla
                      </h3>
                      <p className="text-[10px] text-zinc-500">
                        Trova e spunta contemporaneamente gli slot nei giorni e orari scelti
                      </p>
                    </div>
                  </div>

                  {/* PRESET RAPIDI */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setBatchGiorni([3, 5]);
                        setBatchOraInizio("17:00");
                        setSelectedBatchSlots([]);
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-zinc-300 hover:border-[#1c00ff] text-zinc-700 hover:text-[#1c00ff] transition-all cursor-pointer"
                    >
                      ⚡ Mer + Ven (ore 17:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchGiorni([1, 3, 5]);
                        setBatchOraInizio("09:00");
                        setSelectedBatchSlots([]);
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-zinc-300 hover:border-[#1c00ff] text-zinc-700 hover:text-[#1c00ff] transition-all cursor-pointer"
                    >
                      ⚡ Mattine (ore 09:00)
                    </button>
                  </div>
                </div>

                {/* FILTRO 1: GIORNI DELLA SETTIMANA */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                      1. Giorni della Settimana ({batchGiorni.length} selezionati)
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setBatchGiorni([3, 5]);
                          setSelectedBatchSlots([]);
                        }}
                        className="text-[10px] font-bold text-[#1c00ff] hover:underline cursor-pointer"
                      >
                        Mer + Ven
                      </button>
                      <span className="text-[10px] text-zinc-300">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          setBatchGiorni([1, 3, 5]);
                          setSelectedBatchSlots([]);
                        }}
                        className="text-[10px] font-bold text-[#1c00ff] hover:underline cursor-pointer"
                      >
                        Tutti i giorni Lab (Lun, Mer, Ven)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {GIORNI_SETTIMANA_LAB.map((g) => {
                      const isSelected = batchGiorni.includes(g.id);
                      const isLabOrdinario = [1, 3, 5].includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleToggleBatchDay(g.id)}
                          className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center cursor-pointer border ${
                            isSelected
                              ? "bg-[#1c00ff] text-white border-[#1c00ff] shadow-xs"
                              : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          <span className="text-xs leading-none">{g.sigla}</span>
                          {isLabOrdinario && (
                            <span
                              className={`text-[8px] font-medium leading-tight mt-0.5 ${
                                isSelected ? "text-[#e3ff00]" : "text-zinc-400"
                              }`}
                            >
                              Lab
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FILTRO 2: ORARIO INIZIALE DELLA SEDUTA */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                    2. Orario Iniziale della Seduta
                  </label>
                  <select
                    value={batchOraInizio}
                    onChange={(e) => {
                      setBatchOraInizio(e.target.value);
                      setSelectedBatchSlots([]);
                    }}
                    className="w-full h-9 px-3 rounded-xl border border-zinc-300 bg-white font-bold text-xs text-zinc-900 cursor-pointer shadow-2xs"
                  >
                    {ORARI_DISPONIBILI_BATCH.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* FILTRO 3: ORIZZONTE TEMPORALE */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                    3. Orizzonte Temporale di Prenotazione
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { weeks: 2, label: "2 Settimane" },
                      { weeks: 4, label: "4 Settimane (1 Mese)" },
                      { weeks: 8, label: "8 Settimane (2 Mesi)" },
                      { weeks: 12, label: "12 Settimane (3 Mesi)" },
                    ].map((p) => {
                      const active = batchSettimane === p.weeks;
                      return (
                        <button
                          key={p.weeks}
                          type="button"
                          onClick={() => {
                            setBatchSettimane(p.weeks);
                            setSelectedBatchSlots([]);
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                            active
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                              : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CARD 2: BAROMETRICA CREDITI & AZIONI RAPIDE */}
              <div className="p-3.5 rounded-3xl bg-white border border-zinc-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                  <div>
                    <div className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                      <ListChecks className="size-4 text-[#1c00ff]" />
                      Sessioni Trovate: {batchSlotResults.length}
                      <span className="text-zinc-400 font-normal">
                        ({batchSlotResults.filter((s) => s.disponibile).length} prenotabili)
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-medium">
                      Hai spuntato <strong>{selectedBatchSlots.length}</strong> slot su{" "}
                      {batchSlotResults.filter((s) => s.disponibile).length} liberi
                    </div>
                  </div>

                  {/* TASTI SELEZIONA TUTTO / DESELEZIONA */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllBatch}
                      disabled={batchSlotResults.filter((s) => s.disponibile).length === 0}
                      className="text-xs h-8 rounded-xl font-bold bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800 cursor-pointer"
                    >
                      <CheckSquare className="size-3.5 mr-1 text-[#1c00ff]" />
                      Seleziona Tutti ({batchSlotResults.filter((s) => s.disponibile).length})
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDeselectAllBatch}
                      disabled={selectedBatchSlots.length === 0}
                      className="text-xs h-8 rounded-xl font-bold text-zinc-500 hover:text-zinc-800 cursor-pointer"
                    >
                      Deseleziona
                    </Button>
                  </div>
                </div>

                {/* STATO CREDITI WALLET */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">
                      Nel Tuo Wallet
                    </div>
                    <div className="text-base font-black text-zinc-900">
                      {crediti} <span className="text-[10px] font-normal text-zinc-500">crediti</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-2xl bg-[#1c00ff]/5 border border-[#1c00ff]/20">
                    <div className="text-[10px] font-bold text-[#1c00ff] uppercase">
                      Richiesti
                    </div>
                    <div className="text-base font-black text-[#1c00ff]">
                      {selectedBatchSlots.length}{" "}
                      <span className="text-[10px] font-normal text-[#1c00ff]/70">crediti</span>
                    </div>
                  </div>

                  <div
                    className={`p-2 rounded-2xl border ${
                      crediti - selectedBatchSlots.length < 0
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase">Saldo Residuo</div>
                    <div className="text-base font-black">
                      {crediti - selectedBatchSlots.length}{" "}
                      <span className="text-[10px] font-normal">crediti</span>
                    </div>
                  </div>
                </div>

                {/* AVVISO CREDITI INSUFFICIENTI SE SELEZIONE SUPERA WALLET */}
                {selectedBatchSlots.length > crediti && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-red-600 shrink-0" />
                      <span>
                        Crediti insufficienti: hai selezionato {selectedBatchSlots.length} sessioni ma possiedi{" "}
                        {crediti} crediti.
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("tariffario")}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] h-7 px-2.5 rounded-xl shrink-0"
                    >
                      Acquista Pacchetto Lab
                    </Button>
                  </div>
                )}
              </div>

              {/* CARD 3: LISTA SLOT SPUNTABILI */}
              <div className="space-y-2">
                {batchSlotResults.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-zinc-50 border border-dashed border-zinc-300 text-center space-y-2">
                    <CalendarIcon className="size-8 mx-auto text-zinc-300" />
                    <div className="font-black text-sm text-zinc-800">
                      Nessuno slot corrisponde ai filtri selezionati
                    </div>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Prova a selezionare altri giorni della settimana (es. Lun, Mer, Ven) oppure ad allargare la fascia oraria.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {batchSlotResults.map((s) => {
                      const isSelected = selectedBatchSlots.some(
                        (sel) => sel.data === s.data && sel.orario === s.orario
                      );

                      if (s.isMio) {
                        return (
                          <div
                            key={s.key}
                            className="p-3 rounded-2xl bg-[#1c00ff]/10 border-2 border-[#1c00ff] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="size-7 rounded-lg bg-[#1c00ff] text-white flex items-center justify-center">
                                <Check className="size-4 stroke-[3]" />
                              </div>
                              <div>
                                <div className="font-black text-zinc-900 capitalize">
                                  {formatGiornoEstesoItaliano(s.data)}
                                </div>
                                <div className="text-[11px] text-[#1c00ff] font-bold">
                                  Ore {s.orario} • {s.nome_attivita}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-black uppercase bg-[#1c00ff] text-white px-2 py-0.5 rounded-full">
                              Tuo Slot
                            </span>
                          </div>
                        );
                      }

                      if (s.isOccupato) {
                        return (
                          <div
                            key={s.key}
                            className="p-3 rounded-2xl bg-zinc-100/70 border border-zinc-200 flex items-center justify-between text-xs text-zinc-400 select-none opacity-60"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="size-7 rounded-lg bg-zinc-200 text-zinc-400 flex items-center justify-center">
                                <Lock className="size-3.5" />
                              </div>
                              <div>
                                <div className="font-medium text-zinc-500 capitalize line-through">
                                  {formatGiornoEstesoItaliano(s.data)}
                                </div>
                                <div className="text-[11px] text-zinc-400 font-mono">
                                  Ore {s.orario}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold bg-zinc-200 text-zinc-500 px-2 py-0.5 rounded">
                              Occupato
                            </span>
                          </div>
                        );
                      }

                      if (s.isBloccato) {
                        return (
                          <div
                            key={s.key}
                            className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between text-xs text-amber-700 select-none opacity-60"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="size-7 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center">
                                <AlertTriangle className="size-3.5" />
                              </div>
                              <div>
                                <div className="font-medium text-amber-900 capitalize">
                                  {formatGiornoEstesoItaliano(s.data)}
                                </div>
                                <div className="text-[11px] text-amber-700 font-mono">
                                  Ore {s.orario} • Chiuso
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded">
                              Ferie / Blocco
                            </span>
                          </div>
                        );
                      }

                      if (s.isTroppoVicino) {
                        return (
                          <div
                            key={s.key}
                            className="p-3 rounded-2xl bg-zinc-100/70 border border-zinc-200 flex items-center justify-between text-xs text-zinc-400 select-none opacity-60"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="size-7 rounded-lg bg-zinc-200 text-zinc-400 flex items-center justify-center">
                                <Lock className="size-3.5" />
                              </div>
                              <div>
                                <div className="font-medium text-zinc-500 capitalize line-through">
                                  {formatGiornoEstesoItaliano(s.data)}
                                </div>
                                <div className="text-[11px] text-zinc-400 font-mono">
                                  Ore {s.orario} • Termine prenotazione scaduto
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold bg-zinc-200 text-zinc-500 px-2 py-0.5 rounded">
                              Chiuso (&lt;{policyAnticipoOre}h)
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={s.key}
                          onClick={() => handleToggleBatchSlot(s.data, s.orario)}
                          className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between text-xs select-none ${
                            isSelected
                              ? "bg-[#1c00ff]/5 border-[#1c00ff] shadow-xs"
                              : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/80"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`size-6 rounded-lg flex items-center justify-center transition-all ${
                                isSelected
                                  ? "bg-[#1c00ff] text-white"
                                  : "border-2 border-zinc-300 bg-white text-transparent"
                              }`}
                            >
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                            <div>
                              <div className="font-black text-zinc-900 capitalize leading-tight">
                                {formatGiornoEstesoItaliano(s.data)}
                              </div>
                              <div className="text-[11px] text-zinc-500 font-bold mt-0.5">
                                Ore <span className="font-mono text-zinc-800">{s.orario}</span> • {s.nome_attivita}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full transition-all ${
                              isSelected
                                ? "bg-[#1c00ff] text-white"
                                : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {isSelected ? "Selezionato" : "Spunta"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CARD 4: BARRA DI CONFERMA MASSIVA */}
              {selectedBatchSlots.length > 0 && (
                <div className="p-4 rounded-3xl bg-zinc-900 text-white border border-zinc-800 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-zinc-400">Riepilogo Prenotazione Multipla</div>
                      <div className="text-base font-black text-white">
                        {selectedBatchSlots.length} Sessioni Selezionate
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-zinc-400">Costo Totale</div>
                      <div className="text-base font-black text-[#e3ff00]">
                        -{selectedBatchSlots.length} Crediti
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      if (crediti < selectedBatchSlots.length) {
                        toast.error("Crediti insufficienti. Ricarica un Pacchetto Lab o riduci la selezione.");
                        return;
                      }
                      batchPrenotaMutation.mutate(selectedBatchSlots);
                    }}
                    isLoading={batchPrenotaMutation.isPending}
                    disabled={selectedBatchSlots.length === 0 || crediti < selectedBatchSlots.length}
                    className="w-full h-12 rounded-2xl bg-[#e3ff00] text-zinc-950 hover:bg-[#d9f200] font-black text-sm border border-zinc-900 shadow-lg cursor-pointer"
                  >
                    <Sparkles className="size-4 text-[#1c00ff] mr-1.5" />
                    Conferma e Prenota {selectedBatchSlots.length} Sessioni (-{selectedBatchSlots.length} Crediti)
                  </Button>
                </div>
              )}
            </div>
          )}

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

      {/* ─── TAB 2: TARIFFARIO PACCHETTI LAB (8, 12, 24, 36 SEDUTE) ───────── */}
      {activeTab === "tariffario" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500">
              Scegli i tuoi Pacchetti Lab
            </h2>
            <span className="text-xs font-bold text-zinc-500">
              Saldo attuale: <strong>{crediti} crediti</strong>
            </span>
          </div>

          {/* BANNER INFORMATIVO CONTINUATIVO & GUIDA */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 text-white border-2 border-[#e3ff00] shadow-[0_0_20px_rgba(227,255,0,0.18)] flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#e3ff00] text-zinc-950 font-black shrink-0 border border-zinc-900 shadow-xs">
                <Sparkles className="size-4 text-[#1c00ff]" />
              </div>
              <div>
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>Formula Continuativo Lab</span>
                  <span className="text-[9px] font-black uppercase bg-[#1c00ff] text-[#e3ff00] px-1.5 py-0.2 rounded-full">
                    CONSIGLIATO
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">
                  Fino a 840€ di risparmio annuo, posto fisso garantito e Assistente AI.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                onClick={() => setShowContinuativoModal(true)}
                className="text-xs font-black h-8 px-2.5 bg-[#e3ff00] text-zinc-950 hover:bg-[#d9f200] border border-zinc-900 rounded-xl"
              >
                <Info className="size-3 mr-1 text-[#1c00ff]" />
                Info
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowManualModal(true)}
                className="text-xs font-bold h-8 px-2 text-zinc-400 hover:text-white rounded-xl"
                title="Guida & Manuale App"
              >
                <BookOpen className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* BANNER POSTAZIONE CONGELATA (15 MINUTI) */}
          {frozenSlot && secondsLeft > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-amber-200 text-amber-950 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-300">
                  <Clock className="size-4 text-amber-800 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <span>Postazione Riservata per Te</span>
                    <span className="text-[10px] font-mono font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">
                      {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 leading-tight mt-0.5">
                    {formatGiornoItaliano(frozenSlot.data)} ore <strong>{frozenSlot.orario}</strong> • Concludi l&apos;acquisto per confermarla in via definitiva.
                  </p>
                </div>
              </div>
            </div>
          )}

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
              const isContinuativo = pack.tipo === "abbonamento" || pack.id.startsWith("pack-continuativo");
              const isAnnual = pack.id.includes("annuale");
              const isSemestral = pack.id.includes("semestrale");

              return (
                <div
                  key={pack.id}
                  className={`p-4 rounded-3xl border-2 transition-all relative overflow-hidden ${
                    isAnnual
                      ? "border-[#e3ff00] bg-zinc-950 text-white shadow-[0_0_24px_rgba(227,255,0,0.22)] ring-2 ring-[#e3ff00]/40"
                      : isSemestral
                      ? "border-[#1c00ff] bg-zinc-900 text-white shadow-md"
                      : "border-zinc-200 hover:border-zinc-300 bg-white"
                  }`}
                >
                  {/* BADGE IN ALTO */}
                  <div className="flex items-center justify-between mb-1.5">
                    {isContinuativo && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#e3ff00] flex items-center gap-1">
                        <Bot className="size-3 text-[#e3ff00]" />
                        <span>AI Concierge Incluso</span>
                      </span>
                    )}
                    <div className="ml-auto">
                      {isAnnual ? (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#e3ff00] text-zinc-950 border border-zinc-950 shadow-xs flex items-center gap-1 animate-pulse">
                          👑 PREMIO 12 MESI • MAX RISPARMIO
                        </span>
                      ) : pack.badge ? (
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isSemestral
                              ? "bg-[#1c00ff] text-[#e3ff00] border border-[#e3ff00]/30"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {pack.badge}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3
                        className={`text-base font-black ${
                          isContinuativo ? "text-white" : "text-zinc-900"
                        }`}
                      >
                        {pack.nome}
                      </h3>
                      <p
                        className={`text-xs mt-0.5 leading-relaxed ${
                          isContinuativo ? "text-zinc-300" : "text-zinc-500"
                        }`}
                      >
                        {pack.descrizione}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xl font-black ${
                          isAnnual
                            ? "text-[#e3ff00]"
                            : isSemestral
                            ? "text-[#e3ff00]"
                            : "text-zinc-900"
                        }`}
                      >
                        {pack.prezzo_euro} €
                      </div>
                      <div
                        className={`text-[10px] font-semibold ${
                          isContinuativo ? "text-zinc-400" : "text-zinc-500"
                        }`}
                      >
                        {isContinuativo
                          ? "Quota fissa / mese"
                          : `${(pack.prezzo_euro / pack.crediti).toFixed(1)} € / seduta`}
                      </div>
                    </div>
                  </div>

                  {/* BENEFIT ESCLUSIVI PER CONTINUATIVO */}
                  {isContinuativo && (
                    <div className="mt-3 pt-2.5 border-t border-zinc-800 space-y-1 text-[11px] text-zinc-300">
                      <div className="flex items-center gap-1.5 font-bold text-[#e3ff00]">
                        <Bot className="size-3.5 shrink-0" />
                        <span>Assistente AI Booking Concierge Illimitato</span>
                      </div>
                      {isAnnual && (
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                          <Sparkles className="size-3.5 shrink-0" />
                          <span>Posto fisso garantito per 365 giorni (104 o 156 slot)</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setShowContinuativoModal(true)}
                          className="text-[10px] text-[#e3ff00] underline font-bold hover:text-white cursor-pointer"
                        >
                          ℹ️ Leggi come funziona e le tutele del Continuativo
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    className={`mt-3 pt-3 border-t flex items-center justify-between text-xs ${
                      isContinuativo ? "border-zinc-800" : "border-zinc-100"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                          isContinuativo
                            ? "bg-zinc-800 text-[#e3ff00]"
                            : "bg-[#1c00ff]/10 text-[#1c00ff]"
                        }`}
                      >
                        {pack.crediti} Allenamenti
                      </span>
                      <span className={isContinuativo ? "text-zinc-400" : "text-zinc-500"}>
                        •{" "}
                        {isContinuativo
                          ? isAnnual
                            ? "Durata 12 Mesi"
                            : "Durata 6 Mesi"
                          : pack.giorni_validita && pack.giorni_validita % 7 === 0
                          ? `Scadenza ${pack.giorni_validita / 7} settimane`
                          : `Validità ${pack.giorni_validita} gg`}
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
                        isAnnual
                          ? "bg-[#e3ff00] text-zinc-950 hover:bg-[#d9f200] border border-zinc-900"
                          : isSemestral
                          ? "bg-[#e3ff00] text-zinc-950 hover:bg-[#d9f200]"
                          : "bg-[#1c00ff] text-white hover:bg-[#1600cc]"
                      }`}
                    >
                      {isContinuativo ? "Attiva Subito" : "Ricarica"}
                    </Button>
                  </div>

                  {hasDebt && (
                    <div
                      className={`mt-2 p-2 rounded-xl text-[10px] font-bold ${
                        isContinuativo
                          ? "bg-zinc-800/80 text-zinc-300"
                          : "bg-zinc-50 text-zinc-600 border border-zinc-200"
                      }`}
                    >
                      💡 Con questo pacchetto: {pack.crediti} acquistati - {currentDebtCount} debito ={" "}
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
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                <User className="size-4 text-[#1c00ff]" />
                Informazioni Anagrafiche
              </h2>
              <img
                src="/logo-area46-transparent.png"
                alt="Area46"
                className="h-8 w-auto object-contain drop-shadow-2xs"
              />
            </div>

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

          {/* GUIDA, CONTINUATIVO & ASSISTENTE AI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setShowManualModal(true)}
              className="p-3.5 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 text-left transition-all shadow-2xs flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#1c00ff]/10 text-[#1c00ff] font-bold">
                  <BookOpen className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-zinc-900">Manuale Utente</div>
                  <div className="text-[10px] text-zinc-500">Regole, scadenze e diario</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </button>

            <button
              type="button"
              onClick={() => setShowContinuativoModal(true)}
              className="p-3.5 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 text-left transition-all shadow-2xs flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#e3ff00] text-zinc-950 font-bold border border-zinc-900">
                  <Sparkles className="size-4 text-[#1c00ff]" />
                </div>
                <div>
                  <div className="text-xs font-black text-zinc-900">Lab Continuativo</div>
                  <div className="text-[10px] text-zinc-500">Vantaggi e tutele</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </button>

            <button
              type="button"
              onClick={() => setShowAIModal(true)}
              className="p-3.5 rounded-2xl bg-zinc-950 text-white border-2 border-[#e3ff00] hover:border-[#d9f200] text-left transition-all shadow-xs flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#e3ff00] text-zinc-950 font-bold">
                  <Bot className="size-4 text-[#1c00ff]" />
                </div>
                <div>
                  <div className="text-xs font-black text-white">Assistente AI</div>
                  <div className="text-[10px] text-zinc-400">Booking concierge</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-[#e3ff00]" />
            </button>
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

          {/* LOGOUT DALL'ACCOUNT */}
          <div className="pt-1">
            <Button
              variant="outline"
              onClick={() => setShowLogoutModal(true)}
              className="w-full h-11 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <LogOut className="size-4" />
              Esci dall&apos;Account (Logout)
            </Button>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA LOGOUT */}
      <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl text-center">
          <div className="mx-auto size-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-2 border border-red-200">
            <LogOut className="size-6" />
          </div>

          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-black text-zinc-900">
              Vuoi disconnetterti?
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Potrai riaccedere in qualunque momento inserendo la tua email o tramite Google/Apple.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowLogoutModal(false)}
              className="flex-1 rounded-xl text-xs h-10"
            >
              Annulla
            </Button>
            <Button
              onClick={() => {
                setShowLogoutModal(false);
                logout();
                navigate("/login");
              }}
              disabled={isLoggingOut}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-10 cursor-pointer"
            >
              {isLoggingOut ? "Uscita..." : "Conferma Uscita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODALE CHECKOUT PAGAMENTI ─────────────────────────────────────────── */}
      <Dialog open={!!selectedPack} onOpenChange={(open) => !open && setSelectedPack(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <CreditCard className="size-5 text-[#1c00ff]" />
              Checkout {selectedPack?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Acquisto sedute di allenamento al Landmine Lab.
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
                    IBAN: {config?.iban || "IT35A0103037761000000746509"}
                  </div>
                  <div className="text-[10px] text-amber-800">
                    Intestatario: {config?.intestatario_iban || "Stefano Tronconi (Banca MPS)"}
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
                    <span>Codice Transazione:</span>
                    <span className="font-mono text-zinc-900">
                      {completedTx.ricevuta?.codice || completedTx.transazione?.codice_transazione}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-sans">Pacchetto:</span>
                    <span className="font-sans font-bold text-zinc-800">
                      {completedTx.ricevuta?.descrizione || completedTx.transazione?.nome_pacchetto}
                    </span>
                  </div>
                  <div className="flex justify-between font-sans text-emerald-700 font-bold border-t pt-1">
                    <span>Nuovo Saldo Wallet:</span>
                    <span>
                      {completedTx.crediti_attuali !== undefined
                        ? `${completedTx.crediti_attuali} crediti`
                        : `${completedTx.transazione?.crediti_effettivi_aggiunti} crediti aggiunti`}
                    </span>
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
              ? "Pacchetto Scaduto"
              : "Crediti Esauriti"}
          </DialogTitle>

          <DialogDescription className="text-xs text-zinc-600 mt-2 leading-relaxed">
            Per prenotare uno slot è necessario avere un credito attivo nel wallet.
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
              Acquista Pacchetto Lab
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
                      setActiveTab("tariffario");
                    }
                  }}
                  className="w-full rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black h-11 cursor-pointer"
                >
                  Attiva Pacchetto & Conferma Postazione &rarr;
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setScannerSlot(null)}
                  className="text-xs text-zinc-500 h-8 cursor-pointer"
                >
                  Annulla e torna al calendario
                </Button>
              </DialogFooter>
            </>
          )}
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

      {/* ─── MODALI FUNZIONALITÀ CONTINUATIVO, AI & GUIDA ────────────────────── */}
      <AIBookingConcierge
        open={showAIModal}
        onOpenChange={setShowAIModal}
        onOpenContinuativoInfo={() => setShowContinuativoModal(true)}
      />

      <InfoContinuativoModal
        open={showContinuativoModal}
        onOpenChange={setShowContinuativoModal}
        onSelectPack={(packId) => {
          const pack = pacchetti.find((p) => p.id === packId);
          if (pack) {
            setSelectedPack(pack);
            setCodiceFiscale(user?.codice_fiscale || "");
            setIndirizzo(user?.indirizzo || "");
          }
        }}
      />

      <ManualeUtenteModal open={showManualModal} onOpenChange={setShowManualModal} />
    </div>
  );
}
