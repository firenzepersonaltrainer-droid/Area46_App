import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const VAULT_4_FILE = path.join(ROOT_DIR, "data", "vault", "4_metodologia_esercizi.json");
const VAULT_5_FILE = path.join(ROOT_DIR, "data", "vault", "5_metodologia_allenamenti_cicli.json");
const VAULT_RULES_FILE = path.join(ROOT_DIR, "data", "vault", "regole_esercizi_metodologia.json");
const VAULT_PEDAGOGY_FILE = path.join(ROOT_DIR, "data", "vault", "regole_didattica_pedagogia_coach.json");
const DEMO_DATA_FILE = path.join(ROOT_DIR, "demo-data.json");

console.log("=== APPLICAZIONE MODIFICHE COACH CICLO 7 - ALLENAMENTI A ===");

// 1. Aggiornamento Vault 4: link corretto per High Pull dinamico (ID 065)
if (fs.existsSync(VAULT_4_FILE)) {
  const vault4 = JSON.parse(fs.readFileSync(VAULT_4_FILE, "utf-8"));
  let v4Mod = 0;
  for (const ex of vault4.database_esercizi || []) {
    if (String(ex.id_esercizio).padStart(3, "0") === "065") {
      ex.link_video = "https://youtu.be/Fsi34_9SXTU";
      v4Mod++;
    }
  }
  fs.writeFileSync(VAULT_4_FILE, JSON.stringify(vault4, null, 2), "utf-8");
  console.log(`✅ Vault 4: Link video High Pull dinamico impostato su https://youtu.be/Fsi34_9SXTU (${v4Mod} record).`);
}

// 2. Aggiornamento Regole Metodologiche Esecutive per ID 128 (alternato continuo destra/sinistra)
if (fs.existsSync(VAULT_RULES_FILE)) {
  const rules = JSON.parse(fs.readFileSync(VAULT_RULES_FILE, "utf-8"));
  if (rules.regole_specifiche_esercizi && rules.regole_specifiche_esercizi["128"]) {
    const r128 = rules.regole_specifiche_esercizi["128"];
    r128.modalita_prescrizione_predefinita = "RIPETIZIONI_CONTINUE_ALTERNATE";
    r128.vincolo_notazione = "STANDARD";
    r128.note_obbligatorie = ["Svolgi 2-4 serie di avvicinamento prima della serie allenante"];
  }
  fs.writeFileSync(VAULT_RULES_FILE, JSON.stringify(rules, null, 2), "utf-8");
  console.log("✅ Regole Esecutive: ID 128 aggiornato a RIPETIZIONI_CONTINUE_ALTERNATE e vincolo STANDARD.");
}

// 3. Aggiornamento Pedagogia Didattica Coach
if (fs.existsSync(VAULT_PEDAGOGY_FILE)) {
  const ped = JSON.parse(fs.readFileSync(VAULT_PEDAGOGY_FILE, "utf-8"));
  if (!ped.regole_prescrizione_speciali) ped.regole_prescrizione_speciali = [];
  
  // Aggiungi o aggiorna regola 128
  const existing128 = ped.regole_prescrizione_speciali.find((r) => r.id === "128");
  if (existing128) {
    existing128.regola = "Esercizio alternato continuo dx/sx. Prescrivere ripetizioni totali (es. 4 X 6), vietata notazione con '+'. Note: Svolgi 2-4 serie di avvicinamento prima della serie allenante.";
  } else {
    ped.regole_prescrizione_speciali.push({
      id: "128",
      nome: "COMBO: Landmine Split snatch High hand switch T/GO",
      regola: "Esercizio alternato continuo dx/sx. Prescrivere ripetizioni totali (es. 4 X 6), vietata notazione con '+'. Note: Svolgi 2-4 serie di avvicinamento prima della serie allenante."
    });
  }

  // Aggiungi o aggiorna regola 089
  const existing089 = ped.regole_prescrizione_speciali.find((r) => r.id === "089");
  if (existing089) {
    existing089.regola = "Deadbug con palla: solitamente alternato dx/sx, prescrivere ripetizioni complessive (es. 3 X 20) anziché notazione '+'.";
  } else {
    ped.regole_prescrizione_speciali.push({
      id: "089",
      nome: "Deadbug",
      regola: "Deadbug con palla: solitamente alternato dx/sx, prescrivere ripetizioni complessive (es. 3 X 20) anziché notazione '+'."
    });
  }

  fs.writeFileSync(VAULT_PEDAGOGY_FILE, JSON.stringify(ped, null, 2), "utf-8");
  console.log("✅ Pedagogia Coach: Regole didattiche per 128, 089 registrate.");
}

// 4. Aggiornamento Vault 5 per Allenamenti A del Ciclo 7
const vault5 = JSON.parse(fs.readFileSync(VAULT_5_FILE, "utf-8"));
let modCount = 0;

for (const a of vault5.allenamenti || []) {
  if (a.settimana === "Ciclo 7" && ["37 allenamento A", "39 allenamento A", "41 allenamento A"].includes(a.giorno)) {
    // 1. COMBO: Landmine Split snatch High hand switch T/GO (ID 128)
    if (String(a.id_esercizio).padStart(3, "0") === "128" || (a.nome_esercizio || "").includes("Landmine Split snatch High hand switch")) {
      a.parametri = "4 X 6";
      a.recupero = '75"';
      a.note_tecniche = "Svolgi 2-4 serie di avvicinamento prima della serie allenante";
      modCount++;
    }

    // 2. High Pull (ID 065)
    if (String(a.id_esercizio).padStart(3, "0") === "065" || (a.nome_esercizio || "").trim().toLowerCase() === "high pull") {
      a.note_tecniche = "svolgi qualche movimento di avvicinamento/ attivazione - svolgi un sollevamento “lanciato” del bilanciere, potente, con ritorno controllato. Reset veloce su ogni ripetizione - cerca RPE 8";
      modCount++;
    }

    // 3. Deadbug (ID 089)
    if (String(a.id_esercizio).padStart(3, "0") === "089" || (a.nome_esercizio || "").trim().toLowerCase() === "deadbug") {
      a.parametri = "3 X 20";
      modCount++;
    }
  }
}

fs.writeFileSync(VAULT_5_FILE, JSON.stringify(vault5, null, 2), "utf-8");
console.log(`✅ Vault 5: Aggiornate ${modCount} righe per gli Allenamenti A del Ciclo 7.`);

// 5. Sincronizzazione demo-data.json
if (fs.existsSync(DEMO_DATA_FILE)) {
  const demoData = JSON.parse(fs.readFileSync(DEMO_DATA_FILE, "utf-8"));
  
  // Aggiorna catalogo esercizi
  for (const ex of demoData.database_esercizi || demoData.esercizi || []) {
    if (String(ex.id_esercizio).padStart(3, "0") === "065") {
      ex.link_video = "https://youtu.be/Fsi34_9SXTU";
    }
  }

  // Sostituisci Ciclo 7 in demoData.allenamenti
  let demoAllenamenti = (demoData.allenamenti || []).filter((r) => r.settimana !== "Ciclo 7");
  const c7Rows = (vault5.allenamenti || []).filter((r) => r.settimana === "Ciclo 7");
  demoAllenamenti.push(...c7Rows);
  // Mantieni ordine per ID
  demoAllenamenti.sort((a, b) => Number(a.id) - Number(b.id));
  demoData.allenamenti = demoAllenamenti;

  fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(demoData, null, 2), "utf-8");
  console.log(`✅ demo-data.json: Sincronizzato con il Vault.`);
}
