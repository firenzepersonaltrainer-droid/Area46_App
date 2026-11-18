import fs from "node:fs";
import path from "node:path";

export interface ParsedSingleSet {
  set_numero: number;
  carico_kg: number | null;
  ripetizioni: number | null;
  rpe: string | null;
  note?: string | null;
}

export interface CoachAlert {
  tipo: "warning" | "info" | "ok";
  motivo: "rpe_sforato" | "tecnica_sporca" | "fastidio_articolare" | "ottimo";
  titolo: string;
  messaggio: string;
}

export interface VoiceWorkoutSetResult {
  success: boolean;
  is_multi_set: boolean;
  sets: ParsedSingleSet[];
  // Retrocompatibilità per serie singola
  carico_kg: number | null;
  ripetizioni: number | null;
  rpe: string | null;
  note: string | null;
  coach_feedback?: CoachAlert | null;
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
  // Gestisce anche "ad rep 9" o "a rep 8" o "rep 8" quando usato come RPE
  const normalized = lower
    .replace(/\br\.p\.e\.\b/g, "rpe")
    .replace(/\br\s*p\s*e\b/g, "rpe")
    .replace(/\brp\b/g, "rpe")
    .replace(/\berrepé\b/g, "rpe")
    .replace(/\breppe\b/g, "rpe")
    .replace(/\bsforzo\b/g, "rpe")
    .replace(/\bfatica\b/g, "rpe")
    .replace(/\bintensit[àa]\b/g, "rpe")
    .replace(/\bdifficolt[àa]\b/g, "rpe")
    .replace(/\bad\s*rep\s*([0-9]+)/gi, "rpe $1")
    .replace(/\ba\s*rep\s*([0-9]+)/gi, "rpe $1");

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

  // Spezza la frase in clausole naturali (virgola, punto, punto e virgola, ma, però, tuttavia, sentivo, sensazione, perché, anche se)
  const clausole = sanitized.split(/[,.;:]|\b(?:ma|però|tuttavia|anche se|invece|perché|perche|sentivo|avvertivo)\b/i);

  const clausoleNote: string[] = [];

  for (let cl of clausole) {
    let trimCl = cl.trim();
    if (!trimCl) continue;

    const lower = trimCl.toLowerCase();

    // Se la clausola è solo dichiarazione di serie numerica
    const isPureParameters =
      /^(?:allora\s+|dunque\s+|ecco\s+)?(?:ho\s+fatto|fatte|chiuse|fatti|eseguite|tirate)?\s*(?:[0-9]+|[a-z]+)?\s*(?:ripetizioni|ripetizione|colpi|colpo|rep|reps|rip|volte)?\s*(?:con|a|al|per)?\s*(?:carico|peso)?\s*[0-9]+(?:[.,][0-9]+)?\s*(?:e\s*mezzo)?\s*(?:chili|kg|kili)?\s*(?:rpe\s*[0-9]+)?$/i.test(
        lower
      ) ||
      /^(?:con\s+)?[0-9]+(?:[.,][0-9]+)?\s*(?:e\s*mezzo)?\s*(?:chili|kg|kili)$/i.test(lower) ||
      /^(?:r\.?p\.?e\.?|sforzo|fatica)\s*(?:tra|fra|da)?\s*[0-9]+(?:[.,][0-9]+)?(?:\s*(?:e|o|-)\s*[0-9]+(?:[.,][0-9]+)?)?(?:\s*e\s*mezzo)?$/i.test(lower) ||
      /^(?:due|un|uno|tre|2|1|3)\s*(?:in\s*canna|di\s*riserva|colpi\s*di\s*riserva)$/i.test(lower) ||
      /^(?:prima|seconda|terza|quarta|quinta|sesta)\s*serie\s*(?:andata|fatta|si\s*è\s*chiusa|chiusa)?$/i.test(lower);

    if (isPureParameters) continue;

    // Se contiene parole qualitative, cliniche o di sensazione atletica, teniamola!
    const haParoleQualitative =
      /(?:sentivo|avvertivo|sensazione|sensazioni|spalla|schiena|femorale|gluteo|ginocchio|anca|gamba|braccio|pols[io]|collo|rigido|rigida|fluido|fluida|buon[ao]|ottimo|ottima|difficolt[àa]|pesante|pesantezza|leggero|leggera|facile|cedimento|fatica|assetto|controllo|velocit[àa]|esplosivit[àa]|pattern\s*motorio|bruciore|carico|spinta|stabilit[àa]|dolore|fitta|calo|energia|stanco|stanca|affaticat[ao]|sporca|sporco|sporcizia|compenso|compensato|in\s*modo\s*sporco|tecnica)/i.test(
        lower
      );

    if (haParoleQualitative) {
      let pulita = trimCl
        .replace(/^(?:la\s+)?(?:prima|seconda|terza|quarta|quinta)?\s*(?:serie)?\s*(?:con\s+)?[0-9]+(?:\.[0-9]+)?\s*(?:kg|chili)?\s*(?:[0-9]+\s*(?:ripetizioni|colpi|rep)?)?/gi, "")
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
    // Controllo parole chiave sporco/compenso
    const matchQual = sanitized.match(/(?:sporca|sporco|in\s+modo\s+sporco|compenso|fatica|rigida|dolore).+/i);
    if (matchQual) {
      let candidate = matchQual[0]
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
 * Parsing di una singola serie atomica
 */
function parseSingleSetUnit(testo: string, setNumero: number = 1): ParsedSingleSet {
  const sanitized = sanitizzaTermineBiomeccanica(testo).trim();
  const lower = sanitized.toLowerCase();

  let carico_kg: number | null = null;
  let ripetizioni: number | null = null;
  let rpe: string | null = resolveRpeRange(lower);

  // 1. CARICO
  if (
    lower.includes("corpo libero") ||
    lower.includes("senza peso") ||
    lower.includes("peso corporeo") ||
    lower.includes("solo il corpo")
  ) {
    carico_kg = 0;
  } else {
    const mNumKg = lower.match(/\b([0-9]+(?:[.,][0-9]+)?)\s*(?:e\s*mezzo)?\s*(?:chili|kg|kili)\b/i);
    if (mNumKg) {
      let val = parseFloat(mNumKg[1].replace(",", "."));
      if (!isNaN(val)) {
        if (mNumKg[0].includes("mezzo")) val += 0.5;
        carico_kg = val;
      }
    }

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

    if (carico_kg === null) {
      const pCon = [
        /(?:con|carico|peso|bilanciere\s*a|messo|caricato|scalato\s*a)\s+([0-9]+(?:[.,][0-9]+)?)(?:\s*e\s*mezzo)?(?!\s*(?:colpi|rep|ripetizioni|volte))/i,
        /(?:con|carico|peso|bilanciere\s*a|messo|caricato|scalato\s*a)\s+([a-z]+)(?:\s*e\s*mezzo)?(?!\s*(?:colpi|rep|ripetizioni|volte))/i,
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

    // Se ancora nullo, cerca pattern come "la seconda 20 kg"
    if (carico_kg === null) {
      const mDirectKg = lower.match(/\b([0-9]+(?:[.,][0-9]+)?)\s*(?:kg|chili)\b/i);
      if (mDirectKg) {
        const n = parseFloat(mDirectKg[1].replace(",", "."));
        if (!isNaN(n)) carico_kg = n;
      }
    }
  }

  // 2. RIPETIZIONI
  const repPatterns = [
    /([0-9]+)\s*(?:ripetizioni|ripetizione|colpi|colpo|rep|reps|rip|volte)/i,
    /([a-z]+)\s*(?:ripetizioni|ripetizione|colpi|colpo|rep|reps|rip|volte)/i,
    /(?:fatte|chiuse|fatti|eseguite|tirate|chiuso|fatto)\s+([0-9]+|[a-z]+)/i,
    /(?:chiuso\s+con|chiuso\s+a)\s+([0-9]+|[a-z]+)\s*(?:rep|colpi|ripetizioni)?/i,
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

  const noteQual = estraiNoteQualitative(sanitized);

  return {
    set_numero: setNumero,
    carico_kg,
    ripetizioni,
    rpe,
    note: noteQual,
  };
}

/**
 * Valuta violazioni metodologiche e genera il Coach Guardrail Alert
 */
function valutaCoachAlert(
  sets: ParsedSingleSet[],
  testoCompleto: string,
  targetPrescrizione?: string | number | { rpeTargetMax?: number; targetPrescrizione?: string; parametri?: string } | null
): CoachAlert | null {
  const lower = testoCompleto.toLowerCase();

  // 1. Controllo Tecnica Sporca / Compensi
  const haTecnicaSporca =
    /(?:sporca|sporco|in\s*modo\s*sporco|sporcizia|compenso|compensato|schiena\s*inarcata|strappato|forzata|cedimento\s*non\s*controllato|brutta\s*esecuzione)/i.test(
      lower
    );

  // 2. Controllo Sforamento RPE
  let targetRpeMax = 8.5; // default massimo raccomandato di sicurezza
  if (typeof targetPrescrizione === "number") {
    targetRpeMax = targetPrescrizione;
  } else if (typeof targetPrescrizione === "object" && targetPrescrizione !== null) {
    if (typeof targetPrescrizione.rpeTargetMax === "number") {
      targetRpeMax = targetPrescrizione.rpeTargetMax;
    } else {
      const s = targetPrescrizione.targetPrescrizione || targetPrescrizione.parametri || "";
      const mTarget = s.match(/rpe\s*(?:tra|fra)?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(?:-|e|ed|a)\s*([0-9]+(?:\.[0-9]+)?))?/i);
      if (mTarget) {
        const v1 = parseFloat(mTarget[1]);
        const v2 = mTarget[2] ? parseFloat(mTarget[2]) : v1;
        if (!isNaN(v2)) targetRpeMax = Math.max(v1, v2);
      }
    }
  } else if (typeof targetPrescrizione === "string") {
    const mTarget = targetPrescrizione.match(/rpe\s*(?:tra|fra)?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(?:-|e|ed|a)\s*([0-9]+(?:\.[0-9]+)?))?/i);
    if (mTarget) {
      const v1 = parseFloat(mTarget[1]);
      const v2 = mTarget[2] ? parseFloat(mTarget[2]) : v1;
      if (!isNaN(v2)) targetRpeMax = Math.max(v1, v2);
    }
  }

  const setSforati = sets.filter((s) => {
    if (!s.rpe) return false;
    const n = parseFloat(s.rpe);
    return !isNaN(n) && (n >= 9.0 || n > targetRpeMax);
  });

  if (haTecnicaSporca && setSforati.length > 0) {
    const maxRpe = Math.max(...setSforati.map((s) => parseFloat(s.rpe!)));
    return {
      tipo: "warning",
      motivo: "tecnica_sporca",
      titolo: "Richiamo Tecnico del Coach",
      messaggio: `Attento: c'è un motivo se ti viene richiesta tecnica impeccabile e un RPE controllato! Raggiungere RPE ${maxRpe.toFixed(1)} sporcando il movimento vanifica il transfer motorio e stressa le articolazioni. Mantieni un'esecuzione pulita e scala il carico. Se hai dubbi chiedi a Stefano al Lab.`,
    };
  }

  if (haTecnicaSporca) {
    return {
      tipo: "warning",
      motivo: "tecnica_sporca",
      titolo: "Qualità del Movimento Sotto Target",
      messaggio: "Attento: l'esecuzione sporca o compensata interrompe la linea di spinta corretta. Dai la precedenza alla tecnica impeccabile rispetto al carico sollevato: riduci il peso alla serie successiva per mantenere il pattern motorio pulito.",
    };
  }

  if (setSforati.length > 0) {
    const maxRpe = Math.max(...setSforati.map((s) => parseFloat(s.rpe!)));
    return {
      tipo: "warning",
      motivo: "rpe_sforato",
      titolo: "RPE Oltre la Prescrizione",
      messaggio: `Hai toccato RPE ${maxRpe.toFixed(1)} a fronte di un target raccomandato di RPE ${targetRpeMax.toFixed(1)}. Non forzare a cedimento: fermati con il giusto margine (buffer) per garantire la corretta progressione nel ciclo. Chiedi al coach se devi aggiustare il carico.`,
    };
  }

  // 3. Controllo Fastidi Articolari
  const haFastidio = /(?:dolore|fitta|male\s+alla|fastidio\s+al|fastidio\s+alla|blocco)/i.test(lower);
  if (haFastidio) {
    return {
      tipo: "warning",
      motivo: "fastidio_articolare",
      titolo: "Attenzione Clinico-Articolare",
      messaggio: "Hai segnalato un fastidio o indolenzimento articolare. Applica la Modalità B del Lab: non forzare sul punto critico, decomprimi con mobilità a terra e segnala la sensazione al coach durante la seduta.",
    };
  }

  return null;
}

/**
 * Motore Semantico Deterministico di estrazione parametri set (Singolo e Multi-Serie)
 */
export function parseWorkoutSetDeterministic(
  testo: string,
  targetPrescrizione?: string | number | { rpeTargetMax?: number; targetPrescrizione?: string; parametri?: string } | null
): VoiceWorkoutSetResult {
  const sanitized = sanitizzaTermineBiomeccanica(testo).trim();
  if (!sanitized) {
    return {
      success: false,
      is_multi_set: false,
      sets: [],
      carico_kg: null,
      ripetizioni: null,
      rpe: null,
      note: null,
      coach_feedback: null,
      raw_text: "",
    };
  }

  const lower = sanitized.toLowerCase();

  // -------------------------------------------------------------
  // RILEVAMENTO E SEGMENTAZIONE MULTI-SERIE
  // -------------------------------------------------------------
  // Cerchiamo marcatori ordinali di serie (prima serie, seconda serie, terza serie, set 1, set 2...)
  const ordinalMarkersRegex =
    /(?:\b(?:la\s+)?prima\s+serie\b|\bprimo\s+set\b|\bset\s+1\b|\bla\s+prima\b)|(?:\b(?:la\s+)?seconda\s+serie\b|\bsecondo\s+set\b|\bset\s+2\b|\bla\s+seconda\b)|(?:\b(?:la\s+)?terza\s+serie\b|\bterzo\s+set\b|\bset\s+3\b|\bla\s+terza\b)|(?:\b(?:la\s+)?quarta\s+serie\b|\bquarto\s+set\b|\bset\s+4\b|\bla\s+quarta\b)|(?:\b(?:la\s+)?quinta\s+serie\b|\bquinto\s+set\b|\bset\s+5\b|\bla\s+quinta\b)/gi;

  const matches: Array<{ index: number; text: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = ordinalMarkersRegex.exec(lower)) !== null) {
    matches.push({ index: m.index, text: m[0] });
  }

  // Se ci sono 2 o più serie distinte esplicite (es: prima e seconda, o prima seconda e terza)
  if (matches.length >= 2) {
    const rawSegments: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : sanitized.length;
      rawSegments.push(sanitized.substring(start, end));
    }

    const setsList: ParsedSingleSet[] = [];
    const noteAggregate: string[] = [];

    rawSegments.forEach((seg, idx) => {
      const setParsed = parseSingleSetUnit(seg, idx + 1);
      setsList.push(setParsed);
      if (setParsed.note) {
        noteAggregate.push(`Serie ${idx + 1}: ${setParsed.note}`);
      }
    });

    const coachFeedback = valutaCoachAlert(setsList, sanitized, targetPrescrizione);

    const first = setsList[0] || { carico_kg: null, ripetizioni: null, rpe: null };
    const finalNote = noteAggregate.length > 0 ? noteAggregate.join("; ") : estraiNoteQualitative(sanitized);

    return {
      success: setsList.some((s) => s.carico_kg !== null || s.ripetizioni !== null || s.rpe !== null),
      is_multi_set: true,
      sets: setsList,
      carico_kg: first.carico_kg,
      ripetizioni: first.ripetizioni,
      rpe: first.rpe,
      note: finalNote,
      coach_feedback: coachFeedback,
      raw_text: sanitized,
    };
  }

  // -------------------------------------------------------------
  // CASO SERIE SINGOLA RETRO-COMPATIBILE
  // -------------------------------------------------------------
  const singleParsed = parseSingleSetUnit(sanitized, 1);
  const coachFeedback = valutaCoachAlert([singleParsed], sanitized, targetPrescrizione);

  return {
    success: singleParsed.carico_kg !== null || singleParsed.ripetizioni !== null || singleParsed.rpe !== null,
    is_multi_set: false,
    sets: [singleParsed],
    carico_kg: singleParsed.carico_kg,
    ripetizioni: singleParsed.ripetizioni,
    rpe: singleParsed.rpe,
    note: singleParsed.note,
    coach_feedback: coachFeedback,
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
Il tuo compito è ascoltare/analizzare la dettatura vocale libera dell'atleta dopo le serie ed estrarre i parametri numerici e le note in formato JSON.

REGOLE DI INTERPRETAZIONE MULTI-SERIE:
1. Se l'atleta descrive più serie (es: "la prima serie... la seconda... la terza..."), estrai l'array "sets" con ogni singola serie numerata.
2. "carico_kg": numero intero o decimale in kg (es. "cinquanta chili" -> 50, "42 e mezzo" -> 42.5, "a corpo libero" -> 0).
3. "ripetizioni": intero di ripetizioni o colpi eseguiti (es. "8 ripetizioni", "sei colpi" -> 8, 6).
4. "rpe": valore stringa con decimale. Risolvi range calcolando la media esatta (es. "tra 7.5 e 8.5" -> "8.0", "ad rep 9" / "rpe 9" -> "9.0").
5. "note": frase ordinata e pulita in italiano con le sensazioni muscolari o articolari.
   DIVIETO ASSOLUTO del termine "biomeccanica": usa "pattern motorio" o "economia del gesto".

COACH GUARDRAIL:
Se l'atleta segnala tecnica sporca, compensi, forzature o RPE >= 9.0 (o superiore alla prescrizione ${input.targetPrescrizione || "N/D"}),
compila il campo "coach_feedback" con avviso autorevole ed empatico per l'atleta.

Rispondi ESCLUSIVAMENTE con un JSON valido:
{
  "is_multi_set": boolean,
  "sets": [
    {
      "set_numero": number,
      "carico_kg": number | null,
      "ripetizioni": number | null,
      "rpe": string | null,
      "note": string | null
    }
  ],
  "note_generali": string | null,
  "coach_feedback": {
    "tipo": "warning" | "info",
    "motivo": "tecnica_sporca" | "rpe_sforato" | "fastidio_articolare",
    "titolo": string,
    "messaggio": string
  } | null,
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
          const isMulti = Boolean(parsed.is_multi_set && Array.isArray(parsed.sets) && parsed.sets.length > 1);
          const setsArr: ParsedSingleSet[] = Array.isArray(parsed.sets)
            ? parsed.sets.map((s: any, idx: number) => ({
                set_numero: s.set_numero || idx + 1,
                carico_kg: s.carico_kg !== undefined ? s.carico_kg : null,
                ripetizioni: s.ripetizioni !== undefined ? s.ripetizioni : null,
                rpe: s.rpe ? String(s.rpe) : null,
                note: s.note ? sanitizzaTermineBiomeccanica(s.note) : null,
              }))
            : [];

          const first = setsArr[0] || { carico_kg: null, ripetizioni: null, rpe: null };

          return {
            success: true,
            is_multi_set: isMulti,
            sets: setsArr,
            carico_kg: first.carico_kg,
            ripetizioni: first.ripetizioni,
            rpe: first.rpe,
            note: sanitizzaTermineBiomeccanica(parsed.note_generali || first.note || ""),
            coach_feedback: parsed.coach_feedback || null,
            raw_text: sanitizzaTermineBiomeccanica(rawText) || "",
          };
        }
      }
    } catch (err) {
      console.warn("Chiamata Gemini fallita, passaggio al motore deterministico NLP:", err);
    }
  }

  // Motore Semantico Deterministico NLP di Verità Operativa
  const sourceText = input.text || "";
  return parseWorkoutSetDeterministic(sourceText, input.targetPrescrizione);
}
