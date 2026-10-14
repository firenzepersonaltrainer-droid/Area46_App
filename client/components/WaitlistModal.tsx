import React from "react";
import { Bell, Clock, Sparkles, CheckCircle2, MessageSquare, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { toast } from "sonner";
import {
  subscribeToWaitlist,
  unsubscribeFromWaitlist,
  formatGiornoItaliano,
  buildWhatsAppSlotLink,
} from "../lib/useSimulatedCalendar";

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: {
    data: string;
    orario: string;
    tipo: "reale" | "simulato";
    stato: "occupato" | "opzionato";
    countdownMin?: number;
    countdownSec?: number;
  } | null;
  userId?: string;
  userNome?: string;
  userPhone?: string;
  coachPhone?: string;
  isSubscribed?: boolean;
  onSubscriptionChange?: () => void;
}

export function WaitlistModal({
  open,
  onOpenChange,
  slot,
  userId,
  userNome = "Atleta",
  userPhone = "",
  coachPhone = "+39 340 0000000",
  isSubscribed = false,
  onSubscriptionChange,
}: WaitlistModalProps) {
  if (!slot) return null;

  const isOptioned = slot.stato === "opzionato";

  const handleSubscribe = () => {
    if (!userId) {
      toast.error("Effettua l'accesso per attivare gli avvisi sulle postazioni.");
      return;
    }

    subscribeToWaitlist(userId, slot.data, slot.orario, slot.tipo);
    toast.success(`🔔 Avviso attivato per le ${slot.orario} del ${formatGiornoItaliano(slot.data)}!`);
    if (onSubscriptionChange) onSubscriptionChange();
    onOpenChange(false);
  };

  const handleUnsubscribe = () => {
    if (!userId) return;
    unsubscribeFromWaitlist(userId, slot.data, slot.orario);
    toast.info("Avviso disattivato per questo slot.");
    if (onSubscriptionChange) onSubscriptionChange();
    onOpenChange(false);
  };

  const handleDirectWhatsApp = () => {
    const targetPhone = userPhone || coachPhone;
    const link = buildWhatsAppSlotLink(targetPhone, userNome, slot.data, slot.orario);
    window.open(link, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className={`size-8 rounded-xl flex items-center justify-center ${
              isOptioned ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-[#1c00ff]"
            }`}>
              {isOptioned ? <Clock className="size-4" /> : <Bell className="size-4" />}
            </div>
            <div>
              <DialogTitle className="text-base font-black text-zinc-900">
                {isOptioned ? "Posto Opzionato" : "Slot Attualmente Occupato"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                {isOptioned
                  ? "Un atleta sta completando la procedura di conferma."
                  : "Capienza della pedana al momento esaurita per questo turno."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-3 space-y-3">
          {/* Card riepilogo orario */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Giorno:</span>
              <strong className="text-zinc-900 capitalize">
                {formatGiornoItaliano(slot.data)}
              </strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Orario:</span>
              <strong className="text-zinc-900 text-sm">{slot.orario}</strong>
            </div>

            {isOptioned && slot.countdownSec !== undefined && (
              <div className="flex justify-between items-center pt-1.5 border-t border-zinc-200">
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <Clock className="size-3 text-amber-600 animate-pulse" /> Sblocco automatico:
                </span>
                <span className="font-mono font-black text-amber-900">
                  {slot.countdownMin || 0}m {String(slot.countdownSec % 60).padStart(2, "0")}s
                </span>
              </div>
            )}
          </div>

          {/* Spiegazione servizio avviso */}
          <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs space-y-1">
            <div className="font-bold text-blue-950 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-[#1c00ff]" />
              Avvisami se si libera
            </div>
            <p className="text-[11px] text-blue-900/80 leading-snug">
              Attivando l&apos;avviso, appena la postazione torna disponibile il sistema accenderà la <strong>spia di notifica</strong> sulla tua app e ti invierà un promemoria per bloccarla subito.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2">
          {isSubscribed ? (
            <Button
              variant="outline"
              onClick={handleUnsubscribe}
              className="w-full rounded-xl text-red-600 border-red-200 hover:bg-red-50 text-xs font-bold h-9 cursor-pointer"
            >
              Rimuovi dalla lista d&apos;attesa
            </Button>
          ) : (
            <Button
              onClick={handleSubscribe}
              className="w-full rounded-xl bg-[#1c00ff] hover:bg-[#1600cc] text-white font-black text-xs h-10 shadow-sm cursor-pointer"
            >
              <Bell className="size-3.5 mr-1.5" /> Avvisami se si libera
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={handleDirectWhatsApp}
            className="w-full rounded-xl text-emerald-700 hover:bg-emerald-50 text-xs font-semibold h-8 cursor-pointer"
          >
            <MessageSquare className="size-3.5 mr-1 text-emerald-600" /> Chiedi al Coach su WhatsApp
          </Button>

          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-zinc-400 text-xs h-7 cursor-pointer"
          >
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
