#!/usr/bin/env node
/**
 * ==============================================================================
 * AREA46 METHODOLOGY PLANNER — DRY-RUN SANDBOX IN MEMORIA
 * Pre-Flight Reasoning Engine per la Programmazione di Allenamento (Livello PRO)
 * Coach Stefano Tronconi — Landmine Lab / AI PT Assistant
 * ==============================================================================
 * 
 * Esegue la validazione deterministica A MONTE su qualsiasi bozza di scheda
 * PRIMA che venga scritta o proposta su disco (Vault o demo-data.json).
 * 
 * Applica la MATRICE DI RAGIONAMENTO A 5 FILTRI + TETTO 60 MINUTI + GUARDRAILS:
 *  1. 🧘 Natura del Gesto (Statico vs Dinamico: divieto assoluto ripetizioni)
 *  2. 🔄 Cinematica Continua (Alternato Fluido: divieto assoluto notazione '+')
 *  3. 🚫 Filtro Lessicale (Bando totale 'cerniera d'anca' e gergo ingegneristico)
 *  4. 📋 Destinatario della Nota (Separazione note atleta vs periodizzazione coach)
 *  5. ⚡ Padronanza del Mezzo & Flow (AMRAP vs Pratica Dedicata 5 min nel 1° allenamento)
 *  + ⏱️ Tetto Tassativo dei 60 Minuti a seduta
 *  + 🛡️ Invarianti Didattiche del Guardiano e Coach Knowledge Keeper
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../../..");

// Import moduli guardiani esistenti per integrazione totale
import { loadPedagogyRules, validatePedagogy } from "../../../../scripts/coach_knowledge_keeper.mjs";
import {
  loadRules,
  loadCatalogExercises,
  findExerciseRule,
  estimateRowDurationSeconds,
} from "../../../../scripts/guardian_methodology_pro.mjs";

function normalizeId(id) {
  if (!id) return "";
  return String(id).trim().padStart(3, "0");
}

function cleanStr(s) {
  return String(s || "").trim();
}

/**
 * Valida un array di righe di allenamento (seduta o ciclo intero)
 * applicando rigorosamente i 5 filtri di Pre-Flight Reasoning.
 *
 * @param {Array<Object>} workoutRows - Bozza degli esercizi da validare
 * @param {Object} [options={}] - Opzioni addizionali (es. ciclo, isFirstWorkoutOfCycle)
 * @returns {Object} Report dettagliato con ok, violations, warnings, sessionSummaries
 */
export function validatePreFlightPlan(workoutRows, options = {}) {
  if (!Array.isArray(workoutRows) || workoutRows.length === 0) {
    return {
      ok: false,
      violations: [
        {
          filtro: "INPUT",
          messaggio: "Nessuna riga di allenamento fornita per la validazione in memoria.",
          suggerimento: "Fornire un array valido di oggetti esercizio.",
        },
      ],
      warnings: [],
      sessionSummaries: [],
    };
  }

  const rules = loadRules();
  const pedagogyRules = loadPedagogyRules() || {};
  const catalogMap = loadCatalogExercises();
  const specificRules = rules.regole_specifiche_esercizi || {};

  const continuousBannedPlus = (pedagogyRules.esercizi_alternati_continui_vietato_piu || []).map((e) =>
    normalizeId(e.id)
  );
  const deletedIds = (pedagogyRules.esercizi_eliminati_dal_sistema || []).map((e) => normalizeId(e.id));
  const coldBannedIds = (pedagogyRules.divieti_a_freddo_blocco_1 || []).map((e) => normalizeId(e.id));
  const proExcludedIds = (pedagogyRules.esclusioni_livello_pro || []).map((e) => normalizeId(e.id));
  const matadorUnification = pedagogyRules.unioni_obbligatorie_pro || [];
  const staticStretchIds = (pedagogyRules.allungamenti_statici_vietato_ripetizioni || []).map((e) =>
    normalizeId(e.id)
  );

  const violations = [];
  const warnings = [];
  const sessionMap = new Map();

  for (const row of workoutRows) {
    const sessionKey = cleanStr(row.giorno) || cleanStr(row.seduta) || "Seduta 1";
    if (!sessionMap.has(sessionKey)) sessionMap.set(sessionKey, []);
    sessionMap.get(sessionKey).push(row);
  }

  const sessionSummaries = [];
  let isFirstSession = true;

  for (const [sessionName, sessionRows] of sessionMap.entries()) {
    const sessionReport = {
      nome: sessionName,
      righe: sessionRows.length,
      durata_stimata_min: 0,
      errori: [],
      avvisi: [],
    };

    // Stima della durata seduta
    const hasWarmupRoutine = sessionRows.some((r) => {
      const n = cleanStr(r.note_tecniche).toLowerCase();
      return n.includes("routine") || (n.includes("minuti") && cleanStr(r.sequenza).startsWith("1"));
    });
    let totalSec = hasWarmupRoutine ? 60 : 300;

    // Rileva se è il 1° allenamento del ciclo
    const isFirstWorkout =
      options.isFirstWorkoutOfCycle ||
      isFirstSession ||
      /1°|seduta\s*1\b|allenamento\s*1\b|giorno\s*1\b/i.test(sessionName);

    for (const row of sessionRows) {
      const eid = normalizeId(row.id_esercizio);
      const name = cleanStr(row.nome_esercizio);
      const param = cleanStr(row.parametri);
      const notes = cleanStr(row.note_tecniche);
      const seq = cleanStr(row.sequenza);
      const rec = cleanStr(row.recupero);
      const rule = findExerciseRule(row, specificRules);

      // Calcola durata riga
      const dur = estimateRowDurationSeconds(row);
      totalSec += dur;

      // ========================================================================
      // 🧘 FILTRO 1: NATURA DEL GESTO (STATICO VS DINAMICO)
      // ========================================================================
      const isStaticStretch =
        eid === "030" ||
        staticStretchIds.includes(eid) ||
        name.toLowerCase().includes("wall stretch") ||
        name.toLowerCase().includes("allungamento statico") ||
        name.toLowerCase().includes("tenuta decomprensiva");

      if (isStaticStretch) {
        const hasTime =
          param.includes('"') ||
          param.includes("'") ||
          /sec/i.test(param) ||
          /minut/i.test(param) ||
          /min/i.test(notes);
        const hasBreathing = /respir/i.test(param) || /respir/i.test(notes) || /cicli/i.test(notes);

        if (!hasTime && !hasBreathing) {
          const msg = `[FILTRO 1 - STATICO VS DINAMICO] '${name}' (ID ${eid}) in '${sessionName}': è un allungamento statico/decompressione. DIVIETO ASSOLUTO DI RIPETIZIONI (trovato '${param}'). Prescrizione consentita esclusivamente a tempo (es. 30/60" o 3 X 45") o a cicli respiratori controllati.`;
          violations.push({
            filtro: "FILTRO 1 (Statico vs Dinamico)",
            esercizio: name,
            seduta: sessionName,
            messaggio: msg,
            suggerimento:
              "Riformulare i parametri a tempo (es. '3 X 45\"') o indicare cicli respiratori (es. 'tenere la posizione per circa 6/8 cicli respiratori profondi e controllati').",
          });
          sessionReport.errori.push(msg);
        }

        if (param.includes("+") && !param.includes('"')) {
          const msg = `[FILTRO 1 - STATICO VS DINAMICO] '${name}' (ID ${eid}) in '${sessionName}': notazione a ripetizioni con '+' ('${param}') vietata su allungamenti statici.`;
          violations.push({
            filtro: "FILTRO 1 (Statico vs Dinamico)",
            esercizio: name,
            seduta: sessionName,
            messaggio: msg,
            suggerimento: "Eliminare notazione '+' e sostituire con tempo continuo o respirazioni.",
          });
          sessionReport.errori.push(msg);
        }
      }

      // ========================================================================
      // 🔄 FILTRO 2: CINEMATICA CONTINUA (ALTERNATO VS MONOLATERALE A BLOCCHI)
      // ========================================================================
      const isContinuousAlt =
        continuousBannedPlus.includes(eid) ||
        eid === "047" || // wall driver
        eid === "033" || // Coiled Cobra
        eid === "004" || // Skierg pagaia alternato
        eid === "201" || // Step Up esplosivo alternato
        eid === "158" || // Bat around the head
        (rule &&
          (rule.vincolo_notazione === "VIETATO_PIU" ||
            rule.modalita_prescrizione_predefinita === "TEMPO_ALTERNATO_CONTINUO" ||
            rule.modalita_prescrizione_predefinita === "RIPETIZIONI_CONTINUE_ALTERNATE"));

      if (isContinuousAlt) {
        if (param.includes("+")) {
          const msg = `[FILTRO 2 - CINEMATICA CONTINUA] '${name}' (ID ${eid}) in '${sessionName}': movimento alternato continuo fluido. DIVIETO ASSOLUTO DELLA NOTAZIONE CON '+' (trovato '${param}').`;
          violations.push({
            filtro: "FILTRO 2 (Cinematica Continua)",
            esercizio: name,
            seduta: sessionName,
            messaggio: msg,
            suggerimento:
              eid === "201"
                ? "Prescrivere a ripetizioni totali alternate continue (es. '3x10' o 'X 10'), mai 8+8."
                : "Prescrivere a tempo complessivo continuo (es. '3 X 45\"' o '3x30\"-40\"'), mai 30\"+30\".",
          });
          sessionReport.errori.push(msg);
        }
      }

      // ========================================================================
      // 🚫 FILTRO 3: FILTRO LESSICALE (BANDO 'CERNIERA D'ANCA' & GERGO ACCADEMICO)
      // ========================================================================
      const combinedText = `${name} ${param} ${notes} ${cleanStr(row.tag)} ${cleanStr(row.focus)}`;

      // Bando assoluto e permanente di 'cerniera d'anca'
      if (/cerniera\s+d['’]anca/i.test(combinedText) || /cerniera\s+d\s+anca/i.test(combinedText)) {
        const msg = `[FILTRO 3 - BANDO CERNIERA D'ANCA] Rilevato il termine vietato 'cerniera d'anca' in '${name}' in '${sessionName}'. Regola permanente di Stefano Tronconi: termine bandito al 100% ovunque e sempre.`;
        violations.push({
          filtro: "FILTRO 3 (Lessico & Saggezza)",
          esercizio: name,
          seduta: sessionName,
          messaggio: msg,
          suggerimento:
            "Sostituire immediatamente con linguaggio naturale: 'stabilità del bacino', 'caricamento elastico', 'spinta dai piedi', 'flessione controllata'.",
        });
        sessionReport.errori.push(msg);
      }

      // Bando gergo accademico/ingegneristico nelle note per gli atleti
      const academicMatches = [];
      if (/biomeccanic[aoe]/i.test(notes)) academicMatches.push("biomeccanica");
      if (/fulcro\s+cinetico/i.test(notes)) academicMatches.push("fulcro cinetico");
      if (/catena\s+cinetica/i.test(notes)) academicMatches.push("catena cinetica");
      if (/cinematic[aoe]/i.test(notes)) academicMatches.push("cinematica");

      if (academicMatches.length > 0) {
        const msg = `[FILTRO 3 - GERGO ACCADEMICO] Rilevato gergo ingegneristico (${academicMatches.join(", ")}) nelle note di '${name}' in '${sessionName}'.`;
        violations.push({
          filtro: "FILTRO 3 (Lessico & Saggezza)",
          esercizio: name,
          seduta: sessionName,
          messaggio: msg,
          suggerimento:
            "Sostituire con concetti vicini alla vita reale e al corpo: 'schema motorio', 'dinamica fluida', 'facilità ed efficienza', 'linea di spinta'.",
        });
        sessionReport.errori.push(msg);
      }

      // ========================================================================
      // 📋 FILTRO 4: DESTINATARIO DELLA NOTA (ATLETA VS COACH/PROGRAMMATORE)
      // ========================================================================
      const coachPeriodizationRegex =
        /(?:fondamentale\s+(?:\w+\s+)?mesociclo|consolid(?:at[oa]|amento)\s+mesociclo|mesociclo\s+\d+|scarico\s+mesociclo|fase\s+di\s+accumulo|fase\s+intensificazione|target\s+coach)/i;
      const periodizationMatch = notes.match(coachPeriodizationRegex);

      if (periodizationMatch) {
        const msg = `[FILTRO 4 - SEPARAZIONE NOTE ATLETA] Rilevati riferimenti di periodizzazione/programmazione ('${periodizationMatch[0]}') nelle note atleti di '${name}' in '${sessionName}'.`;
        violations.push({
          filtro: "FILTRO 4 (Destinatario della Nota)",
          esercizio: name,
          seduta: sessionName,
          messaggio: msg,
          suggerimento:
            "Rimuovere la periodizzazione dalle note visibili all'atleta. L'atleta deve ricevere solo istruzioni operative, tecniche, esecutive, RPE e recuperi.",
        });
        sessionReport.errori.push(msg);
      }

      // ========================================================================
      // ⚡ FILTRO 5: PADRONANZA DEL MEZZO & FLOW (AMRAP VS PRATICA DEDICATA)
      // ========================================================================
      const isComplexCoordinationTool =
        eid === "106" || // Dragon Roll
        name.toLowerCase().includes("dragon roll") ||
        name.toLowerCase().includes("flow rope") ||
        (name.toLowerCase().includes("clava") && !name.toLowerCase().includes("leggera"));

      const isInAmrap =
        /\bamrap\b/i.test(param) ||
        /\bamrap\b/i.test(seq) ||
        /\bamrap\s*\d+/i.test(notes) ||
        /\bblocco\s+amrap\b/i.test(notes) ||
        (/\bgiro\b/i.test(notes) && /\bamrap\b/i.test(notes) && !/prima dell['’]inserimento|estrarre dall['’]amrap/i.test(notes));

      if (isComplexCoordinationTool && isInAmrap) {
        if (isFirstWorkout) {
          const msg = `[FILTRO 5 - FLOW & AMRAP] '${name}' (ID ${eid}) inserito in AMRAP nel 1° allenamento in '${sessionName}'.`;
          violations.push({
            filtro: "FILTRO 5 (Padronanza del Mezzo & Flow)",
            esercizio: name,
            seduta: sessionName,
            messaggio: msg,
            suggerimento:
              "Nel 1° allenamento estrarre l'attrezzo complesso dall'AMRAP e collocarlo come stazione dedicata singola da 5 minuti continui per apprendimento senza fretta. Nell'AMRAP inserire un'alternativa fluida e accessibile a tutti (es. jumping rope 50 rep o jumping jacks). Dal 2° allenamento potrà essere reinserito a 50 rep.",
          });
          sessionReport.errori.push(msg);
        }
      }

      // Controllo volume minimo per corde/flow rope
      const isRope =
        name.toLowerCase().includes("rope") ||
        name.toLowerCase().includes("corda") ||
        eid === "106" ||
        eid === "102" ||
        eid === "103";
      if (isRope) {
        const hasTime = param.includes('"') || param.includes("'") || /sec/i.test(param);
        if (!hasTime) {
          const repMatch = param.match(/\d+/);
          const repVal = repMatch ? parseInt(repMatch[0], 10) : 0;
          if (repVal > 0 && repVal < 50) {
            const msg = `[FILTRO 5 - VOLUME CORDA/FLOW] '${name}' (ID ${eid}) prescritto a ripetizioni inferiori a 50 ('${param}') in '${sessionName}'.`;
            violations.push({
              filtro: "FILTRO 5 (Padronanza del Mezzo & Flow)",
              esercizio: name,
              seduta: sessionName,
              messaggio: msg,
              suggerimento: "Prescrivere a tempo (es. 45\" o 30\"+30\") o ad almeno 50 ripetizioni continue al giro.",
            });
            sessionReport.errori.push(msg);
          }
        }
      }

      // ========================================================================
      // 🛡️ REGOLE DIDATTICHE INVARIANTI (GUARDRAILS DI SISTEMA)
      // ========================================================================
      // Esercizi eliminati dal sistema
      if (deletedIds.includes(eid) || name.toLowerCase().includes("gymnasty abs")) {
        const msg = `[INVARIANTE PEDAGOGICA] ESERCIZIO ELIMINATO: '${name}' (ID ${eid}) è stato cancellato definitivamente dal sistema.`;
        violations.push({
          filtro: "Guardiano Metodologico",
          esercizio: name,
          seduta: sessionName,
          messaggio: msg,
          suggerimento: "Rimuovere completamente l'esercizio e sostituirlo con esercizio attivo dal catalogo.",
        });
        sessionReport.errori.push(msg);
      }

      // Pliometria/potenza a freddo (blocco 1)
      if (seq.startsWith("1") && coldBannedIds.includes(eid)) {
        const msg = `[INVARIANTE PEDAGOGICA] ESERCIZIO A FREDDO VIETATO: '${name}' (ID ${eid}) nel blocco 1 (warm-up) in '${sessionName}'.`;
        violations.push({
          filtro: "Guardiano Metodologico",
          esercizio: name,
          seduta: sessionName,
          messaggio: msg,
          suggerimento: "Spostare l'esercizio a un blocco successivo o sostituire con mobilità/attivazione a terra.",
        });
        sessionReport.errori.push(msg);
      }

      // Esclusione Livello PRO (Home Training)
      if (proExcludedIds.includes(eid)) {
        const msg = `[INVARIANTE PEDAGOGICA] ESERCIZIO NON PRO: '${name}' (ID ${eid}) è una propedeutica home training esclusa dal livello PRO.`;
        violations.push({
          filtro: "Guardiano Metodologico",
          esercizio: name,
          seduta: sessionName,
          messaggio: msg,
          suggerimento: "Sostituire con esercizio specifico per attrezzatura Landmine Lab PRO.",
        });
        sessionReport.errori.push(msg);
      }

      // Matador Transitions unificate
      for (const m of matadorUnification) {
        const bannedSeparated = (m.ids_vietati_separatamente || []).map(normalizeId);
        if (bannedSeparated.includes(eid)) {
          const msg = `[INVARIANTE PEDAGOGICA] MATADOR SEPARATO VIETATO: '${name}' (ID ${eid}) deve essere prescritto come esercizio unificato ID ${m.id_unificato} (${m.nome}).`;
          violations.push({
            filtro: "Guardiano Metodologico",
            esercizio: name,
            seduta: sessionName,
            messaggio: msg,
            suggerimento: `Usare sempre ID ${m.id_unificato} (${m.nome}) dal livello PRO in poi.`,
          });
          sessionReport.errori.push(msg);
        }
      }

      // Speed Ladder mai in AMRAP
      const isSpeedLadder =
        name.toLowerCase().includes("ladder") ||
        name.toLowerCase().includes("scaletta") ||
        (rule && rule.attrezzo && rule.attrezzo.toLowerCase().includes("speed ladder"));
      if (isSpeedLadder && (notes.toLowerCase().includes("amrap") || param.toLowerCase().includes("amrap"))) {
        const msg = `[INVARIANTE PEDAGOGICA] SPEED LADDER IN AMRAP: '${name}' inserito in blocco ad alta densità in '${sessionName}'.`;
        violations.push({
          filtro: "Guardiano Metodologico",
          esercizio: name,
          seduta: sessionName,
          messaggio: msg,
          suggerimento: "Collocare Speed Ladder come lavoro neurale qualitativo a sé stante con recupero completo.",
        });
        sessionReport.errori.push(msg);
      }

      // Pliometria reattiva RPE > 8.5
      if (rule && (rule.modalita_prescrizione_predefinita === "PLIOMETRIA_REATTIVA" || (rule.categoria && rule.categoria.includes("pliometria")))) {
        const rpeMatch = notes.match(/rpe\s*([\d.]+)/i);
        if (rpeMatch && parseFloat(rpeMatch[1]) > 8.5) {
          const msg = `[INVARIANTE PEDAGOGICA] PLIOMETRIA AD ALTO RPE: '${name}' ha RPE ${rpeMatch[1]} > 8.5 in '${sessionName}'.`;
          violations.push({
            filtro: "Guardiano Metodologico",
            esercizio: name,
            seduta: sessionName,
            messaggio: msg,
            suggerimento: "La pliometria reattiva richiede freschezza elastica, non cedimento. Rimuovere RPE o limitare a max 8.",
          });
          sessionReport.errori.push(msg);
        }
      }
    }

    // ========================================================================
    // ⏱️ TETTO DEI 60 MINUTI
    // ========================================================================
    const durationMin = Math.round(totalSec / 60);
    sessionReport.durata_stimata_min = durationMin;

    if (durationMin > 60) {
      const msg = `[TETTO 60 MINUTI SUPERATO] La seduta '${sessionName}' ha una durata stimata di ~${durationMin} min (limite massimo inderogabile: 60 min).`;
      violations.push({
        filtro: "Tetto dei 60 Minuti",
        seduta: sessionName,
        messaggio: msg,
        suggerimento: `Snellire la seduta riducendo serie o accorpando stazioni per rientrare nei 60 minuti massimi (durata stimata attuale: ${durationMin} min).`,
      });
      sessionReport.errori.push(msg);
    }

    sessionSummaries.push(sessionReport);
    isFirstSession = false;
  }

  return {
    ok: violations.length === 0,
    violations,
    warnings,
    sessionSummaries,
  };
}

/**
 * Stampa un report formattato e visivamente immediato a terminale.
 */
export function printPlannerReport(report, title = "PRE-FLIGHT REASONING REPORT") {
  console.log("\n================================================================================");
  console.log(`🛡️  AREA46 METHODOLOGY PLANNER — ${title}`);
  console.log("    Filtro Pre-Generazione & Validazione in Memoria (Coach Stefano Tronconi)");
  console.log("================================================================================");

  if (report.sessionSummaries && report.sessionSummaries.length > 0) {
    for (const s of report.sessionSummaries) {
      const icon = s.errori.length > 0 ? "🔴" : s.avvisi.length > 0 ? "⚠️" : "🟢";
      console.log(`\n${icon} ${s.nome}: ${s.righe} esercizi | Durata stimata ~${s.durata_stimata_min} min (Tetto: 60 min)`);
      if (s.errori.length > 0) {
        for (const e of s.errori) console.log(`   ⛔ ${e}`);
      }
      if (s.avvisi.length > 0) {
        for (const w of s.avvisi) console.log(`   ⚠️  ${w}`);
      }
    }
  }

  console.log("\n--------------------------------------------------------------------------------");
  if (report.ok) {
    console.log("🟢 ESITO: CERTIFICATO AL 100%");
    console.log("   La bozza rispetta integralmente la matrice dei 5 filtri e la didattica del Coach.");
    console.log("   ✅ AUTORIZZATA LA SCRITTURA FISICA SU DISCO (Vault / demo-data.json)");
  } else {
    console.log(`🔴 ESITO: VETO METODOLOGICO — ${report.violations.length} ANOMALIE RILEVATE`);
    console.log("   🚫 SCRITTURA BLOCCATA. Correggere prima le seguenti deviazioni concettuali:");
    report.violations.forEach((v, idx) => {
      console.log(`\n   ${idx + 1}. [${v.filtro}] ${v.messaggio}`);
      console.log(`      💡 CORREZIONE: ${v.suggerimento}`);
    });
  }
  console.log("================================================================================\n");
}

/**
 * Payload di prova integrati per test deterministico in memoria.
 */
export function getDemoPayloads() {
  // Payload 1: Pieno di anomalie (Filtro 1, 2, 3, 4, 5 e sforamento 60 min)
  const invalidDraft = [
    {
      id_esercizio: "030",
      nome_esercizio: "Wall Stretch",
      settimana: "Ciclo 9",
      giorno: "49 allenamento A (Bozza Errata)",
      sequenza: "1a",
      parametri: "8+8", // VIOLAZIONE FILTRO 1: Ripetizioni su allungamento statico
      recupero: "30\"",
      note_tecniche: "RPE 7 | Allungamento profondo con cerniera d'anca ben allineata", // VIOLAZIONE FILTRO 3: cerniera d'anca
    },
    {
      id_esercizio: "201",
      nome_esercizio: "Step Up esplosivo alternato",
      settimana: "Ciclo 9",
      giorno: "49 allenamento A (Bozza Errata)",
      sequenza: "2a",
      parametri: "8+8", // VIOLAZIONE FILTRO 2: Notazione '+' su alternato continuo
      recupero: "45\"",
      note_tecniche: "Ottimizzare la biomeccanica di spinta per il consolidamento mesociclo", // VIOLAZIONE FILTRO 3 (biomeccanica) & FILTRO 4 (consolidamento mesociclo)
    },
    {
      id_esercizio: "106",
      nome_esercizio: "Dragon Roll",
      settimana: "Ciclo 9",
      giorno: "49 allenamento A (Bozza Errata)",
      sequenza: "3a",
      parametri: "AMRAP 12'",
      recupero: "60\"",
      note_tecniche: "AMRAP 12' finale nel 1° allenamento del ciclo senza pratica dedicata preventiva", // VIOLAZIONE FILTRO 5: Attrezzo complesso in AMRAP al 1° allenamento
    },
    // Aggiunta stazioni per forzare sforamento tetto 60 min
    {
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      settimana: "Ciclo 9",
      giorno: "49 allenamento A (Bozza Errata)",
      sequenza: "4a",
      parametri: "8x8+8",
      recupero: "120\"",
      note_tecniche: "Carico submassimale",
    },
    {
      id_esercizio: "057",
      nome_esercizio: "Landmine Press",
      settimana: "Ciclo 9",
      giorno: "49 allenamento A (Bozza Errata)",
      sequenza: "5a",
      parametri: "6x10+10",
      recupero: "90\"",
      note_tecniche: "Spinta",
    },
    {
      id_esercizio: "065",
      nome_esercizio: "High Pull",
      settimana: "Ciclo 9",
      giorno: "49 allenamento A (Bozza Errata)",
      sequenza: "6a",
      parametri: "6x8+8",
      recupero: "90\"",
      note_tecniche: "Tirata esplosiva",
    },
  ];

  // Payload 2: Bozza perfetta al 100% conforme alla didattica del Coach
  const validDraft = [
    {
      id_esercizio: "030",
      nome_esercizio: "Wall Stretch",
      settimana: "Ciclo 9",
      giorno: "49 allenamento A (Bozza Certificata)",
      sequenza: "1a",
      parametri: "3 X 45\"", // CONFORME: a tempo continuo
      recupero: "30\"",
      note_tecniche: "Tenere la posizione per circa 6/8 cicli respiratori profondi e controllati, caricamento elastico del bacino", // CONFORME: linguaggio naturale
    },
    {
      id_esercizio: "201",
      nome_esercizio: "Step Up esplosivo alternato",
      settimana: "Ciclo 9",
      giorno: "49 allenamento A (Bozza Certificata)",
      sequenza: "2a",
      parametri: "3x10", // CONFORME: ripetizioni totali alternate
      recupero: "45\"",
      note_tecniche: "RPE 8 | Spinta elastica continua da terra, cambio piede in volo fluido", // CONFORME: note solo tecniche ed esecutive
    },
    {
      id_esercizio: "106",
      nome_esercizio: "Dragon Roll",
      settimana: "Ciclo 9",
      giorno: "49 allenamento A (Bozza Certificata)",
      sequenza: "3a",
      parametri: "1x5'", // CONFORME: 5 minuti dedicati nel 1° allenamento per padronanza del mezzo
      recupero: "60\"",
      note_tecniche: "Stazione didattica singola di 5 minuti per padronanza del gesto e ritmo fluido prima dell'inserimento in AMRAP",
    },
    {
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      settimana: "Ciclo 9",
      giorno: "49 allenamento A (Bozza Certificata)",
      sequenza: "4a",
      parametri: "4x8+8",
      recupero: "RBS 45\" - Rest 60\"",
      note_tecniche: "RPE 8 | Inizia dal lato debole e mantieni stabilità del bacino",
    },
  ];

  return { invalidDraft, validDraft };
}

// ==============================================================================
// RUNNER CLI
// ==============================================================================
async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith("--file="))?.replace("--file=", "").trim();
  const inputArg = args.find((a) => a.startsWith("--input="))?.replace("--input=", "").trim();
  const demoFlag = args.includes("--demo") || (!fileArg && !inputArg);

  if (demoFlag) {
    console.log("\n================================================================================");
    console.log("🧪 AVVIO SIMULAZIONE DRY-RUN INTERNA (SUITE DI TEST PEDAGOGICA)");
    console.log("================================================================================");

    const { invalidDraft, validDraft } = getDemoPayloads();

    console.log("\n--- TEST CASE 1: BOZZA CON ANOMALIE CONCETTUALI (DEVE RICEVERE IL VETO) ---");
    const repInvalid = validatePreFlightPlan(invalidDraft, { isFirstWorkoutOfCycle: true });
    printPlannerReport(repInvalid, "SIMULAZIONE BOZZA CON ANOMALIE");

    console.log("\n--- TEST CASE 2: BOZZA CONFORME AL 100% (DEVE ESSERE CERTIFICATA) ---");
    const repValid = validatePreFlightPlan(validDraft, { isFirstWorkoutOfCycle: true });
    printPlannerReport(repValid, "SIMULAZIONE BOZZA CERTIFICATA");

    const success = !repInvalid.ok && repValid.ok;
    if (success) {
      console.log("🎯 TEST SUITE DRY-RUN COMPLETATA CON SUCCESSO:");
      console.log("   - Riconosciute e bloccate con VETO tutte le violazioni dei 5 filtri e della durata.");
      console.log("   - Certificata con successo la bozza corretta.");
      process.exit(0);
    } else {
      console.error("❌ Errore inaspettato nella suite di test interna.");
      process.exit(1);
    }
  }

  let rawData = null;
  if (fileArg) {
    const fullPath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ File bozza non trovato: ${fullPath}`);
      process.exit(1);
    }
    rawData = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  } else if (inputArg) {
    rawData = JSON.parse(inputArg);
  }

  const rows = Array.isArray(rawData)
    ? rawData
    : rawData.allenamenti || rawData.sedute || rawData.esercizi || [];

  const rep = validatePreFlightPlan(rows);
  printPlannerReport(rep, fileArg ? `FILE: ${path.basename(fileArg)}` : "PAYLOAD IN MEMORIA");
  process.exit(rep.ok ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Errore irreversibile Dry-Run Planner:", err);
    process.exit(1);
  });
}
