/**
 * AREA46 TRAINING LAB — GLIDE DATA MIGRATION ENGINE
 * 
 * Script per importare dati, profili atleti, carnet crediti, scadenze
 * e storico del diario degli allenamenti esportati da Glide Tables o Google Sheets.
 * 
 * Utilizzo:
 *   node --experimental-strip-types scripts/migrate_glide_data.ts --mode=check
 *   node --experimental-strip-types scripts/migrate_glide_data.ts --mode=apply
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, "../demo-data.json");

export interface GlideUserRecord {
  email: string;
  nome: string;
  cognome?: string;
  telefono?: string;
  codice_fiscale?: string;
  indirizzo?: string;
  ruolo?: "manager" | "atleta";
  crediti?: number;
  data_scadenza_crediti?: string;
  tipo_abbonamento?: "standard" | "lab_continuativo_2x" | "lab_continuativo_3x" | string;
  note_coach?: string;
}

export interface GlideDiaryRecord {
  email_cliente: string;
  data_ora: string;
  id_esercizio?: string;
  nome_esercizio: string;
  carico_kg?: number;
  ripetizioni?: number;
  serie?: number;
  sets_json?: Array<{ set: number; carico_kg: number; ripetizioni: number; rpe?: number }>;
  feedback?: string;
}

export interface GlideMigrationPayload {
  utenti?: GlideUserRecord[];
  diario?: GlideDiaryRecord[];
}

/**
 * Esegue la migrazione fondendo i dati senza sovrascrivere o cancellare informazioni preesistenti.
 */
export function executeGlideMigration(payload: GlideMigrationPayload, isDryRun = true) {
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const db = JSON.parse(raw);

  const stats = {
    utenti_aggiornati: 0,
    utenti_creati: 0,
    voci_diario_inserite: 0,
    errori: [] as string[],
  };

  // 1. MIGRAZIONE PROFILI UTENTI E CREDITI
  if (payload.utenti && Array.isArray(payload.utenti)) {
    db.profili_utenti = db.profili_utenti || [];

    for (const u of payload.utenti) {
      if (!u.email || !u.email.includes("@")) {
        stats.errori.push(`Utente saltato: email mancante o non valida (${JSON.stringify(u)})`);
        continue;
      }

      const emailNormalized = u.email.trim().toLowerCase();
      const existing = db.profili_utenti.find(
        (p: any) => p.email.trim().toLowerCase() === emailNormalized
      );

      if (existing) {
        // Aggiorna anagrafica e crediti preservando l'ID
        existing.nome = u.nome || existing.nome;
        existing.cognome = u.cognome ?? existing.cognome;
        existing.name = `${existing.nome} ${existing.cognome || ""}`.trim();
        existing.telefono = u.telefono ?? existing.telefono;
        existing.codice_fiscale = u.codice_fiscale ?? existing.codice_fiscale;
        existing.indirizzo = u.indirizzo ?? existing.indirizzo;
        if (u.crediti !== undefined) existing.crediti = Number(u.crediti);
        if (u.data_scadenza_crediti) existing.data_scadenza_crediti = u.data_scadenza_crediti;
        if (u.tipo_abbonamento) existing.tipo_abbonamento = u.tipo_abbonamento;
        if (u.note_coach) existing.note_coach = u.note_coach;
        stats.utenti_aggiornati++;
      } else {
        // Crea nuovo profilo atleta
        const nuovoId = `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const nuovoProfilo = {
          id: nuovoId,
          email: emailNormalized,
          nome: u.nome || emailNormalized.split("@")[0],
          cognome: u.cognome || "",
          name: `${u.nome || emailNormalized.split("@")[0]} ${u.cognome || ""}`.trim(),
          telefono: u.telefono || "",
          codice_fiscale: u.codice_fiscale || "",
          indirizzo: u.indirizzo || "",
          ruolo: u.ruolo || (emailNormalized === "firenzepersonaltrainer@gmail.com" ? "manager" : "atleta"),
          crediti: Number(u.crediti ?? 0),
          tempo_cancellazione_ore: 24,
          data_scadenza_crediti: u.data_scadenza_crediti || null,
          tipo_abbonamento: u.tipo_abbonamento || "standard",
          note_coach: u.note_coach || "Migrato da Glide",
          data_ultimo_accesso: new Date().toISOString(),
        };
        db.profili_utenti.push(nuovoProfilo);
        stats.utenti_creati++;
      }
    }
  }

  // 2. MIGRAZIONE STORICO DIARIO DI ALLENAMENTO
  if (payload.diario && Array.isArray(payload.diario)) {
    db.diario_utente = db.diario_utente || [];

    for (const d of payload.diario) {
      if (!d.email_cliente || !d.nome_esercizio) {
        stats.errori.push(`Voce diario saltata: dati obbligatori mancanti (${JSON.stringify(d)})`);
        continue;
      }

      const emailNormalized = d.email_cliente.trim().toLowerCase();

      // Evita duplicati identici (stessa data/ora e stesso esercizio)
      const duplicate = db.diario_utente.some(
        (existing: any) =>
          existing.email_cliente.toLowerCase() === emailNormalized &&
          existing.nome_esercizio.toLowerCase() === d.nome_esercizio.toLowerCase() &&
          existing.data_ora === d.data_ora
      );

      if (!duplicate) {
        const nuovaVoce = {
          id: Date.now() + Math.floor(Math.random() * 100000),
          email_cliente: emailNormalized,
          id_esercizio: d.id_esercizio || null,
          nome_esercizio: d.nome_esercizio,
          carico_kg: d.carico_kg ?? null,
          ripetizioni: d.ripetizioni ?? null,
          serie: d.serie ?? null,
          sets_json: d.sets_json ?? null,
          feedback: d.feedback || null,
          data_ora: d.data_ora || new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        db.diario_utente.push(nuovaVoce);
        stats.voci_diario_inserite++;
      }
    }
  }

  // Se non è un dry-run, salviamo fisicamente il database
  if (!isDryRun) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  }

  return { isDryRun, stats, databaseUtentiTotali: db.profili_utenti.length, databaseDiarioTotali: db.diario_utente.length };
}

// Se invocato direttamente da CLI
const isDirectRun = process.argv[1] && process.argv[1].endsWith("migrate_glide_data.ts");
if (isDirectRun) {
  const args = process.argv.slice(2);
  const isApply = args.includes("--mode=apply");

  console.log("=== AREA46 MIGRATION ENGINE ===");
  console.log(`Modalità: ${isApply ? "SCRITTURA DEFINITIVA (--mode=apply)" : "SIMULAZIONE DRY-RUN (--mode=check)"}`);

  // Test di esempio per verificare la validità del motore
  const demoPayload: GlideMigrationPayload = {
    utenti: [
      {
        email: "mario.rossi@gmail.com",
        nome: "Mario",
        cognome: "Rossi",
        crediti: 10,
        tipo_abbonamento: "lab_continuativo_2x",
        data_scadenza_crediti: "2026-12-31",
      },
      {
        email: "nuovo.atleta@example.com",
        nome: "Marco",
        cognome: "Verdi",
        crediti: 8,
        tipo_abbonamento: "standard",
        data_scadenza_crediti: "2026-10-31",
      },
    ],
    diario: [
      {
        email_cliente: "mario.rossi@gmail.com",
        data_ora: "2026-09-20T18:30:00Z",
        nome_esercizio: "Landmine Squat",
        sets_json: [
          { set: 1, carico_kg: 50, ripetizioni: 8, rpe: 7 },
          { set: 2, carico_kg: 60, ripetizioni: 8, rpe: 8 },
          { set: 3, carico_kg: 65, ripetizioni: 6, rpe: 8.5 },
        ],
        feedback: "Ottima sensazione di spinta sul quadricipite",
      },
    ],
  };

  const result = executeGlideMigration(demoPayload, !isApply);
  console.log("Risultato Migrazione:", JSON.stringify(result, null, 2));
}
