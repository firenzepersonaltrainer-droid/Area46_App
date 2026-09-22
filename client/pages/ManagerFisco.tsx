import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLabConfig } from "../lib/useUser";
import {
  Settings,
  Clock,
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

  // Stripe local state
  const [stripeMode, setStripeMode] = useState<"test" | "live">(config?.stripe_mode || "test");
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
          stripe_publishable_key: stripePublishableKey.trim(),
          stripe_webhook_secret: stripeWebhookSecret.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Test di connessione fallito");
      }
      setStripeTestStatus({
        ok: true,
        message: data.message || "Connessione stabilita con successo!",
      });
      toast.success(data.message || "Connessione a Stripe verificata con successo!");
      queryClient.invalidateQueries({ queryKey: ["lab-config"] });
    } catch (err: any) {
      setStripeTestStatus({
        ok: false,
        message: err.message || "Impossibile comunicare con i server Stripe",
      });
      toast.error(err.message || "Errore durante il test di Stripe");
    } finally {
      setIsTestingStripe(false);
    }
  };

  // Salva Configurazione Stripe
  const handleSaveStripe = async () => {
    setIsSavingStripe(true);
    try {
      await aggiornaConfig({
        stripe_mode: stripeMode,
        stripe_publishable_key: stripePublishableKey.trim(),
        stripe_secret_key: stripeSecretKey.trim(),
        stripe_webhook_secret: stripeWebhookSecret.trim(),
        stripe_collegato: !!(stripeSecretKey.trim() && stripeSecretKey.trim().startsWith("sk_")),
      });
      toast.success("Configurazione Stripe salvata con successo!");
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

  // Copia dati per InvoiceBuddy
  const copyInvoiceBuddyData = (tx?: Transazione) => {
    if (tx) {
      const line = `Data: ${tx.created_at.slice(0, 10)} | Cliente: ${tx.nome_cliente} | CF: ${
        tx.codice_fiscale || "N/D"
      } | Importo: € ${tx.importo_euro} | Descrizione: ${tx.nome_pacchetto} (${
        tx.crediti_acquistati
      } crediti) | Regime Forfettario`;
      navigator.clipboard.writeText(line);
      toast.success("Dati fattura copiati negli appunti!");
    } else {
      const allLines = transazioni
        .filter((t) => t.stato === "completato")
        .map(
          (t) =>
            `${t.created_at.slice(0, 10)}\t${t.nome_cliente}\t${t.codice_fiscale || "N/D"}\t${
              t.importo_euro
            }\t${t.nome_pacchetto}\tRegime Forfettario`
        )
        .join("\n");
      navigator.clipboard.writeText(allLines);
      toast.success(`${transazioni.length} record copiati in formato tabellare per InvoiceBuddy!`);
    }
  };

  const handleSelectPolicyOre = async (ore: number) => {
    try {
      await aggiornaConfig({ tempo_cancellazione_ore: ore });
    } catch {
      // toast gestito da hook
    }
  };

  const policyAttiva = config?.tempo_cancellazione_ore || 24;
  const isStripeConnected = !!(config?.stripe_collegato || (config?.stripe_secret_key && config.stripe_secret_key.startsWith("sk_")));

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
            Policy, Fisco & Pagamenti
          </h1>
        </div>
      </div>

      {/* SEZIONE 1: STRIPE CONNECT & PAGAMENTI DIGITALI */}
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
                Carte, Apple Pay, Google Pay con accredito automatico sul tuo conto corrente.
              </p>
            </div>
          </div>

          {/* Badge Stato Connessione */}
          <div className="flex items-center gap-1.5 self-start sm:self-center">
            {isStripeConnected ? (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                config?.stripe_mode === "live"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "bg-blue-50 text-blue-700 border-blue-300"
              }`}>
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {config?.stripe_mode === "live" ? "Live • Incassi Reali Attivi" : "Test • Sandbox Attiva"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Demo Mode (Simulata)
              </span>
            )}
          </div>
        </div>

        {/* Banner esplicativo Incasso Diretto */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 text-xs flex items-start gap-2.5 leading-relaxed">
          <Zap className="size-4 text-[#1c00ff] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-[11px] text-indigo-900">
              100% Incassi Diretti sul tuo Conto Corrente (Senza Intermediari)
            </p>
            <p className="text-[11px] text-indigo-800">
              I pagamenti effettuati dagli atleti per i <strong>Pacchetti Lab</strong> vengono versati direttamente da Stripe sul tuo IBAN bancario impostato nel tuo account Stripe. I crediti acquistati vengono accreditati all&apos;atleta all&apos;istante in totale sicurezza.
            </p>
          </div>
        </div>

        {/* Switch Modalità Test / Live */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
            Ambiente Operativo Stripe
          </label>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <button
              type="button"
              onClick={() => setStripeMode("test")}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                stripeMode === "test"
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                  : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              <span>🧪 Modalità Test (Sandbox)</span>
            </button>
            <button
              type="button"
              onClick={() => setStripeMode("live")}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                stripeMode === "live"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-black"
                  : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              <span>🟢 Modalità Live (Incassi Veri)</span>
            </button>
          </div>
        </div>

        {/* Campi Chiavi API */}
        <div className="space-y-3 text-xs pt-1">
          <div>
            <label className="text-[10px] font-bold uppercase text-zinc-600 block mb-1">
              Stripe Publishable Key ({stripeMode === "live" ? "pk_live_..." : "pk_test_..."})
            </label>
            <Input
              value={stripePublishableKey}
              onChange={(e) => setStripePublishableKey(e.target.value)}
              placeholder={stripeMode === "live" ? "pk_live_51..." : "pk_test_51..."}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase text-zinc-600 block">
                Stripe Secret Key ({stripeMode === "live" ? "sk_live_..." : "sk_test_..."})
              </label>
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="text-[10px] text-zinc-500 hover:text-zinc-800 flex items-center gap-1 cursor-pointer"
              >
                {showSecretKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {showSecretKey ? "Nascondi" : "Mostra"}
              </button>
            </div>
            <Input
              type={showSecretKey ? "text" : "password"}
              value={stripeSecretKey}
              onChange={(e) => setStripeSecretKey(e.target.value)}
              placeholder={stripeMode === "live" ? "sk_live_51..." : "sk_test_51..."}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
              Stripe Webhook Secret (Opzionale per sincronizzazione asincrona, whsec_...)
            </label>
            <Input
              value={stripeWebhookSecret}
              onChange={(e) => setStripeWebhookSecret(e.target.value)}
              placeholder="whsec_..."
              className="font-mono text-xs text-zinc-500"
            />
          </div>
        </div>

        {/* Esito Test Connessione */}
        {stripeTestStatus && (
          <div
            className={`p-3 rounded-2xl border text-xs flex items-center gap-2 ${
              stripeTestStatus.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {stripeTestStatus.ok ? (
              <Check className="size-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="size-4 text-red-600 shrink-0" />
            )}
            <span className="text-[11px] font-bold leading-tight">{stripeTestStatus.message}</span>
          </div>
        )}

        {/* Pulsanti Azione */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestStripe}
            disabled={isTestingStripe}
            className="text-xs font-bold rounded-xl h-9 border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5"
          >
            <KeyRound className="size-3.5 text-[#1c00ff]" />
            {isTestingStripe ? "Verifica in corso..." : "Verifica Connessione Stripe"}
          </Button>

          <Button
            type="button"
            onClick={handleSaveStripe}
            disabled={isSavingStripe}
            className="text-xs font-black rounded-xl h-9 bg-[#1c00ff] text-white hover:bg-[#1600cc] flex items-center gap-1.5 shadow-xs"
          >
            <Check className="size-3.5 text-[#e3ff00]" />
            {isSavingStripe ? "Salvataggio..." : "Salva Configurazione Stripe"}
          </Button>
        </div>

        {/* Guida Rapida Accordion */}
        <div className="pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex items-center justify-between text-[11px] font-bold text-zinc-600 hover:text-zinc-900 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-[#1c00ff]" />
              Guida Rapida: Dove trovare le tue chiavi su Stripe (2 minuti)
            </span>
            {showGuide ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>

          {showGuide && (
            <div className="mt-3 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 space-y-2 leading-relaxed">
              <ol className="list-decimal list-inside space-y-1.5 text-[11px]">
                <li>
                  Accedi alla tua dashboard su{" "}
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1c00ff] underline font-bold"
                  >
                    dashboard.stripe.com
                  </a>{" "}
                  (oppure crea un account gratuito inserendo la tua partita IVA e IBAN bancario).
                </li>
                <li>
                  In alto a destra, assicurati di scegliere se operare in <strong>Modalità Test</strong> o <strong>Modalità Live</strong>.
                </li>
                <li>
                  Vai nel menu <strong>Sviluppatori</strong> (Developers) &gt; <strong>Chiavi API</strong> (API keys).
                </li>
                <li>
                  Copia la <strong>Chiave pubblicabile</strong> (inizia con <code>pk_</code>) e incollala nel primo campo.
                </li>
                <li>
                  Clicca su &quot;Rivela chiave segreta&quot; (inizia con <code>sk_</code>), copiala e incollala nel secondo campo.
                </li>
                <li>
                  Clicca sul pulsante <strong>&quot;Verifica Connessione Stripe&quot;</strong> qui sopra: l&apos;app effettuerà un test istantaneo per confermare che tutto funzioni a meraviglia!
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* SEZIONE 2: POLICY CANCELLAZIONE FLESSIBILE */}
      <div className="p-4 rounded-3xl bg-white border border-zinc-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-[#1c00ff]" />
          <div>
            <h2 className="text-sm font-black text-zinc-900">
              Policy Termine Cancellazione Slot
            </h2>
            <p className="text-[11px] text-zinc-500">
              Tempo minimo di preavviso per la cancellazione gratuita con riaccredito del credito.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1">
          {[12, 24, 36, 48].map((ore) => {
            const isSelected = policyAttiva === ore;
            return (
              <button
                key={ore}
                type="button"
                onClick={() => handleSelectPolicyOre(ore)}
                className={`py-2.5 px-1 rounded-2xl border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
                  isSelected
                    ? "border-[#1c00ff] bg-[#1c00ff] text-white shadow-sm font-black"
                    : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-bold"
                }`}
              >
                <span className="text-base tabular-nums">{ore}h</span>
                <span
                  className={`text-[9px] uppercase tracking-wider ${
                    isSelected ? "text-[#e3ff00]" : "text-zinc-400"
                  }`}
                >
                  {ore === 24 ? "Standard" : ore < 24 ? "Flessibile" : "Rigorosa"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] text-zinc-500 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 leading-relaxed">
          💡 <strong>Impostazione attiva: {policyAttiva} ore</strong>. Se un atleta annulla la seduta con almeno {policyAttiva} ore di anticipo, riceve indietro il credito. In caso contrario, il credito viene trattenuto automaticamente.
        </div>
      </div>

      {/* SEZIONE 3: COORDINATE BONIFICO & LAB */}
      <div className="p-4 rounded-3xl bg-white border border-zinc-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-[#1c00ff]" />
          <div>
            <h2 className="text-sm font-black text-zinc-900">
              Coordinate Bonifico per i Clienti
            </h2>
            <p className="text-[11px] text-zinc-500">
              Visualizzate dagli atleti durante il checkout bonifico.
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
              />
            </div>
          </div>
        </div>
      </div>

      {/* SEZIONE 3: REGISTRO TRANSAZIONI & INVOICEBUDDY BRIDGE */}
      <div className="p-4 rounded-3xl bg-white border border-zinc-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="size-5 text-[#1c00ff]" />
            <div>
              <h2 className="text-sm font-black text-zinc-900">
                Registro Incassi & Fatturazione
              </h2>
              <p className="text-[11px] text-zinc-500">
                Regime Forfettario semplificato.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => copyInvoiceBuddyData()}
            className="text-[11px] font-bold bg-zinc-900 text-white hover:bg-zinc-800 h-8 px-2.5 rounded-xl flex items-center gap-1"
          >
            <Copy className="size-3" /> Copia Dati
          </Button>
        </div>

        {/* LISTA PAGAMENTI */}
        <div className="space-y-2 pt-1">
          {transazioni.length === 0 ? (
            <div className="text-xs text-zinc-400 text-center py-4">
              Nessuna transazione registrata al momento.
            </div>
          ) : (
            transazioni.map((tx) => {
              const isPendingBonifico = tx.stato === "in_attesa_bonifico";

              return (
                <div
                  key={tx.codice_transazione}
                  className={`p-3 rounded-2xl border text-xs space-y-2 ${
                    isPendingBonifico
                      ? "bg-amber-50/70 border-amber-200"
                      : "bg-zinc-50 border-zinc-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-zinc-900">{tx.nome_cliente}</span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                            isPendingBonifico
                              ? "bg-amber-200 text-amber-900"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isPendingBonifico ? "In attesa bonifico" : "Incassato"}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {tx.created_at.slice(0, 10)} • {tx.nome_pacchetto} ({tx.metodo.toUpperCase()})
                      </div>
                      {tx.codice_fiscale && (
                        <div className="text-[10px] font-mono text-zinc-600">
                          CF: {tx.codice_fiscale}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-zinc-900">{tx.importo_euro} €</div>
                      <div className="text-[10px] font-bold text-emerald-700">
                        +{tx.crediti_effettivi_aggiunti} crediti
                      </div>
                    </div>
                  </div>

                  {/* AZIONI SU BONIFICO PENDENTE O COPIA RAPIDA */}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-200/70">
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {tx.codice_transazione}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isPendingBonifico ? (
                        <Button
                          size="sm"
                          onClick={() => approvaBonificoMutation.mutate(tx.codice_transazione)}
                          disabled={approvaBonificoMutation.isPending}
                          className="h-7 text-[11px] font-black bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                        >
                          Approva & Accredita
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInvoiceBuddyData(tx)}
                          className="h-6 text-[10px] text-zinc-600 hover:text-zinc-900"
                        >
                          <Copy className="size-2.5 mr-1" /> Copia Riga
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
        <div className="p-3 rounded-2xl bg-zinc-900 text-white text-xs space-y-1.5 mt-4">
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
