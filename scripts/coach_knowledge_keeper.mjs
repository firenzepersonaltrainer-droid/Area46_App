#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const VAULT_PEDAGOGY_FILE = path.join(ROOT_DIR, "data", "vault", "regole_didattica_pedagogia_coach.json");
const VAULT_CYCLES_FILE = path.join(ROOT_DIR, "data", "vault", "5_metodologia_allenamenti_cicli.json");
const REGISTRO_FILE = path.join(ROOT_DIR, "registro_periodizzazione_pro.json");

export function loadPedagogyRules() {
  if (!fs.existsSync(VAULT_PEDAGOGY_FILE)) return null;
  return JSON.parse(fs.readFileSync(VAULT_PEDAGOGY_FILE, "utf-8"));
}

function normalizeId(id) {
  if (!id) return "";
  return String(id).trim().padStart(3, "0");
}

/**
 * Valida un insieme di sedute/righe di allenamento contro le regole pedagogiche invarianti del Coach
 */
export function validatePedagogy(targetCycleName, workouts = null) {
  const rules = loadPedagogyRules();
  if (!rules) {
    console.warn("⚠️ File regole pedagogiche non trovato:", VAULT_PEDAGOGY_FILE);
    return { ok: true, errors: [], warnings: [] };
  }

  let allWorkouts = [];
  if (workouts && Array.isArray(workouts)) {
    allWorkouts = workouts;
  } else if (fs.existsSync(VAULT_CYCLES_FILE)) {
    const raw = JSON.parse(fs.readFileSync(VAULT_CYCLES_FILE, "utf-8"));
    allWorkouts = raw.allenamenti || [];
  }

  const cycleRows = allWorkouts.filter(
    (w) => (w.settimana || "").toLowerCase() === (targetCycleName || "").toLowerCase()
  );

  const errors = [];
  const warnings = [];

  const deletedIds = (rules.esercizi_eliminati_dal_sistema || []).map((e) => normalizeId(e.id));
  const coldBannedIds = (rules.divieti_a_freddo_blocco_1 || []).map((e) => normalizeId(e.id));
  const proExcludedIds = (rules.esclusioni_livello_pro || []).map((e) => normalizeId(e.id));
  const matadorUnification = rules.unioni_obbligatorie_pro || [];
  const continuousBannedPlus = (rules.esercizi_alternati_continui_vietato_piu || []).map((e) => normalizeId(e.id));
  const hierarchyRules = rules.gerarchia_propedeutiche || [];
  const consolidatedNo3Phase = (rules.consolidati_senza_progressione_3_fasi || []).map((e) => normalizeId(e.id));

  // 1. Controlli riga per riga nel ciclo target
  for (const row of cycleRows) {
    const eid = normalizeId(row.id_esercizio);
    const seq = String(row.sequenza || "").toLowerCase().trim();
    const param = String(row.parametri || "").trim();
    const name = String(row.nome_esercizio || "").trim();
    const giorno = String(row.giorno || "").trim();

    // Check 1: Esercizi eliminati
    if (deletedIds.includes(eid) || name.toLowerCase().includes("gymnasty abs")) {
      errors.push(
        `⛔ ESERCIZIO ELIMINATO: '${name}' (ID ${eid}) è stato cancellato definitivamente dal sistema. Vietata qualsiasi prescrizione in '${giorno}'.`
      );
    }

    // Check 2: Pliometria/potenza a freddo (blocco 1)
    if (seq.startsWith("1") && coldBannedIds.includes(eid)) {
      errors.push(
        `⛔ ESERCIZIO A FREDDO VIETATO: '${name}' (ID ${eid}) è un esercizio di pliometria/potenza elastica ad alto impatto. Non può essere collocato nel blocco 1 (warm-up) in '${giorno}'.`
      );
    }

    // Check 3: Esercizi esclusi dal livello PRO (home training)
    if (proExcludedIds.includes(eid)) {
      errors.push(
        `⛔ ESERCIZIO NON IDONEO A LIVELLO PRO: '${name}' (ID ${eid}) è una propedeutica per home training, non adatta al livello PRO. Rilevato in '${giorno}'.`
      );
    }

    // Check 4: Matador Transitions (ID 242 obbligatorio)
    for (const m of matadorUnification) {
      const bannedSeparated = (m.ids_vietati_separatamente || []).map(normalizeId);
      if (bannedSeparated.includes(eid)) {
        errors.push(
          `⛔ MATADOR SEPARATO VIETATO: '${name}' (ID ${eid}) non può essere usato separatamente. Usare sempre ID ${m.id_unificato} (${m.nome}) in '${giorno}'.`
        );
      }
    }

    // Check 5: Esercizi alternati continui (divieto '+')
    if (continuousBannedPlus.includes(eid)) {
      if (param.includes("+")) {
        errors.push(
          `⛔ NOTAZIONE VIETATA SU ALTERNATO CONTINUO: '${name}' (ID ${eid}) deve essere prescritto a tempo complessivo (es. 3 X 45\"). Trovato '+' in '${param}' in '${giorno}'.`
        );
      }
    }

    // Check 6: Consolidati che non richiedono progressione 3 fasi
    if (consolidatedNo3Phase.includes(eid)) {
      if (param.toLowerCase().includes("costruzione") || param.toLowerCase().includes("studio")) {
        warnings.push(
          `⚠️ PROGRESSIONE NON NECESSARIA: '${name}' (ID ${eid}) è già consolidato dai livelli precedenti. Prescrivere direttamente carichi allenanti anziché costruzione motoria.`
        );
      }
    }
  }

  // 2. Controllo gerarchia propedeutiche storiche
  // Per ogni esercizio target presente in cycleRows, verificare che la propedeutica compaia in un ciclo antecedente
  const targetCycleNumMatch = targetCycleName.match(/\d+/);
  const targetCycleNum = targetCycleNumMatch ? parseInt(targetCycleNumMatch[0], 10) : 999;

  for (const h of hierarchyRules) {
    const targetId = normalizeId(h.id_esercizio_target);
    const hasTargetInCycle = cycleRows.some((r) => normalizeId(r.id_esercizio) === targetId);

    if (hasTargetInCycle) {
      const propId = normalizeId(h.id_propedeutica_obbligatoria);
      // Cerca nei cicli precedenti (con numero di ciclo < targetCycleNum)
      const propUsedInPriorCycles = allWorkouts.some((w) => {
        const cMatch = (w.settimana || "").match(/\d+/);
        const cNum = cMatch ? parseInt(cMatch[0], 10) : 0;
        return cNum < targetCycleNum && normalizeId(w.id_esercizio) === propId;
      });

      if (!propUsedInPriorCycles) {
        errors.push(
          `⛔ GERARCHIA PROPEDEUTICA VIOLATA: '${h.nome_target}' (ID ${targetId}) prescritto in '${targetCycleName}' senza che la sua propedeutica obbligatoria '${h.nome_propedeutica}' (ID ${propId}) sia stata consolidata nei cicli precedenti!`
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

// Esecuzione CLI
if (process.argv[1] && process.argv[1].endsWith("coach_knowledge_keeper.mjs")) {
  const cycleArg = process.argv.find((a) => a.startsWith("--ciclo=")) || "--ciclo=Ciclo 7";
  const cycleName = cycleArg.replace("--ciclo=", "").trim();
  const res = validatePedagogy(cycleName.startsWith("Ciclo") ? cycleName : `Ciclo ${cycleName}`);

  console.log("================================================================================");
  console.log(`🧠 COACH KNOWLEDGE KEEPER — VALIDAZIONE DIDATTICA (${cycleName})`);
  console.log("================================================================================");

  if (res.errors.length > 0) {
    console.log("❌ VIOLAZIONI DIDATTICHE RISCONTRATE:");
    res.errors.forEach((e) => console.log(`   ${e}`));
  }
  if (res.warnings.length > 0) {
    console.log("⚠️  AVVISI DIDATTICI:");
    res.warnings.forEach((w) => console.log(`   ${w}`));
  }
  if (res.ok) {
    console.log("✅ NESSUNA VIOLAZIONE DIDATTICA: Tutte le regole pedagogiche del Coach sono rispettate!");
  }
  console.log("================================================================================");
  process.exit(res.ok ? 0 : 1);
}
