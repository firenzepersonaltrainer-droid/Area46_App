import fs from "node:fs";
import path from "node:path";

export interface AudioAnalysisResult {
  trascrizione: string;
  allerta: "verde" | "giallo" | "rosso";
  sintesi: string;
  proposta_azione: string;
  diagnosi_tecnica?: string;
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

  // Se c'è una chiave Gemini valida e abbiamo il file, tentiamo la chiamata a Gemini 2.0 / 1.5 Flash
  if (apiKey && audioBase64) {
    try {
      const systemInstruction = `
Sei l'Agente Clinico-Semantico & Tecnico Senior di Area46 Landmine Lab.
Il tuo compito è trascrivere con assoluta precisione la nota audio dell'atleta o utente e produrre un'analisi strutturata.

REGOLE PERENTORIE E VINCOLI METODOLOGICI:
1. DIVIETO ASSOLUTO DEL TERMINE "biomeccanica" o tecnicismi freddi per gli atleti: usa sempre "pattern motorio", "economia del gesto" o "cinematica".
2. CLASSIFICAZIONE ALLERTA:
   - 'verde': sessione regolare, sensazioni fluide, fatica fisiologica (RPE <= 8), oppure consiglio app ordinario.
   - 'giallo': affaticamento elevato, piccoli compensi posturali, RPE 8.5-9, oppure bug non bloccante.
   - 'rosso': fitte, dolore acuto articolare (lombare/L5-S1, ginocchio, anca, spalla), cedimento non controllato, oppure crash/blocco totale dell'app.
3. PROPOSTA D'AZIONE WORKOUT:
   - Applica la metodologia del Comitato Tecnico Area46 (Socrates Modalità B): rotazione del movimento critico con destrezza qualitativa, mobilità a terra o decompressione senza dogmi.
4. DIAGNOSI TECNICA (se contesto è 'app_feedback'):
   - Ispeziona il problema descritto e indica i file probabili dell'architettura Area46 (es. client/pages/GiornoDetail.tsx, local-api.ts, client/components/CalendarioMeseNavigabile.tsx, etc.) e la risoluzione.

Rispondi ESCLUSIVAMENTE con un JSON valido con questa esatta struttura:
{
  "trascrizione": "Trascrizione letterale fedele in italiano",
  "allerta": "verde" | "giallo" | "rosso",
  "sintesi": "Riassunto conciso in 1 frase per il Coach",
  "proposta_azione": "Consiglio pratico operativo e immediato per la seduta successiva",
  "diagnosi_tecnica": "Diagnosi tecnica del bug o valutazione del suggerimento con indicazione dei componenti"
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
          const pulisci = (s: string) =>
            s ? s.replace(/biomeccanic[aoe]/gi, "pattern motorio") : "";

          return {
            trascrizione: pulisci(parsed.trascrizione || ""),
            allerta: ["verde", "giallo", "rosso"].includes(parsed.allerta)
              ? parsed.allerta
              : "verde",
            sintesi: pulisci(parsed.sintesi || ""),
            proposta_azione: pulisci(parsed.proposta_azione || ""),
            diagnosi_tecnica: parsed.diagnosi_tecnica
              ? pulisci(parsed.diagnosi_tecnica)
              : undefined,
          };
        }
      }
    } catch (err) {
      console.warn("Gemini API non disponibile o errore:", err);
    }
  }

  // MOTORE EURISTICO CLINICO-SEMANTICO DETERMINISTICO DI VERITÀ OPERATIVA
  return fallbackClinicalAnalysis(contesto, metadata);
}

/**
 * Motore euristico clinico-semantico e diagnostico a regole deterministiche
 */
export function fallbackClinicalAnalysis(
  contesto: "biofeedback_workout" | "app_feedback",
  metadata: {
    livello?: string;
    giorno?: string;
    rpe?: number;
    sensazioni?: string[];
    noteTesto?: string;
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
        rpe >= 9);

    let allerta: "verde" | "giallo" | "rosso" = "verde";
    let sintesi = "Sessione chiusa regolarmente con parametri motori stabili ed ottima risposta generale.";
    let proposta = "Proseguire con la periodizzazione prevista per la seduta successiva mantenendo il focus sulla qualità esecutiva.";

    if (isRedAlert) {
      allerta = "rosso";
      sintesi = `Allerta articolare/carico: segnalata criticità durante la seduta (RPE ${rpe}/10).`;
      proposta =
        "Modalità B di Socrates: scarico attivo del pattern sofferente nella seduta successiva, sostituendolo con lavoro qualitativo a catena cinetica aperta, mobilità del cingolo lombo-pelvico e verifica tecnica diretta con il Coach prima di toccare sovraccarichi.";
    } else if (isYellowAlert) {
      allerta = "giallo";
      sintesi = `Fatica periferica alta o compenso posturale segnalato (RPE ${rpe}/10).`;
      proposta =
        "Regolare i carichi mantenendo 1-2 ripetizioni di riserva nel fondamentale e idratare il tessuto con mobilità attiva di scarico tra le serie.";
    }

    const trascrizioneGenerata = metadata.trascrizioneLive
      ? metadata.trascrizioneLive
      : metadata.noteTesto
      ? metadata.noteTesto
      : `Registrazione vocale atleta su Seduta ${metadata.giorno || ""}: RPE percepito ${rpe}/10, sensazioni motorie: ${(metadata.sensazioni || []).join(", ") || "buone"}.`;

    return {
      trascrizione: trascrizioneGenerata,
      allerta,
      sintesi,
      proposta_azione: proposta,
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

  const trascrizioneGenerata = metadata.descrizione
    ? metadata.descrizione
    : `Nota vocale di segnalazione (${metadata.tipoSegnalazione || "consiglio"}): ${metadata.titolo || ""}.`;

  return {
    trascrizione: trascrizioneGenerata,
    allerta,
    sintesi,
    proposta_azione: proposta,
    diagnosi_tecnica: diagnosi,
  };
}
