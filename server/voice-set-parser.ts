import fs from "node:fs";
import path from "node:path";

export interface VoiceWorkoutSetResult {
  success: boolean;
  carico_kg: number | null;
  ripetizioni: number | null;
  rpe: string | null;
  note: string | null;
  raw_text: string;
}

/**
 * Converte le parole numeriche italiane di uso comune in numeri
 */
const NUMERI_ITALIANI: Record<string, number> = {
  zero: 0,
  uno: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
  undici: 11,
  dodici: 12,
  tredici: 13,
  quattordici: 14,
  quindici: 15,
  sedici: 16,
  diciassette: 17,
  diciotto: 18,
  diciannove: 19,
  venti: 20,
  ventuno: 21,
  ventidue: 22,
  ventitre: 23,
  ventitré: 23,
  ventiquattro: 24,
  venticinque: 25,
  trenta: 30,
  trentacinque: 35,
  quaranta: 40,
  quarantacinque: 45,
  cinquanta: 50,
  cinquantacinque: 55,
  sessanta: 60,
  sessantacinque: 65,
  settanta: 70,
  settantacinque: 75,
  ottanta: 80,
  ottantacinque: 85,
  novanta: 90,
  cento: 100,
};

export function sanitizzaTermineBiomeccanica(s: string): string {
  if (!s) return "";
  return s.replace(/biomeccanic[a-zA-Z]*/gi, "pattern motorio");
}

function parseNumeroParola(parola: string): number | null {
  const p = parola.toLowerCase().trim().replace(/[,]/g, ".");
  if (!isNaN(parseFloat(p))) return parseFloat(p);
  if (NUMERI_ITALIANI[p] !== undefined) return NUMERI_ITALIANI[p];

  // Gestione decine composte (es. "quarantadue" -> 40 + 2 = 42)
  const decine: Record<string, number> = {
    vent: 20, venti: 20,
    trent: 30, trenta: 30,
    quarant: 40, quaranta: 40,
    cinquant: 50, cinquanta: 50,
    sessant: 60, sessanta: 60,
    settant: 70, settanta: 70,
    ottant: 80, ottanta: 80,
    novant: 90, novanta: 90,
  };

  const unita: Record<string, number> = {
    uno: 1, due: 2, tre: 3, tré: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9,
  };

  for (const [decStr, decVal] of Object.entries(decine)) {
    if (p.startsWith(decStr)) {
      const resto = p.slice(decStr.length);
      if (!resto) return decVal;
      if (unita[resto] !== undefined) return decVal + unita[resto];
    }
  }

  return null;
}

/**
 * Risolutore RPE: gestisce singoli valori e range di buon senso calcolando la media esatta.
 * Es: "tra 7.5 e 8.5" -> 8.0
 * Es: "otto o nove" -> 8.5
 * Es: "tra 7 e 8" -> 7.5
 */
export function resolveRpeRange(testo: string): string | null {
  const lower = testo.toLowerCase();

  // Pattern per identificare dove si parla di RPE
  const rpeKeywordIndex = lower.indexOf("rpe");
  let targetSubstring = lower;
  if (rpeKeywordIndex !== -1) {
    targetSubstring = lower.substring(rpeKeywordIndex);
  }

  // 1. Ricerca del range esplicito (es. "fra 7.5 e 8.5", "otto o nove", "7 e mezzo e 8 e mezzo")
  const matchRange = targetSubstring.match(
    /(?:tra|fra|da)?\s*([0-9]+(?:[.,][0-9]+)?|sei|sette|otto|nove|dieci)\s*(?:e\s*mezzo)?\s*(?:e|ed|a|o|-)\s*([0-9]+(?:[.,][0-9]+)?|sei|sette|otto|nove|dieci)\s*(?:e\s*mezzo)?/i
  );

  if (matchRange) {
    let v1 = parseNumeroParola(matchRange[1]);
    let v2 = parseNumeroParola(matchRange[2]);

    if (matchRange[0].includes("e mezzo") || matchRange[0].includes("e mezzo")) {
      const parts = matchRange[0].split(/(?:e|ed|a|o|-)/i);
      if (parts[0] && parts[0].includes("mezzo") && v1 !== null) v1 += 0.5;
      if (parts[1] && parts[1].includes("mezzo") && v2 !== null) v2 += 0.5;
    }

    if (v1 !== null && v2 !== null && v1 >= 5 && v1 <= 10 && v2 >= 5 && v2 <= 10) {
      const media = (v1 + v2) / 2;
      return media.toFixed(1);
    }
  }

  // 2. Singolo valore RPE esplicito (es. "rpe 8.5", "rpe 8", "rpe otto e mezzo")
  const singleMatch = targetSubstring.match(
    /rpe\s*(?:credo|direi|circa|intorno a|su)?\s*([0-9]+(?:[.,][0-9]+)?|sei|sette|otto|nove|dieci)(?:\s*e\s*mezzo)?/i
  );
  if (singleMatch) {
    let val = parseNumeroParola(singleMatch[1]);
    if (val !== null) {
      if (singleMatch[0].includes("e mezzo")) val += 0.5;
      if (val >= 5 && val <= 10) {
        return val.toFixed(1);
      }
    }
  }

  // 3. Fallback: cerca qualsiasi numero compreso tra 5 e 10 associato a rpe
  const generalRpe = targetSubstring.match(/rpe[^0-9a-z]*([5-9](?:[.,][0-9])?|10)/i);
  if (generalRpe) {
    const val = parseFloat(generalRpe[1].replace(",", "."));
    if (!isNaN(val) && val >= 5 && val <= 10) {
      return val.toFixed(1);
    }
  }

  return null;
}

/**
 * Motore Deterministico di estrazione parametri set da testo in italiano.
 */
export function parseWorkoutSetDeterministic(testo: string): VoiceWorkoutSetResult {
  const sanitized = sanitizzaTermineBiomeccanica(testo).trim();
  const lower = sanitized.toLowerCase();

  let carico_kg: number | null = null;
  let ripetizioni: number | null = null;
  let rpe: string | null = resolveRpeRange(lower);

  // 1. Estrazione Carico (kg)
  if (lower.includes("corpo libero") || lower.includes("senza peso") || lower.includes("peso corporeo")) {
    carico_kg = 0;
  } else {
    // Es. "50 kg", "50 chili e mezzo", "quarantadue e mezzo chili", "con 52.5 chili", "carico 60"
    const caricoPatterns = [
      /([0-9]+(?:[.,][0-9]+)?)\s*(?:e\s*mezzo)?\s*(?:chili|kg|kili)\s*(?:e\s*mezzo)?/i,
      /([a-z]+)\s*(?:e\s*mezzo)?\s*(?:chili|kg|kili)\s*(?:e\s*mezzo)?/i,
      /(?:con|carico|peso|bilanciere)\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:e\s*mezzo)?/i,
      /(?:con|carico|peso)\s*([a-z]+)\s*(?:e\s*mezzo)?/i,
    ];

    for (const pat of caricoPatterns) {
      const m = lower.match(pat);
      if (m) {
        let val = parseNumeroParola(m[1]);
        if (val !== null) {
          if (m[0].includes("e mezzo") || m[0].includes("mezzo")) val += 0.5;
          carico_kg = val;
          break;
        }
      }
    }

    // Se ancora nullo, cerca es: "con 50" (se non associato a ripetizioni o rpe)
    if (carico_kg === null) {
      const matchCon = lower.match(/(?:con|a)\s+([0-9]+(?:[.,][0-9]+)?)(?!\s*(?:colpi|rep|ripetizioni))/i);
      if (matchCon) {
        const val = parseFloat(matchCon[1].replace(",", "."));
        if (!isNaN(val)) carico_kg = val;
      }
    }
  }

  // 2. Estrazione Ripetizioni (reps)
  // Es. "6 ripetizioni", "sei colpi", "8 rep", "10 rip", "fatte 5"
  const repPatterns = [
    /([0-9]+)\s*(?:ripetizioni|ripetizione|colpi|colpo|rep|reps|rip)/i,
    /([a-z]+)\s*(?:ripetizioni|ripetizione|colpi|colpo|rep|reps|rip)/i,
    /(?:fatte|chiuse|fatti|eseguite)\s*([0-9]+|[a-z]+)/i,
  ];

  for (const pat of repPatterns) {
    const m = lower.match(pat);
    if (m) {
      const val = parseNumeroParola(m[1]);
      if (val !== null && val >= 1 && val <= 100) {
        ripetizioni = Math.round(val);
        break;
      }
    }
  }

  // Se ancora nullo, cerca un numero a inizio frase se seguito da "con X kg"
  if (ripetizioni === null) {
    const startNumMatch = lower.match(/^([0-9]+)\s+(?:con|a|al)\s+/i);
    if (startNumMatch) {
      const val = parseInt(startNumMatch[1], 10);
      if (!isNaN(val) && val >= 1 && val <= 100) {
        ripetizioni = val;
      }
    }
  }

  // 3. Estrazione Note / Sensazioni
  let noteText = sanitized;
  noteText = noteText.replace(/(?:con\s+)?(?:carico\s+)?(?:peso\s+)?[0-9]+(?:[.,][0-9]+)?\s*(?:e\s*mezzo)?\s*(?:kg|chili|kili)?/gi, " ");
  noteText = noteText.replace(/(?:a\s+)?corpo\s+libero/gi, " ");
  noteText = noteText.replace(/[0-9]+\s*(?:ripetizioni|ripetizione|colpi|colpo|rep|reps|rip)/gi, " ");
  noteText = noteText.replace(/(?:fatte|chiuse|eseguite)\s*[0-9]+/gi, " ");
  noteText = noteText.replace(/rpe\s*(?:credo|direi|circa|intorno a|su)?\s*(?:tra|fra|da)?\s*[0-9]+(?:[.,][0-9]+)?\s*(?:e|ed|a|o|-)\s*[0-9]+(?:[.,][0-9]+)?/gi, " ");
  noteText = noteText.replace(/rpe\s*(?:credo|direi|circa|intorno a|su)?\s*[0-9]+(?:[.,][0-9]+)?(?:\s*e\s*mezzo)?/gi, " ");
  noteText = noteText.replace(/rpe/gi, " ");

  const paroleDaEscludere = new Set([
    "con", "fra", "tra", "del", "della", "delle", "dei", "credo", "direi", "circa",
    "fatto", "fatta", "fatti", "fatte", "set", "serie", "ripetizioni", "ripetizione",
    "colpi", "colpo", "rep", "reps", "rip", "chili", "kili", "kg", "mezzo", "mezzi",
    "fino", "intorno", "peso", "carico", "bilanciere", "sensazione",
    ...Object.keys(NUMERI_ITALIANI),
  ]);

  const parolePulite = noteText
    .split(/\s+/)
    .map((w) => w.trim().replace(/^[,.;:!?()"-]+|[,.;:!?()"-]+$/g, ""))
    .filter((w) => {
      const lowerWord = w.toLowerCase();
      if (w.length <= 2) return false;
      if (paroleDaEscludere.has(lowerWord)) return false;
      if (parseNumeroParola(lowerWord) !== null) return false;
      return true;
    });

  const finalNote = parolePulite.length > 0 ? parolePulite.join(" ") : null;

  return {
    success: carico_kg !== null || ripetizioni !== null || rpe !== null,
    carico_kg,
    ripetizioni,
    rpe,
    note: finalNote ? sanitizzaTermineBiomeccanica(finalNote) : null,
    raw_text: sanitized,
  };
}

/**
 * Funzione unificata di Voice Workout Logging con Agente AI (Gemini 2.5 Flash / Flash Audio)
 * e fallback euristico deterministico immediato di Verità Operativa.
 */
export async function parseVoiceWorkoutSet(input: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  filePath?: string;
  targetPrescrizione?: string;
}): Promise<VoiceWorkoutSetResult> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    "";

  let audioData = input.audioBase64 || "";
  let mimeType = input.mimeType || "audio/webm";

  if (!audioData && input.filePath && fs.existsSync(input.filePath)) {
    const ext = path.extname(input.filePath).toLowerCase();
    if (ext === ".mp4" || ext === ".m4a") mimeType = "audio/mp4";
    else if (ext === ".wav") mimeType = "audio/wav";
    else if (ext === ".mp3") mimeType = "audio/mpeg";
    else mimeType = "audio/webm";

    audioData = fs.readFileSync(input.filePath).toString("base64");
  }

  // Se c'è la chiave Gemini e abbiamo o audio o testo, possiamo interrogare il modello multimodale
  if (apiKey && (audioData || (input.text && input.text.trim().length > 3))) {
    try {
      const systemInstruction = `
Sei l'Agente Voice Workout Logger (Aura & Socrates) di Area46 Landmine Lab.
Il tuo compito è analizzare la dettatura vocale dell'atleta registrata durante il recupero post-serie
ed estrarre i parametri numerici precisi del set eseguito in formato JSON strutturato.

VINCOLI METODOLOGICI E REGOLE DI BUON SENSO:
1. "carico_kg": numero decimale o intero espresso in kg (es. "cinquanta chili" -> 50, "quarantadue e mezzo" -> 42.5, "a corpo libero" -> 0).
2. "ripetizioni": intero di ripetizioni o colpi eseguiti (es. "6 ripetizioni", "sei colpi", "8 rep" -> 6, 8).
3. "rpe": stringa con il valore RPE.
   - RISOLUTORE INTELLIGENTE DI RANGE RPE: Se l'atleta indica un range o un'incertezza (es. "tra 7.5 e 8.5", "fra 7.5 e 8.5", "otto o nove", "tra 7 e 8"),
     CALCOLA LA MEDIA ESATTA DI BUON SENSO:
     * (7.5 + 8.5) / 2 = 8.0 -> "8.0"
     * (8 + 9) / 2 = 8.5 -> "8.5"
     * (7 + 8) / 2 = 7.5 -> "7.5"
     Se indica un valore singolo (es. "8", "8 e mezzo") -> "8.0" o "8.5".
4. "note": isola eventuali sensazioni, fatica o commenti qualitativi (es. "fatto facile", "leggero compenso", "pesante").
   DIVIETO ASSOLUTO del termine "biomeccanica": sostituiscilo sempre con "pattern motorio" o "economia del gesto".

Rispondi ESCLUSIVAMENTE con un JSON valido con questa esatta struttura:
{
  "carico_kg": number | null,
  "ripetizioni": number | null,
  "rpe": string | null,
  "note": string | null,
  "trascrizione": string
}
`;

      const contentsParts: any[] = [];
      if (audioData) {
        contentsParts.push({
          inlineData: {
            mimeType: mimeType,
            data: audioData,
          },
        });
      }
      if (input.text) {
        contentsParts.push({
          text: `Testo dettato: "${input.text}". Prescrizione scheda: ${input.targetPrescrizione || "N/D"}`,
        });
      } else {
        contentsParts.push({
          text: `Ascolta la dettatura vocale dell'atleta e compila i campi del set. Prescrizione scheda: ${input.targetPrescrizione || "N/D"}`,
        });
      }

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: contentsParts }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      });

      if (response.ok) {
        const geminiData = await response.json();
        const textResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          const parsed = JSON.parse(textResponse);
          const rawText = parsed.trascrizione || input.text || "";
          const pulisci = (s: string | null) =>
            s ? s.replace(/biomeccanic[aoe]/gi, "pattern motorio") : null;

          let finalRpe = parsed.rpe ? String(parsed.rpe).trim() : null;
          if (finalRpe && (finalRpe.includes("-") || finalRpe.includes("e") || finalRpe.includes("o"))) {
            const resolved = resolveRpeRange(finalRpe);
            if (resolved) finalRpe = resolved;
          }

          return {
            success: true,
            carico_kg: parsed.carico_kg !== undefined ? parsed.carico_kg : null,
            ripetizioni: parsed.ripetizioni !== undefined ? parsed.ripetizioni : null,
            rpe: finalRpe,
            note: pulisci(parsed.note),
            raw_text: pulisci(rawText) || "",
          };
        }
      }
    } catch (err) {
      console.warn("Chiamata Gemini API per voice workout logger fallita, passaggio al fallback euristico:", err);
    }
  }

  // Fallback Deterministico di Verità Operativa
  const sourceText = input.text || "";
  return parseWorkoutSetDeterministic(sourceText);
}
