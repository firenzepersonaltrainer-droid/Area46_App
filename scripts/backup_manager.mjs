#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEMO_DATA_FILE = path.join(ROOT_DIR, "demo-data.json");
const TMP_DATA_FILE = "/tmp/demo-data.json";
const BACKUPS_DIR = path.join(ROOT_DIR, "backups");
const VAULT_DIR = path.join(ROOT_DIR, "data", "vault");

// Assicura directory esistenti
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(VAULT_DIR)) fs.mkdirSync(VAULT_DIR, { recursive: true });

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${d}_${hh}-${mm}-${ss}`;
}

function loadCurrentData() {
  if (!fs.existsSync(DEMO_DATA_FILE)) {
    throw new Error(`File principale dati non trovato: ${DEMO_DATA_FILE}`);
  }
  const raw = fs.readFileSync(DEMO_DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

// ─── 1. VERIFICA INTEGRITÀ ──────────────────────────────────────────────────
export function verifyIntegrity(data = null) {
  const d = data || loadCurrentData();
  const report = {
    ok: true,
    warnings: [],
    errors: [],
    stats: {},
  };

  const users = d.profili_utenti || [];
  const bookings = d.prenotazioni_slot || [];
  const diary = d.diario_utente || [];
  const creditsHistory = d.movimenti_crediti || [];
  const transactions = d.transazioni_pagamenti || [];
  const exercises = d.database_esercizi || [];
  const workouts = d.allenamenti || [];

  report.stats = {
    utenti_totali: users.length,
    utenti_con_crediti: users.filter((u) => (u.crediti || 0) > 0).length,
    crediti_totali_attivi: users.reduce((acc, u) => acc + (u.crediti || 0), 0),
    prenotazioni_slot: bookings.length,
    voci_diario: diary.length,
    movimenti_crediti: creditsHistory.length,
    transazioni_pagamenti: transactions.length,
    esercizi_database: exercises.length,
    allenamenti_totali: workouts.length,
  };

  // Guardrail 1: utenti reali minimi
  if (users.length < 5) {
    report.errors.push(`Anomalia critica: trovati solo ${users.length} utenti (soglia minima di sicurezza: 5)`);
    report.ok = false;
  }

  // Guardrail 2: crediti corrotti
  for (const u of users) {
    if (typeof u.crediti !== "number" || isNaN(u.crediti)) {
      report.errors.push(`Utente ${u.nome || u.email} ha un valore di crediti non valido: ${u.crediti}`);
      report.ok = false;
    } else if (u.crediti < 0) {
      report.warnings.push(`Utente ${u.nome || u.email} ha crediti negativi: ${u.crediti}`);
    }
  }

  // Guardrail 3: cancellazioni involontarie
  if (bookings.length === 0 && d.prenotazioni_slot !== undefined) {
    report.warnings.push("Attenzione: 0 prenotazioni slot presenti nel database");
  }

  // Guardrail 4: catalogo esercizi
  if (exercises.length < 50) {
    report.errors.push(`Anomalia catalogo: solo ${exercises.length} esercizi presenti`);
    report.ok = false;
  }

  return report;
}

// ─── 2. CREA BACKUP ──────────────────────────────────────────────────────────
export function createBackup(customTag = "") {
  const data = loadCurrentData();
  const v = verifyIntegrity(data);

  const tagStr = customTag ? `_${customTag}` : "";
  const filename = `backup_${formatTimestamp()}${tagStr}.json`;
  const targetPath = path.join(BACKUPS_DIR, filename);

  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), "utf-8");

  // Salva anche una copia "backup_latest.json"
  const latestPath = path.join(BACKUPS_DIR, "backup_latest.json");
  fs.copyFileSync(targetPath, latestPath);

  // Rotazione backup: mantieni i 50 più recenti
  cleanOldBackups(50);

  console.log(`=======================================================`);
  console.log(`🛡️  AREA46 — BACKUP DI SICUREZZA CREATO CON SUCCESSO`);
  console.log(`=======================================================`);
  console.log(`📁 File: ${filename}`);
  console.log(`📊 Utenti registrati: ${v.stats.utenti_totali} (${v.stats.crediti_totali_attivi} crediti complessivi)`);
  console.log(`📅 Prenotazioni attive: ${v.stats.prenotazioni_slot}`);
  console.log(`🏋️  Voci diario atleti: ${v.stats.voci_diario}`);
  console.log(`🎯 Esercizi nel catalogo: ${v.stats.esercizi_database}`);
  if (v.warnings.length > 0) {
    console.log(`⚠️  Avvisi:`, v.warnings);
  }
  console.log(`=======================================================\n`);

  return targetPath;
}

function cleanOldBackups(maxKeep = 50) {
  const files = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith("backup_") && f.endsWith(".json") && f !== "backup_latest.json")
    .map((f) => ({
      name: f,
      path: path.join(BACKUPS_DIR, f),
      time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length > maxKeep) {
    const toDelete = files.slice(maxKeep);
    for (const f of toDelete) {
      try {
        fs.unlinkSync(f.path);
      } catch {}
    }
  }
}

// ─── 3. RIPRISTINO (RESTORE) ────────────────────────────────────────────────
export function restoreBackup(targetFileName = "") {
  let fileToRestore = "";

  if (targetFileName) {
    const exactPath = path.isAbsolute(targetFileName)
      ? targetFileName
      : path.join(BACKUPS_DIR, targetFileName);
    if (!fs.existsSync(exactPath)) {
      throw new Error(`File di backup non trovato: ${exactPath}`);
    }
    fileToRestore = exactPath;
  } else {
    const latestPath = path.join(BACKUPS_DIR, "backup_latest.json");
    if (!fs.existsSync(latestPath)) {
      throw new Error("Nessun backup disponibile da ripristinare!");
    }
    fileToRestore = latestPath;
  }

  // Snapshot di emergenza dello stato attuale PRIMA di sovrascrivere
  if (fs.existsSync(DEMO_DATA_FILE)) {
    const safetyTag = `pre_restore_${formatTimestamp()}`;
    const safetyFile = path.join(BACKUPS_DIR, `safety_snapshot_${safetyTag}.json`);
    fs.copyFileSync(DEMO_DATA_FILE, safetyFile);
    console.log(`📸 Snapshot di salvataggio prima del ripristino creato: ${path.basename(safetyFile)}`);
  }

  // Carica e valida il file da ripristinare
  const raw = fs.readFileSync(fileToRestore, "utf-8");
  const data = JSON.parse(raw);
  const v = verifyIntegrity(data);

  if (!v.ok) {
    console.error("❌ ERRORE: Il file di backup contiene anomalie critiche:", v.errors);
    throw new Error("Ripristino interrotto per evitare corruzione dati.");
  }

  // Scrivi su demo-data.json
  fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");

  // Scrivi anche su /tmp se presente
  try {
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {}

  console.log(`=======================================================`);
  console.log(`🔄 RIPRISTINO COMPLETATO CON SUCCESSO!`);
  console.log(`=======================================================`);
  console.log(`📁 Ripristinato da: ${path.basename(fileToRestore)}`);
  console.log(`👥 Utenti ripristinati: ${v.stats.utenti_totali}`);
  console.log(`🎟️  Crediti totali: ${v.stats.crediti_totali_attivi}`);
  console.log(`📅 Prenotazioni: ${v.stats.prenotazioni_slot}`);
  console.log(`=======================================================\n`);
}

// ─── 4. SEPARAZIONE MODULARE DEI DATI (CAMERE STAGNE) ────────────────────────
export function splitIntoVaultModules() {
  const d = loadCurrentData();

  // Modulo 1: Utenti, Crediti e Fisco
  const modUtenti = {
    profili_utenti: d.profili_utenti || [],
    movimenti_crediti: d.movimenti_crediti || [],
    transazioni_pagamenti: d.transazioni_pagamenti || [],
    transazioni_cancellate: d.transazioni_cancellate || [],
    utenti_cancellati: d.utenti_cancellati || [],
    tariffario_pacchetti: d.tariffario_pacchetti || [],
  };
  fs.writeFileSync(
    path.join(VAULT_DIR, "1_gestionale_utenti_crediti.json"),
    JSON.stringify(modUtenti, null, 2),
    "utf-8"
  );

  // Modulo 2: Calendario e Prenotazioni
  const modCalendario = {
    prenotazioni_slot: d.prenotazioni_slot || [],
    prenotazioni_cancellate: d.prenotazioni_cancellate || [],
    eccezioni_calendario: d.eccezioni_calendario || [],
    regole_palinsesto: d.regole_palinsesto || [],
  };
  fs.writeFileSync(
    path.join(VAULT_DIR, "2_gestionale_calendario.json"),
    JSON.stringify(modCalendario, null, 2),
    "utf-8"
  );

  // Modulo 3: Diario e Allenamenti Atleti
  const modDiario = {
    diario_utente: d.diario_utente || [],
    stato_allenamenti: d.stato_allenamenti || [],
    preferenze_utente: d.preferenze_utente || [],
  };
  fs.writeFileSync(
    path.join(VAULT_DIR, "3_atleti_diario_progressi.json"),
    JSON.stringify(modDiario, null, 2),
    "utf-8"
  );

  // Modulo 4: Catalogo Esercizi (Proprietà intellettuale)
  const modEsercizi = {
    database_esercizi: d.database_esercizi || [],
    livelli: d.livelli || [],
    ordine_livelli: d.ordine_livelli || [],
  };
  fs.writeFileSync(
    path.join(VAULT_DIR, "4_metodologia_esercizi.json"),
    JSON.stringify(modEsercizi, null, 2),
    "utf-8"
  );

  // Modulo 5: Schede e Cicli di Allenamento
  const modAllenamenti = {
    allenamenti: d.allenamenti || [],
  };
  fs.writeFileSync(
    path.join(VAULT_DIR, "5_metodologia_allenamenti_cicli.json"),
    JSON.stringify(modAllenamenti, null, 2),
    "utf-8"
  );

  // Modulo 6: Configurazione Lab
  const modConfig = {
    configurazione_lab: d.configurazione_lab || {},
    attivita_lab: d.attivita_lab || [],
    notifiche_email: d.notifiche_email || [],
  };
  fs.writeFileSync(
    path.join(VAULT_DIR, "6_configurazione_lab.json"),
    JSON.stringify(modConfig, null, 2),
    "utf-8"
  );

  console.log(`=======================================================`);
  console.log(`🏛️  AREA46 — DATI SUDDIVISI IN CAMERE STAGNE (VAULT)`);
  console.log(`=======================================================`);
  console.log(`Cartella: data/vault/`);
  console.log(`  1. 1_gestionale_utenti_crediti.json (Anagrafica & Crediti)`);
  console.log(`  2. 2_gestionale_calendario.json (Slot & Presenze)`);
  console.log(`  3. 3_atleti_diario_progressi.json (Pesi sollevati & Feedback)`);
  console.log(`  4. 4_metodologia_esercizi.json (163 Esercizi & Categorie)`);
  console.log(`  5. 5_metodologia_allenamenti_cicli.json (Cicli 1, 2, 3...)`);
  console.log(`  6. 6_configurazione_lab.json (Regole orari & Notifiche)`);
  console.log(`=======================================================\n`);
}

// ─── 5. FUSIONE MODULI (MERGE) ──────────────────────────────────────────────
export function mergeVaultModules() {
  const mod1 = JSON.parse(fs.readFileSync(path.join(VAULT_DIR, "1_gestionale_utenti_crediti.json"), "utf-8"));
  const mod2 = JSON.parse(fs.readFileSync(path.join(VAULT_DIR, "2_gestionale_calendario.json"), "utf-8"));
  const mod3 = JSON.parse(fs.readFileSync(path.join(VAULT_DIR, "3_atleti_diario_progressi.json"), "utf-8"));
  const mod4 = JSON.parse(fs.readFileSync(path.join(VAULT_DIR, "4_metodologia_esercizi.json"), "utf-8"));
  const mod5 = JSON.parse(fs.readFileSync(path.join(VAULT_DIR, "5_metodologia_allenamenti_cicli.json"), "utf-8"));
  const mod6 = JSON.parse(fs.readFileSync(path.join(VAULT_DIR, "6_configurazione_lab.json"), "utf-8"));

  const merged = {
    ...mod4,
    ...mod5,
    ...mod3,
    ...mod1,
    ...mod2,
    ...mod6,
  };

  const v = verifyIntegrity(merged);
  if (!v.ok) {
    throw new Error("Errore durante la fusione dei moduli: integrità non valida!");
  }

  // Crea prima un backup
  createBackup("pre_merge");

  fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(merged, null, 2), "utf-8");
  try {
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(merged, null, 2), "utf-8");
  } catch {}

  console.log(`✅ Moduli del Vault riuniti con successo in demo-data.json`);
}

// ─── CLI DISPATCHER ─────────────────────────────────────────────────────────
const cmd = process.argv[2] || "verify";

try {
  switch (cmd) {
    case "backup":
      createBackup(process.argv[3] || "");
      break;
    case "restore":
      restoreBackup(process.argv[3] || "");
      break;
    case "verify": {
      const v = verifyIntegrity();
      console.log(`=======================================================`);
      console.log(`🔍 CONTROLLO INTEGRITÀ DATI AREA46 LAB`);
      console.log(`=======================================================`);
      console.log(`Esito: ${v.ok ? "✅ PERFETTO (Tutti i dati sono integri)" : "❌ ATTENZIONE (Rilevate anomalie)"}`);
      console.log(`- Utenti registrati: ${v.stats.utenti_totali}`);
      console.log(`- Utenti con crediti: ${v.stats.utenti_con_crediti}`);
      console.log(`- Crediti totali attivi: ${v.stats.crediti_totali_attivi}`);
      console.log(`- Prenotazioni slot: ${v.stats.prenotazioni_slot}`);
      console.log(`- Voci diario atleti: ${v.stats.voci_diario}`);
      console.log(`- Esercizi nel catalogo: ${v.stats.esercizi_database}`);
      console.log(`- Allenamenti complessivi: ${v.stats.allenamenti_totali}`);
      if (v.warnings.length > 0) console.log(`Avvisi:`, v.warnings);
      if (v.errors.length > 0) console.log(`Errori:`, v.errors);
      console.log(`=======================================================\n`);
      break;
    }
    case "split":
      splitIntoVaultModules();
      break;
    case "merge":
      mergeVaultModules();
      break;
    default:
      console.log(`Comandi disponibili: backup, restore, verify, split, merge`);
  }
} catch (err) {
  console.error("❌ ERRORE:", err.message);
  process.exit(1);
}
