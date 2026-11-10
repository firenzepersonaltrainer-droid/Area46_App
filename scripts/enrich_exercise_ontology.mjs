import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEMO_DATA_FILE = path.join(ROOT_DIR, "demo-data.json");
const VAULT_MOD4_FILE = path.join(ROOT_DIR, "data", "vault", "4_metodologia_esercizi.json");

export function determineOntology(ex) {
  const nome = (ex.nome_reale || ex.nome_esercizio || "").toLowerCase();
  const patternBio = (ex.pattern_biomeccanico || "").toLowerCase();
  const tagBio = (ex.tag_biomeccanici || "").toLowerCase();
  const attrezzo = (ex.attrezzo || "").toLowerCase();
  const ruolo = (ex.ruolo || "").toLowerCase();

  let pattern_motorio = "Catena Cinetica Funzionale";
  let fulcro_articolare = "Anca";
  let meridiano_miofasciale = "Catena Cinetica Funzionale";
  let cue_esecutiva = "Allineamento neutro e controllo motorio";

  // 1. PATTERN MOTORIO & CUE
  if (nome.includes("deadlift") || nome.includes("stacco") || patternBio.includes("cerniera d'anca") || tagBio.includes("cerniera d'anca")) {
    pattern_motorio = "Cerniera d'anca";
    fulcro_articolare = "Anca";
    meridiano_miofasciale = "Linea Posteriore Superficiale";
    cue_esecutiva = nome.includes("coiled") 
      ? "Coiling Spirale e spinta dal tallone" 
      : "Spinta dal tallone e cerniera d'anca neutra";
  } else if (nome.includes("squat") || patternBio.includes("accosciata") || tagBio.includes("accosciata")) {
    pattern_motorio = "Accosciata / Quad Dominant";
    fulcro_articolare = "Ginocchio e anca";
    meridiano_miofasciale = "Linea Frontale Superficiale";
    cue_esecutiva = "Tripode podalico e discesa controllata";
  } else if (nome.includes("lunge") || nome.includes("affondo") || patternBio.includes("affondo") || tagBio.includes("affondo")) {
    pattern_motorio = "Affondo e deambulazione";
    fulcro_articolare = "Anca e ginocchio";
    meridiano_miofasciale = "Catena Crociata Anteriore";
    cue_esecutiva = nome.includes("pendulum") 
      ? "Transizione fluida baricentro e stabilità podalica" 
      : "Stabilità ginocchio su secondo dito e bacino in asse";
  } else if (nome.includes("press") || patternBio.includes("spinta") || tagBio.includes("spinta")) {
    if (nome.includes("vertical") || nome.includes("overhead") || patternBio.includes("verticale") || tagBio.includes("verticale")) {
      pattern_motorio = "Spinta verticale";
      fulcro_articolare = "Cingolo scapolo-omerale / Spalla";
      meridiano_miofasciale = "Catena Crociata Anteriore";
      cue_esecutiva = "Presa a Tenaglia / Pincer Grip e spinta senza compenso lombare";
    } else {
      pattern_motorio = "Spinta orizzontale";
      fulcro_articolare = "Cingolo scapolo-omerale / Spalla";
      meridiano_miofasciale = "Linea Frontale Superficiale";
      cue_esecutiva = "Presa a Tenaglia / Pincer Grip e stabilità scapolare";
    }
  } else if (nome.includes("row") || nome.includes("pull") || patternBio.includes("trazione") || tagBio.includes("trazione")) {
    if (nome.includes("high pull") || patternBio.includes("verticale") || tagBio.includes("verticale")) {
      pattern_motorio = "Trazione verticale / Alta";
      fulcro_articolare = "Cingolo scapolo-omerale e gomito";
      meridiano_miofasciale = "Catena Crociata Posteriore";
      cue_esecutiva = "Braccio a Cavo Neutro e trazione a gomito guidato";
    } else {
      pattern_motorio = "Trazione orizzontale";
      fulcro_articolare = "Cingolo scapolare e gomito";
      meridiano_miofasciale = "Linea Posteriore Superficiale";
      cue_esecutiva = "Braccio a Cavo Neutro e adduzione scapolare attiva";
    }
  } else if (nome.includes("rotation") || nome.includes("twist") || nome.includes("coiling") || nome.includes("cobra") || patternBio.includes("rotazione") || tagBio.includes("rotazione") || tagBio.includes("multi-planare")) {
    pattern_motorio = "Rotazione toracica e spiralizzazione";
    fulcro_articolare = "Colonna toracica";
    meridiano_miofasciale = "Linea Spirale";
    cue_esecutiva = "Coiling Spirale e contro-rotazione bacino-torace";
  } else if (nome.includes("hold") || nome.includes("transverse") || patternBio.includes("anti-rotazione") || tagBio.includes("anti-rotazione")) {
    pattern_motorio = "Anti-rotazione e tenuta del core";
    fulcro_articolare = "Rachide lombare e bacino";
    meridiano_miofasciale = "Catena Crociata Funzionale";
    cue_esecutiva = "Contro-rotazione del bacino su torace e blocco isometrico";
  } else if (nome.includes("jerk") || nome.includes("snatch") || nome.includes("clean") || nome.includes("swing") || patternBio.includes("tripla estensione") || tagBio.includes("tripla estensione")) {
    pattern_motorio = "Estensione d'anca / Triple Extension";
    fulcro_articolare = "Anca e caviglia";
    meridiano_miofasciale = "Catena Crociata Posteriore";
    cue_esecutiva = "Esplosività d'anca e blocco gluteo apicale";
  } else if (nome.includes("hop") || nome.includes("jump") || nome.includes("skater") || nome.includes("balzo") || tagBio.includes("pliometria") || ruolo.includes("pliometria")) {
    pattern_motorio = "Pliometria e reattività";
    fulcro_articolare = "Complesso caviglia-piede e ginocchio";
    meridiano_miofasciale = "Linea Spirale";
    cue_esecutiva = "Stiffness caviglia, contatto di avampiede elastico e rimbalzo reattivo";
  } else if (attrezzo.includes("rope") || attrezzo.includes("clave") || attrezzo.includes("stick") || nome.includes("roll") || nome.includes("matador") || tagBio.includes("destrezza") || ruolo.includes("skill")) {
    pattern_motorio = "Destrezza neurale e ritmo";
    fulcro_articolare = attrezzo.includes("clave") ? "Polsi e avambraccio" : "Cingolo scapolare e polsi";
    meridiano_miofasciale = "Linea Spirale";
    cue_esecutiva = attrezzo.includes("clave") 
      ? "Clava leggera all'esordio per salvaguardare i polsi" 
      : "Ritmo fluido, continuità circolare ed economia del gesto";
  } else if (nome.includes("skierg") || nome.includes("bike") || nome.includes("rower") || tagBio.includes("metcon") || tagBio.includes("aerobica") || ruolo.includes("engine")) {
    pattern_motorio = "Engine e condizionamento ciclico";
    fulcro_articolare = "Anca e cingolo scapolare";
    meridiano_miofasciale = tagBio.includes("crociate") ? "Catena Crociata Anteriore" : "Linea Posteriore Superficiale";
    cue_esecutiva = nome.includes("pagaia") 
      ? "Tirata a pagaia sul lato della gamba anteriore e ritmo costante" 
      : "Cerniera d'anca fluida e cadenza respiratoria costante";
  } else if (tagBio.includes("warm up") || tagBio.includes("mobilità") || ruolo.includes("warm up")) {
    pattern_motorio = "Mobilità e attivazione a terra";
    fulcro_articolare = "Colonna toracica e bacino";
    meridiano_miofasciale = "Linea Spirale";
    cue_esecutiva = "Respirazione diaframmatica e graduale allungamento attivo";
  }

  // Raffinamenti specifici per regole vincolanti del coach
  if (ex.id_esercizio === "056" || nome.includes("coiled deadlift")) {
    cue_esecutiva = "Coiling Spirale e spinta dal tallone; reset tra i lati";
    meridiano_miofasciale = "Linea Spirale";
    fulcro_articolare = "Anca e colonna toracica";
  } else if (ex.id_esercizio === "242" || nome.includes("matador")) {
    cue_esecutiva = "Transizione continua Underhand/Overhand con polso in asse";
    meridiano_miofasciale = "Linea Spirale";
    fulcro_articolare = "Polsi e cinto scapolare";
  } else if (ex.id_esercizio === "047" || nome.includes("wall driver")) {
    cue_esecutiva = "Movimento alternato continuo a tempo senza scatti";
    pattern_motorio = "Mobilità e spinta contro parete";
    fulcro_articolare = "Spalla e colonna toracica";
  } else if (ex.id_esercizio === "227" || nome.includes("skyerg lunges") || nome.includes("skierg lunges")) {
    cue_esecutiva = "Tirata con tecnica pagaia sul lato della gamba fissa anteriore";
    pattern_motorio = "Affondo e condizionamento asimmetrico";
    fulcro_articolare = "Anca e cingolo scapolare";
  } else if (ex.id_esercizio === "106" || nome.includes("dragon roll")) {
    cue_esecutiva = "Rotazione a flusso continuo a tempo; nessun conteggio a rep";
    pattern_motorio = "Destrezza neurale e ritmo";
    fulcro_articolare = "Polsi e spalla";
    meridiano_miofasciale = "Linea Spirale";
  }

  return {
    pattern_motorio,
    fulcro_articolare,
    meridiano_miofasciale,
    cue_esecutiva,
  };
}

export function enrichDatabase(db) {
  let count = 0;
  if (!db.database_esercizi || !Array.isArray(db.database_esercizi)) {
    return 0;
  }
  for (const ex of db.database_esercizi) {
    const onto = determineOntology(ex);
    ex.pattern_motorio = onto.pattern_motorio;
    ex.fulcro_articolare = onto.fulcro_articolare;
    ex.meridiano_miofasciale = onto.meridiano_miofasciale;
    ex.cue_esecutiva = onto.cue_esecutiva;
    count++;
  }
  return count;
}

// Se invocato direttamente da CLI
if (process.argv[1] && process.argv[1].endsWith("enrich_exercise_ontology.mjs")) {
  console.log("=======================================================");
  console.log("🧠 ARRICCHIMENTO ONTOLOGICO DATABASE ESERCIZI (AREA46)");
  console.log("=======================================================");

  const rawDemo = fs.readFileSync(DEMO_DATA_FILE, "utf-8");
  const demoDb = JSON.parse(rawDemo);
  const nEnrichedDemo = enrichDatabase(demoDb);
  fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(demoDb, null, 2), "utf-8");
  console.log(`✅ Arricchiti ${nEnrichedDemo} esercizi in demo-data.json`);

  if (fs.existsSync(VAULT_MOD4_FILE)) {
    const rawVault = fs.readFileSync(VAULT_MOD4_FILE, "utf-8");
    const vaultDb = JSON.parse(rawVault);
    const nEnrichedVault = enrichDatabase(vaultDb);
    fs.writeFileSync(VAULT_MOD4_FILE, JSON.stringify(vaultDb, null, 2), "utf-8");
    console.log(`✅ Arricchiti ${nEnrichedVault} esercizi in data/vault/4_metodologia_esercizi.json`);
  }

  console.log("=======================================================\n");
}
