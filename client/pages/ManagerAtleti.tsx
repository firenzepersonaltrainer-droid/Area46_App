import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  useProfili,
  UserProfile,
  useMovimentiCrediti,
  MovimentoCrediti,
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

export default function ManagerAtletiPage() {
  const { profili, modificaCrediti, salvaProfilo, dismettiAtleta } = useProfili();
  const { movimenti, registraMovimento } = useMovimentiCrediti();

  const [search, setSearch] = useState("");
  const [selectedAtleta, setSelectedAtleta] = useState<UserProfile | null>(null);

  // Modale Modifica Crediti / Debiti
  const [creditiModalOpen, setCreditiModalOpen] = useState(false);
  const [nuoviCrediti, setNuoviCrediti] = useState<number>(0);
  const [nuovaScadenza, setNuovaScadenza] = useState<string>("");

  // Modale Anagrafica / Nuovo Atleta
  const [anagraficaModalOpen, setAnagraficaModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

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
    setNuovaScadenza(atleta.data_scadenza_crediti || "");
    setCreditiModalOpen(true);
  };

  const handleSaveCrediti = async () => {
    if (!selectedAtleta) return;
    try {
      await modificaCrediti({
        id: selectedAtleta.id,
        crediti: Number(nuoviCrediti),
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
        tempo_cancellazione_ore: atleta.tempo_cancellazione_ore || 24,
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
        tempo_cancellazione_ore: 24,
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
    if (!editForm.nome || !editForm.cognome) {
      toast.error("Nome e Cognome sono obbligatori");
      return;
    }
    try {
      await salvaProfilo(editForm);
      setAnagraficaModalOpen(false);
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
                  <div className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                    <Clock className="size-3 text-zinc-400" />
                    <span>
                      Disdetta min: <strong>{atleta.tempo_cancellazione_ore || 24} ore</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
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

            <div className="grid grid-cols-2 gap-2">
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
                  Crediti Iniziali
                </label>
                <Input
                  type="number"
                  value={editForm.crediti ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, crediti: Number(e.target.value) })}
                  placeholder="0"
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
    </div>
  );
}
