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
 * Mappatura parole numeriche italiane
 */
const NUMERI_ITALIANI: Record<string, number> = {
  zero: 0,
  uno: 1, un: 1, una: 1,
  due: 2,
  tre: 3, tré: 3,
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
  venti: 20, vent: 20,
  ventuno: 21,
  ventidue: 22,
  ventitre: 23, ventitré: 23,
  ventiquattro: 24,
  venticinque: 25,
  ventisei: 26,
  ventisette: 27,
  ventotto: 28,
  ventinove: 29,
  trenta: 30, trent: 30,
  trentacinque: 35,
  quaranta: 40, quarant: 40,
  quarantacinque: 45,
  cinquanta: 50, cinquant: 50,
  cinquantacinque: 55,
  sessanta: 60, sessant: 60,
  sessantacinque: 65,
  settanta: 70, settant: 70,
  settantacinque: 75,
  ottanta: 80, ottant: 80,
  ottantacinque: 85,
  novanta: 90, novant: 90,
  novantacinque: 95,
  cento: 100,
};

/**
 * Sanitizza il termine biomeccanica/o in pattern motorio per gli atleti
 */
export function sanitizzaTermineBiomeccanica(s: string): string {
  if (!s) return "";
  return s
    .replace(/biomeccanic[a-zA-Z]*/gi, "pattern motorio")
    .replace(/catena\s+cinetica/gi, "linea di spinta")
    .replace(/fulcro/gi, "punto d'appoggio");
}

/**
 * Converte qualsiasi stringa di numero o parola italiana in float
 */
export function parseNumeroParola(parola: string): number | null {
  if (!parola) return null;
  const p = parola.toLowerCase().trim().replace(/,/g, ".");
  const numDirect = parseFloat(p);
  if (!isNaN(numDirect) && /^[0-9]+(?:\.[0-9]+)?$/.test(p)) return numDirect;
  if (NUMERI_ITALIANI[p] !== undefined) return NUMERI_ITALIANI[p];

  const decine: Record<string, number> = {
    vent: 20,
    trent: 30,
    quarant: 40,
    cinquant: 50,
    sessant: 60,
    settant: 70,
    ottant: 80,
    novant: 90,
  };

  const unita: Record<string, number> = {
    uno: 1, due: 2, tre: 3, tré: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9,
  };

  for (const [decStr, decVal] of Object.entries(decine)) {
    if (p.startsWith(decStr)) {
      const resto = p.slice(decStr.length);
      if (!resto) return decVal;
      if (unita[resto] !== undefined) return decVal + unita[resto];
      if (resto.startsWith("i") && unita[resto.slice(1)] !== undefined) return decVal + unita[resto.slice(1)];
      if (resto.startsWith("e") && unita[resto.slice(1)] !== undefined) return decVal + unita[resto.slice(1)];
    }
  }

  return null;
}

/**
 * Risolutore RPE & Reps in Reserve:
 * Riconosce RPE espliciti, range con media esatta, parole come sforzo/fatica, e RIR ("due di riserva").
 */
export function resolveRpeRange(testo: string): string | null {
  const lower = testo.toLowerCase();

  // 1. RIR (Reps in Reserve / colpi in canna)
  if (lower.match(/(?:due|2)\s*(?:in\s*canna|di\s*riserva|colpi\s*di\s*riserva|buffer\s*2)/i)) {
    return "8.0";
  }
  if (lower.match(/(?:un|uno|1)\s*(?:in\s*canna|di\s*riserva|colpo\s*di\s*riserva|buffer\s*1)/i)) {
    return "9.0";
  }
  if (lower.match(/(?:tre|3)\s*(?:in\s*canna|di\s*riserva|colpi\s*di\s*riserva|buffer\s*3)/i)) {
    return "7.0";
  }
  if (lower.match(/(?:a\s*tutta|a\s*cedimento|zero\s*in\s*canna|massimale|limite\s*assoluto)/i)) {
    return "10.0";
  }

  // 2. Normalizzazione termini acustici di "RPE"
  const normalized = lower
    .replace(/\br\.p\.e\.\b/g, "rpe")
    .replace(/\br\s*p\s*e\b/g, "rpe")
    .replace(/\brp\b/g, "rpe")
    .replace(/\berrepé\b/g, "rpe")
    .replace(/\breppe\b/g, "rpe")
    .replace(/\bsforzo\b/g, "rpe")
    .replace(/\bfatica\b/g, "rpe")
    .replace(/\bintensit[àa]\b/g, "rpe")
    .replace(/\bdifficolt[àa]\b/g, "rpe");

  const rpeIdx = normalized.indexOf("rpe");
  let targetSubstring = normalized;
  if (rpeIdx !== -1) {
    targetSubstring = normalized.substring(rpeIdx);
  }

  // A. Range esplicito dopo RPE (es. "rpe tra 7.5 e 8.5", "rpe 8 o 9", "rpe tra 7 e 8", "sforzo fra 7 e mezzo e 8 e mezzo")
  const matchRange = targetSubstring.match(
    /rpe\s*(?:credo|direi|circa|intorno\s*a|su|tra|fra|da)?\s*([0-9]+(?:[.,][0-9]+)?|[a-z]+)\s*(?:e\s*mezzo)?\s*(?:e|ed|a|o|-)\s*([0-9]+(?:[.,][0-9]+)?|[a-z]+)\s*(?:e\s*mezzo)?/i
  );

  if (matchRange) {
    let v1 = parseNumeroParola(matchRange[1]);
    let v2 = parseNumeroParola(matchRange[2]);

    if (matchRange[0].includes("e mezzo") || matchRange[0].includes("mezzo")) {
      const parts = matchRange[0].split(/(?:e|ed|a|o|-)/i);
      if (parts[0] && parts[0].includes("mezzo") && v1 !== null) v1 += 0.5;
      if (parts[1] && parts[1].includes("mezzo") && v2 !== null) v2 += 0.5;
    }

    if (v1 !== null && v2 !== null && v1 >= 5 && v1 <= 10 && v2 >= 5 && v2 <= 10) {
      const media = (v1 + v2) / 2;
      return media.toFixed(1);
    }
  }

  // B. Singolo valore RPE esplicito (es. "rpe 8.5", "rpe 8", "rpe otto e mezzo", "sforzo 7 e mezzo")
  const singleMatch = targetSubstring.match(
    /rpe\s*(?:credo|direi|circa|intorno\s*a|su|pari\s*a|di)?\s*([0-9]+(?:[.,][0-9]+)?|[a-z]+)(?:\s*e\s*mezzo)?/i
  );
  if (singleMatch) {
    let val = parseNumeroParola(singleMatch[1]);
    if (val !== null) {
      if (singleMatch[0].includes("e mezzo") || singleMatch[0].includes("mezzo")) val += 0.5;
      if (val >= 5 && val <= 10) {
        return val.toFixed(1);
      }
    }
  }

  // C. Fallback: cerca qualsiasi numero o parola 5..10 nei primi 25 caratteri dopo RPE
  if (rpeIdx !== -1) {
    const after = normalized.substring(rpeIdx, rpeIdx + 30);
    const mNum = after.match(/\b([5-9](?:[.,][0-9])?|10)\b/);
    if (mNum) {
      const n = parseFloat(mNum[1].replace(",", "."));
      if (!isNaN(n) && n >= 5 && n <= 10) return n.toFixed(1);
    }
  }

  return null;
}

/**
 * Estrae le note qualitative di senso compiuto preservando la fluidità della lingua italiana
 */
export function estraiNoteQualitative(testo: string): string | null {
  const sanitized = sanitizzaTermineBiomeccanica(testo).trim();
  if (!sanitized) return null;

  // Spezza la frase in clausole naturali (virgola, punto, punto e virgola, ma, però, tuttavia, sentivo, sensazione, perché)
  const clausole = sanitized.split(/[,.;:]|\b(?:ma|però|tuttavia|anche se|invece|perché|perche|sentivo|avvertivo)\b/i);

  const clausoleNote: string[] = [];

  for (let cl of clausole) {
    let trimCl = cl.trim();
    if (!trimCl) continue;

    const lower = trimCl.toLowerCase();

    // Se la clausola è solo dichiarazione di serie numerica (es: "ho fatto 8 ripetizioni", "con 45 chili", "rpe 8", "fatte 10 con 50 kg")
    const isPureParameters =
      /^(?:allora\s+|dunque\s+|ecco\s+)?(?:ho\s+fatto|fatte|chiuse|fatti|eseguite|tirate)?\s*(?:[0-9]+|[a-z]+)?\s*(?:ripetizioni|ripetizione|colpi|colpo|rep|reps|rip|volte)?\s*(?:con|a|al|per)?\s*(?:carico|peso)?\s*[0-9]+(?:[.,][0-9]+)?\s*(?:e\s*mezzo)?\s*(?:chili|kg|kili)?\s*(?:rpe\s*[0-9]+)?$/i.test(
        lower
      ) ||
      /^(?:con\s+)?[0-9]+(?:[.,][0-9]+)?\s*(?:e\s*mezzo)?\s*(?:chili|kg|kili)$/i.test(lower) ||
      /^(?:r\.?p\.?e\.?|sforzo|fatica)\s*(?:tra|fra|da)?\s*[0-9]+(?:[.,][0-9]+)?(?:\s*(?:e|o|-)\s*[0-9]+(?:[.,][0-9]+)?)?(?:\s*e\s*mezzo)?$/i.test(lower) ||
      /^(?:due|un|uno|tre|2|1|3)\s*(?:in\s*canna|di\s*riserva|colpi\s*di\s*riserva)$/i.test(lower) ||
      /^(?:prima|seconda|terza|quarta)\s*serie\s*(?:andata|fatta)?$/i.test(lower);

    if (isPureParameters) continue;

    // Se contiene parole qualitative, cliniche o di sensazione atletica, teniamola!
    const haParoleQualitative =
      /(?:sentivo|avvertivo|sensazione|sensazioni|spalla|schiena|femorale|gluteo|ginocchio|anca|gamba|braccio|pols[io]|collo|rigido|rigida|fluido|fluida|buon[ao]|ottimo|ottima|difficolt[àa]|pesante|pesantezza|leggero|leggera|facile|cedimento|fatica|assetto|controllo|velocit[àa]|esplosivit[àa]|pattern\s*motorio|bruciore|carico|spinta|stabilit[àa]|dolore|fitta|calo|energia|stanco|stanca|affaticat[ao])/i.test(
        lower
      );

    if (haParoleQualitative) {
      // Pulisci eventuali rimasugli di numeri isolati di RPE o carico a inizio/fine clausola
      let pulita = trimCl
        .replace(/^(?:e\s+|ed\s+|anche\s+|poi\s+)+/gi, "")
        .replace(/\b(?:r\.?p\.?e\.?|sforzo)\s*[0-9]+(?:[.,][0-9]+)?(?:\s*e\s*mezzo)?/gi, "")
        .replace(/\b(?:con\s+)?[0-9]+(?:[.,][0-9]+)?\s*(?:kg|chili)\b/gi, "")
        .trim();

      if (pulita.length > 3) {
        clausoleNote.push(pulita);
      }
    }
  }

  if (clausoleNote.length === 0) {
    // Fallback: se non abbiamo clausole isolate, verifichiamo se c'è una parola chiave nella frase intera
    const lowerAll = sanitized.toLowerCase();
    const matchSensazioni = sanitized.match(
      /(?:sentivo|sensazion[ei]|spalla|schiena|femorale|gluteo|ginocchio|anca|gamba|rigido|rigida|fluido|buon[ao]|ottimo|cedimento|controllo).+/i
    );
    if (matchSensazioni) {
      let candidate = matchSensazioni[0]
        .replace(/\b(?:r\.?p\.?e\.?|sforzo)\s*[0-9]+(?:[.,][0-9]+)?/gi, "")
        .trim();
      if (candidate.length > 4) {
        return sanitizzaTermineBiomeccanica(candidate.charAt(0).toUpperCase() + candidate.slice(1));
      }
    }
    return null;
  }

  let final = clausoleNote.join(", ").trim();
  final = final.replace(/\s+/g, " ");
  final = final.replace(/^[,.;:-]+\s*/, "").replace(/\s*[,.;:-]+$/, "").trim();
  if (final.length > 0) {
    final = final.charAt(0).toUpperCase() + final.slice(1);
    return sanitizzaTermineBiomeccanica(final);
  }
  return null;
}

/**
 * Motore Semantico Deterministico di estrazione parametri set da frase libera in italiano.
 */
export function parseWorkoutSetDeterministic(testo: string): VoiceWorkoutSetResult {
  const sanitized = sanitizzaTermineBiomeccanica(testo).trim();
  if (!sanitized) {
    return {
      success: false,
      carico_kg: null,
      ripetizioni: null,
      rpe: null,
      note: null,
      raw_text: "",
    };
  }

  const lower = sanitized.toLowerCase();
  let carico_kg: number | null = null;
  let ripetizioni: number | null = null;
  let rpe: string | null = resolveRpeRange(lower);

  // 1. ESTRAZIONE CARICO (KG)
  if (
    lower.includes("corpo libero") ||
    lower.includes("senza peso") ||
    lower.includes("peso corporeo") ||
    lower.includes("solo il corpo")
  ) {
    carico_kg = 0;
  } else {
    // A. Cerca numero arabo prima di chili/kg (es. "60 chili", "45.5 kg", "quarantadue e mezzo chili")
    const mNumKg = lower.match(/\b([0-9]+(?:[.,][0-9]+)?)\s*(?:e\s*mezzo)?\s*(?:chili|kg|kili)\b/i);
    if (mNumKg) {
      let val = parseFloat(mNumKg[1].replace(",", "."));
      if (!isNaN(val)) {
        if (mNumKg[0].includes("mezzo")) val += 0.5;
        carico_kg = val;
      }
    }

    // B. Cerca parole prima di chili/kg (es. "sessanta chili", "trenta cinque chili", "quarantacinque e mezzo chili")
    if (carico_kg === null) {
      const mWordKg = lower.match(/((?:[a-z]+\s+){0,2}[a-z]+)\s*(?:e\s*mezzo)?\s*(?:chili|kg|kili)\b/i);
      if (mWordKg) {
        const tokens = mWordKg[1].trim().split(/\s+/);
        for (let len = Math.min(2, tokens.length); len >= 1; len--) {
          const slice = tokens.slice(tokens.length - len);
          if (slice.length === 2) {
            const n1 = parseNumeroParola(slice[0]);
            const n2 = parseNumeroParola(slice[1]);
            if (n1 !== null && n2 !== null && n1 >= 20 && n2 < 10) {
              let total = n1 + n2;
              if (mWordKg[0].includes("mezzo")) total += 0.5;
              carico_kg = total;
              break;
            }
          } else if (slice.length === 1) {
            let n = parseNumeroParola(slice[0]);
            if (n !== null) {
              if (mWordKg[0].includes("mezzo")) n += 0.5;
              carico_kg = n;
              break;
            }
          }
        }
      }
    }

    // Pattern: "con X", "carico X", "peso X", "bilanciere a X"
    if (carico_kg === null) {
      const pCon = [
        /(?:con|carico|peso|bilanciere\s*a|messo|caricato)\s+([0-9]+(?:[.,][0-9]+)?)(?:\s*e\s*mezzo)?(?!\s*(?:colpi|rep|ripetizioni|volte))/i,
        /(?:con|carico|peso|bilanciere\s*a|messo|caricato)\s+([a-z]+)(?:\s*e\s*mezzo)?(?!\s*(?:colpi|rep|ripetizioni|volte))/i,
      ];
      for (const pat of pCon) {
        const m = lower.match(pat);
        if (m) {
          let val = parseNumeroParola(m[1]);
          if (val !== null && val > 0 && val <= 300) {
            if (m[0].includes("e mezzo") || m[0].includes("mezzo")) val += 0.5;
            carico_kg = val;
            break;
          }
        }
      }
    }

    // Pattern: "50x8"
    if (carico_kg === null) {
      const mCross = lower.match(/([0-9]+(?:[.,][0-9]+)?)\s*x\s*([0-9]+)/i);
      if (mCross) {
        const n1 = parseFloat(mCross[1].replace(",", "."));
        const n2 = parseInt(mCross[2], 10);
        if (!isNaN(n1) && !isNaN(n2)) {
          carico_kg = n1;
          if (ripetizioni === null) ripetizioni = n2;
        }
      }
    }
  }

  // 2. ESTRAZIONE RIPETIZIONI (REPS)
  if (ripetizioni === null) {
    const repPatterns = [
      /([0-9]+)\s*(?:ripetizioni|ripetizione|colpi|colpo|rep|reps|rip|volte)/i,
      /([a-z]+)\s*(?:ripetizioni|ripetizione|colpi|colpo|rep|reps|rip|volte)/i,
      /(?:fatte|chiuse|fatti|eseguite|tirate|chiuso|fatto)\s+([0-9]+|[a-z]+)/i,
      /(?:ceduto\s+alla|mollato\s+alla)\s+([0-9]+a?|prima|seconda|terza|quarta|quinta|sesta|settima|ottava|nona|decima)/i,
    ];

    const ordinali: Record<string, number> = {
      prima: 1, seconda: 2, terza: 3, quarta: 4, quinta: 5,
      sesta: 6, settima: 7, ottava: 8, nona: 9, decima: 10,
    };

    for (const pat of repPatterns) {
      const m = lower.match(pat);
      if (m) {
        const raw = m[1].toLowerCase().replace(/a$/, "");
        if (ordinali[raw] !== undefined) {
          ripetizioni = ordinali[raw];
          break;
        }
        const val = parseNumeroParola(raw);
        if (val !== null && val >= 1 && val <= 100) {
          ripetizioni = Math.round(val);
          break;
        }
      }
    }
  }

  // Pattern: inizio frase con numero es: "8 con 50 kg"
  if (ripetizioni === null) {
    const startNumMatch = lower.match(/^(?:allora\s+|dunque\s+)?([0-9]+|[a-z]+)\s+(?:con|a|al|per)\s+/i);
    if (startNumMatch) {
      const val = parseNumeroParola(startNumMatch[1]);
      if (val !== null && val >= 1 && val <= 50) {
        ripetizioni = Math.round(val);
      }
    }
  }

  // 3. ESTRAZIONE E ORDINAMENTO DELLE NOTE QUALITATIVE
  const note = estraiNoteQualitative(sanitized);

  const success = carico_kg !== null || ripetizioni !== null || rpe !== null;

  return {
    success,
    carico_kg,
    ripetizioni,
    rpe,
    note,
    raw_text: sanitized,
  };
}

/**
 * Funzione unificata di Voice Workout Logging con Agente AI (Gemini 2.0 Flash / Flash Audio)
 * e motore semantico deterministico NLP integrato di Verità Operativa.
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

  // Se c'è la chiave Gemini e abbiamo o audio o testo, interroghiamo il modello multimodale
  if (apiKey && (audioData || (input.text && input.text.trim().length > 2))) {
    try {
      const systemInstruction = `
Sei l'Agente Voice Workout Logger (Aura & Socrates) di Area46 Landmine Lab.
Il tuo compito è ascoltare/analizzare la dettatura vocale libera dell'atleta registrata dopo la serie ed estrarre i parametri numerici e le note in formato JSON.

REGOLE DI INTERPRETAZIONE:
1. "carico_kg": numero intero o decimale espresso in kg (es. "cinquanta chili" -> 50, "42 e mezzo" -> 42.5, "a corpo libero" -> 0).
2. "ripetizioni": intero di ripetizioni o colpi eseguiti (es. "8 ripetizioni", "sei colpi", "fatte 10" -> 8, 6, 10).
3. "rpe": valore stringa con decimale.
   - SE L'ATLETA INDICA UN RANGE O UN'INCERTEZZA (es. "tra 7.5 e 8.5", "otto o nove", "fra 7 e 8", "sforzo 8 e mezzo"),
     CALCOLA LA MEDIA ESATTA DI BUON SENSO (es. (7.5+8.5)/2 = 8.0 -> "8.0", (8+9)/2 = 8.5 -> "8.5").
   - SE PARLA DI BUFFER/RIR: "due in canna" -> "8.0", "una in canna" -> "9.0", "a tutta/cedimento" -> "10.0".
4. "note": frase ordinata e pulita in italiano con le sensazioni muscolari o articolari.
   DIVIETO ASSOLUTO del termine "biomeccanica": usa "pattern motorio" o "economia del gesto".

Rispondi ESCLUSIVAMENTE con un JSON valido:
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
          text: `Testo dettato: "${input.text}". Prescrizione: ${input.targetPrescrizione || "N/D"}`,
        });
      } else {
        contentsParts.push({
          text: `Ascolta la voce dell'atleta e compila i campi. Prescrizione: ${input.targetPrescrizione || "N/D"}`,
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
            note: sanitizzaTermineBiomeccanica(parsed.note || ""),
            raw_text: sanitizzaTermineBiomeccanica(rawText) || "",
          };
        }
      }
    } catch (err) {
      console.warn("Chiamata Gemini fallita, utilizzo motore semantico deterministico:", err);
    }
  }

  // Motore Semantico Deterministico NLP di Verità Operativa
  const sourceText = input.text || "";
  return parseWorkoutSetDeterministic(sourceText);
}
