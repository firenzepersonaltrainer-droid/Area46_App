import fs from "node:fs";
import path from "node:path";

export interface AudioAnalysisResult {
  trascrizione: string;
  allerta: "verde" | "giallo" | "rosso";
  sintesi: string;
  proposta_azione: string;
  consiglio_coach?: string;
  diagnosi_tecnica?: string;
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
Il tuo compito è trascrivere con assoluta precisione la nota audio dell'atleta, analizzare il biofeedback post-workout e produrre una risposta razionale con consiglio pratico per l'atleta.

REGOLE PERENTORIE E VINCOLI METODOLOGICI:
1. DIVIETO ASSOLUTO del termine "biomeccanica" o tecnicismi freddi per gli atleti: usa sempre "pattern motorio", "economia del gesto" o "cinematica".
2. CLASSIFICAZIONE ALLERTA:
   - 'verde': sessione regolare, sensazioni fluide, fatica fisiologica (RPE <= 8).
   - 'giallo': affaticamento elevato, piccoli compensi posturali, RPE 8.5-9.
   - 'rosso': fitte, dolore acuto articolare (lombare/L5-S1, ginocchio, anca, spalla), cedimento non controllato.
3. CONSIGLIO DEL COACH PER L'ATLETA:
   - Risposta diretta e rassicurante in prima persona singolare o come Comitato Tecnico del Coach Stefano Tronconi.
   - Applica la Modalità B di Socrates: se c'è dolore o compenso, proponi rotazione con destrezza a terra o decompressione senza dogmi.
   - Dai consigli concreti di recupero naturale (idratazione, respirazione diaframmatica a terra, sonno).

Rispondi ESCLUSIVAMENTE con un JSON valido con questa esatta struttura:
{
  "trascrizione": "Trascrizione letterale fedele in italiano",
  "allerta": "verde" | "giallo" | "rosso",
  "sintesi": "Riassunto conciso in 1 frase per il Coach",
  "proposta_azione": "Consiglio pratico operativo e metodologico per la seduta successiva",
  "consiglio_coach": "Messaggio diretto, razionale e rassicurante rivolto all'atleta con il consiglio operativo del Coach",
  "diagnosi_tecnica": "Diagnosi tecnica (se contesto è app_feedback)"
}
`;

      const promptText = `
Contesto: ${contesto}
Metadati noti:
- Livello: ${metadata.livello || "N/D"}
- Giorno: ${metadata.giorno || "N/D"}
- RPE registrato: ${metadata.rpe ?? "N/D"}
- Sensazioni espresse a chip: ${(metadata.sensazioni || []).join(", ") || "Nessuna"}
- Trascrizione vocale rilevata dal dispositivo: ${metadata.trascrizioneLive || "Nessuna trascrizione client disponibile"}
- Note scritte: ${metadata.noteTesto || metadata.descrizione || "Nessuna"}
- Tipo segnalazione: ${metadata.tipoSegnalazione || "N/D"}
- Titolo segnalazione: ${metadata.titolo || "N/D"}
- Device info: ${metadata.deviceInfo || "N/D"}

Ascolta l'audio allegato, trascrivilo fedelmente ed esegui l'analisi clinico-semantica o tecnica.
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
          return {
            trascrizione: sanitizzaLinguaggioAtleta(parsed.trascrizione || ""),
            allerta: ["verde", "giallo", "rosso"].includes(parsed.allerta)
              ? parsed.allerta
              : "verde",
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
  const rawTranscript = metadata.trascrizioneLive || metadata.noteTesto || metadata.descrizione || "";
  const testo = (
    `${rawTranscript} ${metadata.noteTesto || ""} ${metadata.descrizione || ""} ${metadata.titolo || ""} ${(metadata.sensazioni || []).join(" ")}`
  ).toLowerCase();

  const rpe = metadata.rpe ?? 8;

  if (contesto === "biofeedback_workout") {
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
        rpe >= 9);

    let allerta: "verde" | "giallo" | "rosso" = "verde";
    let sintesi = "Sessione chiusa regolarmente con parametri motori stabili ed ottima risposta generale.";
    let proposta = "Proseguire con la periodizzazione prevista per la seduta successiva mantenendo il focus sulla qualità esecutiva.";
    let consiglioCoach = "Sessione chiusa con successo e ottimo controllo! Il corpo ha risposto con facilità al carico di lavoro. Ricorda di bere adeguatamente e presentati alla prossima seduta con la stessa concentrazione sul pattern motorio.";

    if (isRedAlert) {
      allerta = "rosso";
      sintesi = `Allerta articolare/carico: segnalata criticità durante la seduta (RPE ${rpe}/10).`;
      proposta =
        "Modalità B di Socrates: scarico attivo del pattern sofferente nella seduta successiva, sostituendolo con lavoro qualitativo a terra, mobilità del cingolo lombo-pelvico e verifica tecnica diretta con il Coach prima di toccare sovraccarichi.";
      consiglioCoach =
        "Ho registrato la tua segnalazione sul fastidio avvertito. Nessun allarmismo: il corpo cerca equilibrio. Nella prossima seduta applicheremo la Modalità B sostituendo il movimento pesante con decompressione e mobilità a terra per farti muovere con facilità e senza stress. Se hai fitte parlane con me in sala prima di iniziare.";
    } else if (isYellowAlert) {
      allerta = "giallo";
      sintesi = `Fatica periferica alta o compenso posturale segnalato (RPE ${rpe}/10).`;
      proposta =
        "Regolare i carichi mantenendo 1-2 ripetizioni di riserva nel fondamentale e idratare il tessuto con mobilità attiva di scarico tra le serie.";
      consiglioCoach =
        `Hai espresso un'intensità elevata (RPE ${rpe}/10) con una sensazione di fatica marcata o piccolo compenso. Ottimo impegno per aver completato la scheda, ma per la prossima seduta mantieni 1-2 colpi di riserva (buffer) senza forzare la chiusura. Nelle prossime 24 ore dai priorità al sonno e ad una buona idratazione per favorire il recupero naturale dei tessuti.`;
    }

    const trascrizioneGenerata = metadata.trascrizioneLive
      ? metadata.trascrizioneLive
      : metadata.noteTesto
      ? metadata.noteTesto
      : `Registrazione vocale atleta su Seduta ${metadata.giorno || ""}: RPE percepito ${rpe}/10, sensazioni motorie: ${(metadata.sensazioni || []).join(", ") || "buone"}.`;

    return {
      trascrizione: sanitizzaLinguaggioAtleta(trascrizioneGenerata),
      allerta,
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
