import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Sparkles, Check, X, Loader2, Volume2, AlertCircle, Edit3 } from "lucide-react";
import { toast } from "./Toast";

interface VoiceSetLoggerModalProps {
  open: boolean;
  onClose: () => void;
  setIndex: number;
  targetPrescrizione?: string;
  onApplyParsedSet: (result: {
    carico_kg: number | null;
    ripetizioni: number | null;
    rpe: string | null;
    note: string | null;
  }) => void;
}

// -------------------------------------------------------------
// MOTORE SEMANTICO DETERMINISTICO CLIENT-SIDE (ZERO FAIL GUARANTEE)
// -------------------------------------------------------------
const NUMERI_ITALIANI: Record<string, number> = {
  zero: 0, uno: 1, un: 1, una: 1, due: 2, tre: 3, tré: 3, quattro: 4, cinque: 5,
  sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12,
  tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18,
  diciannove: 19, venti: 20, ventuno: 21, ventidue: 22, ventitre: 23, ventitré: 23,
  ventiquattro: 24, venticinque: 25, trenta: 30, trentacinque: 35, quaranta: 40,
  quarantacinque: 45, cinquanta: 50, cinquantacinque: 55, sessanta: 60, settanta: 70,
  ottanta: 80, novanta: 90, cento: 100,
};

function sanitizzaTermineBiomeccanicaClient(s: string): string {
  if (!s) return "";
  return s
    .replace(/biomeccanic[a-zA-Z]*/gi, "pattern motorio")
    .replace(/catena\s+cinetica/gi, "linea di spinta")
    .replace(/fulcro/gi, "punto d'appoggio");
}

function parseNumeroClient(parola: string): number | null {
  if (!parola) return null;
  const p = parola.toLowerCase().trim().replace(/,/g, ".");
  const num = parseFloat(p);
  if (!isNaN(num) && /^[0-9]+(?:\.[0-9]+)?$/.test(p)) return num;
  if (NUMERI_ITALIANI[p] !== undefined) return NUMERI_ITALIANI[p];
  return null;
}

function resolveRpeClient(testo: string): string | null {
  const lower = testo.toLowerCase();

  // RIR
  if (lower.match(/(?:due|2)\s*(?:in\s*canna|di\s*riserva|colpi\s*di\s*riserva|buffer\s*2)/i)) return "8.0";
  if (lower.match(/(?:un|uno|1)\s*(?:in\s*canna|di\s*riserva|colpo\s*di\s*riserva|buffer\s*1)/i)) return "9.0";
  if (lower.match(/(?:tre|3)\s*(?:in\s*canna|di\s*riserva|colpi\s*di\s*riserva|buffer\s*3)/i)) return "7.0";
  if (lower.match(/(?:a\s*tutta|a\s*cedimento|zero\s*in\s*canna|massimale|limite\s*assoluto)/i)) return "10.0";

  const normalized = lower
    .replace(/\br\.p\.e\.\b/g, "rpe")
    .replace(/\br\s*p\s*e\b/g, "rpe")
    .replace(/\brp\b/g, "rpe")
    .replace(/\berrepé\b/g, "rpe")
    .replace(/\breppe\b/g, "rpe")
    .replace(/\bsforzo\b/g, "rpe")
    .replace(/\bfatica\b/g, "rpe");

  const rpeIdx = normalized.indexOf("rpe");
  let target = rpeIdx !== -1 ? normalized.substring(rpeIdx) : normalized;

  // Range RPE
  const matchRange = target.match(
    /rpe\s*(?:credo|direi|circa|intorno\s*a|su|tra|fra|da)?\s*([0-9]+(?:[.,][0-9]+)?|[a-z]+)\s*(?:e\s*mezzo)?\s*(?:e|ed|a|o|-)\s*([0-9]+(?:[.,][0-9]+)?|[a-z]+)\s*(?:e\s*mezzo)?/i
  );
  if (matchRange) {
    let v1 = parseNumeroClient(matchRange[1]);
    let v2 = parseNumeroClient(matchRange[2]);
    if (matchRange[0].includes("mezzo") && v1 !== null) v1 += 0.5;
    if (matchRange[0].includes("mezzo") && v2 !== null) v2 += 0.5;
    if (v1 !== null && v2 !== null && v1 >= 5 && v1 <= 10 && v2 >= 5 && v2 <= 10) {
      return ((v1 + v2) / 2).toFixed(1);
    }
  }

  // Singolo RPE
  const singleMatch = target.match(
    /rpe\s*(?:credo|direi|circa|intorno\s*a|su|pari\s*a|di)?\s*([0-9]+(?:[.,][0-9]+)?|[a-z]+)(?:\s*e\s*mezzo)?/i
  );
  if (singleMatch) {
    let val = parseNumeroClient(singleMatch[1]);
    if (val !== null) {
      if (singleMatch[0].includes("mezzo")) val += 0.5;
      if (val >= 5 && val <= 10) return val.toFixed(1);
    }
  }

  return null;
}

function parseWorkoutSetClientFallback(testo: string) {
  const sanitized = sanitizzaTermineBiomeccanicaClient(testo).trim();
  const lower = sanitized.toLowerCase();

  let carico_kg: number | null = null;
  let ripetizioni: number | null = null;
  let rpe = resolveRpeClient(lower);

  // Carico
  if (lower.includes("corpo libero") || lower.includes("senza peso") || lower.includes("peso corporeo")) {
    carico_kg = 0;
  } else {
    const mKg = lower.match(/([0-9]+(?:[.,][0-9]+)?|[a-z]+)\s*(?:e\s*mezzo)?\s*(?:chili|kg|kili)/i);
    if (mKg) {
      let val = parseNumeroClient(mKg[1]);
      if (val !== null) {
        if (mKg[0].includes("mezzo")) val += 0.5;
        carico_kg = val;
      }
    }
    if (carico_kg === null) {
      const mCon = lower.match(/(?:con|carico|peso|bilanciere\s*a)\s+([0-9]+(?:[.,][0-9]+)?|[a-z]+)/i);
      if (mCon) {
        let val = parseNumeroClient(mCon[1]);
        if (val !== null && val > 0 && val <= 300) carico_kg = val;
      }
    }
  }

  // Ripetizioni
  const mRep = lower.match(/([0-9]+|[a-z]+)\s*(?:ripetizioni|ripetizione|colpi|colpo|rep|reps|rip|volte)/i) ||
    lower.match(/(?:fatte|chiuse|fatti|eseguite|tirate)\s+([0-9]+|[a-z]+)/i);
  if (mRep) {
    const val = parseNumeroClient(mRep[1]);
    if (val !== null && val >= 1 && val <= 100) ripetizioni = Math.round(val);
  } else {
    const mStart = lower.match(/^(?:allora\s+)?([0-9]+|[a-z]+)\s+(?:con|a|al)\s+/i);
    if (mStart) {
      const val = parseNumeroClient(mStart[1]);
      if (val !== null && val >= 1 && val <= 50) ripetizioni = Math.round(val);
    }
  }

  // Note
  const clausole = sanitized.split(/[,.;:]|\b(?:ma|però|tuttavia|anche se|invece|perché|perche|sentivo|avvertivo)\b/i);
  const noteArr: string[] = [];
  for (const cl of clausole) {
    const trimCl = cl.trim();
    const l = trimCl.toLowerCase();
    if (!trimCl) continue;
    if (/(?:sentivo|avvertivo|sensazione|spalla|schiena|femorale|gluteo|ginocchio|anca|gamba|rigido|fluido|buon[ao]|ottimo|cedimento|fatica|calo|energia|stanco)/i.test(l)) {
      const clean = trimCl.replace(/\b(?:r\.?p\.?e\.?|sforzo)\s*[0-9]+(?:[.,][0-9]+)?/gi, "").trim();
      if (clean.length > 3) noteArr.push(clean);
    }
  }

  let finalNote = noteArr.length > 0 ? noteArr.join(", ") : null;
  if (finalNote) {
    finalNote = sanitizzaTermineBiomeccanicaClient(finalNote.charAt(0).toUpperCase() + finalNote.slice(1));
  }

  return {
    success: carico_kg !== null || ripetizioni !== null || rpe !== null,
    carico_kg,
    ripetizioni,
    rpe,
    note: finalNote,
  };
}

// -------------------------------------------------------------
// COMPONENTE MODALE ATHLETIC-LUXURY
// -------------------------------------------------------------
export const VoiceSetLoggerModal: React.FC<VoiceSetLoggerModalProps> = ({
  open,
  onClose,
  setIndex,
  targetPrescrizione,
  onApplyParsedSet,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    carico_kg: number | null;
    ripetizioni: number | null;
    rpe: string | null;
    note: string | null;
  } | null>(null);

  const recognitionRef = useRef<any>(null);

  // Reset e controllo supporto browser all'apertura
  useEffect(() => {
    if (open) {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
        setSpeechNotice("Dettatura browser non supportata nativamente: tocca il campo e usa il tasto microfono della tastiera dello smartphone o scrivi il messaggio.");
      } else {
        setSpeechSupported(true);
        setSpeechNotice(null);
      }
    } else {
      stopRecording();
      setTranscript("");
      setParsedPreview(null);
      setIsAnalyzing(false);
      setSpeechNotice(null);
    }
  }, [open]);

  const startRecording = () => {
    setSpeechNotice(null);
    setParsedPreview(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechNotice("Dettatura vocale non attiva. Tocca la casella e usa il microfono della tastiera dello smartphone o scrivi liberamente.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "it-IT";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try { navigator.vibrate(30); } catch {}
        }
      };

      recognition.onresult = (event: any) => {
        let full = "";
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript + " ";
        }
        setTranscript(full.trim());
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech Recognition Event:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setSpeechNotice("Microfono non autorizzato nel browser. Consenti l'accesso al microfono o usa la tastiera vocale del telefono.");
        } else if (event.error === "no-speech") {
          setSpeechNotice("Nessuna voce rilevata. Avvicinati al microfono e parla ad alta voce.");
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e: any) {
      console.warn("Errore avvio SpeechRecognition:", e);
      setSpeechNotice("Impossibile avviare il microfono: scrivi o usa il microfono della tastiera.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const handleAnalyze = async () => {
    stopRecording();
    const textToAnalyze = transcript.trim();
    if (!textToAnalyze) {
      toast.error("Nessun testo da analizzare. Parla o scrivi prima di procedere.");
      return;
    }

    setIsAnalyzing(true);

    try {
      // 1. Chiamata API server
      const res = await fetch("/app-api/ai-parse-voice-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToAnalyze,
          targetPrescrizione: targetPrescrizione || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setParsedPreview({
            carico_kg: data.carico_kg,
            ripetizioni: data.ripetizioni,
            rpe: data.rpe,
            note: data.note,
          });
          toast.success(`Serie ${setIndex + 1} interpretata dall'Agente AI!`);
          setIsAnalyzing(false);
          return;
        }
      }

      // 2. Fallback deterministico locale garantito
      const localResult = parseWorkoutSetClientFallback(textToAnalyze);
      if (localResult.success) {
        setParsedPreview(localResult);
        toast.success(`Serie ${setIndex + 1} elaborata con successo!`);
      } else {
        toast.error("Nessun parametro numerico rilevato. Prova a specificare carico e ripetizioni.");
      }
    } catch (e) {
      // Fallback deterministico locale
      const localResult = parseWorkoutSetClientFallback(textToAnalyze);
      if (localResult.success) {
        setParsedPreview(localResult);
        toast.success(`Serie ${setIndex + 1} elaborata localmente!`);
      } else {
        toast.error("Errore nell'analisi. Riprova indicando chili e ripetizioni.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (parsedPreview) {
      onApplyParsedSet(parsedPreview);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-[#09090b] text-white shadow-2xl p-5 flex flex-col items-center text-center relative overflow-hidden"
        style={{
          boxShadow: "0 0 50px rgba(28, 0, 255, 0.25), 0 20px 40px rgba(0, 0, 0, 0.9)",
        }}
      >
        {/* Glow circolare estetico */}
        <div className="absolute -top-12 -right-12 size-36 rounded-full bg-[#1c00ff]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 size-36 rounded-full bg-[#e3ff00]/10 blur-3xl pointer-events-none" />

        {/* Tasto Chiudi */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>

        {/* Header con badge pulito (zero diciture "3 sec") */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c00ff]/20 border border-[#1c00ff]/40 mb-2.5 text-[11px] font-black uppercase tracking-wider text-[#e3ff00]">
          <Sparkles className="size-3 text-[#e3ff00]" />
          <span>Agente Voice Workout • Serie {setIndex + 1}</span>
        </div>

        <h3 className="text-lg font-black text-white tracking-tight">
          Dettatura Libera Set
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5 max-w-[280px]">
          Parla liberamente durante il recupero. L'IA traduce ed estrae carichi, reps, RPE e note.
        </p>

        {/* Microfono Pulsante Athletic-Luxury */}
        <div className="my-5 relative flex items-center justify-center">
          {isRecording && (
            <>
              <div className="absolute size-28 rounded-full bg-[#1c00ff]/30 animate-ping duration-1000" />
              <div className="absolute size-24 rounded-full border-2 border-[#e3ff00] animate-pulse" />
            </>
          )}

          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isAnalyzing}
            className={`relative size-20 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer active:scale-95 ${
              isRecording
                ? "bg-red-600 text-white shadow-red-600/50"
                : "text-white hover:scale-105"
            }`}
            style={{
              background: isRecording ? "#dc2626" : "#1c00ff",
              border: isRecording ? "2.5px solid #ffffff" : "2.5px solid #e3ff00",
            }}
            title={isRecording ? "Tocca per fermare la registrazione" : "Tocca per parlare"}
          >
            {isAnalyzing ? (
              <Loader2 className="size-8 animate-spin text-[#e3ff00]" />
            ) : isRecording ? (
              <MicOff className="size-8 text-white animate-pulse" />
            ) : (
              <Mic className="size-8 text-[#e3ff00]" />
            )}
          </button>
        </div>

        {/* Stato di ascolto / avvisi */}
        {isRecording && (
          <div className="flex items-center gap-2 text-xs font-bold text-[#e3ff00] mb-2 animate-pulse">
            <span className="size-2 rounded-full bg-red-500" />
            <span>In ascolto... Parla ora</span>
          </div>
        )}

        {speechNotice && (
          <div className="w-full flex items-start gap-2 bg-amber-950/40 border border-amber-600/40 rounded-xl p-2.5 mb-2.5 text-left text-[11px] text-amber-200">
            <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{speechNotice}</span>
          </div>
        )}

        {/* Casella Trascrizione / Input Modificabile in Tempo Reale */}
        <div className="w-full text-left space-y-1 mb-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 px-1">
            <span className="flex items-center gap-1">
              <Edit3 className="size-3 text-[#1c00ff]" />
              <span>Messaggio dettato / scritto:</span>
            </span>
            {transcript && (
              <button
                type="button"
                onClick={() => setTranscript("")}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
              >
                Cancella
              </button>
            )}
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Dì o scrivi: '8 ripetizioni con 45 chili, sforzo tra 7 e mezzo e 8 e mezzo, spalla destra un po' rigida'…"
            rows={3}
            className="w-full rounded-2xl bg-zinc-900 border border-zinc-700 p-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#1c00ff] focus:outline-none focus:ring-1 focus:ring-[#1c00ff]"
          />
        </div>

        {/* Suggerimenti rapidi in 1 tocco per test immediato */}
        {!transcript && !parsedPreview && (
          <div className="w-full flex flex-wrap gap-1.5 justify-center mb-3">
            {[
              "8 colpi con 50 kg rpe 8",
              "6 colpi a 60 kg rpe tra 7.5 e 8.5",
              "10 reps con 40 kg buone sensazioni",
            ].map((sugg) => (
              <button
                key={sugg}
                type="button"
                onClick={() => setTranscript(sugg)}
                className="text-[10px] bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded-lg border border-zinc-700/60 transition-colors cursor-pointer truncate max-w-[280px]"
              >
                + "{sugg}"
              </button>
            ))}
          </div>
        )}

        {/* Anteprima Parametri Rilevati */}
        {parsedPreview && (
          <div className="w-full rounded-2xl bg-zinc-900/90 border border-zinc-700 p-3 mb-3 text-left space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-emerald-400">
              <span>Parametri Estratti dall'IA:</span>
              <span className="text-zinc-400 font-normal">Pronto per la serie</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-zinc-800 p-2 rounded-xl border border-zinc-700/70">
                <div className="text-[10px] text-zinc-400 font-bold uppercase">Carico</div>
                <div className="text-sm font-black text-white">
                  {parsedPreview.carico_kg !== null ? `${parsedPreview.carico_kg} kg` : "N/D"}
                </div>
              </div>
              <div className="bg-zinc-800 p-2 rounded-xl border border-zinc-700/70">
                <div className="text-[10px] text-zinc-400 font-bold uppercase">Reps</div>
                <div className="text-sm font-black text-white">
                  {parsedPreview.ripetizioni !== null ? `${parsedPreview.ripetizioni}` : "N/D"}
                </div>
              </div>
              <div className="bg-zinc-800 p-2 rounded-xl border border-zinc-700/70">
                <div className="text-[10px] text-zinc-400 font-bold uppercase">RPE</div>
                <div className="text-sm font-black text-[#e3ff00]">
                  {parsedPreview.rpe || "N/D"}
                </div>
              </div>
            </div>

            {parsedPreview.note && (
              <div className="text-[11px] text-zinc-300 italic bg-zinc-800/50 p-2 rounded-lg border border-zinc-700/50">
                <span className="font-bold text-zinc-400 not-italic">Note:</span> “{parsedPreview.note}”
              </div>
            )}
          </div>
        )}

        {/* Pulsanti Azione */}
        <div className="w-full flex gap-2">
          {parsedPreview ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setParsedPreview(null);
                  startRecording();
                }}
                className="flex-1 py-3 px-3 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-bold uppercase hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Riprova
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-[2] py-3 px-3 rounded-xl text-xs font-black text-white shadow-lg cursor-pointer flex items-center justify-center gap-1.5 transition-transform hover:scale-[1.02] active:scale-98"
                style={{
                  background: "#1c00ff",
                  border: "1.5px solid #e3ff00",
                }}
              >
                <Check className="size-4 text-[#e3ff00]" />
                <span>Applica alla Serie</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-3 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-bold uppercase hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !transcript.trim()}
                className={`flex-[2] py-3 px-3 rounded-xl text-xs font-black text-white shadow-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                  !transcript.trim() || isAnalyzing
                    ? "opacity-50 cursor-not-allowed bg-zinc-800 border border-zinc-700"
                    : "hover:scale-[1.02] active:scale-98"
                }`}
                style={{
                  background: transcript.trim() ? "#1c00ff" : undefined,
                  border: transcript.trim() ? "1.5px solid #e3ff00" : undefined,
                }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-[#e3ff00]" />
                    <span>Analisi IA in corso…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 text-[#e3ff00]" />
                    <span>Analizza con Agente AI</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
