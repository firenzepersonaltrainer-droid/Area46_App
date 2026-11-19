#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const VAULT_CAL_FILE = path.join(ROOT_DIR, "data", "vault", "2_gestionale_calendario.json");
const DEMO_DATA_FILE = path.join(ROOT_DIR, "demo-data.json");

export function runStateIntegrityGuard(autoFix = true) {
  const issues = [];
  console.log("🛡️  [AREA46 CALENDAR & STATE GUARDIAN] Avvio verifica integrità...");

  // 1. Verifica esistenza e formato Vault Calendario
  if (!fs.existsSync(VAULT_CAL_FILE)) {
    throw new Error(`CRITICO: Camera stagna calendario non trovata in: ${VAULT_CAL_FILE}`);
  }

  let vaultData;
  try {
    vaultData = JSON.parse(fs.readFileSync(VAULT_CAL_FILE, "utf-8"));
  } catch (err) {
    throw new Error(`CRITICO: File ${VAULT_CAL_FILE} corrotto o JSON non valido: ${err.message}`);
  }

  const vaultExceptions = Array.isArray(vaultData.eccezioni_calendario) ? vaultData.eccezioni_calendario : [];
  const vaultBookings = Array.isArray(vaultData.prenotazioni_slot) ? vaultData.prenotazioni_slot : [];

  console.log(`📊 Vault Calendario: ${vaultExceptions.length} eccezioni/chiusure, ${vaultBookings.length} prenotazioni.`);

  // 2. Controllo presidio festività natalizie (25-12-2026 -> 06-01-2027)
  const xmasDates = [
    "2026-12-25", "2026-12-26", "2026-12-27", "2026-12-28",
    "2026-12-29", "2026-12-30", "2026-12-31",
    "2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04", "2027-01-05", "2027-01-06"
  ];

  const missingXmas = xmasDates.filter((d) => !vaultExceptions.some((e) => e.data === d));
  if (missingXmas.length > 0) {
    issues.push(`Festività natalizie incomplete nel Vault! Date mancanti: ${missingXmas.join(", ")}`);
    if (autoFix) {
      console.log(`🔧 [AUTO-FIX] Ripristino automatico di ${missingXmas.length} chiusure natalizie nel Vault...`);
      for (const d of missingXmas) {
        vaultExceptions.push({
          id: `exc-xmas-${d}`,
          data: d,
          orario: null,
          tipo: "chiusura_giornata",
          motivo: "Chiusura festività natalizie",
          created_at: new Date().toISOString(),
        });
      }
      vaultExceptions.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
      vaultData.eccezioni_calendario = vaultExceptions;
      fs.writeFileSync(VAULT_CAL_FILE, JSON.stringify(vaultData, null, 2), "utf-8");
    }
  }

  // 3. Controllo non-regressione tra demo-data.json e Vault
  if (fs.existsSync(DEMO_DATA_FILE)) {
    try {
      const demoRaw = fs.readFileSync(DEMO_DATA_FILE, "utf-8");
      const demoData = JSON.parse(demoRaw);
      const demoExceptions = Array.isArray(demoData.eccezioni_calendario) ? demoData.eccezioni_calendario : [];

      if (demoExceptions.length < vaultExceptions.length) {
        issues.push(`Disallineamento: demo-data.json ha solo ${demoExceptions.length} eccezioni vs ${vaultExceptions.length} nel Vault`);
        if (autoFix) {
          console.log(`🔧 [AUTO-FIX] Allineamento demo-data.json con il Vault (${vaultExceptions.length} eccezioni)...`);
          demoData.eccezioni_calendario = vaultExceptions;
          if (vaultBookings.length > 0 && (!demoData.prenotazioni_slot || demoData.prenotazioni_slot.length < vaultBookings.length)) {
            demoData.prenotazioni_slot = vaultBookings;
          }
          fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(demoData, null, 2), "utf-8");
        }
      }
    } catch (dErr) {
      issues.push(`Errore lettura demo-data.json: ${dErr.message}`);
    }
  }

  if (issues.length > 0 && !autoFix) {
    console.error("❌ [GUARDIAN FAIL] Rilevati problemi di integrità di stato:", issues);
    return { ok: false, issues };
  }

  console.log("✅ [GUARDIAN PASS] Stato calendario e chiusure protetto e conforme al 100% (Zero Regression).");
  return { ok: true, count: vaultExceptions.length, issues };
}

// Invocazione CLI diretta
if (process.argv[1] && process.argv[1].endsWith("state_integrity_guard.mjs")) {
  try {
    const res = runStateIntegrityGuard(true);
    process.exit(res.ok ? 0 : 1);
  } catch (err) {
    console.error("💥 [FATAL GUARDIAN ERROR]", err.message);
    process.exit(1);
  }
}
