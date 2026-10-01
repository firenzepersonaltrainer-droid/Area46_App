import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useProfili,
  UserProfile,
  useMovimentiCrediti,
  MovimentoCrediti,
  isTxDeleted,
  isAthleteDeleted,
  saveDeletedBookingId,
  isBookingDeleted,
} from "../lib/useUser";
import {
  Users,
  Search,
  Plus,
  Coins,
  Calendar,
  AlertTriangle,
  Phone,
  Mail,
  Edit2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  History,
  Gift,
  ShieldAlert,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  UserX,
  Copy,
  Receipt,
  TrendingUp,
  Trash2,
  Share2,
  Crown,
  Smartphone,
  Send,
  Sparkles,
} from "lucide-react";
import { PerformanceModal } from "../components/PerformanceModal";
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

function formatGiornoEsteso(iso: string): string {
  try {
    const d = new Date(iso + "T00:00:00");
    const giorni = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
    const mesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return `${giorni[d.getDay()]} ${d.getDate()} ${mesi[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

export default function ManagerAtletiPage() {
  const navigate = useNavigate();
  const { profili, modificaCrediti, salvaProfilo, dismettiAtleta, eliminaAtleta, isDeleting } = useProfili();
  const { movimenti, registraMovimento } = useMovimentiCrediti();

  const [search, setSearch] = useState("");
  const [selectedAtleta, setSelectedAtleta] = useState<UserProfile | null>(null);

  // Modale Modifica Crediti / Debiti
  const [creditiModalOpen, setCreditiModalOpen] = useState(false);
  const [nuoviCrediti, setNuoviCrediti] = useState<number>(0);
  const [nuoviAnticipi, setNuoviAnticipi] = useState<number>(0);
  const [nuovaScadenza, setNuovaScadenza] = useState<string>("");

  // Modale Anagrafica / Nuovo Atleta
  const [anagraficaModalOpen, setAnagraficaModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

  // Modale Benvenuto Nuovo Atleta & Istruzioni PWA
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [welcomeAtletaData, setWelcomeAtletaData] = useState<any | null>(null);

  // Modale Storico Crediti (Audit Ledger)
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyAtleta, setHistoryAtleta] = useState<UserProfile | null>(null);

  // Modale Bonus / Penale
  const [bonusPenaltyModalOpen, setBonusPenaltyModalOpen] = useState(false);
  const [bonusPenaltyForm, setBonusPenaltyForm] = useState<{
    tipo: "bonus_regalo" | "penalty" | "modifica_manuale";
    delta: number;
    motivazione: string;
  }>({
    tipo: "bonus_regalo",
    delta: 1,
    motivazione: "",
  });

  // Modale Dismissione Anticipata
  const [dismissioneModalOpen, setDismissioneModalOpen] = useState(false);
  const [dismissioneAtleta, setDismissioneAtleta] = useState<UserProfile | null>(null);
  const [anteprimaData, setAnteprimaData] = useState<any | null>(null);
  const [loadingAnteprima, setLoadingAnteprima] = useState(false);
  const [penaleInput, setPenaleInput] = useState<number>(50);
  const [noteDismissione, setNoteDismissione] = useState("");
  const [isDismettendo, setIsDismettendo] = useState(false);

  // Modale Esito Dismissione & Dati Fattura
  const [esitoModalOpen, setEsitoModalOpen] = useState(false);
  const [esitoDismissione, setEsitoDismissione] = useState<any | null>(null);

  // Modale Performance & I.A. Coach Assistant
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
  const [performanceAtleta, setPerformanceAtleta] = useState<UserProfile | null>(null);

  // Modale Eliminazione Definitiva Atleta
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [atletaDaCancellare, setAtletaDaCancellare] = useState<UserProfile | null>(null);

  const handleOpenDeleteAthlete = (atleta: UserProfile) => {
    setAtletaDaCancellare(atleta);
    setDeleteModalOpen(true);
  };

  const handleConfirmDeleteAthlete = async () => {
    if (!atletaDaCancellare) return;
    try {
      await eliminaAtleta(atletaDaCancellare.id);
      setDeleteModalOpen(false);
      setAtletaDaCancellare(null);
    } catch {
      // toast già gestito da hook
    }
  };

  // Modale Sedute Prenotate Future dell'Atleta
  const [futureBookingsModalOpen, setFutureBookingsModalOpen] = useState(false);
  const [athleteForFutureBookings, setAthleteForFutureBookings] = useState<UserProfile | null>(null);
  const [bookingToCancelFromAtleta, setBookingToCancelFromAtleta] = useState<any | null>(null);
  const [atletaProrogaChoice, setAtletaProrogaChoice] = useState(false);

  const queryClient = useQueryClient();

  // Query Prenotazioni per calcolo e visualizzazione sedute future
  const { data: prenotazioni = [] } = useQuery<any[]>({
    queryKey: ["prenotazioni"],
    queryFn: async () => {
      const res = await fetch("/app-api/prenotazioni");
      if (!res.ok) return [];
      const list: any[] = await res.json();
      return list.filter(
        (p) =>
          !isBookingDeleted(p.id) &&
          (p.stato === "confermata" || !p.stato || p.stato === "attiva") &&
          !p.stato?.startsWith("cancellata")
      );
    },
  });

  // Calcolo delle sedute future (non ancora svolte) per un atleta
  const todayISO = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const currentHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const getUpcomingBookingsForAthlete = (atleta: UserProfile) => {
    return prenotazioni
      .filter((p) => {
        if (isBookingDeleted(p.id)) return false;
        const matchesUser =
          (p.atleta_id && p.atleta_id === atleta.id) ||
          (p.email_cliente && p.email_cliente.toLowerCase() === atleta.email.toLowerCase());
        if (!matchesUser) return false;
        if (p.data < todayISO) return false;
        if (p.data === todayISO && p.orario < currentHM) return false;
        return true;
      })
      .sort((a, b) => (a.data + a.orario).localeCompare(b.data + b.orario));
  };

  const cancellaDaAtletaMutation = useMutation({
    mutationFn: async ({ id, proroga }: { id: string; proroga: boolean }) => {
      saveDeletedBookingId(id);
      queryClient.setQueryData<any[]>(["prenotazioni"], (old) =>
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
      queryClient.setQueryData<any[]>(["prenotazioni"], (old) =>
        (old || []).filter((p) => p.id !== variables.id)
      );
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      toast.success(data.messaggio || "Seduta annullata. Credito ripristinato.");
      setBookingToCancelFromAtleta(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante la cancellazione della seduta");
    },
  });

  // Query Transazioni per calcolo totale versamenti
  const { data: transazioni = [] } = useQuery<any[]>({
    queryKey: ["transazioni"],
    queryFn: async () => {
      const res = await fetch("/app-api/transazioni");
      if (!res.ok) return [];
      const list: any[] = await res.json();
      return list.filter((t) => !isTxDeleted(t.codice_transazione) && !isTxDeleted(t.id));
    },
  });

  const atleti = profili.filter((p) => p.ruolo === "atleta");

  const filteredAtleti = atleti.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.nome.toLowerCase().includes(q) ||
      a.cognome.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.telefono && a.telefono.includes(q))
    );
  });

  const handleOpenCrediti = (atleta: UserProfile) => {
    setSelectedAtleta(atleta);
    setNuoviCrediti(atleta.crediti);
    setNuoviAnticipi(atleta.anticipi_da_scontare || 0);
    setNuovaScadenza(atleta.data_scadenza_crediti || "");
    setCreditiModalOpen(true);
  };

  const handleSaveCrediti = async () => {
    if (!selectedAtleta) return;
    try {
      await modificaCrediti({
        id: selectedAtleta.id,
        crediti: Number(nuoviCrediti),
        anticipi_da_scontare: Number(nuoviAnticipi) || 0,
        data_scadenza_crediti: nuovaScadenza || undefined,
      });
      setCreditiModalOpen(false);
    } catch {
      // toast già gestito da hook
    }
  };

  const handleOpenEdit = (atleta?: UserProfile) => {
    if (atleta) {
      setEditForm({
        ...atleta,
        shared_wallet_with: atleta.shared_wallet_with || "",
        tempo_cancellazione_ore: atleta.tempo_cancellazione_ore || 24,
        tempo_anticipo_prenotazione_ore: atleta.tempo_anticipo_prenotazione_ore ?? 24,
      });
    } else {
      setEditForm({
        nome: "",
        cognome: "",
        email: "",
        telefono: "",
        codice_fiscale: "",
        indirizzo: "",
        crediti: 10,
        shared_wallet_with: "",
        tempo_cancellazione_ore: 24,
        tempo_anticipo_prenotazione_ore: 24,
        data_scadenza_crediti: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      });
    }
    setAnagraficaModalOpen(true);
  };

  const handleOpenHistory = (atleta: UserProfile) => {
    setHistoryAtleta(atleta);
    setHistoryModalOpen(true);
  };

  const handleOpenBonusPenalty = (atleta: UserProfile) => {
    setSelectedAtleta(atleta);
    setBonusPenaltyForm({
      tipo: "bonus_regalo",
      delta: 1,
      motivazione: "",
    });
    setBonusPenaltyModalOpen(true);
  };

  const handleSaveBonusPenalty = async () => {
    if (!selectedAtleta) return;
    if (!bonusPenaltyForm.motivazione.trim()) {
      toast.error("Inserisci una motivazione per il movimento");
      return;
    }
    try {
      const finalDelta =
        bonusPenaltyForm.tipo === "penalty"
          ? -Math.abs(bonusPenaltyForm.delta)
          : Math.abs(bonusPenaltyForm.delta);

      await registraMovimento({
        atleta_id: selectedAtleta.id,
        tipo: bonusPenaltyForm.tipo,
        delta_crediti: finalDelta,
        motivazione: bonusPenaltyForm.motivazione.trim(),
      });
      setBonusPenaltyModalOpen(false);
    } catch {
      // toast già gestito da hook
    }
  };

  const handleSaveAnagrafica = async () => {
    if (!editForm.nome?.trim() || !editForm.cognome?.trim()) {
      toast.error("Nome e Cognome sono obbligatori");
      return;
    }
    const cleanNome = editForm.nome.trim();
    const cleanCognome = editForm.cognome.trim();
    const fallbackEmail = `${cleanNome.toLowerCase().replace(/[^a-z0-9]/g, "")}.${cleanCognome.toLowerCase().replace(/[^a-z0-9]/g, "")}${Date.now().toString().slice(-4)}@area46lab.it`;
    const cleanEmail = editForm.email?.trim() ? editForm.email.trim().toLowerCase() : fallbackEmail;

    const isNew = !editForm.id;
    const payload: any = {
      ...editForm,
      nome: cleanNome,
      cognome: cleanCognome,
      email: cleanEmail,
      ruolo: "atleta",
      crediti: Number(editForm.crediti || 0),
      tempo_cancellazione_ore: Number(editForm.tempo_cancellazione_ore || 24),
      tempo_anticipo_prenotazione_ore: Number(editForm.tempo_anticipo_prenotazione_ore || 24),
    };

    try {
      const res = await salvaProfilo(payload);
      setAnagraficaModalOpen(false);
      if (isNew) {
        setWelcomeAtletaData({
          atleta: res || payload,
          notifica: res?.notifica_email,
        });
        setWelcomeModalOpen(true);
      }
    } catch {
      // toast già gestito da hook
    }
  };

  const handleOpenDismissione = async (atleta: UserProfile) => {
    setDismissioneAtleta(atleta);
    setPenaleInput(50);
    setNoteDismissione("");
    setAnteprimaData(null);
    setLoadingAnteprima(true);
    setDismissioneModalOpen(true);

    try {
      const res = await fetch(`/app-api/atleti/${atleta.id}/anteprima-dismissione`);
      if (!res.ok) throw new Error("Errore recupero anteprima dismissione");
      const data = await res.json();
      setAnteprimaData(data);
      if (data.penale_standard !== undefined) {
        setPenaleInput(data.penale_standard);
      }
    } catch (e: any) {
      toast.error(e.message || "Errore caricamento dati dismissione");
    } finally {
      setLoadingAnteprima(false);
    }
  };

  const handleConfirmDismissione = async () => {
    if (!dismissioneAtleta) return;
    setIsDismettendo(true);
    try {
      const res = await dismettiAtleta({
        id: dismissioneAtleta.id,
        penale_euro: Number(penaleInput),
        note: noteDismissione.trim(),
        tariffa_seduta: anteprimaData?.tariffa_seduta,
        sedute_svolte: anteprimaData?.sedute_svolte,
        totale_versato: anteprimaData?.totale_gia_versato,
      });

      setDismissioneModalOpen(false);
      setEsitoDismissione(res);
      setEsitoModalOpen(true);
      toast.success(res.messaggio || "Dismissione completata con successo!");
    } catch (e: any) {
      toast.error(e.message || "Errore durante la dismissione");
    } finally {
      setIsDismettendo(false);
    }
  };

  const copyTestoFattura = (testo: string) => {
    navigator.clipboard.writeText(testo);
    toast.success("Riepilogo e dati fiscali copiati negli appunti!");
  };

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER GESTIONE ATLETI */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#09090b] text-[#e3ff00] border border-[#e3ff00]/40">
              Pannello Manager
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-zinc-900 mt-1 flex items-center gap-2">
            <Users className="size-5 text-[#1c00ff]" />
            Atleti & Crediti Lab
          </h1>
        </div>

        <Button
          onClick={() => handleOpenEdit()}
          className="rounded-xl text-xs font-black bg-[#1c00ff] text-white hover:bg-[#1600cc] flex items-center gap-1 h-9 px-3"
        >
          <Plus className="size-4" /> Nuovo Atleta
        </Button>
      </div>

      {/* BARRA DI RICERCA */}
      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Cerca atleta per nome, cognome, email o tel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white text-xs h-10 rounded-2xl border-zinc-200"
        />
      </div>

      {/* LISTA SCHEDE ATLETI */}
      <div className="space-y-3">
        {filteredAtleti.map((atleta) => {
          const hasDebt = atleta.crediti < 0;
          const isZero = atleta.crediti === 0;

          return (
            <div
              key={atleta.id}
              className="p-4 rounded-3xl bg-white border border-zinc-200 shadow-2xs space-y-3"
            >
              {/* RIGA 1: NOME & SALDO CREDITI */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-zinc-100 text-zinc-800 flex items-center justify-center font-black text-sm border border-zinc-200">
                    {atleta.nome[0]}
                    {atleta.cognome[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-zinc-900 leading-tight">
                        {atleta.nome} {atleta.cognome}
                      </h3>
                      {atleta.is_shared_wallet && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 shadow-2xs">
                          <Share2 className="size-2.5 text-indigo-600" />
                          Condiviso con {atleta.shared_master_nome || "Master"}
                        </span>
                      )}
                      {atleta.is_wallet_master && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                          <Crown className="size-2.5 text-amber-600" />
                          Titolare Borsellino ({atleta.shared_partners_count || 1}{" "}
                          {atleta.shared_partners_count === 1 ? "partner" : "partner"})
                        </span>
                      )}
                      {atleta.stato_iscrizione === "dismesso" && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                          Dismesso
                        </span>
                      )}
                      {atleta.tipo_abbonamento && atleta.tipo_abbonamento !== "nessuno" && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-[#1c00ff] border border-blue-200">
                          {atleta.tipo_abbonamento === "lab_continuativo_2x"
                            ? "Continuativo 2X"
                            : atleta.tipo_abbonamento === "lab_continuativo_3x"
                            ? "Continuativo 3X"
                            : atleta.tipo_abbonamento}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {atleta.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* BADGE SALDO CREDITI */}
                <div className="text-right">
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border ${
                      hasDebt
                        ? "bg-red-50 text-red-700 border-red-200"
                        : isZero
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    <Coins className="size-3.5" />
                    <span>
                      {hasDebt ? `${atleta.crediti} DEBITO` : `${atleta.crediti} Crediti`}
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-zinc-400 mt-0.5">
                    {atleta.data_scadenza_crediti
                      ? `Scad: ${new Date(atleta.data_scadenza_crediti).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "short",
                        })}`
                      : "Senza scadenza"}
                  </div>
                  {atleta.is_shared_wallet && (
                    <div className="text-[9px] font-bold text-indigo-600 mt-0.5">
                      Borsellino comune
                    </div>
                  )}
                  {atleta.is_wallet_master && (
                    <div className="text-[9px] font-bold text-amber-700 mt-0.5">
                      Monte crediti comune
                    </div>
                  )}
                  {Number(atleta.anticipi_da_scontare || 0) > 0 && (
                    <div className="text-[9.5px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md mt-1 inline-flex items-center gap-1">
                      <span>⏳ {atleta.anticipi_da_scontare} da recuperare</span>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGA 2: ALERT SCADENZA / INATTIVITÀ 6 MESI */}
              {atleta.avviso_scadenza && (
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                  <span>Crediti in scadenza entro {atleta.giorni_a_scadenza} giorni.</span>
                </div>
              )}

              {atleta.avviso_inattivita && (
                <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-[11px] font-bold flex items-center gap-1.5">
                  <Clock className="size-3.5 text-purple-600 shrink-0" />
                  <span>
                    Inattivo da <strong>{atleta.mesi_inattivita} mesi</strong>. Regola 6 mesi:
                    inviare notifica prima del reset dello storico.
                  </span>
                </div>
              )}

              {/* RIGA 3: DETTAGLI & AZIONI */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-col gap-0.5 text-[11px] text-zinc-500">
                  {atleta.telefono ? (
                    <a
                      href={`tel:${atleta.telefono}`}
                      className="text-zinc-700 font-semibold hover:text-[#1c00ff] flex items-center gap-1"
                    >
                      <Phone className="size-3" /> {atleta.telefono}
                    </a>
                  ) : (
                    <span>Nessun recapito telefonico</span>
                  )}
                  <div className="text-[10px] font-bold text-zinc-500 flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 text-zinc-400" />
                      Disdetta: <strong>{atleta.tempo_cancellazione_ore || 24}h</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Anticipo: <strong>{atleta.tempo_anticipo_prenotazione_ore ?? 24}h</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPerformanceAtleta(atleta);
                      setPerformanceModalOpen(true);
                    }}
                    className="text-xs font-black h-8 px-2.5 rounded-xl border-[#1c00ff]/30 text-[#1c00ff] bg-[#1c00ff]/5 hover:bg-[#1c00ff]/10 flex items-center gap-1 shadow-2xs cursor-pointer"
                    title="Performance, Diario & Assistente I.A."
                  >
                    <TrendingUp className="size-3.5 text-[#1c00ff]" />
                    <span>Performance</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAthleteForFutureBookings(atleta);
                      setFutureBookingsModalOpen(true);
                      setBookingToCancelFromAtleta(null);
                      setAtletaProrogaChoice(false);
                    }}
                    className="text-xs font-bold h-8 px-2.5 rounded-xl border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100/80 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Visualizza tutte le sessioni/slot prenotati e non ancora svolti"
                  >
                    <Calendar className="size-3.5 text-blue-600" />
                    <span>Sedute Future</span>
                    {getUpcomingBookingsForAthlete(atleta).length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-black leading-tight">
                        {getUpcomingBookingsForAthlete(atleta).length}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenHistory(atleta)}
                    className="text-xs font-bold h-8 px-2 rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-100 flex items-center gap-1"
                    title="Storico Audit Crediti"
                  >
                    <History className="size-3.5 text-zinc-600" />
                    <span className="hidden sm:inline">Storico</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenBonusPenalty(atleta)}
                    className="text-xs font-bold h-8 px-2 rounded-xl border-amber-200 text-amber-800 bg-amber-50/50 hover:bg-amber-100/60 flex items-center gap-1"
                    title="Bonus / Regalo / Penale"
                  >
                    <Gift className="size-3.5 text-amber-600" />
                    <span className="hidden sm:inline">Bonus/Penale</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenCrediti(atleta)}
                    className="text-xs font-bold h-8 px-2.5 rounded-xl border-zinc-300"
                  >
                    Saldo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/manager/fisco?action=versamento&email=${encodeURIComponent(atleta.email)}`
                      )
                    }
                    className="text-xs font-bold h-8 px-2 rounded-xl border-indigo-200 text-indigo-800 bg-indigo-50/50 hover:bg-indigo-100/60 flex items-center gap-1 cursor-pointer"
                    title="Registra versamento manuale nel Fisco per questo atleta"
                  >
                    <Receipt className="size-3.5 text-[#1c00ff]" />
                    <span className="hidden sm:inline">Versamento</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(atleta)}
                    className="text-xs text-zinc-600 h-8 w-8 p-0 rounded-xl"
                    aria-label="Modifica anagrafica"
                  >
                    <Edit2 className="size-3.5" />
                  </Button>

                  {/* TASTO ROSSO ACCESO DISMISSIONE ANTICIPATA */}
                  <Button
                    size="sm"
                    onClick={() => handleOpenDismissione(atleta)}
                    disabled={atleta.stato_iscrizione === "dismesso"}
                    className={`text-xs font-black h-8 px-2.5 rounded-xl border flex items-center gap-1 transition-all ${
                      atleta.stato_iscrizione === "dismesso"
                        ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700 text-white border-red-700 shadow-2xs"
                    }`}
                    title="Dismissione anticipata con penale e revoca slot"
                  >
                    <UserX className="size-3.5" />
                    <span>
                      {atleta.stato_iscrizione === "dismesso" ? (
                        "Dismesso"
                      ) : (
                        <>
                          Dismissione <span className="hidden sm:inline">Anticipata</span>
                        </>
                      )}
                    </span>
                  </Button>

                  {/* TASTO CANCELLA DEFINITIVO */}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleOpenDeleteAthlete(atleta)}
                    className="text-xs font-black h-8 px-2.5 rounded-xl bg-red-800 hover:bg-red-900 text-white border border-red-900 shadow-2xs flex items-center gap-1 cursor-pointer"
                    title="Elimina atleta dall'anagrafica, diario e prenotazioni (preserva i dati contabili nel fisco)"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Cancella</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALE GESTIONE CREDITI & DEBITI */}
      <Dialog open={creditiModalOpen} onOpenChange={setCreditiModalOpen}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Coins className="size-5 text-[#1c00ff]" />
              Modifica Crediti & Debiti
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Aggiorna il saldo e la scadenza di {selectedAtleta?.nome} {selectedAtleta?.cognome}.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-4 text-xs">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-600 block mb-1">
                Saldo Crediti (accetta anche valori negativi per debiti, es. -2)
              </label>
              <Input
                type="number"
                value={nuoviCrediti}
                onChange={(e) => setNuoviCrediti(Number(e.target.value))}
                className="text-base font-black tabular-nums"
              />
              <div className="flex gap-1.5 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNuoviCrediti((prev) => prev - 1)}
                  className="flex-1 text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
                >
                  -1 Seduta
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNuoviCrediti((prev) => prev + 1)}
                  className="flex-1 text-xs h-7 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-bold"
                >
                  +1 Seduta
                </Button>
              </div>
            </div>

            {/* BOX GESTIONE ANTICIPI CREDITI */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Coins className="size-3.5 text-amber-600" />
                  Anticipi da scalare su prox acquisto
                </label>
                <span className="text-xs font-black text-amber-800 tabular-nums">
                  {nuoviAnticipi} crediti
                </span>
              </div>
              <p className="text-[10.5px] text-amber-800/90 leading-relaxed">
                Se concedi crediti in anticipo all&apos;atleta per farlo prenotare prima del pagamento, indica qui i crediti che l&apos;app <strong>scalerà in automatico</strong> al suo prossimo acquisto con Stripe o bonifico.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={nuoviAnticipi}
                  onChange={(e) => setNuoviAnticipi(Math.max(0, Number(e.target.value)))}
                  className="text-xs font-black tabular-nums bg-white border-amber-300 h-8"
                  placeholder="0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNuoviCrediti((prev) => prev + 8);
                    setNuoviAnticipi((prev) => prev + 8);
                  }}
                  className="text-[11px] h-8 px-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 font-bold whitespace-nowrap"
                >
                  +8 Anticipo rapido
                </Button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-600 block mb-1">
                Data di Scadenza Crediti
              </label>
              <Input
                type="date"
                value={nuovaScadenza}
                onChange={(e) => setNuovaScadenza(e.target.value)}
                className="text-xs"
              />
              <div className="flex gap-1.5 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    setNuovaScadenza(d.toISOString().slice(0, 10));
                  }}
                  className="flex-1 text-[11px] h-7"
                >
                  +1 Settimana
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 30);
                    setNuovaScadenza(d.toISOString().slice(0, 10));
                  }}
                  className="flex-1 text-[11px] h-7"
                >
                  +30 Giorni
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCreditiModalOpen(false)}
              className="flex-1 rounded-xl"
            >
              Annulla
            </Button>
            <Button
              onClick={handleSaveCrediti}
              className="flex-1 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black"
            >
              Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE ANAGRAFICA ATLETA */}
      <Dialog open={anagraficaModalOpen} onOpenChange={setAnagraficaModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Users className="size-5 text-[#1c00ff]" />
              {editForm.id ? "Modifica Anagrafica Atleta" : "Registra Nuovo Atleta"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Dati anagrafici e recapiti per notifiche e ricevute Lab.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                  Nome
                </label>
                <Input
                  value={editForm.nome || ""}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  placeholder="Nome"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                  Cognome
                </label>
                <Input
                  value={editForm.cognome || ""}
                  onChange={(e) => setEditForm({ ...editForm, cognome: e.target.value })}
                  placeholder="Cognome"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Email
              </label>
              <Input
                type="email"
                value={editForm.email || ""}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="atleta@example.com"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Telefono (WhatsApp)
              </label>
              <Input
                value={editForm.telefono || ""}
                onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                placeholder="+39 333 1234567"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                  Codice Fiscale
                </label>
                <Input
                  value={editForm.codice_fiscale || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, codice_fiscale: e.target.value.toUpperCase() })
                  }
                  placeholder="Codice Fiscale"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                  Saldo Crediti
                </label>
                <Input
                  type="number"
                  value={editForm.crediti ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, crediti: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-amber-800 block mb-1">
                  Anticipi da scalare
                </label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.anticipi_da_scontare ?? 0}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      anticipi_da_scontare: Math.max(0, Number(e.target.value)),
                    })
                  }
                  placeholder="0"
                  className="border-amber-300 focus:border-amber-500"
                />
              </div>
            </div>

            {/* SELEZIONE POLICY CANCELLAZIONE PERSONALIZZATA */}
            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Policy Cancellazione Slot (Preavviso Minimo)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[12, 24, 36, 48].map((ore) => (
                  <button
                    key={ore}
                    type="button"
                    onClick={() =>
                      setEditForm({ ...editForm, tempo_cancellazione_ore: ore })
                    }
                    className={`py-2 text-xs font-black rounded-xl border transition-all ${
                      (editForm.tempo_cancellazione_ore || 24) === ore
                        ? "bg-[#1c00ff] text-white border-[#1c00ff] shadow-xs"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {ore}h
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                Disdetta prima di <strong>{editForm.tempo_cancellazione_ore || 24} ore</strong>: credito restituito. Entro le {editForm.tempo_cancellazione_ore || 24}h: cancellazione tardiva (credito perso).
              </p>
            </div>

            {/* SELEZIONE POLICY ANTICIPO PRENOTAZIONE PERSONALIZZATA */}
            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Policy Anticipo Minimo Prenotazione Slot
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[0, 12, 24, 36, 48].map((ore) => (
                  <button
                    key={ore}
                    type="button"
                    onClick={() =>
                      setEditForm({ ...editForm, tempo_anticipo_prenotazione_ore: ore })
                    }
                    className={`py-2 text-xs font-black rounded-xl border transition-all ${
                      (editForm.tempo_anticipo_prenotazione_ore ?? 24) === ore
                        ? "bg-[#1c00ff] text-white border-[#1c00ff] shadow-xs"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {ore === 0 ? "0h" : `${ore}h`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                L&apos;atleta può prenotare con almeno <strong>{editForm.tempo_anticipo_prenotazione_ore ?? 24} ore</strong> di anticipo rispetto all&apos;orario dello slot.
              </p>
            </div>

            {/* SEZIONE BORSELLINO CREDITI CONDIVISO (SOLUZIONE MASTER & PARTNER) */}
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2 mt-2">
              <label className="text-[10px] font-bold uppercase text-indigo-900 flex items-center gap-1.5">
                <Share2 className="size-3.5 text-[#1c00ff]" />
                Borsellino Crediti Condiviso (Partner & Coppie)
              </label>
              <p className="text-[10px] text-zinc-600 leading-tight">
                Consente a due o più atleti di usufruire dello stesso pacchetto con un solo pagamento/fisco a carico del titolare, mantenendo app, calendario e diario 100% individuali.
              </p>
              <div>
                <select
                  value={editForm.shared_wallet_with || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, shared_wallet_with: e.target.value })
                  }
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#1c00ff]"
                >
                  <option value="">🔘 Borsellino Autonomo (Personale)</option>
                  {atleti
                    .filter((a) => a.id !== editForm.id && a.ruolo === "atleta")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        🤝 Condiviso con {a.nome} {a.cognome} ({a.crediti} crediti attuali)
                      </option>
                    ))}
                </select>
              </div>
              {editForm.shared_wallet_with && (
                <div className="p-2 bg-indigo-100/70 border border-indigo-200 rounded-xl text-[11px] text-indigo-950 font-medium leading-relaxed">
                  💡 Questo atleta scalerà automaticamente le sessioni dal pacchetto del titolare selezionato e ne condividerà la scadenza. Le sue prenotazioni a calendario e il suo diario di allenamento resteranno del tutto privati e separati.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setAnagraficaModalOpen(false)}
              className="flex-1 rounded-xl"
            >
              Annulla
            </Button>
            <Button
              onClick={handleSaveAnagrafica}
              className="flex-1 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black"
            >
              Salva Atleta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE STORICO CREDITI (AUDIT LEDGER) */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-lg bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
                <History className="size-5 text-[#1c00ff]" />
                Audit Ledger Crediti
              </DialogTitle>
              <Button
                size="sm"
                onClick={() => {
                  if (historyAtleta) {
                    handleOpenBonusPenalty(historyAtleta);
                  }
                }}
                className="text-xs font-bold bg-[#e3ff00] text-zinc-950 hover:bg-[#d9f200] border border-zinc-900 rounded-xl flex items-center gap-1 h-7 px-2.5"
              >
                <Gift className="size-3 text-[#1c00ff]" />
                + Bonus / Penale
              </Button>
            </div>
            <DialogDescription className="text-xs text-zinc-500">
              Cronologia completa movimenti, pacchetti, prenotazioni e penali per{" "}
              <strong>
                {historyAtleta?.nome} {historyAtleta?.cognome}
              </strong>
              . Saldo attuale:{" "}
              <span className="font-bold text-zinc-900">
                {historyAtleta?.crediti} crediti
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* BOX TOTALE VERSAMENTI EFFETTUATI */}
          {(() => {
            const atletaTransazioni = transazioni.filter(
              (t) =>
                t.email_cliente &&
                historyAtleta?.email &&
                t.email_cliente.toLowerCase() === historyAtleta.email.toLowerCase() &&
                t.stato === "completato"
            );
            const totaleVersamenti = atletaTransazioni.reduce(
              (acc, t) => acc + (t.importo_euro || 0),
              0
            );

            return (
              <div className="my-2 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs text-base">
                    💶
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                      Totale Versamenti Effettuati
                    </div>
                    <div className="text-xs text-zinc-600">
                      {atletaTransazioni.length}{" "}
                      {atletaTransazioni.length === 1
                        ? "pagamento registrato"
                        : "pagamenti registrati"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-emerald-950 tabular-nums">
                    {totaleVersamenti.toLocaleString("it-IT", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Lista movimenti */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-3 text-xs">
            {(() => {
              const atletaMovimenti = movimenti.filter(
                (m) =>
                  m.atleta_id === historyAtleta?.id ||
                  m.email_cliente === historyAtleta?.email
              );

              if (atletaMovimenti.length === 0) {
                return (
                  <div className="p-8 text-center text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                    Nessun movimento registrato per questo atleta.
                  </div>
                );
              }

              return atletaMovimenti.map((mov) => {
                const isPositive = mov.delta_crediti > 0;
                const isZero = mov.delta_crediti === 0;

                return (
                  <div
                    key={mov.id}
                    className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`size-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isPositive
                            ? "bg-emerald-100 text-emerald-800"
                            : isZero
                            ? "bg-zinc-200 text-zinc-700"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="size-4" />
                        ) : isZero ? (
                          <Coins className="size-4" />
                        ) : (
                          <ArrowDownRight className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-zinc-900 truncate">
                          {mov.motivazione || mov.tipo}
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                          <span>
                            {new Date(mov.data_ora).toLocaleDateString("it-IT", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>•</span>
                          <span className="uppercase font-semibold tracking-wider text-[9px] px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-700">
                            {mov.operatore}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-black text-xs tabular-nums ${
                          isPositive
                            ? "text-emerald-700"
                            : isZero
                            ? "text-zinc-600"
                            : "text-red-600"
                        }`}
                      >
                        {isPositive ? `+${mov.delta_crediti}` : mov.delta_crediti}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-semibold tabular-nums mt-0.5">
                        Saldo: {mov.saldo_risultante}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHistoryModalOpen(false)}
              className="w-full rounded-xl"
            >
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE BONUS / REGALO / PENALITÀ COACH */}
      <Dialog open={bonusPenaltyModalOpen} onOpenChange={setBonusPenaltyModalOpen}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Gift className="size-5 text-amber-600" />
              Bonus o Penalità
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Registra una variazione di crediti con motivazione per{" "}
              <strong>
                {selectedAtleta?.nome} {selectedAtleta?.cognome}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-3.5 text-xs">
            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Tipo di Operazione
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setBonusPenaltyForm({
                      ...bonusPenaltyForm,
                      tipo: "bonus_regalo",
                      delta: Math.abs(bonusPenaltyForm.delta || 1),
                    })
                  }
                  className={`p-2.5 rounded-2xl border text-xs font-black text-left transition-all ${
                    bonusPenaltyForm.tipo === "bonus_regalo"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300 ring-2 ring-emerald-500/20"
                      : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-emerald-700 mb-0.5">
                    <Gift className="size-3.5" />
                    <span>Bonus / Regalo</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-normal">
                    Aggiunge crediti all'atleta
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setBonusPenaltyForm({
                      ...bonusPenaltyForm,
                      tipo: "penalty",
                      delta: Math.abs(bonusPenaltyForm.delta || 1),
                    })
                  }
                  className={`p-2.5 rounded-2xl border text-xs font-black text-left transition-all ${
                    bonusPenaltyForm.tipo === "penalty"
                      ? "bg-red-50 text-red-900 border-red-300 ring-2 ring-red-500/20"
                      : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-red-700 mb-0.5">
                    <ShieldAlert className="size-3.5" />
                    <span>Penalità</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-normal">
                    Decurta crediti o manda in debito
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Numero di Crediti ({bonusPenaltyForm.tipo === "penalty" ? "- Crediti" : "+ Crediti"})
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((val) => (
                  <Button
                    key={val}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setBonusPenaltyForm({ ...bonusPenaltyForm, delta: val })
                    }
                    className={`flex-1 text-xs font-black h-8 rounded-xl ${
                      bonusPenaltyForm.delta === val
                        ? "bg-[#1c00ff] text-white border-[#1c00ff]"
                        : "border-zinc-200"
                    }`}
                  >
                    {bonusPenaltyForm.tipo === "penalty" ? `-${val}` : `+${val}`}
                  </Button>
                ))}
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={bonusPenaltyForm.delta}
                  onChange={(e) =>
                    setBonusPenaltyForm({
                      ...bonusPenaltyForm,
                      delta: Math.max(1, Number(e.target.value)),
                    })
                  }
                  className="w-16 text-center text-xs font-black"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Motivazione (visibile nel diario/storico)
              </label>
              <Input
                value={bonusPenaltyForm.motivazione}
                onChange={(e) =>
                  setBonusPenaltyForm({
                    ...bonusPenaltyForm,
                    motivazione: e.target.value,
                  })
                }
                placeholder={
                  bonusPenaltyForm.tipo === "penalty"
                    ? "Es. Mancata presenza senza avviso"
                    : "Es. Regalo compleanno / fedeltà 2026"
                }
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setBonusPenaltyModalOpen(false)}
              className="flex-1 rounded-xl"
            >
              Annulla
            </Button>
            <Button
              onClick={handleSaveBonusPenalty}
              className={`flex-1 rounded-xl font-black text-white ${
                bonusPenaltyForm.tipo === "penalty"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              Conferma {bonusPenaltyForm.tipo === "penalty" ? "Penalità" : "Bonus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE DISMISSIONE ANTICIPATA ATLETA */}
      <Dialog open={dismissioneModalOpen} onOpenChange={setDismissioneModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                <AlertTriangle className="size-3" /> Risoluzione Accordo
              </span>
            </div>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <UserX className="size-5 text-red-600" />
              Dismissione Anticipata Atleta
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Calcolo automatico di conguaglio (decadenza sconto + penale), cancellazione slot calendario e avviso per emissione fattura.
            </DialogDescription>
          </DialogHeader>

          {loadingAnteprima ? (
            <div className="py-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
              <Clock className="size-6 text-red-600 animate-spin" />
              <span>Calcolo in corso di sedute svolte e conguaglio penale...</span>
            </div>
          ) : (
            <div className="my-3 space-y-3.5 text-xs">
              {/* SCHEDA DATI ATLETA & PIANO */}
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-zinc-900 text-sm">
                    {dismissioneAtleta?.nome} {dismissioneAtleta?.cognome}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    {anteprimaData?.tipo_abbonamento === "lab_continuativo_2x"
                      ? "Continuativo 2X (250€/m)"
                      : "Continuativo 3X (359€/m)"}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 flex flex-col gap-0.5 font-mono">
                  <span>CF: {dismissioneAtleta?.codice_fiscale || "Non presente"}</span>
                  <span>Email: {dismissioneAtleta?.email}</span>
                </div>
              </div>

              {/* DETTAGLIO CONTEGGIO & DECONTO */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2.5">
                <div className="text-[11px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Coins className="size-3.5 text-amber-700" />
                  Ricalcolo Economico a Tariffa Piena
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-zinc-700">
                    <span>Sedute svolte (a prezzo pieno):</span>
                    <span className="font-bold">
                      {anteprimaData?.sedute_svolte ?? 0} x {anteprimaData?.tariffa_seduta?.toFixed(2) ?? "33.25"} € ={" "}
                      <strong>{(anteprimaData?.valore_sedute_pieno ?? 0).toFixed(2)} €</strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-zinc-700">
                    <span>Quota già versata dal cliente:</span>
                    <span className="font-bold text-emerald-700">
                      - {(anteprimaData?.totale_gia_versato ?? 0).toFixed(2)} €
                    </span>
                  </div>

                  <div className="pt-2 border-t border-amber-200 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-black text-zinc-900 block">Penale di Recesso & Svincolo Slot:</span>
                      <span className="text-[10px] text-zinc-500">Preimpostata a 50 €, modificabile se opportuno</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        step={5}
                        value={penaleInput}
                        onChange={(e) => setPenaleInput(Number(e.target.value))}
                        className="w-20 text-right font-black text-xs h-8 bg-white border-amber-300"
                      />
                      <span className="font-black text-zinc-700">€</span>
                    </div>
                  </div>
                </div>

                {/* TOTALE NETTO DA ADDEBITARE */}
                {(() => {
                  const valPieno = anteprimaData?.valore_sedute_pieno ?? 0;
                  const versato = anteprimaData?.totale_gia_versato ?? 0;
                  const pen = Number(penaleInput) || 0;
                  const netto = Math.max(0, Math.round((valPieno + pen - versato) * 100) / 100);

                  return (
                    <div className="p-2.5 rounded-xl bg-red-600 text-white flex items-center justify-between mt-2 shadow-xs">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-red-200">
                          Totale Netto da Addebitare
                        </div>
                        <div className="text-[10px] text-white/80">
                          Decadenza sconto + penale a saldo
                        </div>
                      </div>
                      <div className="text-xl font-black tabular-nums">{netto.toFixed(2)} €</div>
                    </div>
                  );
                })()}
              </div>

              {/* AZIONI AUTOMATICHE IRREVERSIBILI */}
              <div className="p-3 rounded-2xl bg-zinc-900 text-white space-y-2">
                <div className="text-[11px] font-black text-[#e3ff00] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  Operazioni eseguite in 1 solo clic:
                </div>
                <ul className="space-y-1.5 text-[11px] text-zinc-300">
                  <li className="flex items-start gap-1.5">
                    <span className="text-red-400 font-bold">•</span>
                    <span>
                      <strong>Cancellazione Slot Futuri</strong>: verranno rimossi tutti i{" "}
                      <strong>{anteprimaData?.prenotazioni_future?.length ?? 0} appuntamenti futuri</strong> dell'atleta e gli slot torneranno liberi nel calendario.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#e3ff00] font-bold">•</span>
                    <span>
                      <strong>Avviso Email per Fattura</strong>: riceverai subito una mail su{" "}
                      <strong>{anteprimaData?.email_coach || "firenzepersonaltrainer@gmail.com"}</strong> con i dati fiscali completi (CF, indirizzo, totale e causale consigliata).
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>
                      <strong>Stripe & Fisco</strong>: addebito automatico su carta salvata (o registrazione transazione) e inserimento nel Registro Fiscale come <strong>'Da emettere'</strong>.
                    </span>
                  </li>
                </ul>
              </div>

              {/* NOTE OPZIONALI COACH */}
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                  Note interne recesso (opzionale)
                </label>
                <Input
                  value={noteDismissione}
                  onChange={(e) => setNoteDismissione(e.target.value)}
                  placeholder="Es. Richiesta anticipata per trasferimento / motivi lavorativi"
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 pt-2 border-t border-zinc-100">
            <Button
              variant="outline"
              onClick={() => setDismissioneModalOpen(false)}
              disabled={isDismettendo}
              className="flex-1 rounded-xl"
            >
              Annulla
            </Button>
            <Button
              onClick={handleConfirmDismissione}
              disabled={isDismettendo || loadingAnteprima}
              className="flex-1 rounded-xl font-black bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20"
            >
              <UserX className="size-4" />
              {isDismettendo ? "Elaborazione..." : "Conferma ed Esegui"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE ESITO DISMISSIONE & RIEPILOGO FATTURA */}
      <Dialog open={esitoModalOpen} onOpenChange={setEsitoModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <CheckCircle2 className="size-5" />
              <span className="text-xs font-black uppercase tracking-wider">
                Operazione Conclusa con Successo
              </span>
            </div>
            <DialogTitle className="text-lg font-black text-zinc-900">
              Dismissione Registrata & Slot Liberati
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              L'atleta è stato dismesso, le prenotazioni future sono state revocate e la notifica con i dati per la fattura è stata inviata alla tua email.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Codice Transazione:</span>
                <span className="font-mono font-bold text-zinc-900">
                  {esitoDismissione?.dettagli?.codice_transazione}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Totale Netto Addebitato:</span>
                <span className="font-black text-red-600 text-sm">
                  {Number(esitoDismissione?.dettagli?.totale_addebitato || 0).toFixed(2)} €
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Prenotazioni Future Revocate:</span>
                <span className="font-bold text-zinc-900">
                  {esitoDismissione?.dettagli?.prenotazioni_cancellate?.length || 0} slot liberati
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Stato Fiscale:</span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                  Da emettere (visibile in Fisco)
                </span>
              </div>
            </div>

            {/* TESTO EMAIL INVIATA */}
            {esitoDismissione?.dettagli?.email_notifica?.corpo && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1">
                    <Mail className="size-3 text-zinc-400" />
                    Copia Dati per Fattura Elettronica / SDI
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyTestoFattura(esitoDismissione.dettagli.email_notifica.corpo)}
                    className="h-6 text-[10px] font-bold text-[#1c00ff] hover:bg-blue-50 px-2 rounded-lg flex items-center gap-1"
                  >
                    <Copy className="size-2.5" /> Copia Riepilogo
                  </Button>
                </div>
                <pre className="p-3 rounded-2xl bg-zinc-900 text-zinc-200 text-[10px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border border-zinc-800 leading-relaxed">
                  {esitoDismissione.dettagli.email_notifica.corpo}
                </pre>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setEsitoModalOpen(false)}
              className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-black"
            >
              Ho capito, chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE PERFORMANCE, DIARIO & ASSISTENTE I.A. */}
      <PerformanceModal
        isOpen={performanceModalOpen}
        onClose={() => setPerformanceModalOpen(false)}
        atleta={performanceAtleta}
      />

      {/* MODALE DI CONFERMA CANCELLAZIONE DEFINITIVA ATLETA */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <div className="mx-auto size-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-2 border border-red-200">
            <AlertTriangle className="size-6 text-red-600" />
          </div>

          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-black text-zinc-900">
              Conferma Eliminazione dall&apos;Anagrafica
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 mt-1">
              Rimuove l&apos;atleta dall&apos;elenco, dalle prenotazioni e dal diario. I dati fiscali rimarranno preservati nel Fisco.
            </DialogDescription>
          </DialogHeader>

          {atletaDaCancellare && (
            <div className="my-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-950 space-y-2">
              <p className="font-bold text-sm text-red-900">
                Stai per eliminare dall&apos;anagrafica: {atletaDaCancellare.nome} {atletaDaCancellare.cognome}
              </p>
              <p className="text-[11px] text-red-800/90 leading-relaxed">
                Verranno eliminati dall&apos;applicazione:
              </p>
              <ul className="list-disc list-inside text-[11px] text-red-800/90 space-y-0.5">
                <li>Scheda anagrafica e profilo atleta</li>
                <li>Tutte le prenotazioni slot passate e future</li>
                <li>Storico crediti interni e debiti di presenza</li>
                <li>Diario allenamenti e tonnellaggio registrato</li>
              </ul>
              <div className="p-2.5 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-950 text-[11px] font-semibold mt-2">
                🛡️ <strong>Nota Fiscale:</strong> I movimenti e le ricevute registrate nella sezione <strong>Fisco</strong> rimarranno conservati a norma contabile.
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="flex-1 rounded-xl"
              disabled={isDeleting}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteAthlete}
              disabled={isDeleting}
              className="flex-1 rounded-xl font-black bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Eliminazione..." : "Sì, Elimina dall'Anagrafica"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE SEDUTE PRENOTATE FUTURE DELL'ATLETA */}
      <Dialog
        open={futureBookingsModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFutureBookingsModalOpen(false);
            setAthleteForFutureBookings(null);
            setBookingToCancelFromAtleta(null);
          }
        }}
      >
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Calendar className="size-5 text-[#1c00ff]" />
              Sedute Prenotate Future
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Sessioni in programma non ancora svolte per{" "}
              <strong className="text-zinc-800">
                {athleteForFutureBookings?.nome} {athleteForFutureBookings?.cognome}
              </strong>
            </DialogDescription>
          </DialogHeader>

          {athleteForFutureBookings && (() => {
            const upcoming = getUpcomingBookingsForAthlete(athleteForFutureBookings);
            if (upcoming.length === 0) {
              return (
                <div className="py-8 text-center space-y-2">
                  <div className="size-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                    <Calendar className="size-6" />
                  </div>
                  <div className="text-sm font-bold text-zinc-700">Nessuna seduta futura prenotata</div>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                    Questo atleta al momento non ha turni prenotati per oggi o per i prossimi giorni.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-2.5 my-2">
                <div className="flex items-center justify-between text-xs px-1 text-zinc-500 font-bold">
                  <span>Turni programmati</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-black">
                    {upcoming.length} {upcoming.length === 1 ? "seduta" : "sedute"}
                  </span>
                </div>

                <div className="space-y-2">
                  {upcoming.map((bk) => (
                    <div
                      key={bk.id}
                      className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-11 rounded-xl bg-[#1c00ff] text-white flex flex-col items-center justify-center font-black leading-tight shadow-2xs shrink-0">
                          <Clock className="size-3.5" />
                          <span className="text-xs">{bk.orario}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-zinc-900 truncate">
                            {formatGiornoEsteso(bk.data)}
                          </div>
                          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold text-zinc-700">{bk.attivita || "Landmine Lab"}</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-semibold">Confermata</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setBookingToCancelFromAtleta(bk);
                          setAtletaProrogaChoice(false);
                        }}
                        className="text-xs font-bold h-8 px-2.5 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 shrink-0 cursor-pointer"
                        title="Annulla o sposta questo slot"
                      >
                        Annulla
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Sotto-sezione conferma annullamento slot selezionato con scelta proroga */}
          {bookingToCancelFromAtleta && (
            <div className="mt-3 p-4 rounded-2xl bg-red-50/70 border border-red-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-red-900 flex items-center gap-1.5">
                  <AlertTriangle className="size-4 text-red-600" />
                  Conferma Annullamento Seduta
                </span>
                <button
                  type="button"
                  onClick={() => setBookingToCancelFromAtleta(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 font-bold"
                >
                  Chiudi
                </button>
              </div>

              <div className="text-xs text-zinc-700">
                Stai annullando lo slot di{" "}
                <strong>{formatGiornoEsteso(bookingToCancelFromAtleta.data)}</strong> alle ore{" "}
                <strong>{bookingToCancelFromAtleta.orario}</strong>. 1 credito verrà restituito al wallet dell'atleta.
              </div>

              <div className="space-y-1.5 pt-1">
                <label
                  onClick={() => setAtletaProrogaChoice(false)}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${
                    !atletaProrogaChoice
                      ? "bg-white border-[#1c00ff] ring-1 ring-[#1c00ff] text-zinc-900 font-bold"
                      : "bg-white/60 border-zinc-200 text-zinc-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="proroga-atleta"
                    checked={!atletaProrogaChoice}
                    onChange={() => setAtletaProrogaChoice(false)}
                    className="mt-0.5 text-[#1c00ff]"
                  />
                  <div>
                    <div className="font-bold">Nessuna proroga (Consigliato per spostamento)</div>
                    <div className="text-[11px] text-zinc-500 font-normal mt-0.5">
                      1 credito restituito. Data di scadenza del pacchetto invariata.
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setAtletaProrogaChoice(true)}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${
                    atletaProrogaChoice
                      ? "bg-amber-50 border-amber-500 ring-1 ring-amber-500 text-amber-950 font-bold"
                      : "bg-white/60 border-zinc-200 text-zinc-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="proroga-atleta"
                    checked={atletaProrogaChoice}
                    onChange={() => setAtletaProrogaChoice(true)}
                    className="mt-0.5 text-amber-600"
                  />
                  <div>
                    <div className="font-bold">Proroga scadenza carnet (+7 giorni)</div>
                    <div className="text-[11px] text-amber-800 font-normal mt-0.5">
                      Posticipa di 1 settimana la scadenza dei crediti (recupero straordinario).
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBookingToCancelFromAtleta(null)}
                  className="flex-1 rounded-xl h-8 text-xs font-bold"
                >
                  Annulla operazione
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    cancellaDaAtletaMutation.mutate({
                      id: bookingToCancelFromAtleta.id,
                      proroga: atletaProrogaChoice,
                    });
                  }}
                  disabled={cancellaDaAtletaMutation.isPending}
                  className="flex-1 rounded-xl h-8 text-xs font-black bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  {cancellaDaAtletaMutation.isPending ? "Annullamento..." : "Conferma Annulla Seduta"}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setFutureBookingsModalOpen(false);
                setAthleteForFutureBookings(null);
                setBookingToCancelFromAtleta(null);
              }}
              className="w-full rounded-xl"
            >
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE BENVENUTO NUOVO ATLETA & ISTRUZIONI PWA */}
      <Dialog
        open={welcomeModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setWelcomeModalOpen(false);
            setWelcomeAtletaData(null);
          }
        }}
      >
        <DialogContent className="max-w-md p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Sparkles className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-zinc-900">
                  Nuovo Atleta Registrato!
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                  Profilo censito con successo e notifica di benvenuto generata.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {welcomeAtletaData?.atleta && (
            <div className="space-y-4 my-2">
              {/* STATUS BADGE EMAIL */}
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5 text-xs">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Notifica Email inviata all'atleta</div>
                  <div className="text-[11px] text-emerald-800">
                    Inviata a <strong>{welcomeAtletaData.atleta.email}</strong> con la guida completa passo-passo per iPhone e Android.
                  </div>
                </div>
              </div>

              {/* RIEPILOGO ATLETA */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider">Atleta</span>
                  <span className="font-black text-zinc-900">
                    {welcomeAtletaData.atleta.nome} {welcomeAtletaData.atleta.cognome}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider">Email</span>
                  <span className="font-mono text-zinc-800">{welcomeAtletaData.atleta.email}</span>
                </div>
                {welcomeAtletaData.atleta.telefono && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider">Telefono</span>
                    <span className="font-medium text-zinc-800">{welcomeAtletaData.atleta.telefono}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-zinc-200/60">
                  <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider">Accesso Programmi</span>
                  <span className="font-bold text-[#1c00ff]">Immediato & Gratuito (100%)</span>
                </div>
              </div>

              {/* ANTEPRIMA GUIDA INSTALLAZIONE PWA SMARTPHONE */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                  <Smartphone className="size-3.5 text-[#1c00ff]" />
                  Guida Installazione Rapida Telefono
                </div>
                <div className="p-3 rounded-2xl bg-zinc-900 text-zinc-100 text-[11px] space-y-2 font-mono leading-relaxed select-text">
                  <p className="text-[#e3ff00] font-bold">🍏 IPHONE (SAFARI):</p>
                  <p className="text-zinc-300">
                    1. Safari: https://area46-app.vercel.app<br />
                    2. Icona Condividi ⎋ &rarr; "Aggiungi a schermata Home" (+)
                  </p>
                  <p className="text-[#e3ff00] font-bold pt-1">🤖 ANDROID (CHROME):</p>
                  <p className="text-zinc-300">
                    1. Chrome: https://area46-app.vercel.app<br />
                    2. Menu ⋮ &rarr; "Installa app" / "Aggiungi a schermata Home"
                  </p>
                  <p className="text-emerald-400 font-bold pt-1">🔑 ACCESSO OTP:</p>
                  <p className="text-zinc-300">
                    Email {welcomeAtletaData.atleta.email} &rarr; Codice OTP numerico istantaneo
                  </p>
                </div>
              </div>

              {/* PULSANTI DI CONDIVISIONE RAPIDA */}
              <div className="space-y-2 pt-1">
                {/* WHATSAPP */}
                <a
                  href={`https://wa.me/${(welcomeAtletaData.atleta.telefono || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                    `Ciao ${welcomeAtletaData.atleta.nome}! Il Coach Stefano Tronconi ha creato il tuo profilo atleta in Area46 Landmine Lab! 🏋️‍♂️\n\nEcco come salvare e installare l'app sul display del tuo telefono:\n\n🍏 IPHONE (SAFARI):\n1. Apri con SAFARI: https://area46-app.vercel.app\n2. Tocca l'icona Condividi in basso (quadrato con freccetta ⎋)\n3. Scegli "Aggiungi alla schermata Home" (+)\n4. Tocca "Aggiungi"\n\n🤖 ANDROID (CHROME):\n1. Apri con GOOGLE CHROME: https://area46-app.vercel.app\n2. Tocca i tre puntini in alto a destra (⋮)\n3. Tocca "Installa app" o "Aggiungi a schermata Home"\n\n🔑 ACCESSO RAPIDO:\n1. Apri l'app dal tuo telefono\n2. Inserisci la tua email: ${welcomeAtletaData.atleta.email}\n3. Clicca su "Ricevi Codice di Accesso (OTP)" per entrare subito in sicurezza senza password complesse!`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <Send className="size-3.5" />
                  Invia Istruzioni su WhatsApp
                </a>

                {/* COPIA NEGLI APPUNTI */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const text = `Ciao ${welcomeAtletaData.atleta.nome}! Il Coach Stefano Tronconi ha creato il tuo profilo atleta in Area46 Landmine Lab! 🏋️‍♂️\n\nEcco come salvare e installare l'app sul display del tuo telefono:\n\n🍏 IPHONE (SAFARI):\n1. Apri con SAFARI: https://area46-app.vercel.app\n2. Tocca l'icona Condividi in basso (quadrato con freccetta ⎋)\n3. Scegli "Aggiungi alla schermata Home" (+)\n4. Tocca "Aggiungi"\n\n🤖 ANDROID (CHROME):\n1. Apri con GOOGLE CHROME: https://area46-app.vercel.app\n2. Tocca i tre puntini in alto a destra (⋮)\n3. Tocca "Installa app" o "Aggiungi a schermata Home"\n\n🔑 ACCESSO RAPIDO:\n1. Apri l'app dal tuo telefono\n2. Inserisci la tua email: ${welcomeAtletaData.atleta.email}\n3. Clicca su "Ricevi Codice di Accesso (OTP)" per entrare subito in sicurezza senza password complesse!`;
                    navigator.clipboard.writeText(text);
                    toast.success("Istruzioni copiate negli appunti!");
                  }}
                  className="w-full h-10 rounded-xl border-zinc-200 text-zinc-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Copy className="size-3.5" />
                  Copia Testo per SMS o Messaggio
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setWelcomeModalOpen(false);
                setWelcomeAtletaData(null);
              }}
              className="w-full rounded-xl"
            >
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
