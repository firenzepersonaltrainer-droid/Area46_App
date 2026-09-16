import React, { useState } from "react";
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
    onSuccess: (data) => {
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

      {/* SEZIONE 1: POLICY CANCELLAZIONE FLESSIBILE */}
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

      {/* SEZIONE 2: COORDINATE BONIFICO & LAB */}
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
            <Copy className="size-3" /> Copia per InvoiceBuddy
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
