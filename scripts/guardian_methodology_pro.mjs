#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const VAULT_CYCLES_FILE = path.join(ROOT_DIR, "data", "vault", "5_metodologia_allenamenti_cicli.json");
const VAULT_RULES_FILE = path.join(ROOT_DIR, "data", "vault", "regole_esercizi_metodologia.json");
const VAULT_EXERCISES_FILE = path.join(ROOT_DIR, "data", "vault", "4_metodologia_esercizi.json");

export function loadCatalogExercises() {
  if (!fs.existsSync(VAULT_EXERCISES_FILE)) return {};
  const data = JSON.parse(fs.readFileSync(VAULT_EXERCISES_FILE, "utf-8"));
  const map = {};
  for (const ex of (data.database_esercizi || [])) {
    const id = normalizeId(ex.id_esercizio);
    if (id) map[id] = ex;
  }
  return map;
}

export function loadRules() {
  if (!fs.existsSync(VAULT_RULES_FILE)) {
    throw new Error(`File regole non trovato: ${VAULT_RULES_FILE}`);
  }
  return JSON.parse(fs.readFileSync(VAULT_RULES_FILE, "utf-8"));
}

export function loadWorkouts() {
  if (!fs.existsSync(VAULT_CYCLES_FILE)) {
    throw new Error(`File allenamenti non trovato: ${VAULT_CYCLES_FILE}`);
  }
  const data = JSON.parse(fs.readFileSync(VAULT_CYCLES_FILE, "utf-8"));
  return data.allenamenti || [];
}

function normalizeId(id) {
  if (!id) return "";
  const s = String(id).trim();
  return s.padStart(3, "0");
}

function normalizeName(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trova la regola di un esercizio per ID o per Nome normalizzato
 */
export function findExerciseRule(item, rulesMap) {
  const normId = normalizeId(item.id_esercizio);
  if (normId && rulesMap[normId]) {
    return rulesMap[normId];
  }
  const itemNormName = normalizeName(item.nome_esercizio);
  for (const rule of Object.values(rulesMap)) {
    const ruleNormName = normalizeName(rule.nome);
    if (ruleNormName === itemNormName || itemNormName.includes(ruleNormName) || ruleNormName.includes(itemNormName)) {
      return rule;
    }
  }
  return null;
}

/**
 * Stima realistica del tempo di una riga di allenamento in secondi
 */
function estimateRowDurationSeconds(row) {
  const param = String(row.parametri || "").toLowerCase();
  const notes = String(row.note_tecniche || "").toLowerCase();
  const recStr = String(row.recupero || "").toLowerCase().trim();
  const seq = String(row.sequenza || "").toLowerCase().trim();

  // AMRAP blocco speciale
  const amrapMatch = notes.match(/amrap\s*(\d+)['"]?/);
  if (amrapMatch) {
    // Il blocco AMRAP viene contato una sola volta per il primo esercizio del cluster (es. 5a)
    if (seq && !seq.endsWith("a")) {
      return 0; // già conteggiato nel primo esercizio del cluster
    }
    const mins = parseInt(amrapMatch[1], 10);
    return mins * 60;
  }

  // Flusso a minuti (es. 1x5')
  const minFlowMatch = param.match(/(\d+)x(\d+)['’]/);
  if (minFlowMatch) {
    const sets = parseInt(minFlowMatch[1], 10);
    const mins = parseInt(minFlowMatch[2], 10);
    return sets * mins * 60 + 60;
  }

  // Estrazione sets
  let sets = 1;
  const setMatch = param.match(/^(\d+)x/);
  if (setMatch) {
    sets = parseInt(setMatch[1], 10);
  }

  // Estrazione tempo di lavoro per set
  let workPerSetSec = 25; // default
  if (param.includes("+")) {
    const secPlusMatch = param.match(/(\d+)["”]\s*\+\s*(\d+)["”]/);
    if (secPlusMatch) {
      workPerSetSec = parseInt(secPlusMatch[1], 10) + parseInt(secPlusMatch[2], 10);
    } else {
      const repPlusMatch = param.match(/(\d+)\s*\+\s*(\d+)/);
      if (repPlusMatch) {
        workPerSetSec = (parseInt(repPlusMatch[1], 10) + parseInt(repPlusMatch[2], 10)) * 2.5;
      }
    }
  } else {
    const secSingleMatch = param.match(/(\d+)["”]/);
    if (secSingleMatch) {
      workPerSetSec = parseInt(secSingleMatch[1], 10);
    } else {
      const repMatch = param.match(/x\s*(\d+)/);
      if (repMatch) {
        workPerSetSec = parseInt(repMatch[1], 10) * 3;
      }
    }
  }

  // Recupero: gestione intelligente jump set
  let recSec = 0;
  const isJumpSetFirstLeg = (seq.endsWith("a") || seq.endsWith("b")) && !recStr;

  if (isJumpSetFirstLeg) {
    // In un jump set, il primo esercizio ha solo la transizione rapida al secondo
    recSec = 10;
  } else if (recStr.includes("rbs")) {
    const rbsNum = recStr.match(/(\d+)/);
    const val = rbsNum ? parseInt(rbsNum[1], 10) : 45;
    recSec = val * 1.5; // recupero fisiologico totale
  } else if (recStr) {
    const recNum = recStr.match(/(\d+)/);
    recSec = recNum ? parseInt(recNum[1], 10) : 45;
  } else {
    recSec = 30; // default moderato
  }

  return sets * (workPerSetSec + recSec);
}

/**
 * Verifica corrispondenza semantica delle note obbligatorie
 */
function checkRequiredNoteMatches(requiredNote, actualNote) {
  const req = requiredNote.toLowerCase();
  const act = actualNote.toLowerCase();

  // Match clava / polsi
  if (req.includes("clava") || req.includes("polso") || req.includes("polsi")) {
    return act.includes("clava") || act.includes("polso") || act.includes("polsi");
  }

  // Match progressione dragon flag / core
  if (req.includes("versione") || req.includes("propedeutica") || req.includes("rpe di 8")) {
    return act.includes("versione") || act.includes("propedeutica") || act.includes("rpe 8") || act.includes("rpe di 8");
  }

  // Match generico parziale
  const tokens = req.split(/[\s,/]+/).filter((t) => t.length > 5);
  for (const t of tokens) {
    if (act.includes(t)) return true;
  }
  return false;
}

/**
 * Valida un ciclo PRO
 */
export function validateProCycle(workouts, cycleName, rules, catalogMap = null) {
  const specificRules = rules.regole_specifiche_esercizi || {};
  const guardrails = rules.guardrails_generali || {};

  const report = {
    ciclo: cycleName,
    totale_righe: workouts.length,
    ok: true,
    violations: [],
    warnings: [],
    sessionReports: [],
  };

  // 1. Raggruppa per giorno/seduta
  const sessionMap = new Map();
  for (const w of workouts) {
    const giorno = w.giorno || "Sconosciuto";
    if (!sessionMap.has(giorno)) sessionMap.set(giorno, []);
    sessionMap.get(giorno).push(w);
  }

  // 2. Controllo alternanza A-B-A-B-A-B (6 sedute fisse)
  const sessionNames = Array.from(sessionMap.keys());
  if (sessionNames.length !== 6) {
    report.warnings.push(
      `Il ciclo dovrebbe avere esattamente 6 sedute (A-B-A-B-A-B). Trovate: ${sessionNames.length}`
    );
  }

  // 3. Verifica scarico selettivo (multiplo di 3 o indicazione esplicita)
  const isScaricoCycle = cycleName.includes("6") || cycleName.toLowerCase().includes("scarico");

  // 4. Validazione per ciascuna seduta
  for (const [sessionName, sessionRows] of sessionMap.entries()) {
    const sessionRes = {
      sessione: sessionName,
      righe: sessionRows.length,
      durata_stimata_min: 0,
      warnings: [],
      errors: [],
    };

    let totalDurationSec = 300; // 5 min attivazione generale

    for (const row of sessionRows) {
      const durSec = estimateRowDurationSeconds(row);
      totalDurationSec += durSec;

      const rule = findExerciseRule(row, specificRules);
      const rowParam = String(row.parametri || "").trim();
      const rowNotes = String(row.note_tecniche || "").trim();
      const rowName = String(row.nome_esercizio || "").trim();

      // Guardrail 1: Speed Ladder mai in circuiti o AMRAP
      const isSpeedLadder =
        rowName.toLowerCase().includes("ladder") ||
        rowName.toLowerCase().includes("scaletta") ||
        (rule && rule.attrezzo && rule.attrezzo.toLowerCase().includes("speed ladder"));

      const isAmrapOrIntense =
        rowNotes.toLowerCase().includes("amrap") ||
        rowNotes.toLowerCase().includes("circuito") ||
        rowParam.toLowerCase().includes("amrap");

      if (isSpeedLadder && isAmrapOrIntense) {
        const msg = `VIOLAZIONE TASSATIVA: '${rowName}' (Speed Ladder) inserito in AMRAP/circuito ad alta intensità nella seduta ${sessionName}.`;
        sessionRes.errors.push(msg);
        report.violations.push(msg);
        report.ok = false;
      }

      // Guardrail 2: Regole esecutive specifiche da catalogo
      if (rule) {
        // Vincolo VIETATO_PIU (es. Coiled Cobra a tempo continuo alternato)
        if (rule.vincolo_notazione === "VIETATO_PIU" || rule.modalita_prescrizione_predefinita === "TEMPO_ALTERNATO_CONTINUO") {
          if (rowParam.includes("+")) {
            const msg = `ERRORE NOTAZIONE: '${rowName}' è un esercizio alternato continuo (${rule.modalita_prescrizione_predefinita}). Vietata la notazione monolaterale con '+' (trovato '${rowParam}'). Usare parametro a tempo continuo (es. 30"-40").`;
            sessionRes.errors.push(msg);
            report.violations.push(msg);
            report.ok = false;
          }
        }

        // Vincolo OBBLIGATORIO_PIU (esercizi asimmetrici o per lato no-stop)
        if (rule.vincolo_notazione === "OBBLIGATORIO_PIU" || rule.modalita_prescrizione_predefinita === "TEMPO_PER_LATO_NO_STOP" || rule.modalita_prescrizione_predefinita === "RIPETIZIONI_MONOLATERALI_RBS") {
          if (!rowParam.includes("+") && !rowParam.toLowerCase().includes("flow")) {
            const msg = `AVVISO NOTAZIONE: '${rowName}' è classificato come asimmetrico/per lato (${rule.modalita_prescrizione_predefinita}), ma i parametri '${rowParam}' non contengono la notazione '+' (es. 8+8 o 60"+60").`;
            sessionRes.warnings.push(msg);
            report.warnings.push(msg);
          }
        }

        // Controllo note obbligatorie (es. Clave / Wrist safety)
        if (rule.note_obbligatorie && rule.note_obbligatorie.length > 0) {
          for (const reqNote of rule.note_obbligatorie) {
            if (!checkRequiredNoteMatches(reqNote, rowNotes)) {
              const msg = `NOTA DI SICUREZZA MANCANTE: '${rowName}' richiede indicazione: "${reqNote}".`;
              sessionRes.warnings.push(msg);
              report.warnings.push(msg);
            }
          }
        }

        // Divieto RPE massimale su pliometria
        if (rule.modalita_prescrizione_predefinita === "PLIOMETRIA_REATTIVA" || (rule.categoria && rule.categoria.includes("pliometria"))) {
          const rpeMatch = rowNotes.match(/rpe\s*([\d.]+)/i);
          if (rpeMatch) {
            const rpeVal = parseFloat(rpeMatch[1]);
            if (rpeVal > 8.5) {
              const msg = `VIOLAZIONE METODOLOGICA: '${rowName}' (Pliometria reattiva) ha RPE prescritto ${rpeVal} > 8.5. La pliometria richiede reattività elastica e freschezza, mai cedimento.`;
              sessionRes.errors.push(msg);
              report.violations.push(msg);
              report.ok = false;
            }
          }
        }

        // Controllo scarico selettivo Mod B: nessun massimale puro nei cicli di scarico
        if (isScaricoCycle && rule.categoria === "forza e struttura" && rule.ruolo === "fondamentale") {
          const rpeMatch = rowNotes.match(/rpe\s*([\d.]+)/i);
          if (rpeMatch && parseFloat(rpeMatch[1]) >= 9.5) {
            const msg = `VIOLAZIONE SCARICO MODALITÀ B: '${rowName}' ha RPE ${rpeMatch[1]} in un ciclo di scarico (${cycleName}). I fondamentali pesanti devono cedere il passo a lavoro qualitativo/submassimale o destrezza.`;
            sessionRes.errors.push(msg);
            report.violations.push(msg);
            report.ok = false;
          }
        }
      }

      // Controllo coerenza Link Video con catalogo esercizi
      if (catalogMap) {
        const normId = normalizeId(row.id_esercizio);
        const catEx = catalogMap[normId];
        if (catEx && catEx.link_video) {
          const rowVid = (row.link_video || "").trim();
          const catVid = (catEx.link_video || "").trim();
          if (rowVid && catVid && rowVid !== catVid) {
            const msg = `DISCREPANZA VIDEO: '${rowName}' ha link video '${rowVid}' differente da quello di catalogo ('${catVid}').`;
            sessionRes.warnings.push(msg);
            report.warnings.push(msg);
          }
        }
      }
    }

    const durationMin = Math.round(totalDurationSec / 60);
    sessionRes.durata_stimata_min = durationMin;

    // Controllo tetto 60 minuti
    if (durationMin > 60) {
      const msg = `SUPERAMENTO TETTO 60 MINUTI: La seduta '${sessionName}' ha una durata stimata di ~${durationMin} min (tetto massimo consentito: 60 min).`;
      sessionRes.warnings.push(msg);
      report.warnings.push(msg);
    }

    report.sessionReports.push(sessionRes);
  }

  return report;
}

/**
 * CLI Runner
 */
async function main() {
  const args = process.argv.slice(2);
  const cicloArg = args.find((a) => a.startsWith("--ciclo="))?.split("=")[1];
  const allFlag = args.includes("--all");

  console.log("================================================================================");
  console.log("🛡️  AREA46 TRAINING LAB - AGENTE GUARDIANO METODOLOGICO (LIVELLO PRO)");
  console.log("    Verifica Vincoli Esecutivi, Notazioni, Sicurezza Articolare e Periodizzazione");
  console.log("================================================================================\n");

  const rules = loadRules();
  const catalogMap = loadCatalogExercises();
  const allWorkouts = loadWorkouts();
  const proWorkouts = allWorkouts.filter((w) => w.livello === "PRO");

  const distinctCycles = [...new Set(proWorkouts.map((w) => w.settimana))];

  let targetCycles = [];
  if (cicloArg) {
    const cycleName = cicloArg.toLowerCase().includes("ciclo") ? cicloArg : `Ciclo ${cicloArg}`;
    targetCycles = distinctCycles.filter((c) => c.toLowerCase() === cycleName.toLowerCase());
    if (targetCycles.length === 0) {
      console.error(`❌ Nessun allenamento trovato per '${cycleName}'. Cicli disponibili: ${distinctCycles.join(", ")}`);
      process.exit(1);
    }
  } else if (allFlag) {
    targetCycles = distinctCycles;
  } else {
    // Default: analizza l'ultimo ciclo inserito
    targetCycles = [distinctCycles[distinctCycles.length - 1]];
  }

  let totalViolations = 0;
  let totalWarnings = 0;

  for (const cName of targetCycles) {
    const cycleWorkouts = proWorkouts.filter((w) => w.settimana === cName);
    const rep = validateProCycle(cycleWorkouts, cName, rules, catalogMap);

    console.log(`📋 ANALISI: ${cName} (${rep.totale_righe} righe di programmazione)`);
    console.log("--------------------------------------------------------------------------------");

    for (const s of rep.sessionReports) {
      const statusIcon = s.errors.length > 0 ? "❌" : s.warnings.length > 0 ? "⚠️" : "✅";
      console.log(`  ${statusIcon} Seduta '${s.sessione}': ~${s.durata_stimata_min} min stimati | ${s.righe} esercizi`);
      if (s.errors.length > 0) {
        for (const e of s.errors) console.log(`     ⛔ ${e}`);
      }
      if (s.warnings.length > 0) {
        for (const w of s.warnings) console.log(`     ⚠️  ${w}`);
      }
    }

    if (rep.violations.length > 0) {
      totalViolations += rep.violations.length;
      console.log(`\n❌ ${rep.violations.length} VIOLAZIONI CRITICHE riscontrate in ${cName}.`);
    } else {
      console.log(`\n✅ Nessuna violazione critica in ${cName}. Parametri conformi ai guardrails.`);
    }

    if (rep.warnings.length > 0) {
      totalWarnings += rep.warnings.length;
    }
    console.log("\n");
  }

  console.log("================================================================================");
  console.log(`RIEPILOGO GUARDIANO: ${totalViolations} Errori critici, ${totalWarnings} Avvisi metodologici.`);
  console.log("================================================================================");

  if (totalViolations > 0) {
    console.error("\n❌ Validazione FALLITA: correggere le violazioni prima del commit/push.");
    process.exit(1);
  } else {
    console.log("\n🛡️  VALIDAZIONE SUPERATA AL 100%: Tutte le regole esecutive e di sicurezza rispettate.");
    process.exit(0);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Errore irreversibile Guardiano:", err);
    process.exit(1);
  });
}
