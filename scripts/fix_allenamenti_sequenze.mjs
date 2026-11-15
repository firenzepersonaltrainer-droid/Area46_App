import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const VAULT_FILE = path.join(ROOT_DIR, "data", "vault", "5_metodologia_allenamenti_cicli.json");
const DEMO_DATA_FILE = path.join(ROOT_DIR, "demo-data.json");
const TMP_DATA_FILE = "/tmp/demo-data.json";
const EXCEL_FILE = path.join(ROOT_DIR, "database esercizi Lab.xlsx");

console.log("=======================================================");
console.log("🔧 APPLICAZIONE CORREZIONE NUMERAZIONE ESERCIZI LAB");
console.log("=======================================================");

// 1. Carica Vault 5
const vaultRaw = fs.readFileSync(VAULT_FILE, "utf-8");
const vaultData = JSON.parse(vaultRaw);
const allenamenti = vaultData.allenamenti;

console.log(`Caricati ${allenamenti.length} record da ${path.basename(VAULT_FILE)}`);

// Definizione correzioni puntuali basate sull id record
const updates = [
  // --- Level 1 Giorno 4 (salto da 1 a 4 -> 1, 2, 3, 4, 5) ---
  { id: 148, sequenza: "2", check: { livello: "Level 1", giorno: "Giorno 4", ex: "218" } },
  { id: 149, sequenza: "3", check: { livello: "Level 1", giorno: "Giorno 4", ex: "221" } },
  { id: 150, sequenza: "4", check: { livello: "Level 1", giorno: "Giorno 4", ex: "039" } },
  { id: 151, sequenza: "5", check: { livello: "Level 1", giorno: "Giorno 4", ex: "098" } },

  // --- Level 1 Giorno 5 (salto da 1 a 3 -> 1, 2, 3, 4, 5, 6, 7) ---
  { id: 153, sequenza: "2", check: { livello: "Level 1", giorno: "Giorno 5", ex: "021" } },
  { id: 154, sequenza: "3", check: { livello: "Level 1", giorno: "Giorno 5", ex: "056" } },
  { id: 155, sequenza: "4", check: { livello: "Level 1", giorno: "Giorno 5", ex: "067" } },
  { id: 156, sequenza: "5", check: { livello: "Level 1", giorno: "Giorno 5", ex: "170" } },
  { id: 157, sequenza: "6", check: { livello: "Level 1", giorno: "Giorno 5", ex: "100" } },
  { id: 158, sequenza: "7", check: { livello: "Level 1", giorno: "Giorno 5", ex: "086" } },

  // --- Level 1 Giorno 3 (salto da 3b a 5 -> 1, 2, 3a, 3b, 4, 5, 6, 7) ---
  { id: 143, sequenza: "4", check: { livello: "Level 1", giorno: "Giorno 3", ex: "067" } },
  { id: 144, sequenza: "5", check: { livello: "Level 1", giorno: "Giorno 3", ex: "076" } },
  { id: 145, sequenza: "6", check: { livello: "Level 1", giorno: "Giorno 3", ex: "069" } },
  { id: 146, sequenza: "7", check: { livello: "Level 1", giorno: "Giorno 3", ex: "071" } },

  // --- Level 1 Giorno 6 (salto da 3b a 5 -> 1, 2, 3a, 3b, 4, 5, 6, 7) ---
  { id: 163, sequenza: "4", check: { livello: "Level 1", giorno: "Giorno 6", ex: "079" } },
  { id: 164, sequenza: "5", check: { livello: "Level 1", giorno: "Giorno 6", ex: "075" } },
  { id: 165, sequenza: "6", check: { livello: "Level 1", giorno: "Giorno 6", ex: "076" } },
  { id: 166, sequenza: "7", check: { livello: "Level 1", giorno: "Giorno 6", ex: "082" } },

  // --- Level 1 Giorno 14 (typo "11" per seq 1) ---
  { id: 216, sequenza: "1", check: { livello: "Level 1", giorno: "Giorno 14", ex: "019" } },

  // --- Entry Level Giorno 1 (salto da 3 a 5 -> 1, 2, 3, 4, 5, 6, 7, 8) ---
  { id: 65, sequenza: "4", check: { livello: "Entry Level", giorno: "Giorno 1", ex: "040" } },
  { id: 66, sequenza: "5", check: { livello: "Entry Level", giorno: "Giorno 1", ex: "043" } },
  { id: 67, sequenza: "6", check: { livello: "Entry Level", giorno: "Giorno 1", ex: "026" } },
  { id: 68, sequenza: "7", check: { livello: "Entry Level", giorno: "Giorno 1", ex: "037" } },
  { id: 69, sequenza: "8", check: { livello: "Entry Level", giorno: "Giorno 1", ex: "092" } },

  // --- Advanced Giorno 3 (salto da 5 a 7 -> 1, 2, 3, 4, 5, 6) ---
  { id: 421, sequenza: "6", check: { livello: "Advanced", giorno: "Giorno 3", ex: "019" } },

  // --- Advanced Giorno 16 (salto da 1 a 3 e poi 4a-4d -> 1, 2, 3a, 3b, 3c, 3d) ---
  { id: 494, sequenza: "2", check: { livello: "Advanced", giorno: "Giorno 16", ex: "180" } },
  { id: 495, sequenza: "3a", check: { livello: "Advanced", giorno: "Giorno 16", ex: "001" } },
  { id: 496, sequenza: "3b", check: { livello: "Advanced", giorno: "Giorno 16", ex: "170" } },
  { id: 497, sequenza: "3c", check: { livello: "Advanced", giorno: "Giorno 16", ex: "095" } },
  { id: 498, sequenza: "3d", check: { livello: "Advanced", giorno: "Giorno 16", ex: "204" } },

  // --- Advanced Giorno 5, 6, 7, 8 (Autofill Excel: record 433, 434, 435 appartengono a Giorno 5) ---
  { id: 433, giorno: "Giorno 5", sequenza: "5", check: { livello: "Advanced", ex: "105" } },
  { id: 434, giorno: "Giorno 5", sequenza: "6", check: { livello: "Advanced", ex: "241" } },
  { id: 435, giorno: "Giorno 5", sequenza: "7", check: { livello: "Advanced", ex: "090" } },
];

let appliedCount = 0;
for (const u of updates) {
  const item = allenamenti.find((a) => a.id === u.id);
  if (!item) {
    console.error(`❌ Item con id ${u.id} non trovato!`);
    continue;
  }
  // Validazione di sicurezza prima di toccare il record
  if (u.check.livello && item.livello !== u.check.livello) {
    throw new Error(`Controllo fallito per ID ${u.id}: livello atteso ${u.check.livello}, trovato ${item.livello}`);
  }
  if (u.check.giorno && item.giorno !== u.check.giorno) {
    throw new Error(`Controllo fallito per ID ${u.id}: giorno atteso ${u.check.giorno}, trovato ${item.giorno}`);
  }
  const idEs = String(item.id_esercizio).replace(/^0+/, "");
  const chkEs = String(u.check.ex).replace(/^0+/, "");
  if (idEs !== chkEs) {
    throw new Error(`Controllo fallito per ID ${u.id}: esercizio atteso ${chkEs}, trovato ${idEs}`);
  }

  const oldSeq = item.sequenza;
  const oldGiorno = item.giorno;
  if (u.sequenza !== undefined) item.sequenza = u.sequenza;
  if (u.giorno !== undefined) item.giorno = u.giorno;

  console.log(`  ✓ ID ${item.id} [${item.livello} - ${item.nome_esercizio}]: ` +
    (u.giorno ? `Giorno: "${oldGiorno}" -> "${item.giorno}", ` : "") +
    `Seq: "${oldSeq}" -> "${item.sequenza}"`);
  appliedCount++;
}

console.log(`\nApplicate con successo ${appliedCount} correzioni su ${updates.length} previste.`);

// 2. Salva Vault 5
fs.writeFileSync(VAULT_FILE, JSON.stringify(vaultData, null, 2), "utf-8");
console.log(`✅ File ${path.basename(VAULT_FILE)} salvato.`);

// 3. Aggiorna demo-data.json
if (fs.existsSync(DEMO_DATA_FILE)) {
  const demoRaw = fs.readFileSync(DEMO_DATA_FILE, "utf-8");
  const demoData = JSON.parse(demoRaw);
  if (Array.isArray(demoData.allenamenti)) {
    for (const u of updates) {
      const item = demoData.allenamenti.find((a) => a.id === u.id);
      if (item) {
        if (u.sequenza !== undefined) item.sequenza = u.sequenza;
        if (u.giorno !== undefined) item.giorno = u.giorno;
      }
    }
    fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(demoData, null, 2), "utf-8");
    console.log(`✅ File ${path.basename(DEMO_DATA_FILE)} aggiornato.`);
  }
}

// 4. Aggiorna /tmp/demo-data.json se presente
if (fs.existsSync(TMP_DATA_FILE)) {
  try {
    const tmpRaw = fs.readFileSync(TMP_DATA_FILE, "utf-8");
    const tmpData = JSON.parse(tmpRaw);
    if (Array.isArray(tmpData.allenamenti)) {
      for (const u of updates) {
        const item = tmpData.allenamenti.find((a) => a.id === u.id);
        if (item) {
          if (u.sequenza !== undefined) item.sequenza = u.sequenza;
          if (u.giorno !== undefined) item.giorno = u.giorno;
        }
      }
      fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(tmpData, null, 2), "utf-8");
      console.log(`✅ File ${TMP_DATA_FILE} aggiornato.`);
    }
  } catch {}
}

// 5. Aggiorna database esercizi Lab.xlsx per coerenza totale tra file
if (fs.existsSync(EXCEL_FILE)) {
  const wb = XLSX.readFile(EXCEL_FILE);
  
  // Sheet Level 1
  if (wb.Sheets["Level 1"]) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Level 1"], { header: 1 });
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 5) continue;
      const g = String(row[2] || "").trim();
      const ex = String(row[4] || "").replace(/^0+/, "");
      
      // Level 1 Giorno 4
      if (g === "Giorno 4") {
        if (ex === "218") row[3] = 2;
        if (ex === "221") row[3] = 3;
        if (ex === "39") row[3] = 4;
        if (ex === "98") row[3] = 5;
      }
      // Level 1 Giorno 5
      if (g === "Giorno 5") {
        if (ex === "21") row[3] = 2;
        if (ex === "56") row[3] = 3;
        if (ex === "67") row[3] = 4;
        if (ex === "170") row[3] = 5;
        if (ex === "100") row[3] = 6;
        if (ex === "86") row[3] = 7;
      }
      // Level 1 Giorno 3
      if (g === "Giorno 3") {
        if (ex === "67") row[3] = 4;
        if (ex === "76") row[3] = 5;
        if (ex === "69") row[3] = 6;
        if (ex === "71") row[3] = 7;
      }
      // Level 1 Giorno 6
      if (g === "Giorno 6") {
        if (ex === "79") row[3] = 4;
        if (ex === "75") row[3] = 5;
        if (ex === "76") row[3] = 6;
        if (ex === "82") row[3] = 7;
      }
      // Level 1 Giorno 14
      if (g === "Giorno 14") {
        if (ex === "19" && String(row[3]) === "11") row[3] = 1;
      }
    }
    wb.Sheets["Level 1"] = XLSX.utils.aoa_to_sheet(rows);
  }

  // Sheet Entry Level
  if (wb.Sheets["Entry Level"]) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Entry Level"], { header: 1 });
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 5) continue;
      const g = String(row[2] || "").trim();
      const ex = String(row[4] || "").replace(/^0+/, "");
      if (g === "Giorno 1") {
        if (ex === "40") row[3] = 4;
        if (ex === "43") row[3] = 5;
        if (ex === "26") row[3] = 6;
        if (ex === "37") row[3] = 7;
        if (ex === "92") row[3] = 8;
      }
    }
    wb.Sheets["Entry Level"] = XLSX.utils.aoa_to_sheet(rows);
  }

  // Sheet Advanced
  if (wb.Sheets["Advanced"]) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Advanced"], { header: 1 });
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 5) continue;
      const g = String(row[2] || "").trim();
      const ex = String(row[4] || "").replace(/^0+/, "");
      if (g === "Giorno 3" && ex === "19") row[3] = 6;
      if (g === "Giorno 16") {
        if (ex === "180") row[3] = 2;
        if (ex === "1") row[3] = "3a";
        if (ex === "170") row[3] = "3b";
        if (ex === "95") row[3] = "3c";
        if (ex === "204") row[3] = "3d";
      }
      // Autofill rows 31, 32, 33 (idx 30, 31, 32)
      if (r === 30 && ex === "105") { row[2] = "Giorno 5"; row[3] = 5; }
      if (r === 31 && ex === "241") { row[2] = "Giorno 5"; row[3] = 6; }
      if (r === 32 && ex === "90") { row[2] = "Giorno 5"; row[3] = 7; }
    }
    wb.Sheets["Advanced"] = XLSX.utils.aoa_to_sheet(rows);
  }

  XLSX.writeFile(wb, EXCEL_FILE);
  console.log(`✅ File master Excel ${path.basename(EXCEL_FILE)} aggiornato.`);
}

console.log("=======================================================");
console.log("🎉 TUTTE LE CORREZIONI SONO STATE COMPLETATE");
console.log("=======================================================\n");
