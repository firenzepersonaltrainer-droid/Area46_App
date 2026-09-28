import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser, useEccezioniCalendario } from "../lib/useUser";
import {
  Bot,
  Sparkles,
  Lock,
  CalendarCheck,
  Send,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronRight,
  XCircle,
  HelpCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { toast } from "sonner";

interface AIBookingConciergeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenContinuativoInfo?: () => void;
}

interface ParsedSlot {
  data: string;
  orario: string;
  giornoNome: string;
  disponibile: boolean;
  motivoBlocco?: string;
}

export function AIBookingConcierge({
  open,
  onOpenChange,
  onOpenContinuativoInfo,
}: AIBookingConciergeProps) {
  const queryClient = useQueryClient();
  const { user, crediti, isManager } = useCurrentUser();
  const { eccezioni } = useEccezioniCalendario();

  const [promptInput, setPromptInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [proposedSlots, setProposedSlots] = useState<ParsedSlot[]>([]);
  const [successBooking, setSuccessBooking] = useState(false);

  // Verifica se l'utente ha diritto all'assistente AI (Abbonamento Continuativo o Coach)
  const hasContinuativo = useMemo(() => {
    if (isManager) return true;
    if (!user) return false;
    const tipo = user.tipo_abbonamento?.toLowerCase() || "";
    return (
      tipo.includes("continuativo") ||
      tipo.includes("lab_continuativo") ||
      tipo === "abbonamento_annuale" ||
      tipo === "abbonamento_semestrale"
    );
  }, [user, isManager]);

  // Query per verificare prenotazioni esistenti nel periodo
  const { data: prenotazioni = [] } = useQuery<any[]>({
    queryKey: ["prenotazioni-all"],
    queryFn: async () => {
      const res = await fetch("/app-api/prenotazioni");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  // Helper per calcolare date e slot a partire dal prompt naturale
  const handleParsePrompt = (customText?: string) => {
    const text = (customText || promptInput).trim().toLowerCase();
    if (!text) return;

    setIsProcessing(true);
    setProposedSlots([]);
    setSuccessBooking(false);

    setTimeout(() => {
      try {
        // 1. Riconoscimento giorni della settimana
        const targetDays: number[] = [];
        if (text.includes("lun") || text.includes("lunedì")) targetDays.push(1);
        if (text.includes("mar") || text.includes("martedì")) targetDays.push(2);
        if (text.includes("mer") || text.includes("mercoledì")) targetDays.push(3);
        if (text.includes("gio") || text.includes("giovedì")) targetDays.push(4);
        if (text.includes("ven") || text.includes("venerdì")) targetDays.push(5);
        if (text.includes("sab") || text.includes("sabato")) targetDays.push(6);
        if (text.includes("dom") || text.includes("domenica")) targetDays.push(0);

        // Se non specificati, default lunedì e mercoledì
        const finalDays = targetDays.length > 0 ? targetDays : [1, 3];

        // 2. Riconoscimento orario
        let targetTime = "18:00";
        const timeMatch = text.match(/(\d{1,2})[:.](\d{2})/) || text.match(/ore\s+(\d{1,2})/);
        if (timeMatch) {
          if (timeMatch[2]) {
            targetTime = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
          } else {
            targetTime = `${timeMatch[1].padStart(2, "0")}:00`;
          }
        }

        // 3. Riconoscimento orizzonte temporale
        let totalWeeks = 4; // default 4 settimane
        const weeksMatch = text.match(/(\d{1,2})\s*settiman/);
        if (weeksMatch) {
          totalWeeks = parseInt(weeksMatch[1], 10);
        } else if (text.includes("mese") || text.includes("1 mese")) {
          totalWeeks = 4;
        } else if (text.includes("2 mesi")) {
          totalWeeks = 8;
        } else if (text.includes("3 mesi") || text.includes("trimestr")) {
          totalWeeks = 12;
        } else if (text.includes("6 mesi") || text.includes("semestr")) {
          totalWeeks = 24;
        } else if (text.includes("anno") || text.includes("12 mesi")) {
          totalWeeks = 52;
        }

        // Limita l'orizzonte a max 24 settimane per singola richiesta
        totalWeeks = Math.min(totalWeeks, 24);

        // 4. Generazione date candidate
        const slots: ParsedSlot[] = [];
        const today = new Date();
        const curDate = new Date(today);
        curDate.setDate(curDate.getDate() + 1); // a partire da domani

        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + totalWeeks * 7);

        const dayNames = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

        while (curDate <= endDate) {
          const dayNum = curDate.getDay();
          if (finalDays.includes(dayNum)) {
            const dateStr = curDate.toISOString().slice(0, 10);

            // Controlla eccezioni (chiusura lab o slot bloccato)
            const bloccato = eccezioni.find(
              (e: any) =>
                e.data === dateStr &&
                (e.tipo === "chiusura_giornata" || (e.tipo === "slot_bloccato" && e.orario === targetTime))
            );

            // Controlla se già occupato
            const occupato = prenotazioni.find(
              (p: any) => p.data === dateStr && p.orario === targetTime && p.stato === "confermata"
            );

            const isAvailable = !bloccato && !occupato;
            let motivoBlocco = "";
            if (bloccato) motivoBlocco = bloccato.motivo || "Chiusura / Ferie Lab";
            else if (occupato) motivoBlocco = "Slot già occupato da un altro atleta";

            slots.push({
              data: dateStr,
              orario: targetTime,
              giornoNome: dayNames[dayNum],
              disponibile: isAvailable,
              motivoBlocco: isAvailable ? undefined : motivoBlocco,
            });
          }
          curDate.setDate(curDate.getDate() + 1);
        }

        const validSlots = slots.filter((s) => s.disponibile);
        const blockedCount = slots.length - validSlots.length;

        setProposedSlots(slots);
        setAiResponse(
          `Ho pianificato **${validSlots.length} sessioni** alle ore **${targetTime}** per le prossime **${totalWeeks} settimane** nei giorni di **${finalDays
            .map((d) => dayNames[d])
            .join(" e ")}**. ${
            blockedCount > 0
              ? `(Nota: ${blockedCount} date sono state escluse automaticamente perché coincidenti con ferie o slot già prenotati).`
              : "Tutti gli slot richiesti sono perfettamente disponibili!"
          }`
        );
      } catch (err) {
        setAiResponse("Non sono riuscito a interpretare la richiesta. Prova a specificare giorni e orari chiaramente (es. 'Lunedì e Mercoledì alle 18:00 per 4 settimane').");
      } finally {
        setIsProcessing(false);
      }
    }, 450);
  };

  // Mutation Conferma Batch
  const batchBookingMutation = useMutation({
    mutationFn: async (slotsToBook: Array<{ data: string; orario: string }>) => {
      const res = await fetch("/app-api/prenotazioni/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          atleta_id: user?.id,
          slots: slotsToBook,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nella prenotazione multipla");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["prenotazioni-all"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      setSuccessBooking(true);
      toast.success(
        `Ottimo! ${data.prenotate?.length || proposedSlots.filter((s) => s.disponibile).length} sessioni bloccate con successo a calendario!`
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante la conferma degli slot");
    },
  });

  const handleConfirmBatch = () => {
    const valid = proposedSlots.filter((s) => s.disponibile).map((s) => ({
      data: s.data,
      orario: s.orario,
    }));
    if (valid.length === 0) {
      toast.error("Nessuno slot disponibile da prenotare.");
      return;
    }
    batchBookingMutation.mutate(valid);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl [scrollbar-width:thin]">
        <DialogHeader className="mb-2 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#e3ff00] text-zinc-950 font-black border border-zinc-900 shadow-xs">
                <Bot className="size-5 text-[#1c00ff]" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#1c00ff] flex items-center gap-1">
                  <span>AI Booking Concierge</span>
                  <span className="bg-[#1c00ff] text-[#e3ff00] text-[9px] px-1.5 py-0.2 rounded-full font-black">
                    PRO
                  </span>
                </div>
                <DialogTitle className="text-xl font-black tracking-tight text-zinc-900">
                  Assistente Personale Calendario
                </DialogTitle>
              </div>
            </div>

            {hasContinuativo ? (
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-600" />
                Benefit Attivo
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Lock className="size-3 text-zinc-500" />
                Continuativo Only
              </span>
            )}
          </div>
          <DialogDescription className="text-xs text-zinc-500 mt-1">
            Chiedi in linguaggio naturale di bloccare o modificare i tuoi slot per settimane o mesi interi.
          </DialogDescription>
        </DialogHeader>

        {/* CONTENUTO IN BASE AI PRIVILEGI CONTINUATIVO */}
        {!hasContinuativo ? (
          /* SCHERMATA BENEFIT BLOCCATO CON PROMO CONTINUATIVO */
          <div className="py-4 space-y-4">
            <div className="p-5 rounded-2xl bg-zinc-950 text-white border-2 border-[#e3ff00] shadow-[0_0_25px_rgba(227,255,0,0.15)] relative overflow-hidden text-center space-y-3">
              <div className="size-14 rounded-2xl bg-[#e3ff00] text-zinc-950 mx-auto flex items-center justify-center font-black shadow-md border border-zinc-900">
                <Lock className="size-7 text-[#1c00ff]" />
              </div>

              <div>
                <h3 className="text-base font-black text-white">
                  Benefit Esclusivo Abbonamento Lab Continuativo
                </h3>
                <p className="text-xs text-zinc-300 mt-1 max-w-md mx-auto leading-relaxed">
                  L&apos;<strong>Assistente AI Booking Concierge</strong> è riservato agli atleti che hanno
                  sottoscritto un <strong>Abbonamento Lab Continuativo (6 o 12 Mesi)</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left pt-2 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <div className="font-bold text-[#e3ff00] flex items-center gap-1 text-[11px]">
                    <Sparkles className="size-3.5" />
                    Una Sola Frase
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    &quot;Prenotami tutti i Lunedì e Giovedì alle 18:00 fino a Natale&quot;.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <div className="font-bold text-[#e3ff00] flex items-center gap-1 text-[11px]">
                    <CalendarCheck className="size-3.5" />
                    Fino a 156 Slot Subito
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    Blocca il tuo posto fisso garantito per 365 giorni senza fare corse.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <div className="font-bold text-[#e3ff00] flex items-center gap-1 text-[11px]">
                    <ShieldCheck className="size-3.5" />
                    Massimo Risparmio
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    Fino a 840 € di sconto annuo rispetto ai pacchetti a consumo.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    if (onOpenContinuativoInfo) onOpenContinuativoInfo();
                  }}
                  className="w-full bg-[#e3ff00] text-zinc-950 hover:bg-[#d9f200] font-black text-xs h-10 rounded-xl shadow-md border border-zinc-900"
                >
                  <Sparkles className="size-4 mr-1 text-[#1c00ff]" />
                  Scopri l&apos;Abbonamento Continuativo & Attiva l&apos;AI
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-100 border border-zinc-200 text-[11px] text-zinc-600 text-center">
              💡 Attualmente hai un profilo a pacchetto a consumo. Per prenotare singolarmente i tuoi slot,
              puoi utilizzare il calendario standard dell&apos;Area Personale.
            </div>
          </div>
        ) : (
          /* CONCIERGE ATTIVO PER ATLETI CONTINUATIVI */
          <div className="space-y-4 pt-2">
            {/* SUGGERIMENTI RAPIDI DI COMANDO (CHIPS) */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
                <Sparkles className="size-3 text-[#1c00ff]" />
                Comandi rapidi suggeriti (tocca per provare):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Prenota Lunedì e Mercoledì alle 18:00 per 4 settimane",
                  "Prenota Martedì e Venerdì alle 17:15 per 6 settimane",
                  "Prenota tutti i Lunedì, Mercoledì e Venerdì alle 19:00 per 8 settimane",
                  "Prenota Sabato alle 10:30 per 4 settimane",
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPromptInput(chip);
                      handleParsePrompt(chip);
                    }}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors text-left cursor-pointer border border-zinc-200"
                  >
                    &quot;{chip}&quot;
                  </button>
                ))}
              </div>
            </div>

            {/* BARRA DI INPUT PROMPT AI */}
            <div className="space-y-2">
              <div className="relative flex items-center">
                <Input
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleParsePrompt();
                    }
                  }}
                  placeholder="Es. Prenotami lun e ven alle 18:00 fino a fine mese..."
                  className="pr-20 text-xs h-11 rounded-2xl border-zinc-300 focus:border-[#1c00ff] bg-zinc-50"
                  disabled={isProcessing}
                />
                <Button
                  size="sm"
                  onClick={() => handleParsePrompt()}
                  disabled={!promptInput.trim() || isProcessing}
                  className="absolute right-1.5 h-8 px-3 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black text-xs flex items-center gap-1"
                >
                  {isProcessing ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Invia</span>
                      <Send className="size-3" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* RISPOSTA AI E ANTEPRIMA SLOT GENERATI */}
            {aiResponse && (
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                <div className="flex items-start gap-2">
                  <div className="p-1 rounded-md bg-[#1c00ff] text-white shrink-0 mt-0.5">
                    <Bot className="size-3.5" />
                  </div>
                  <div className="text-xs text-zinc-800 leading-relaxed font-medium">
                    {aiResponse}
                  </div>
                </div>

                {/* TABELLA / LISTA DEGLI SLOT CALCOLATI */}
                {proposedSlots.length > 0 && !successBooking && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase text-zinc-500">
                      <span>Riepilogo Calendario ({proposedSlots.length} slot elaborati)</span>
                      <span>
                        Validi:{" "}
                        <strong className="text-emerald-700">
                          {proposedSlots.filter((s) => s.disponibile).length}
                        </strong>
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 [scrollbar-width:thin]">
                      {proposedSlots.map((slot, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                            slot.disponibile
                              ? "bg-white border-zinc-200"
                              : "bg-red-50/60 border-red-200 text-red-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900">
                              {slot.giornoNome}{" "}
                              {new Date(slot.data + "T00:00:00").toLocaleDateString("it-IT", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 font-bold text-zinc-700">
                              {slot.orario}
                            </span>
                          </div>

                          <div>
                            {slot.disponibile ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="size-3 text-emerald-600" />
                                Disponibile
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                                <XCircle className="size-3 text-red-500" />
                                {slot.motivoBlocco || "Escluso"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* BOTTONE CONFERMA BATCH */}
                    <div className="pt-2">
                      <Button
                        onClick={handleConfirmBatch}
                        disabled={
                          batchBookingMutation.isPending ||
                          proposedSlots.filter((s) => s.disponibile).length === 0
                        }
                        className="w-full bg-[#1c00ff] text-[#e3ff00] hover:bg-[#1600cc] font-black text-xs h-10 rounded-xl shadow-md flex items-center justify-center gap-2"
                      >
                        {batchBookingMutation.isPending ? (
                          <>
                            <RefreshCw className="size-4 animate-spin" />
                            <span>Blocco slot in corso...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-4" />
                            <span>
                              Conferma & Blocca {proposedSlots.filter((s) => s.disponibile).length}{" "}
                              Sessioni a Calendario
                            </span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* STATO SUCCESSO */}
                {successBooking && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-center space-y-1">
                    <CheckCircle2 className="size-8 text-emerald-600 mx-auto" />
                    <div className="font-black text-sm">Sessioni Prenotate con Successo!</div>
                    <p className="text-xs text-emerald-800">
                      I tuoi slot sono stati registrati a sistema e riservati a tuo nome nel calendario ufficiale di Area46.
                    </p>
                    <div className="pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onOpenChange(false);
                        }}
                        className="text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                      >
                        Chiudi Assistente
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1 text-[11px]">
            <ShieldCheck className="size-3.5 text-[#1c00ff]" />
            Garanzia slot Area46 Landmine Lab
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-zinc-600 hover:text-zinc-900"
          >
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
