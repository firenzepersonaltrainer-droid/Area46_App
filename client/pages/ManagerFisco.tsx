import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useLabConfig,
  useProfili,
  getStoredStripeCredentials,
  saveStoredStripeCredentials,
  saveDeletedTxId,
  isTxDeleted,
} from "../lib/useUser";
import {
  Settings,
  Building2,
  Receipt,
  CheckCircle2,
  ShieldCheck,
  Copy,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  CreditCard,
  KeyRound,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  Search,
  Download,
  Users,
  Clock,
  Trash2,
  AlertTriangle,
  PlusCircle,
  Coins,
  Banknote,
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

interface Transazione {
  codice_transazione: string;
  email_cliente: string;
  nome_cliente: string;
  codice_fiscale?: string;
  indirizzo?: string;
  id_pacchetto: string;
  nome_pacchetto: string;
  importo_euro: number;
  metodo: string;
  crediti_acquistati: number;
  debiti_decurtati: number;
  crediti_effettivi_aggiunti: number;
  causale_bonifico?: string;
  stato: "completato" | "in_attesa_bonifico";
  created_at: string;
}

export default function ManagerFiscoPage() {
  const queryClient = useQueryClient();
  const { config, aggiornaConfig } = useLabConfig();
  const { profili } = useProfili();

  // Stripe local state - precaricato immediatamente dal vault locale del browser
  const initialStored = useMemo(() => getStoredStripeCredentials(), []);
  const [stripeMode, setStripeMode] = useState<"test" | "live">(
    initialStored?.stripe_mode || config?.stripe_mode || "live"
  );
  const [stripePublishableKey, setStripePublishableKey] = useState(
    initialStored?.stripe_publishable_key || config?.stripe_publishable_key || ""
  );
  const [stripeSecretKey, setStripeSecretKey] = useState(
    initialStored?.stripe_secret_key || config?.stripe_secret_key || ""
  );
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState(
    initialStored?.stripe_webhook_secret || config?.stripe_webhook_secret || ""
  );
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isTestingStripe, setIsTestingStripe] = useState(false);
  const [isSavingStripe, setIsSavingStripe] = useState(false);
  const [stripeTestStatus, setStripeTestStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Modale Backup / Ripristino Rapido Credenziali
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupInput, setBackupInput] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();

  // Modale Registrazione Versamento Manuale
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualAtletaId, setManualAtletaId] = useState("");
  const [manualImporto, setManualImporto] = useState<string>("890");
  const [manualMetodo, setManualMetodo] = useState<"bonifico" | "contanti" | "pos" | "altro">("bonifico");
  const [manualData, setManualData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [manualPackId, setManualPackId] = useState<string>("pack-36");
  const [manualDescrizione, setManualDescrizione] = useState<string>("Pacchetto Lab 36");
  const [manualAccreditaCrediti, setManualAccreditaCrediti] = useState<boolean>(false);
  const [manualCrediti, setManualCrediti] = useState<number>(0);
  const [manualGiorniValidita, setManualGiorniValidita] = useState<number>(84);
  const [manualNote, setManualNote] = useState<string>("");

  // Tariffario pacchetti
  const { data: pacchetti = [] } = useQuery<any[]>({
    queryKey: ["tariffario"],
    queryFn: async () => {
      const res = await fetch("/app-api/tariffario");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Filtri Registro Incassi
  const [filtroPeriodo, setFiltroPeriodo] = useState<
    "tutti" | "questo_mese" | "mese_scorso" | "quest_anno" | "custom"
  >("tutti");
  const [filtroDataDa, setFiltroDataDa] = useState("");
  const [filtroDataA, setFiltroDataA] = useState("");
  const [filtroAtleta, setFiltroAtleta] = useState("tutti");
  const [filtroMetodo, setFiltroMetodo] = useState<"tutti" | "stripe" | "bonifico" | "contanti" | "pos">("tutti");
  const [filtroStato, setFiltroStato] = useState<"tutti" | "completato" | "in_attesa_bonifico">("tutti");
  const [searchTx, setSearchTx] = useState("");

  // Modale Eliminazione Movimento Fiscale (elimina solo la transazione e ricalcola il registro incassi)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [txDaCancellare, setTxDaCancellare] = useState<Transazione | null>(null);

  const eliminaTxMutation = useMutation({
    mutationFn: async (codiceOrId: string) => {
      // 1. Memorizza istantaneamente l'ID cancellato nel vault permanente locale
      saveDeletedTxId(codiceOrId);

      const res = await fetch(`/app-api/transazioni/${encodeURIComponent(codiceOrId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore durante l'eliminazione del movimento fiscale");
      }
      return res.json();
    },
    onSuccess: (_, codiceOrId) => {
      // 2. Rimuove all'istante il record dalla cache React Query
      queryClient.setQueryData<Transazione[]>(["transazioni"], (old = []) => {
        return old.filter(
          (t) => t.codice_transazione !== codiceOrId && (t as any).id !== codiceOrId && !isTxDeleted(t.codice_transazione)
        );
      });
      queryClient.invalidateQueries({ queryKey: ["transazioni"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      setDeleteModalOpen(false);
      setTxDaCancellare(null);
      toast.success("Movimento fiscale eliminato in modo definitivo. Registro incassi ricalcolato.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante l'eliminazione");
    },
  });

  const handleOpenDeleteTx = (tx: Transazione) => {
    setTxDaCancellare(tx);
    setDeleteModalOpen(true);
  };

  const handleConfirmDeleteTx = async () => {
    if (!txDaCancellare) return;
    await eliminaTxMutation.mutateAsync(txDaCancellare.codice_transazione || txDaCancellare.id);
  };

  // Sync with config on load - non sovrascrive mai dati locali validi con stringhe vuote
  useEffect(() => {
    const stored = getStoredStripeCredentials();
    if (config) {
      if (config.stripe_mode) {
        setStripeMode(config.stripe_mode);
      } else if (stored?.stripe_mode) {
        setStripeMode(stored.stripe_mode);
      }

      if (config.stripe_publishable_key) {
        setStripePublishableKey(config.stripe_publishable_key);
      } else if (stored?.stripe_publishable_key) {
        setStripePublishableKey(stored.stripe_publishable_key);
      }

      if (config.stripe_secret_key) {
        setStripeSecretKey(config.stripe_secret_key);
      } else if (stored?.stripe_secret_key) {
        setStripeSecretKey(stored.stripe_secret_key);
      }

      if (config.stripe_webhook_secret) {
        setStripeWebhookSecret(config.stripe_webhook_secret);
      } else if (stored?.stripe_webhook_secret) {
        setStripeWebhookSecret(stored.stripe_webhook_secret);
      }

      // Se il server ha la chiave ma il local storage no, memorizzala localmente
      if (config.stripe_secret_key && !stored?.stripe_secret_key) {
        saveStoredStripeCredentials({
          stripe_mode: config.stripe_mode,
          stripe_publishable_key: config.stripe_publishable_key,
          stripe_secret_key: config.stripe_secret_key,
          stripe_webhook_secret: config.stripe_webhook_secret,
        });
      } else if (!config.stripe_secret_key && stored?.stripe_secret_key) {
        // Se il client ha le chiavi nel local vault ma il server non le ha ancora (es. dopo cold start), reidrata subito il backend
        aggiornaConfig({
          stripe_mode: stored.stripe_mode || "live",
          stripe_publishable_key: stored.stripe_publishable_key,
          stripe_secret_key: stored.stripe_secret_key,
          stripe_webhook_secret: stored.stripe_webhook_secret,
          stripe_collegato: true,
        }).catch(() => {});
      }
    }
  }, [config]);

  // Query Transazioni - filtrando via i movimenti cancellati permanentemente
  const { data: transazioni = [] } = useQuery<Transazione[]>({
    queryKey: ["transazioni"],
    queryFn: async () => {
      const res = await fetch("/app-api/transazioni");
      if (!res.ok) throw new Error("Errore recupero transazioni");
      const list: Transazione[] = await res.json();
      return list.filter((t) => !isTxDeleted(t.codice_transazione) && !isTxDeleted((t as any).id));
    },
    refetchInterval: 10000,
  });

  // Atleti per il selettore
  const atleti = useMemo(() => {
    return profili.filter((p) => p.ruolo === "atleta");
  }, [profili]);

  // Mutation Registrazione Versamento Manuale
  const registraVersamentoMutation = useMutation({
    mutationFn: async (payload: {
      atleta_id: string;
      importo_euro: number;
      metodo: string;
      id_pacchetto?: string;
      nome_pacchetto?: string;
      data_pagamento?: string;
      crediti_da_accreditare?: number;
      giorni_validita?: number;
      note?: string;
    }) => {
      const res = await fetch("/app-api/transazioni/manuale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante la registrazione del versamento");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transazioni"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      setManualModalOpen(false);
      toast.success(data.messaggio || "Versamento registrato con successo nel Registro Fisco!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante la registrazione del versamento");
    },
  });

  const handleOpenManualModal = (preselectedAthleteIdOrEmail?: string) => {
    let target = preselectedAthleteIdOrEmail;
    if (!target && atleti.length > 0) {
      target = atleti[0].id;
    }
    setManualAtletaId(target || "");
    setManualImporto("890");
    setManualMetodo("bonifico");
    setManualData(new Date().toISOString().slice(0, 10));
    setManualPackId("pack-36");
    setManualDescrizione("Pacchetto Lab 36");
    setManualAccreditaCrediti(false);
    setManualCrediti(0);
    setManualGiorniValidita(84);
    setManualNote("");
    setManualModalOpen(true);
  };

  const handlePackChange = (packId: string) => {
    setManualPackId(packId);
    if (packId === "manuale") {
      setManualDescrizione("Versamento Manuale / Bonifico");
    } else {
      const p = pacchetti.find((item) => item.id === packId);
      if (p) {
        setManualDescrizione(p.nome);
        setManualImporto(String(p.prezzo_euro));
        if (manualAccreditaCrediti) {
          setManualCrediti(p.crediti);
        }
        setManualGiorniValidita(p.giorni_validita || 60);
      }
    }
  };

  const handleToggleAccredita = (enable: boolean) => {
    setManualAccreditaCrediti(enable);
    if (enable) {
      const p = pacchetti.find((item) => item.id === manualPackId);
      setManualCrediti(p ? p.crediti : 10);
    } else {
      setManualCrediti(0);
    }
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const imp = parseFloat(manualImporto.replace(",", "."));
    if (isNaN(imp) || imp <= 0) {
      toast.error("Inserisci un importo valido in Euro maggiore di zero");
      return;
    }
    if (!manualAtletaId) {
      toast.error("Seleziona l'atleta destinatario del versamento");
      return;
    }

    await registraVersamentoMutation.mutateAsync({
      atleta_id: manualAtletaId,
      importo_euro: imp,
      metodo: manualMetodo,
      id_pacchetto: manualPackId,
      nome_pacchetto: manualDescrizione.trim() || "Versamento Manuale",
      data_pagamento: manualData,
      crediti_da_accreditare: manualAccreditaCrediti ? Number(manualCrediti) || 0 : 0,
      giorni_validita: manualAccreditaCrediti ? Number(manualGiorniValidita) || 60 : undefined,
      note: manualNote.trim(),
    });
  };

  useEffect(() => {
    const action = searchParams.get("action");
    const emailParam = searchParams.get("email");
    if (action === "versamento" && emailParam) {
      const found = profili.find(
        (p) => p.email?.toLowerCase() === emailParam.toLowerCase() || p.id === emailParam
      );
      handleOpenManualModal(found?.id || emailParam);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, profili]);

  // Test Stripe Connection
  const handleTestStripe = async () => {
    const keyToTest = stripeSecretKey.trim() || config?.stripe_secret_key;
    if (!keyToTest) {
      toast.error("Inserisci la Stripe Secret Key prima di eseguire il test.");
      return;
    }
    setIsTestingStripe(true);
    setStripeTestStatus(null);
    try {
      const res = await fetch("/app-api/config/stripe/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stripe_mode: stripeMode,
          stripe_secret_key: keyToTest,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore durante il test di connessione.");
      setStripeTestStatus({
        ok: true,
        message: data.message || "Connessione riuscita! Il tuo account Stripe è pronto a incassare.",
      });
      toast.success("Connessione a Stripe stabilita con successo!");
    } catch (err: any) {
      setStripeTestStatus({
        ok: false,
        message: err.message || "Impossibile collegarsi a Stripe con questa Secret Key.",
      });
      toast.error(err.message || "Errore connessione Stripe");
    } finally {
      setIsTestingStripe(false);
    }
  };

  // Salva Configurazione Stripe
  const handleSaveStripeConfig = async () => {
    setIsSavingStripe(true);
    try {
      const credsToSave = {
        stripe_mode: stripeMode,
        stripe_publishable_key: stripePublishableKey.trim(),
        stripe_secret_key: stripeSecretKey.trim(),
        stripe_webhook_secret: stripeWebhookSecret.trim(),
      };
      // 1. Memorizza istantaneamente nel vault sicuro locale del dispositivo
      saveStoredStripeCredentials(credsToSave);

      // 2. Invia al backend
      await aggiornaConfig({
        ...credsToSave,
        stripe_collegato: !!(stripeSecretKey.trim() && (stripeSecretKey.trim().startsWith("sk_") || stripeSecretKey.trim().startsWith("rk_"))),
      });
      toast.success("Credenziali Stripe salvate e memorizzate in modo permanente!");
    } catch (err: any) {
      toast.error(err.message || "Errore durante il salvataggio");
    } finally {
      setIsSavingStripe(false);
    }
  };

  const handleCopyBackup = () => {
    const creds = {
      stripe_mode: stripeMode,
      stripe_publishable_key: stripePublishableKey.trim(),
      stripe_secret_key: stripeSecretKey.trim(),
      stripe_webhook_secret: stripeWebhookSecret.trim(),
    };
    navigator.clipboard.writeText(JSON.stringify(creds, null, 2));
    toast.success("Credenziali Stripe copiate negli appunti per il trasferimento!");
  };

  const handleApplyBackup = async () => {
    try {
      const parsed = JSON.parse(backupInput.trim());
      if (!parsed.stripe_secret_key && !parsed.stripe_publishable_key) {
        toast.error("Formato backup non valido. Chiavi Stripe mancanti.");
        return;
      }
      if (parsed.stripe_mode) setStripeMode(parsed.stripe_mode);
      if (parsed.stripe_publishable_key) setStripePublishableKey(parsed.stripe_publishable_key.trim());
      if (parsed.stripe_secret_key) setStripeSecretKey(parsed.stripe_secret_key.trim());
      if (parsed.stripe_webhook_secret) setStripeWebhookSecret(parsed.stripe_webhook_secret.trim());

      saveStoredStripeCredentials(parsed);
      await aggiornaConfig({
        ...parsed,
        stripe_collegato: !!(parsed.stripe_secret_key && (parsed.stripe_secret_key.startsWith("sk_") || parsed.stripe_secret_key.startsWith("rk_"))),
      });
      setBackupModalOpen(false);
      setBackupInput("");
      toast.success("Backup Stripe ripristinato con successo!");
    } catch {
      toast.error("Errore nella lettura del backup. Incolla un formato JSON valido.");
    }
  };

  // Mutation Approvazione Bonifico
  const approvaBonificoMutation = useMutation({
    mutationFn: async (codice: string) => {
      const res = await fetch(`/app-api/transazioni/${codice}/approva-bonifico`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore approvazione bonifico");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transazioni"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Bonifico approvato! Crediti aggiunti al wallet dell'atleta.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore approvazione bonifico");
    },
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FILTRI REGISTRO INCASSI
  // ───────────────────────────────────────────────────────────────────────────
  const filteredTransazioni = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    return transazioni.filter((tx) => {
      const txDate = new Date(tx.created_at);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();

      // Filtro Periodo
      if (filtroPeriodo === "questo_mese") {
        if (txYear !== currentYear || txMonth !== currentMonth) return false;
      } else if (filtroPeriodo === "mese_scorso") {
        const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        if (txYear !== prevMonthYear || txMonth !== prevMonth) return false;
      } else if (filtroPeriodo === "quest_anno") {
        if (txYear !== currentYear) return false;
      } else if (filtroPeriodo === "custom") {
        if (filtroDataDa) {
          const daTs = new Date(filtroDataDa + "T00:00:00").getTime();
          if (txDate.getTime() < daTs) return false;
        }
        if (filtroDataA) {
          const aTs = new Date(filtroDataA + "T23:59:59").getTime();
          if (txDate.getTime() > aTs) return false;
        }
      }

      // Filtro Atleta
      if (filtroAtleta !== "tutti") {
        if (tx.email_cliente?.toLowerCase() !== filtroAtleta.toLowerCase()) return false;
      }

      // Filtro Metodo
      if (filtroMetodo !== "tutti") {
        const metodoLower = (tx.metodo || "").toLowerCase();
        if (filtroMetodo === "stripe" && !metodoLower.includes("stripe") && !metodoLower.includes("carta")) {
          return false;
        }
        if (filtroMetodo === "bonifico" && !metodoLower.includes("bonifico")) {
          return false;
        }
        if (filtroMetodo === "contanti" && !metodoLower.includes("contant")) {
          return false;
        }
        if (filtroMetodo === "pos" && !metodoLower.includes("pos")) {
          return false;
        }
      }

      // Filtro Stato
      if (filtroStato !== "tutti") {
        if (tx.stato !== filtroStato) return false;
      }

      // Ricerca Libera
      if (searchTx.trim()) {
        const q = searchTx.toLowerCase().trim();
        const matchName = tx.nome_cliente?.toLowerCase().includes(q);
        const matchEmail = tx.email_cliente?.toLowerCase().includes(q);
        const matchCF = tx.codice_fiscale?.toLowerCase().includes(q);
        const matchCode = tx.codice_transazione?.toLowerCase().includes(q);
        const matchPack = tx.nome_pacchetto?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchCF && !matchCode && !matchPack) {
          return false;
        }
      }

      return true;
    });
  }, [
    transazioni,
    filtroPeriodo,
    filtroDataDa,
    filtroDataA,
    filtroAtleta,
    filtroMetodo,
    filtroStato,
    searchTx,
  ]);

  // Calcolo KPI sui record filtrati
  const kpiStats = useMemo(() => {
    const completati = filteredTransazioni.filter((t) => t.stato === "completato");
    const pending = filteredTransazioni.filter((t) => t.stato === "in_attesa_bonifico");

    const totaleIncassato = completati.reduce((acc, t) => acc + (t.importo_euro || 0), 0);
    const numeroIncassi = completati.length;
    const mediaTransazione = numeroIncassi > 0 ? totaleIncassato / numeroIncassi : 0;
    const totaleInAttesa = pending.reduce((acc, t) => acc + (t.importo_euro || 0), 0);

    return {
      totaleIncassato,
      numeroIncassi,
      mediaTransazione,
      totaleInAttesa,
      numeroInAttesa: pending.length,
    };
  }, [filteredTransazioni]);

  // Copia dati per InvoiceBuddy / Fisco
  const copyInvoiceBuddyData = (tx?: Transazione) => {
    if (tx) {
      const line = `${tx.created_at.slice(0, 10)}\t${tx.nome_cliente}\t${
        tx.codice_fiscale || "N/D"
      }\t${tx.importo_euro}\t${tx.nome_pacchetto}\t${tx.metodo.toUpperCase()}\tRegime Forfettario`;
      navigator.clipboard.writeText(line);
      toast.success("Dati transazione copiati negli appunti!");
    } else {
      const header = "Data\tNome Cliente\tCodice Fiscale\tImporto (€)\tPacchetto\tMetodo\tRegime Fiscale";
      const rows = filteredTransazioni
        .filter((t) => t.stato === "completato")
        .map(
          (t) =>
            `${t.created_at.slice(0, 10)}\t${t.nome_cliente}\t${t.codice_fiscale || "N/D"}\t${
              t.importo_euro
            }\t${t.nome_pacchetto}\t${t.metodo.toUpperCase()}\tRegime Forfettario`
        );
      const fullTsv = [header, ...rows].join("\n");
      navigator.clipboard.writeText(fullTsv);
      toast.success(`${rows.length} transazioni copiate per InvoiceBuddy / Excel!`);
    }
  };

  const isStripeConnected = !!(
    config?.stripe_collegato ||
    (config?.stripe_secret_key && (config.stripe_secret_key.startsWith("sk_") || config.stripe_secret_key.startsWith("rk_"))) ||
    (stripeSecretKey && (stripeSecretKey.trim().startsWith("sk_") || stripeSecretKey.trim().startsWith("rk_")))
  );

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#09090b] text-[#e3ff00] border border-[#e3ff00]/40">
              Pannello Manager
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-zinc-900 mt-1 flex items-center gap-2">
            <Settings className="size-5 text-[#1c00ff]" />
            Fisco, Incassi & Pagamenti
          </h1>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SEZIONE 1: STRIPE CONNECT & INCASSI DIRETTI SU CONTO */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-white border-2 border-indigo-100 shadow-sm space-y-4">
        {/* Titolo e Badge Stato */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-indigo-50 text-[#1c00ff] border border-indigo-200">
              <CreditCard className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-zinc-900">
                  Stripe & Incassi Bancari Diretti
                </h2>
              </div>
              <p className="text-[11px] text-zinc-500">
                Incassi con carta, Apple Pay e Google Pay accreditati direttamente sul tuo conto corrente.
              </p>
            </div>
          </div>

          {/* Badge Stato Connessione (Senza scritta Demo Mode) */}
          <div className="flex items-center gap-1.5 self-start sm:self-center">
            {isStripeConnected ? (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  config?.stripe_mode === "live"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-blue-50 text-blue-700 border-blue-300"
                }`}
              >
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {config?.stripe_mode === "live" ? "Live • Incassi Reali Attivi" : "Test • Sandbox Attiva"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-300">
                <span className="size-1.5 rounded-full bg-zinc-400" />
                In attesa di credenziali Stripe
              </span>
            )}
          </div>
        </div>

        {/* Banner esplicativo Incasso Diretto */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 text-xs flex items-start gap-2.5 leading-relaxed">
          <Zap className="size-4 text-[#1c00ff] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-[11px] text-indigo-900">
              100% Incassi Diretti sul tuo IBAN Bancario (Senza Intermediari)
            </p>
            <p className="text-[11px] text-indigo-800">
              I versamenti effettuati dagli atleti per i <strong>Pacchetti Lab</strong> confluiscono direttamente da Stripe sul tuo IBAN bancario impostato nel tuo account Stripe. I crediti acquistati vengono accreditati all&apos;atleta all&apos;istante in totale sicurezza.
            </p>
          </div>
        </div>

        {/* Campi Credenziali API Stripe */}
        <div className="space-y-3 text-xs pt-1">
          <div>
            <label className="text-[10px] font-bold uppercase text-zinc-600 block mb-1">
              Stripe Publishable Key ({stripeMode === "live" ? "pk_live_..." : "pk_test_..."})
            </label>
            <Input
              value={stripePublishableKey}
              onChange={(e) => setStripePublishableKey(e.target.value)}
              placeholder={stripeMode === "live" ? "pk_live_..." : "pk_test_..."}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase text-zinc-600">
                Stripe Secret Key ({stripeMode === "live" ? "sk_live_..." : "sk_test_..."})
              </label>
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="text-[10px] text-zinc-500 hover:text-zinc-800 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {showSecretKey ? (
                  <>
                    <EyeOff className="size-3" /> Nascondi
                  </>
                ) : (
                  <>
                    <Eye className="size-3" /> Mostra
                  </>
                )}
              </button>
            </div>
            <Input
              type={showSecretKey ? "text" : "password"}
              value={stripeSecretKey}
              onChange={(e) => setStripeSecretKey(e.target.value)}
              placeholder={stripeMode === "live" ? "sk_live_..." : "sk_test_..."}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-zinc-600 block mb-1">
              Stripe Webhook Signing Secret (whsec_...)
            </label>
            <Input
              type={showSecretKey ? "text" : "password"}
              value={stripeWebhookSecret}
              onChange={(e) => setStripeWebhookSecret(e.target.value)}
              placeholder="whsec_..."
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Esito Test Connessione */}
        {stripeTestStatus && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-start gap-2 border ${
              stripeTestStatus.ok
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-red-50 text-red-900 border-red-200"
            }`}
          >
            {stripeTestStatus.ok ? (
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <span className="font-bold">
                {stripeTestStatus.ok ? "Test superato:" : "Errore connessione:"}
              </span>{" "}
              <span>{stripeTestStatus.message}</span>
            </div>
          </div>
        )}

        {/* Banner Persistenza Permanente & Backup/Ripristino */}
        <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className={`size-2.5 rounded-full shrink-0 ${isStripeConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
            <div>
              <p className="font-bold text-[11px] text-zinc-900 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                {isStripeConnected
                  ? "Memorizzazione Permanente Attiva nel Vault del Dispositivo"
                  : "Nessuna chiave Stripe salvata in memoria"}
              </p>
              <p className="text-[10px] text-zinc-500">
                {isStripeConnected
                  ? "Le chiavi rimangono memorizzate su questo dispositivo e non andranno perse ad ogni riavvio o nuovo accesso."
                  : "Inserisci le chiavi del tuo account Stripe e premi Salva per memorizzarle in modo permanente."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
            {isStripeConnected && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyBackup}
                title="Copia chiavi per esportarle o fare backup"
                className="h-7 px-2.5 text-[10px] font-bold rounded-lg border-zinc-200 text-zinc-700 hover:bg-zinc-100 flex items-center gap-1 cursor-pointer"
              >
                <Copy className="size-3 text-zinc-500" />
                <span>Copia Backup</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBackupInput("");
                setBackupModalOpen(true);
              }}
              title="Incolla e ripristina credenziali da un altro dispositivo"
              className="h-7 px-2.5 text-[10px] font-bold rounded-lg border-zinc-200 text-zinc-700 hover:bg-zinc-100 flex items-center gap-1 cursor-pointer"
            >
              <Download className="size-3 text-zinc-500" />
              <span>Ripristina</span>
            </Button>
          </div>
        </div>

        {/* Pulsanti Azione Stripe */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-zinc-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestStripe}
            disabled={isTestingStripe}
            className="text-xs font-bold rounded-xl border-zinc-300 text-zinc-800 hover:bg-zinc-100 flex items-center justify-center gap-1.5"
          >
            <KeyRound className="size-3.5 text-[#1c00ff]" />
            <span>{isTestingStripe ? "Verifica in corso..." : "Verifica Connessione Stripe"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSaveStripeConfig}
            disabled={isSavingStripe}
            className="text-xs font-black rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Check className="size-3.5" />
            <span>{isSavingStripe ? "Salvataggio..." : "Salva Credenziali Stripe"}</span>
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SEZIONE 2: COORDINATE BONIFICO PER I CLIENTI */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-3xl bg-white border border-zinc-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-[#1c00ff]" />
          <div>
            <h2 className="text-sm font-black text-zinc-900">
              Coordinate Bonifico per i Clienti
            </h2>
            <p className="text-[11px] text-zinc-500">
              Visualizzate dagli atleti durante il checkout tramite bonifico bancario.
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
              IBAN Lab
            </label>
            <Input
              value={config?.iban || ""}
              onChange={(e) => aggiornaConfig({ iban: e.target.value })}
              className="font-mono text-xs"
              placeholder="IT00..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Intestatario
              </label>
              <Input
                value={config?.intestatario_iban || ""}
                onChange={(e) => aggiornaConfig({ intestatario_iban: e.target.value })}
                className="text-xs"
                placeholder="Nome / Ragione Sociale"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Banca
              </label>
              <Input
                value={config?.banca || ""}
                onChange={(e) => aggiornaConfig({ banca: e.target.value })}
                className="text-xs"
                placeholder="Istituto di Credito"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SEZIONE 3: REGISTRO INCASSI & FATTURAZIONE (AVANZATO CON FILTRI) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-4">
        {/* Header Registro */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-zinc-900 text-[#e3ff00]">
              <Receipt className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-900">
                Registro Incassi & Fatturazione
              </h2>
              <p className="text-[11px] text-zinc-500">
                Riepilogo fiscale versamenti per Regime Forfettario e InvoiceBuddy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => handleOpenManualModal()}
              className="text-xs font-black bg-[#1c00ff] text-white hover:bg-[#1600cc] h-8 px-3 rounded-xl flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
            >
              <PlusCircle className="size-3.5" />
              <span>Registra Versamento</span>
            </Button>

            <Button
              size="sm"
              onClick={() => copyInvoiceBuddyData()}
              className="text-xs font-black bg-zinc-900 text-white hover:bg-zinc-800 h-8 px-3 rounded-xl flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
            >
              <Copy className="size-3.5 text-[#e3ff00]" />
              <span>Copia Filtrati ({filteredTransazioni.filter((t) => t.stato === "completato").length})</span>
            </Button>
          </div>
        </div>

        {/* KPI CARDS INCASSI (DINAMICHE SUI FILTRI) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
              Totale Incassato
            </span>
            <div className="text-xl font-black text-emerald-950 mt-1 tabular-nums">
              {kpiStats.totaleIncassato.toLocaleString("it-IT", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              €
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">
              Nel periodo selezionato
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
              Transazioni
            </span>
            <div className="text-xl font-black text-zinc-900 mt-1 tabular-nums">
              {kpiStats.numeroIncassi}
            </div>
            <span className="text-[10px] text-zinc-500 font-medium">
              Pagamenti completati
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
              Media / Transazione
            </span>
            <div className="text-xl font-black text-[#1c00ff] mt-1 tabular-nums">
              {kpiStats.mediaTransazione.toLocaleString("it-IT", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              €
            </div>
            <span className="text-[10px] text-zinc-500 font-medium">
              Spesa media per carnet
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
              In Attesa Bonifico
            </span>
            <div className="text-xl font-black text-amber-950 mt-1 tabular-nums">
              {kpiStats.totaleInAttesa.toLocaleString("it-IT", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              €
            </div>
            <span className="text-[10px] text-amber-700 font-medium">
              {kpiStats.numeroInAttesa} {kpiStats.numeroInAttesa === 1 ? "da approvare" : "da approvare"}
            </span>
          </div>
        </div>

        {/* BARRA FILTRI AVANZATI */}
        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-black text-zinc-700 uppercase tracking-wide">
            <Filter className="size-3.5 text-[#1c00ff]" />
            <span>Filtra Registro</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {/* Periodo */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Periodo Temporale
              </label>
              <select
                value={filtroPeriodo}
                onChange={(e) => setFiltroPeriodo(e.target.value as any)}
                className="w-full text-xs font-bold bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 text-zinc-800 focus:outline-[#1c00ff]"
              >
                <option value="tutti">Tutto lo storico</option>
                <option value="questo_mese">Questo Mese</option>
                <option value="mese_scorso">Mese Scorso</option>
                <option value="quest_anno">Anno in corso</option>
                <option value="custom">Intervallo personalizzato</option>
              </select>
            </div>

            {/* Atleta */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Filtra per Atleta
              </label>
              <select
                value={filtroAtleta}
                onChange={(e) => setFiltroAtleta(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 text-zinc-800 focus:outline-[#1c00ff]"
              >
                <option value="tutti">Tutti gli atleti ({atleti.length})</option>
                {atleti.map((a) => (
                  <option key={a.id} value={a.email}>
                    {a.nome} {a.cognome}
                  </option>
                ))}
              </select>
            </div>

            {/* Metodo */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Metodo di Pagamento
              </label>
              <select
                value={filtroMetodo}
                onChange={(e) => setFiltroMetodo(e.target.value as any)}
                className="w-full text-xs font-bold bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 text-zinc-800 focus:outline-[#1c00ff]"
              >
                <option value="tutti">Tutti i metodi</option>
                <option value="stripe">Stripe / Carta / Apple Pay</option>
                <option value="bonifico">Bonifico Bancario</option>
                <option value="contanti">Contanti</option>
                <option value="pos">POS Fisico / Carta</option>
              </select>
            </div>

            {/* Ricerca per Testo */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Cerca (Nome / CF / Codice)
              </label>
              <div className="relative">
                <Search className="size-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTx}
                  onChange={(e) => setSearchTx(e.target.value)}
                  placeholder="Es. Matteo Calosci o CF..."
                  className="w-full text-xs bg-white border border-zinc-200 rounded-xl pl-8 pr-2.5 py-1.5 text-zinc-800 focus:outline-[#1c00ff]"
                />
              </div>
            </div>
          </div>

          {/* Date Picker Custom (se selezionato) */}
          {filtroPeriodo === "custom" && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-200/80">
              <div>
                <label className="text-[9px] font-bold uppercase text-zinc-500 block mb-0.5">
                  Dal Giorno
                </label>
                <Input
                  type="date"
                  value={filtroDataDa}
                  onChange={(e) => setFiltroDataDa(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase text-zinc-500 block mb-0.5">
                  Al Giorno
                </label>
                <Input
                  type="date"
                  value={filtroDataA}
                  onChange={(e) => setFiltroDataA(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
          )}
        </div>

        {/* TABELLA / LISTA TRANSAZIONI FILTRATE */}
        <div className="space-y-2">
          {filteredTransazioni.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 text-xs">
              Nessuna transazione trovata con i filtri selezionati.
            </div>
          ) : (
            filteredTransazioni.map((tx) => {
              const isPendingBonifico = tx.stato === "in_attesa_bonifico";

              return (
                <div
                  key={tx.codice_transazione}
                  className={`p-3.5 rounded-2xl border text-xs space-y-2.5 shadow-2xs ${
                    isPendingBonifico
                      ? "bg-amber-50/70 border-amber-200"
                      : "bg-zinc-50 border-zinc-200/90"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-zinc-900">
                          {tx.nome_cliente}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                            isPendingBonifico
                              ? "bg-amber-200 text-amber-900 border border-amber-300"
                              : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          }`}
                        >
                          {isPendingBonifico ? "In attesa bonifico" : "Incassato"}
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-zinc-700">
                          {tx.created_at.slice(0, 10)}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-zinc-800">
                          {tx.nome_pacchetto}
                        </span>
                        <span>•</span>
                        <span className="uppercase text-[10px] font-bold text-zinc-600 bg-zinc-200/70 px-1.5 py-0.2 rounded">
                          {tx.metodo}
                        </span>
                      </div>

                      {tx.codice_fiscale && (
                        <div className="text-[10px] font-mono text-zinc-600 mt-0.5">
                          CF: <strong className="text-zinc-800">{tx.codice_fiscale}</strong>
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-zinc-950 tabular-nums">
                        {tx.importo_euro.toLocaleString("it-IT", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        €
                      </div>
                      <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                        +{tx.crediti_effettivi_aggiunti} crediti
                      </div>
                    </div>
                  </div>

                  {/* RIGA INFERIORE: CODICE TRANSAZIONE & AZIONI */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200/70 text-[10px]">
                    <span className="text-zinc-400 font-mono">
                      ID: {tx.codice_transazione}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isPendingBonifico ? (
                        <Button
                          size="sm"
                          onClick={() => approvaBonificoMutation.mutate(tx.codice_transazione)}
                          disabled={approvaBonificoMutation.isPending}
                          className="h-7 text-[11px] font-black bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xs"
                        >
                          Approva & Accredita
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInvoiceBuddyData(tx)}
                          className="h-6 text-[10px] font-bold text-zinc-600 hover:text-zinc-900 px-2 rounded-lg"
                        >
                          <Copy className="size-2.5 mr-1" /> Copia Riga InvoiceBuddy
                        </Button>
                      )}

                      {/* TASTO CANCELLA MOVIMENTO DAL REGISTRO FISCO */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDeleteTx(tx)}
                        className="h-6 text-[10px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 rounded-lg flex items-center gap-1 cursor-pointer"
                        title="Elimina esclusivamente questo movimento dal registro incassi del fisco"
                      >
                        <Trash2 className="size-2.5" />
                        <span>Cancella</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PREDISPOSIZIONE FUTURA APP STANDALONE FATTURAZIONE */}
        <div className="p-3.5 rounded-2xl bg-zinc-900 text-white text-xs space-y-1.5 mt-4">
          <div className="flex items-center gap-1.5 text-[#e3ff00] font-black text-[11px] uppercase tracking-wider">
            <Sparkles className="size-3.5" />
            Predisposizione Standalone App Fatture
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            Come concordato, per non appesantire quest&apos;app con le ore di personal fuori dal Lab e la numerazione progressiva, la struttura dei pagamenti espone nativamente l&apos;endpoint <code>/app-api/transazioni</code>. Quando realizzeremo l&apos;app autonoma dedicata, comunicheranno istantaneamente a costo zero.
          </p>
        </div>
      </div>

      {/* MODALE DI CONFERMA CANCELLAZIONE MOVIMENTO DA FISCO */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <div className="mx-auto size-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-2 border border-red-200">
            <AlertTriangle className="size-6 text-red-600" />
          </div>

          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-black text-zinc-900">
              Conferma Eliminazione Movimento Fiscale
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 mt-1">
              Elimina solo questa registrazione dal registro Fisco. L&apos;atleta e le sue prenotazioni rimarranno intatti nel database.
            </DialogDescription>
          </DialogHeader>

          {txDaCancellare && (
            <div className="my-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-950 space-y-2">
              <p className="font-bold text-sm text-red-900">
                Stai per eliminare il movimento di: {txDaCancellare.nome_cliente}
              </p>
              <div className="text-[11px] text-zinc-800 space-y-1 bg-white/90 p-3 rounded-xl border border-red-200 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Transazione:</span>
                  <strong>{txDaCancellare.codice_transazione}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Pacchetto:</span>
                  <strong>{txDaCancellare.nome_pacchetto}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Importo storno:</span>
                  <strong className="text-red-700">€ {txDaCancellare.importo_euro.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Data versamento:</span>
                  <span>{txDaCancellare.created_at.slice(0, 10)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Metodo:</span>
                  <span className="uppercase font-semibold">{txDaCancellare.metodo}</span>
                </div>
              </div>
              <p className="text-[11px] text-red-800/90 leading-relaxed pt-1">
                ⚠️ Il totale degli incassi e il registro fiscale verranno automaticamente ricalcolati senza questo movimento.
              </p>
              <div className="p-2 rounded-xl bg-emerald-100/70 border border-emerald-300 text-emerald-950 text-[11px] font-semibold">
                👤 <strong>Sicurezza Atleta:</strong> L&apos;atleta <em>{txDaCancellare.nome_cliente}</em>, il suo profilo e le sue prenotazioni rimarranno invariati nel database.
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="flex-1 rounded-xl"
              disabled={eliminaTxMutation.isPending}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteTx}
              disabled={eliminaTxMutation.isPending}
              className="flex-1 rounded-xl font-black bg-red-600 hover:bg-red-700 text-white"
            >
              {eliminaTxMutation.isPending ? "Eliminazione..." : "Sì, Elimina Movimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ripristino Rapido Backup Credenziali */}
      <Dialog open={backupModalOpen} onOpenChange={setBackupModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-zinc-900">
              <KeyRound className="size-5 text-[#1c00ff]" />
              Ripristina Credenziali Stripe da Backup
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 leading-relaxed">
              Incolla qui il codice JSON delle credenziali Stripe (ottenuto premendo <strong>&quot;Copia Backup&quot;</strong> da un altro computer o dispositivo) per salvarle e attivarle all&apos;istante.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <textarea
              rows={6}
              value={backupInput}
              onChange={(e) => setBackupInput(e.target.value)}
              placeholder='{ "stripe_publishable_key": "pk_live_...", "stripe_secret_key": "sk_live_...", ... }'
              className="w-full text-xs font-mono p-3 rounded-2xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c00ff] text-zinc-800"
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBackupModalOpen(false);
                setBackupInput("");
              }}
              className="flex-1 rounded-xl text-xs font-semibold"
            >
              Annulla
            </Button>
            <Button
              size="sm"
              onClick={handleApplyBackup}
              disabled={!backupInput.trim()}
              className="flex-1 rounded-xl text-xs font-black bg-[#1c00ff] text-white hover:bg-[#1600cc] shadow-xs"
            >
              Ripristina e Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE REGISTRAZIONE VERSAMENTO MANUALE FISCO */}
      <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-2xl bg-indigo-50 text-[#1c00ff] border border-indigo-200">
                <PlusCircle className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-zinc-900">
                  Registra Versamento Manuale
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  Assegna un pagamento ricevuto (bonifico, contanti o POS) al registro fiscale.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmitManual} className="space-y-3.5 text-xs pt-1">
            {/* Selettore Atleta */}
            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-600 block mb-1">
                Atleta Intestatario *
              </label>
              <select
                value={manualAtletaId}
                onChange={(e) => setManualAtletaId(e.target.value)}
                required
                className="w-full text-xs font-bold bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 focus:outline-[#1c00ff] focus:ring-1 focus:ring-[#1c00ff]"
              >
                <option value="">-- Seleziona Atleta --</option>
                {atleti.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} {a.cognome} ({a.crediti} crediti attivi) — {a.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Importo e Metodo */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-600 block mb-1">
                  Importo (€) *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={manualImporto}
                    onChange={(e) => setManualImporto(e.target.value)}
                    placeholder="890"
                    className="text-sm font-black tabular-nums pr-6"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">
                    €
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-600 block mb-1">
                  Metodo di Pagamento *
                </label>
                <select
                  value={manualMetodo}
                  onChange={(e) => setManualMetodo(e.target.value as any)}
                  className="w-full text-xs font-bold bg-white border border-zinc-300 rounded-xl px-2.5 py-2 text-zinc-900 focus:outline-[#1c00ff]"
                >
                  <option value="bonifico">🏦 Bonifico Bancario</option>
                  <option value="contanti">💵 Contanti</option>
                  <option value="pos">💳 POS Fisico / Carta</option>
                  <option value="altro">📋 Altro / Assegno</option>
                </select>
              </div>
            </div>

            {/* Data e Pacchetto di Riferimento */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-600 block mb-1">
                  Data del Pagamento *
                </label>
                <Input
                  type="date"
                  required
                  value={manualData}
                  onChange={(e) => setManualData(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-600 block mb-1">
                  Tariffa / Pacchetto
                </label>
                <select
                  value={manualPackId}
                  onChange={(e) => handlePackChange(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-zinc-300 rounded-xl px-2.5 py-2 text-zinc-900 focus:outline-[#1c00ff]"
                >
                  {pacchetti.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (€ {p.prezzo_euro})
                    </option>
                  ))}
                  <option value="manuale">Altro / Personalizzato</option>
                </select>
              </div>
            </div>

            {/* Descrizione / Causale */}
            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-600 block mb-1">
                Descrizione / Causale Fiscale
              </label>
              <Input
                type="text"
                value={manualDescrizione}
                onChange={(e) => setManualDescrizione(e.target.value)}
                placeholder="Es. Bonifico Bancario / Pacchetto Lab 36"
                className="text-xs"
              />
            </div>

            {/* Blocco Gestione Crediti */}
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-900 flex items-center gap-1.5">
                  <Coins className="size-3.5 text-amber-600" />
                  Accreditare crediti al borsellino?
                </span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="accreditaCreditiRadio"
                      checked={!manualAccreditaCrediti}
                      onChange={() => handleToggleAccredita(false)}
                      className="accent-[#1c00ff]"
                    />
                    <span>No (0 crediti)</span>
                  </label>
                  <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1c00ff] cursor-pointer">
                    <input
                      type="radio"
                      name="accreditaCreditiRadio"
                      checked={manualAccreditaCrediti}
                      onChange={() => handleToggleAccredita(true)}
                      className="accent-[#1c00ff]"
                    />
                    <span>Sì, accredita</span>
                  </label>
                </div>
              </div>

              {!manualAccreditaCrediti ? (
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  💡 <strong>Consigliato per versamenti già assegnati</strong>: il saldo crediti dell&apos;atleta non verrà toccato (utile per atleti come Alessandro Pantanella a cui i crediti sono già stati impostati all&apos;inserimento o per versamenti contabili separati).
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-200">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-zinc-600 block mb-0.5">
                      Crediti da Aggiungere
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={manualCrediti}
                      onChange={(e) => setManualCrediti(Number(e.target.value))}
                      className="text-xs font-black tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-zinc-600 block mb-0.5">
                      Giorni Validità Carnet
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={manualGiorniValidita}
                      onChange={(e) => setManualGiorniValidita(Number(e.target.value))}
                      className="text-xs tabular-nums"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Note opzionali */}
            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-600 block mb-1">
                Note Interne (Opzionali)
              </label>
              <Input
                type="text"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Es. Bonifico saldato il 28/09, rif. contabile #104"
                className="text-xs"
              />
            </div>

            <DialogFooter className="flex gap-2 pt-2 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManualModalOpen(false)}
                className="flex-1 rounded-xl text-xs font-semibold"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={registraVersamentoMutation.isPending}
                className="flex-1 rounded-xl text-xs font-black bg-[#1c00ff] text-white hover:bg-[#1600cc] shadow-xs cursor-pointer"
              >
                {registraVersamentoMutation.isPending ? "Salvataggio..." : "Salva nel Registro Fisco"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
