import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, useLabConfig } from "../lib/useUser";
import {
  Sparkles,
  Check,
  CreditCard,
  Building2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Receipt,
  FileCheck,
  Zap,
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

export default function TariffarioPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, crediti, hasDebt } = useCurrentUser();
  const { config } = useLabConfig();

  const [selectedPack, setSelectedPack] = useState<Pacchetto | null>(null);
  const [metodo, setMetodo] = useState<"carta" | "apple_pay" | "paypal" | "bonifico">("carta");
  const [codiceFiscale, setCodiceFiscale] = useState(user?.codice_fiscale || "");
  const [indirizzo, setIndirizzo] = useState(user?.indirizzo || "");
  const [completedTx, setCompletedTx] = useState<any | null>(null);

  // Query Pacchetti
  const { data: pacchetti = [], isLoading } = useQuery<Pacchetto[]>({
    queryKey: ["tariffario"],
    queryFn: async () => {
      const res = await fetch("/app-api/tariffario");
      if (!res.ok) throw new Error("Errore caricamento pacchetti");
      return res.json();
    },
  });

  // Mutation Checkout
  const checkoutMutation = useMutation({
    mutationFn: async (payload: {
      id_pacchetto: string;
      metodo: string;
      codice_fiscale: string;
      indirizzo: string;
    }) => {
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
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["transazioni"] });
      setCompletedTx(data);
      setSelectedPack(null);
      if (data.transazione.stato === "in_attesa_bonifico") {
        toast.info("Richiesta registrata! Effettua il bonifico con la causale generata.");
      } else {
        toast.success("Pagamento completato con successo! Crediti aggiornati.");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore nel completamento dell'acquisto");
    },
  });

  const handleOpenCheckout = (pack: Pacchetto) => {
    setSelectedPack(pack);
    setCodiceFiscale(user?.codice_fiscale || "");
    setIndirizzo(user?.indirizzo || "");
  };

  const currentDebtCount = hasDebt ? Math.abs(crediti) : 0;

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER */}
      <div>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#e3ff00] text-zinc-950 font-black border border-zinc-900 shadow-2xs">
            <Sparkles className="size-5 text-[#1c00ff]" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-zinc-900">
              Tariffario & Ricarica Crediti
            </h1>
            <p className="text-xs text-zinc-500">
              1 Credito = 1 Allenamento con Coach Landmine Lab
            </p>
          </div>
        </div>
      </div>

      {/* AVVISO DEBITO IN CORSO (SE PRESENTE) */}
      {hasDebt && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1">
          <div className="font-black flex items-center gap-1.5 text-red-700">
            <AlertTriangle className="size-4 shrink-0" />
            REGOLARIZZAZIONE DEBITO ATTIVO
          </div>
          <p className="text-[11px] leading-relaxed">
            Attualmente hai <strong>{currentDebtCount} sedute a debito</strong>. Al momento
            dell&apos;acquisto di qualunque pacchetto, il debito verrà automaticamente sanato dal totale
            dei crediti acquistati.
          </p>
        </div>
      )}

      {/* LISTA PACCHETTI */}
      <div className="space-y-3">
        {pacchetti.map((pack) => {
          const creditiEffettivi = Math.max(0, pack.crediti - currentDebtCount);
          const isPro = pack.badge === "Pro Lab" || pack.tipo === "ricorrente_4mesi";

          return (
            <div
              key={pack.id}
              className={`p-4 rounded-3xl border-2 transition-all relative overflow-hidden bg-white ${
                pack.badge === "Più Scelto"
                  ? "border-[#1c00ff] shadow-md ring-1 ring-[#1c00ff]/20"
                  : isPro
                  ? "border-zinc-900 bg-zinc-900 text-white shadow-md"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              {/* BADGE IN ALTO */}
              {pack.badge && (
                <div className="flex justify-end mb-1">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      pack.badge === "Più Scelto"
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
                    className={`text-base font-black tracking-tight ${
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

              {/* DETTAGLIO CREDITI E VALIDITÀ */}
              <div
                className={`mt-3 pt-3 border-t flex items-center justify-between text-xs ${
                  isPro ? "border-zinc-800" : "border-zinc-100"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                      isPro
                        ? "bg-zinc-800 text-[#e3ff00]"
                        : "bg-[#1c00ff]/10 text-[#1c00ff]"
                    }`}
                  >
                    {pack.crediti} Allenamenti
                  </span>
                  <span
                    className={`text-[11px] ${
                      isPro ? "text-zinc-400" : "text-zinc-500"
                    }`}
                  >
                    • Validità {pack.giorni_validita} gg
                  </span>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleOpenCheckout(pack)}
                  className={`rounded-xl text-xs font-black h-8 px-3.5 ${
                    isPro
                      ? "bg-[#e3ff00] text-zinc-950 hover:bg-[#d9f200]"
                      : "bg-[#1c00ff] text-white hover:bg-[#1600cc]"
                  }`}
                >
                  Acquista
                </Button>
              </div>

              {/* CALCOLO DEBITO DETRATTO SE PRESENTE */}
              {hasDebt && (
                <div
                  className={`mt-2 p-2 rounded-xl text-[10px] font-bold ${
                    isPro
                      ? "bg-zinc-800/80 text-zinc-300"
                      : "bg-zinc-50 text-zinc-600 border border-zinc-200"
                  }`}
                >
                  💡 Con questo pacchetto: {pack.crediti} acquistati - {currentDebtCount} debito ={" "}
                  <strong className="text-emerald-500">{creditiEffettivi} crediti netti</strong>.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODALE CHECKOUT & PAGAMENTO */}
      <Dialog open={!!selectedPack} onOpenChange={(open) => !open && setSelectedPack(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <CreditCard className="size-5 text-[#1c00ff]" />
              Checkout & Ricarica Crediti
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Finalizza l&apos;acquisto per il tuo account Area46.
            </DialogDescription>
          </DialogHeader>

          {selectedPack && (
            <div className="my-3 space-y-4 text-xs">
              {/* RIEPILOGO PACCHETTO */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                <div className="flex justify-between font-bold text-zinc-900 text-sm">
                  <span>{selectedPack.nome}</span>
                  <span className="text-[#1c00ff]">{selectedPack.prezzo_euro} €</span>
                </div>
                <div className="flex justify-between text-zinc-500 text-[11px]">
                  <span>Crediti inclusi:</span>
                  <strong>{selectedPack.crediti} sedute</strong>
                </div>
                {hasDebt && (
                  <div className="flex justify-between text-red-600 font-bold text-[11px]">
                    <span>Debito sanato:</span>
                    <span>- {currentDebtCount} credito/i</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-700 font-black border-t border-zinc-200 pt-1.5">
                  <span>Nuovo Saldo Wallet Finale:</span>
                  <span>{Math.max(0, selectedPack.crediti - currentDebtCount)} crediti</span>
                </div>
              </div>

              {/* SELEZIONE METODO DI PAGAMENTO */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block mb-2">
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

              {/* SE BONIFICO: ANTEPRIMA COORDINATE */}
              {metodo === "bonifico" && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <div className="font-bold">Coordinate per Bonifico:</div>
                  <div className="font-mono text-[11px] select-all bg-white p-1.5 rounded border border-amber-300">
                    IBAN: {config?.iban || "IT46X0306909606100000046460"}
                  </div>
                  <div className="text-[10px] text-amber-800">
                    Intestatario: {config?.intestatario_iban || "Area46 Training Lab SSD a r.l."}
                  </div>
                </div>
              )}

              {/* DATI FISCALI PER RICEVUTA / INVOICEBUDDY */}
              <div className="space-y-2 pt-1 border-t border-zinc-100">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block">
                  Dati di Fatturazione / Ricevuta
                </label>
                <div className="space-y-1.5">
                  <Input
                    placeholder="Codice Fiscale (es. RSSMRA85M01D612Z)"
                    value={codiceFiscale}
                    onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Indirizzo (Via, Civico, Città)"
                    value={indirizzo}
                    onChange={(e) => setIndirizzo(e.target.value)}
                    className="text-xs"
                  />
                </div>
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
                ? "Genera Causale Bonifico"
                : `Paga ${selectedPack?.prezzo_euro} €`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE RICEVUTA PAGAMENTO / RIEPILOGO BONIFICO */}
      <Dialog open={!!completedTx} onOpenChange={(open) => !open && setCompletedTx(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <div className="mx-auto size-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
            <FileCheck className="size-6" />
          </div>

          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-black text-zinc-900">
              {completedTx?.transazione?.stato === "in_attesa_bonifico"
                ? "Richiesta Registrata!"
                : "Pagamento Confermato!"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              {completedTx?.transazione?.stato === "in_attesa_bonifico"
                ? "Procedi con il bonifico bancario per attivare le sedute."
                : "La tua ricevuta è pronta e i crediti sono già nel tuo wallet."}
            </DialogDescription>
          </DialogHeader>

          {completedTx && (
            <div className="my-3 space-y-3 text-xs">
              {completedTx.transazione.stato === "in_attesa_bonifico" ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="font-bold text-amber-900">Causale Univoca Obbligatoria:</div>
                  <div className="p-2 rounded-xl bg-white border border-amber-300 font-mono text-xs font-bold text-zinc-900 select-all text-center">
                    {completedTx.transazione.causale_bonifico}
                  </div>
                  <div className="text-[11px] text-amber-800">
                    IBAN: <strong>{config?.iban}</strong>
                    <br />
                    Importo esatto da versare: <strong>{completedTx.transazione.importo_euro} €</strong>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between border-b pb-1 font-sans font-bold text-zinc-900">
                    <span>Codice Ricevuta:</span>
                    <span>{completedTx.ricevuta?.codice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-sans">Cliente:</span>
                    <span>{completedTx.ricevuta?.cliente}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-sans">Pacchetto:</span>
                    <span>{completedTx.ricevuta?.descrizione}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-sans">Importo Totale:</span>
                    <span className="font-bold text-zinc-900">{completedTx.ricevuta?.importo}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-sans text-emerald-700 font-bold">
                    <span>Crediti Attuali:</span>
                    <span>{completedTx.crediti_attuali} sedute disponibili</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setCompletedTx(null);
                navigate("/prenota");
              }}
              className="w-full rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black h-10"
            >
              Vai a Prenotare i tuoi Slot &rarr;
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
