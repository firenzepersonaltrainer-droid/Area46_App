import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Lightbulb,
  Bug,
  HelpCircle,
  EyeOff,
  Send,
  Sparkles,
  Smartphone,
  Shield,
  MessageSquarePlus,
  CheckCircle2,
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
import { Textarea } from "./Textarea";
import { AudioFeedbackRecorder } from "./AudioFeedbackRecorder";
import { toast } from "sonner";

interface AppFeedbackBugModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser?: { id?: string; email?: string; name?: string } | null;
}

export function AppFeedbackBugModal({
  open,
  onOpenChange,
  currentUser,
}: AppFeedbackBugModalProps) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<"consiglio" | "bug" | "altro">("consiglio");
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [isAnonimo, setIsAnonimo] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<{
    blob: Blob;
    base64: string;
    durationSec: number;
    transcript?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTipo("consiglio");
    setTitolo("");
    setDescrizione("");
    setIsAnonimo(false);
    setRecordedAudio(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titolo.trim() && !recordedAudio) {
      toast.error("Inserisci un titolo o registra una nota vocale.");
      return;
    }

    setIsSubmitting(true);

    const deviceInfo = typeof window !== "undefined"
      ? `${navigator.userAgent} • ${window.screen.width}x${window.screen.height} • Pagina: ${window.location.pathname}`
      : "Desktop/Mobile";

    try {
      if (recordedAudio) {
        // Invio tramite pipeline audio multimodale con segnalazione
        const res = await fetch("/app-api/audio-note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: recordedAudio.base64,
            durata_sec: recordedAudio.durationSec,
            formato: "webm",
            contesto: "app_feedback",
            tipoSegnalazione: tipo,
            titolo: titolo.trim() || (recordedAudio.transcript ? `Nota Vocale: ${recordedAudio.transcript.substring(0, 30)}...` : `Nota Vocale: ${tipo.toUpperCase()}`),
            descrizione: descrizione.trim() || recordedAudio.transcript || "Nota vocale allegata",
            transcript: recordedAudio.transcript || undefined,
            trascrizione_live: recordedAudio.transcript || undefined,
            anonimo: isAnonimo,
            deviceInfo,
          }),
        });

        if (res.ok) {
          toast.success("Segnalazione inviata con nota audio al team di sviluppo!");
          queryClient.invalidateQueries({ queryKey: ["segnalazioni-bug"] });
          queryClient.invalidateQueries({ queryKey: ["audio-notes"] });
          resetForm();
          onOpenChange(false);
        } else {
          toast.error("Errore nell'invio della segnalazione vocale.");
        }
      } else {
        // Invio standard testuale
        const res = await fetch("/app-api/segnalazioni-bug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo,
            titolo: titolo.trim(),
            descrizione: descrizione.trim(),
            anonimo: isAnonimo,
            device_info: deviceInfo,
          }),
        });

        if (res.ok) {
          toast.success("Grazie! Il tuo suggerimento o segnalazione è stato inviato.");
          queryClient.invalidateQueries({ queryKey: ["segnalazioni-bug"] });
          resetForm();
          onOpenChange(false);
        } else {
          toast.error("Errore nell'invio della segnalazione.");
        }
      }
    } catch {
      toast.error("Errore di connessione durante l'invio.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 bg-white rounded-3xl shadow-2xl border-2 border-zinc-200 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1c00ff] text-[#e3ff00]">
              Area46 Voice & Feedback
            </span>
          </div>
          <DialogTitle className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <MessageSquarePlus className="size-5 text-[#1c00ff]" />
            Suggerimenti, Idee & Bug Report
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 font-medium">
            Aiutaci a rendere l&apos;App perfetta: condividi un&apos;idea, segnala un problema o inviaci una nota vocale.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Selettore Tipo Segnalazione */}
          <div>
            <label className="block text-xs font-black text-zinc-900 uppercase tracking-wider mb-1.5">
              Tipo di segnalazione:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTipo("consiglio")}
                className={`py-2.5 px-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  tipo === "consiglio"
                    ? "bg-[#1c00ff] text-white border-[#1c00ff] shadow-md shadow-[#1c00ff]/20 font-black"
                    : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 font-bold"
                }`}
              >
                <Lightbulb className={`size-4 ${tipo === "consiglio" ? "text-[#e3ff00]" : "text-amber-500"}`} />
                <span className="text-[11px]">Idea / Consiglio</span>
              </button>

              <button
                type="button"
                onClick={() => setTipo("bug")}
                className={`py-2.5 px-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  tipo === "bug"
                    ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20 font-black"
                    : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 font-bold"
                }`}
              >
                <Bug className={`size-4 ${tipo === "bug" ? "text-white" : "text-rose-600"}`} />
                <span className="text-[11px]">Segnala Bug</span>
              </button>

              <button
                type="button"
                onClick={() => setTipo("altro")}
                className={`py-2.5 px-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  tipo === "altro"
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-md font-black"
                    : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 font-bold"
                }`}
              >
                <HelpCircle className={`size-4 ${tipo === "altro" ? "text-[#e3ff00]" : "text-zinc-500"}`} />
                <span className="text-[11px]">Altro</span>
              </button>
            </div>
          </div>

          {/* Switch Invia in forma anonima */}
          <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${isAnonimo ? "bg-zinc-900 text-[#e3ff00]" : "bg-zinc-200 text-zinc-700"}`}>
                <EyeOff className="size-4" />
              </div>
              <div>
                <div className="text-xs font-black text-zinc-900">Invia in forma anonima</div>
                <div className="text-[10px] text-zinc-500">
                  {isAnonimo
                    ? "La tua identità ed email non verranno collegate."
                    : `Invierai come: ${currentUser?.name || currentUser?.email || "Atleta Lab"}`}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAnonimo(!isAnonimo)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                isAnonimo ? "bg-[#1c00ff]" : "bg-zinc-300"
              }`}
            >
              <span
                className={`size-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  isAnonimo ? "left-6.5 shadow-xs" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {/* Titolo e Descrizione */}
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1">
              Titolo riassuntivo:
            </label>
            <Input
              placeholder={tipo === "bug" ? "Es. Errore salvataggio pesi..." : "Es. Suggerimento grafica o calendario..."}
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              className="text-xs rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1">
              Dettagli o descrizione (opzionale se registri audio):
            </label>
            <Textarea
              placeholder="Spiega nei dettagli cosa hai notato o come migliorare l'esperienza..."
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              className="text-xs h-20 rounded-xl"
            />
          </div>

          {/* Registratore Vocale Diretto */}
          <div>
            <AudioFeedbackRecorder
              label="Spiega a voce libera con una nota vocale (opzionale)"
              maxDurationSec={60}
              onAudioRecorded={(audio) => setRecordedAudio(audio)}
              onAudioCleared={() => setRecordedAudio(null)}
            />
          </div>

          {/* Dettagli automatici dispositivo */}
          <div className="p-2.5 rounded-xl bg-zinc-100 text-[10px] text-zinc-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Smartphone className="size-3.5 text-zinc-400" />
              Info dispositivo rilevate in automatico per la diagnosi
            </span>
            <span className="font-mono text-[9px] bg-white px-1.5 py-0.5 rounded border border-zinc-200">
              Auto-diagnosi AI
            </span>
          </div>

          {/* Bottoni azione */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#1c00ff] hover:bg-[#1600cc] text-white rounded-xl text-xs font-black shadow-md shadow-[#1c00ff]/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Send className="size-3.5" />
              <span>{isSubmitting ? "Invio in corso…" : "Invia Segnalazione"}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
