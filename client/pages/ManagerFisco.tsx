import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLabConfig, useProfili } from "../lib/useUser";
import {
  Settings,
  Building2,
  Receipt,
  CheckCircle2,
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
} from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
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

  // Stripe local state
  const [stripeMode, setStripeMode] = useState<"test" | "live">(config?.stripe_mode || "live");
  const [stripePublishableKey, setStripePublishableKey] = useState(config?.stripe_publishable_key || "");
  const [stripeSecretKey, setStripeSecretKey] = useState(config?.stripe_secret_key || "");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState(config?.stripe_webhook_secret || "");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isTestingStripe, setIsTestingStripe] = useState(false);
  const [isSavingStripe, setIsSavingStripe] = useState(false);
  const [stripeTestStatus, setStripeTestStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Filtri Registro Incassi
  const [filtroPeriodo, setFiltroPeriodo] = useState<
    "tutti" | "questo_mese" | "mese_scorso" | "quest_anno" | "custom"
  >("tutti");
  const [filtroDataDa, setFiltroDataDa] = useState("");
  const [filtroDataA, setFiltroDataA] = useState("");
  const [filtroAtleta, setFiltroAtleta] = useState("tutti");
  const [filtroMetodo, setFiltroMetodo] = useState<"tutti" | "stripe" | "bonifico">("tutti");
  const [filtroStato, setFiltroStato] = useState<"tutti" | "completato" | "in_attesa_bonifico">("tutti");
  const [searchTx, setSearchTx] = useState("");

  // Sync with config on load
  useEffect(() => {
    if (config) {
      if (config.stripe_mode) setStripeMode(config.stripe_mode);
      if (config.stripe_publishable_key !== undefined) setStripePublishableKey(config.stripe_publishable_key || "");
      if (config.stripe_secret_key !== undefined) setStripeSecretKey(config.stripe_secret_key || "");
      if (config.stripe_webhook_secret !== undefined) setStripeWebhookSecret(config.stripe_webhook_secret || "");
    }
  }, [config]);

  // Query Transazioni
  const { data: transazioni = [] } = useQuery<Transazione[]>({
    queryKey: ["transazioni"],
    queryFn: async () => {
      const res = await fetch("/app-api/transazioni");
      if (!res.ok) throw new Error("Errore recupero transazioni");
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Atleti per il selettore
  const atleti = useMemo(() => {
    return profili.filter((p) => p.ruolo === "atleta");
  }, [profili]);

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
      await aggiornaConfig({
        stripe_mode: stripeMode,
        stripe_publishable_key: stripePublishableKey.trim(),
        stripe_secret_key: stripeSecretKey.trim(),
        stripe_webhook_secret: stripeWebhookSecret.trim(),
        stripe_collegato: !!(stripeSecretKey.trim() && stripeSecretKey.trim().startsWith("sk_")),
      });
      toast.success("Credenziali Stripe salvate con successo!");
    } catch (err: any) {
      toast.error(err.message || "Errore durante il salvataggio");
    } finally {
      setIsSavingStripe(false);
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
    (config?.stripe_secret_key && config.stripe_secret_key.startsWith("sk_"))
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

          <Button
            size="sm"
            onClick={() => copyInvoiceBuddyData()}
            className="text-xs font-black bg-zinc-900 text-white hover:bg-zinc-800 h-8 px-3 rounded-xl flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <Copy className="size-3.5 text-[#e3ff00]" />
            <span>Copia Filtrati ({filteredTransazioni.filter((t) => t.stato === "completato").length})</span>
          </Button>
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
    </div>
  );
}
