import fs from "node:fs";
import path from "node:path";

export interface AudioAnalysisResult {
  trascrizione: string;
  allerta: "verde" | "giallo" | "rosso";
  sintesi: string;
  proposta_azione: string;
  consiglio_coach?: string;
  diagnosi_tecnica?: string;
  tipo_intervento?: "spinta" | "scarico" | "consolidamento";
  giorno_destinazione?: string | number;
}

/**
 * Sanitizza il linguaggio per gli atleti rimuovendo tecnicismi accademici
 */
function sanitizzaLinguaggioAtleta(s: string): string {
  if (!s) return "";
  return s
    .replace(/biomeccanic[a-zA-Z]*/gi, "pattern motorio")
    .replace(/catena\s+cinetica(?:\s+aperta|\s+chiusa)?/gi, "linea di spinta")
    .replace(/fulcro/gi, "punto d'appoggio")
    .replace(/obbligatori[aoe]/gi, "consigliato");
}

/**
 * Calcola in modo deterministico il giorno di allenamento successivo
 */
export function calcolaGiornoSuccessivo(giorno?: string | number): string | number {
  if (!giorno && giorno !== 0) return 2;
  const str = String(giorno).trim();
  const matchNum = str.match(/\d+/);
  if (matchNum) {
    const n = parseInt(matchNum[0], 10);
    // Se la stringa è tipo "1 allenamento A" -> "2 allenamento B"
    if (/allenamento\s+[ab]/i.test(str)) {
      const nextN = n + 1;
      const nextLettera = nextN % 2 === 1 ? "A" : "B";
      return `${nextN} allenamento ${nextLettera}`;
    }
    // Altrimenti semplice numero incrementato
    return n + 1;
  }
  return 2;
}

/**
 * Analisi clinico-semantica e trascrizione multimodale per note audio post-workout e segnalazioni app.
 * Utilizza Gemini Multimodale (se configurato con GEMINI_API_KEY) o motore clinico euristico integrato.
 */
export async function analyzeAudioWithGemini(
  filePath: string,
  contesto: "biofeedback_workout" | "app_feedback",
  metadata: {
    livello?: string;
    giorno?: string;
    rpe?: number;
    sensazioni?: string[];
    noteTesto?: string;
    trascrizioneLive?: string;
    tipoSegnalazione?: string;
    titolo?: string;
    descrizione?: string;
    deviceInfo?: string;
  } = {}
): Promise<AudioAnalysisResult> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    "";

  let audioBase64 = "";
  let mimeType = "audio/webm";

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".mp4" || ext === ".m4a") mimeType = "audio/mp4";
    else if (ext === ".wav") mimeType = "audio/wav";
    else if (ext === ".mp3") mimeType = "audio/mpeg";
    else if (ext === ".ogg") mimeType = "audio/ogg";
    else mimeType = "audio/webm";

    const buffer = fs.readFileSync(filePath);
    audioBase64 = buffer.toString("base64");
  }

  // Se c'è una chiave Gemini valida e abbiamo il file, tentiamo la chiamata a Gemini
  if (apiKey && audioBase64) {
    try {
      const systemInstruction = `
Sei l'Agente Clinico-Semantico & Tecnico Senior (Socrates & Aura) di Area46 Landmine Lab.
Il tuo compito è trascrivere con assoluta precisione la nota audio dell'atleta, analizzare il biofeedback post-workout e produrre una risposta razionale con consiglio pratico per la SEDUTA SUCCESSIVA dell'atleta.

REGOLE PERENTORIE E VINCOLI METODOLOGICI:
1. DIVIETO ASSOLUTO del termine "biomeccanica" o tecnicismi freddi per gli atleti: usa sempre "pattern motorio", "economia del gesto" o "cinematica".
2. CLASSIFICAZIONE ALLERTA & INTERVENTO:
   - 'spinta' (verde): allenamento percepito leggero, fluido, ampio margine, atleta fresco con voglia di caricare -> consigliare di spingere maggiormente sul carico (+1.25/+2.5kg).
   - 'scarico' (giallo/rosso): affaticamento elevato, piccoli compensi posturali, RPE >= 9, o fitte/dolori -> consigliare lavoro più leggero, scarico selettivo (Modalità B) o buffer 2 colpi.
   - 'consolidamento' (verde): sessione regolare, stimolo centrato (RPE 7.5-8.5).
3. I CONSIGLI SONO PER LA SEDUTA SUCCESSIVA: non prescrivere interventi sulla seduta appena chiusa.
4. SINTESI VOCALE FEDELE: La sintesi per il Coach deve riassumere fedelmente quello che l'atleta ha detto a voce, non solo le caselle spuntate.

Rispondi ESCLUSIVAMENTE con un JSON valido con questa esatta struttura:
{
  "trascrizione": "Trascrizione letterale fedele in italiano",
  "allerta": "verde" | "giallo" | "rosso",
  "tipo_intervento": "spinta" | "scarico" | "consolidamento",
  "sintesi": "Riassunto conciso dei contenuti vocali e clinici per il Coach Stefano",
  "proposta_azione": "Consiglio pratico operativo e metodologico per la seduta successiva",
  "consiglio_coach": "Messaggio chiaro per l'atleta destinato alla seduta successiva",
  "diagnosi_tecnica": "Diagnosi tecnica (se contesto è app_feedback)"
}
`;

      const promptText = `
Contesto: ${contesto}
Metadati noti:
- Livello: ${metadata.livello || "N/D"}
- Giorno appena concluso: ${metadata.giorno || "N/D"}
- Giorno successivo calcolato: ${calcolaGiornoSuccessivo(metadata.giorno)}
- RPE registrato: ${metadata.rpe ?? "N/D"}
- Sensazioni espresse a chip: ${(metadata.sensazioni || []).join(", ") || "Nessuna"}
- Trascrizione vocale rilevata dal dispositivo: ${metadata.trascrizioneLive || "Nessuna trascrizione client disponibile"}
- Note scritte: ${metadata.noteTesto || metadata.descrizione || "Nessuna"}
- Tipo segnalazione: ${metadata.tipoSegnalazione || "N/D"}
- Titolo segnalazione: ${metadata.titolo || "N/D"}
- Device info: ${metadata.deviceInfo || "N/D"}

Ascolta l'audio allegato, trascrivilo fedelmente ed esegui l'analisi clinico-semantica focalizzandoti sulle parole dell'atleta.
`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: audioBase64,
                  },
                },
                { text: promptText },
              ],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (response.ok) {
        const geminiData = await response.json();
        const textResponse =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          const parsed = JSON.parse(textResponse);
          const nextDay = calcolaGiornoSuccessivo(metadata.giorno);
          return {
            trascrizione: sanitizzaLinguaggioAtleta(parsed.trascrizione || ""),
            allerta: ["verde", "giallo", "rosso"].includes(parsed.allerta)
              ? parsed.allerta
              : "verde",
            tipo_intervento: ["spinta", "scarico", "consolidamento"].includes(parsed.tipo_intervento)
              ? parsed.tipo_intervento
              : "consolidamento",
            giorno_destinazione: nextDay,
            sintesi: sanitizzaLinguaggioAtleta(parsed.sintesi || ""),
            proposta_azione: sanitizzaLinguaggioAtleta(parsed.proposta_azione || ""),
            consiglio_coach: sanitizzaLinguaggioAtleta(parsed.consiglio_coach || parsed.proposta_azione || ""),
            diagnosi_tecnica: parsed.diagnosi_tecnica || undefined,
          };
        }
      }
    } catch (err) {
      console.warn("Chiamata Gemini fallita, passaggio al motore clinico deterministico:", err);
    }
  }

  // MOTORE CLINICO-SEMANTICO DETERMINISTICO DI VERITÀ OPERATIVA
  return fallbackClinicalAnalysis(contesto, metadata);
}

/**
 * Motore clinico-semantico e diagnostico a regole deterministiche
 */
export function fallbackClinicalAnalysis(
  contesto: "biofeedback_workout" | "app_feedback",
  metadata: {
    livello?: string;
    giorno?: string;
    rpe?: number;
    sensazioni?: string[];
    noteTesto?: string;
    trascrizioneLive?: string;
    tipoSegnalazione?: string;
    titolo?: string;
    descrizione?: string;
    deviceInfo?: string;
  }
): AudioAnalysisResult {
  const rawTranscript = (metadata.trascrizioneLive || metadata.noteTesto || metadata.descrizione || "").trim();
  const chipSensazioni = (metadata.sensazioni || []).join(" ");
  const testo = (
    `${rawTranscript} ${metadata.noteTesto || ""} ${metadata.descrizione || ""} ${metadata.titolo || ""} ${chipSensazioni}`
  ).toLowerCase();

  const rpe = metadata.rpe ?? 8;
  const nextDay = calcolaGiornoSuccessivo(metadata.giorno);

  if (contesto === "biofeedback_workout") {
    // 1. Rilevamento Dolore / Allerta Rossa
    const isRedAlert =
      testo.includes("dolore") ||
      testo.includes("fitta") ||
      testo.includes("blocc") ||
      testo.includes("lombare") ||
      testo.includes("ginocchio") ||
      testo.includes("spalla") ||
      testo.includes("strappo") ||
      testo.includes("crack") ||
      testo.includes("male acuto") ||
      rpe >= 10;

    // 2. Rilevamento Fatica Elevata / Scarico
    const isYellowAlert =
      !isRedAlert &&
      (testo.includes("fatica") ||
        testo.includes("stanchezza") ||
        testo.includes("pesant") ||
        testo.includes("compenso") ||
        testo.includes("difficolt") ||
        testo.includes("instabil") ||
        testo.includes("sporca") ||
        testo.includes("sporco") ||
        testo.includes("duro") ||
        rpe >= 9);

    // 3. Rilevamento Spinta / Facilità (L'allenamento si è rivelato leggero -> SPINGERE MAGGIORMENTE)
    const isSpinta =
      !isRedAlert &&
      !isYellowAlert &&
      (testo.includes("legger") ||
        testo.includes("facile") ||
        testo.includes("sping") ||
        testo.includes("caric") ||
        testo.includes("volav") ||
        testo.includes("troppo poco") ||
        testo.includes("ampio margine") ||
        testo.includes("potevo dare di più") ||
        testo.includes("potevo caricare") ||
        testo.includes("fresco") ||
        testo.includes("energia") ||
        testo.includes("esplosiv") ||
        chipSensazioni.toLowerCase().includes("carico leggero") ||
        rpe <= 7);

    let allerta: "verde" | "giallo" | "rosso" = "verde";
    let tipoIntervento: "spinta" | "scarico" | "consolidamento" = "consolidamento";
    let sintesi = "";
    let proposta = "";
    let consiglioCoach = "";

    // Sintesi fedele che valorizza in primo piano ciò che l'atleta ha detto a voce
    const estrattiVocali = rawTranscript ? `"${rawTranscript}"` : "";

    if (isRedAlert) {
      allerta = "rosso";
      tipoIntervento = "scarico";
      sintesi = rawTranscript
        ? `Nota Vocale: l'atleta segnala dolore o criticità articolare/muscolare (${estrattiVocali}). RPE: ${rpe}/10.`
        : `Allerta articolare/carico: segnalata criticità durante la seduta (RPE ${rpe}/10).`;
      proposta =
        `Per Seduta Successiva (Giorno ${nextDay}): Modalità B di Socrates: scarico attivo del pattern sofferente, sostituendolo con lavoro qualitativo a terra, mobilità lombo-pelvica e verifica tecnica con il Coach prima di toccare sovraccarichi.`;
      consiglioCoach =
        `Ho ascoltato la tua nota sul fastidio avvertito. Nessun allarme: il corpo cerca equilibrio. Per la prossima seduta applicheremo la Modalità B sostituendo il movimento pesante con decompressione e mobilità a terra per muoverti con facilità e zero stress.`;
    } else if (isYellowAlert) {
      allerta = "giallo";
      tipoIntervento = "scarico";
      sintesi = rawTranscript
        ? `Nota Vocale: l'atleta riferisce fatica marcata o pesantezza d'intensità (${estrattiVocali}). RPE: ${rpe}/10.`
        : `Fatica periferica alta o compenso posturale segnalato (RPE ${rpe}/10).`;
      proposta =
        `Per Seduta Successiva (Giorno ${nextDay}): Lavoro più leggero: regolare i carichi mantenendo 1-2 ripetizioni di riserva nel fondamentale e idratare il tessuto con mobilità attiva di scarico tra le serie.`;
      consiglioCoach =
        `Hai espresso un'intensità elevata (RPE ${rpe}/10) con fatica marcata. Per la prossima seduta mantieni 1-2 colpi di riserva (buffer) senza forzare la chiusura. Nelle prossime 24 ore dai priorità a riposo e idratazione.`;
    } else if (isSpinta) {
      allerta = "verde";
      tipoIntervento = "spinta";
      sintesi = rawTranscript
        ? `Nota Vocale: l'atleta riferisce facilità, ottima fluidità e margine sul carico (${estrattiVocali}). RPE: ${rpe}/10.`
        : `Carico percepito leggero / ottima riserva energetica (RPE ${rpe}/10).`;
      proposta =
        `Per Seduta Successiva (Giorno ${nextDay}): Spingere maggiormente! Concedere incremento di sovraccarico progressivo (+1.25 / +2.5 kg sui fondamentali) o alzare l'intensità a target pieno per stimolare l'adattamento.`;
      consiglioCoach =
        `Ottima risposta cinestesica: la seduta è risultata agevole e il pattern solido. Nella prossima seduta concediti un incremento di carico (+1.25/+2.5 kg) sui fondamentali per continuare la scaletta a onda progressiva.`;
    } else {
      // Consolidamento a regime
      allerta = "verde";
      tipoIntervento = "consolidamento";
      sintesi = rawTranscript
        ? `Nota Vocale: l'atleta esprime sensazioni stabili e controllo centrato (${estrattiVocali}). RPE: ${rpe}/10.`
        : `Sessione chiusa regolarmente con parametri motori stabili ed ottima risposta generale (RPE ${rpe}/10).`;
      proposta =
        `Per Seduta Successiva (Giorno ${nextDay}): Proseguire con la periodizzazione prevista mantenendo il focus sulla qualità e velocità del pattern motorio.`;
      consiglioCoach =
        `Sessione chiusa con successo e ottimo controllo sul pattern motorio! Per la prossima seduta mantieni la stessa qualità esecutiva.`;
    }

    const trascrizioneGenerata = rawTranscript
      ? rawTranscript
      : `Registrazione vocale atleta su Seduta ${metadata.giorno || ""}: RPE percepito ${rpe}/10, sensazioni motorie: ${(metadata.sensazioni || []).join(", ") || "buone"}.`;

    return {
      trascrizione: sanitizzaLinguaggioAtleta(trascrizioneGenerata),
      allerta,
      tipo_intervento: tipoIntervento,
      giorno_destinazione: nextDay,
      sintesi: sanitizzaLinguaggioAtleta(sintesi),
      proposta_azione: sanitizzaLinguaggioAtleta(proposta),
      consiglio_coach: sanitizzaLinguaggioAtleta(consiglioCoach),
    };
  }

  // Contesto: app_feedback
  const isBug = metadata.tipoSegnalazione === "bug" || testo.includes("bug") || testo.includes("errore");
  const isCriticalBug =
    isBug &&
    (testo.includes("crash") ||
      testo.includes("blocc") ||
      testo.includes("impossibile") ||
      testo.includes("bianc") ||
      testo.includes("perso") ||
      testo.includes("non salva"));

  let allerta: "verde" | "giallo" | "rosso" = "verde";
  let sintesi = `Segnalazione ${metadata.tipoSegnalazione || "consiglio"}: "${metadata.titolo || "Suggerimento per l'App"}"`;
  let diagnosi = "Suggerimento utile per l'evoluzione dell'interfaccia e l'esperienza atleta in sala.";
  let proposta = "Valutare l'implementazione nel prossimo sprint di rifinitura UI/UX.";

  if (isCriticalBug) {
    allerta = "rosso";
    sintesi = `BUG CRITICO SEGNALATO: ${metadata.titolo || "Anomalia bloccante in applicazione"}`;
    diagnosi = `Rilevata anomalia bloccante su context ${metadata.deviceInfo || "Browser"}. File probabili da ispezionare: client/pages/GiornoDetail.tsx, local-api.ts o client/components/Dialog.tsx.`;
    proposta = "Verifica immediata del flusso dati e ripristino idempotente con test in locale.";
  } else if (isBug) {
    allerta = "giallo";
    sintesi = `Anomalia non bloccante: ${metadata.titolo || "Comportamento imprevisto app"}`;
    diagnosi = `Comportamento anomalo segnalato su ${metadata.deviceInfo || "dispositivo mobile"}. Componenti correlati in client/components/.`;
    proposta = "Riprodurre su browser di test ed applicare hotfix nel gestionale.";
  }

  return {
    trascrizione: sanitizzaLinguaggioAtleta(rawTranscript || metadata.titolo || "Segnalazione testo"),
    allerta,
    sintesi: sanitizzaLinguaggioAtleta(sintesi),
    proposta_azione: sanitizzaLinguaggioAtleta(proposta),
    consiglio_coach: sanitizzaLinguaggioAtleta(proposta),
    diagnosi_tecnica: diagnosi,
  };
}
