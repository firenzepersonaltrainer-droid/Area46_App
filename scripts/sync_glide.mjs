/**
 * AREA46 TRAINING LAB — SINCRONIZZAZIONE AUTOMATICA GLIDE
 * 
 * Sincronizza solo ed esclusivamente:
 * 1. Dati anagrafici atleti (nome, cognome, email, telefono, codice fiscale)
 * 2. Storico e nuove voci del diario di allenamento (esercizi, carichi, serie, rep, feedback)
 * 
 * Preserva al 100% crediti, scadenze, prenotazioni e movimenti contabili/fisco dell'app Area46.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEMO_DATA_PATH = path.join(ROOT_DIR, "demo-data.json");
const CREDENZIALI_PATH = path.join(ROOT_DIR, "credenziali.json");
const GLIDE_DIR = path.join(ROOT_DIR, "data", "glide_export");

function base64url(str) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: creds.token_uri,
    exp: now + 3600,
    iat: now,
  };
  const signInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signInput);
  const signature = signer.sign(creds.private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${signInput}.${signature}`;

  const res = await fetch(creds.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  return data.access_token;
}

export async function runGlideSync() {
  console.log("=======================================================");
  console.log("🔄 AVVIO SINCRONIZZAZIONE DATI DA GLIDE — AREA46 LAB");
  console.log("=======================================================");

  const report = {
    timestamp: new Date().toISOString(),
    sorgenti_trovate: [],
    utenti_aggiornati: 0,
    utenti_aggiunti: 0,
    voci_diario_aggiunte: 0,
    avvisi_e_problematiche: [],
  };

  if (!fs.existsSync(DEMO_DATA_PATH)) {
    throw new Error(`File database locale non trovato in: ${DEMO_DATA_PATH}`);
  }
  const db = JSON.parse(fs.readFileSync(DEMO_DATA_PATH, "utf-8"));
  db.profili_utenti = db.profili_utenti || [];
  db.diario_utente = db.diario_utente || [];

  let token = null;
  if (fs.existsSync(CREDENZIALI_PATH)) {
    try {
      const creds = JSON.parse(fs.readFileSync(CREDENZIALI_PATH, "utf-8"));
      token = await getGoogleAccessToken(creds);
      console.log("✅ Connessione Google Cloud Drive / Sheets stabilita.");
    } catch (err) {
      report.avvisi_e_problematiche.push(`Connessione Google Cloud non riuscita: ${err.message}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SORGENTE 1: Google Sheet 'database esercizi Lab' (Foglio 'Diario')
  // ───────────────────────────────────────────────────────────────────────────
  if (token) {
    try {
      const sheetId = "1SNy8IJk1E20BcAdar0F1TqqnpRIDkjlkNn6P2ljKPNY";
      const diarioRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Diario!A1:Z5000`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (diarioRes.ok) {
        const diarioData = await diarioRes.json();
        const rows = diarioData.values || [];
        if (rows.length > 1) {
          report.sorgenti_trovate.push(`Google Sheet Diario (${rows.length - 1} righe)`);
          const headers = rows[0].map((h) => String(h).toLowerCase().trim());
          const dateIdx = headers.findIndex((h) => h.includes("data"));
          const emailIdx = headers.findIndex((h) => h.includes("mail") || h.includes("cliente"));
          const exIdx = headers.findIndex((h) => h.includes("esercizio") || h.includes("id"));
          const loadIdx = headers.findIndex((h) => h.includes("carico") || h.includes("peso"));
          const feedIdx = headers.findIndex((h) => h.includes("feedback") || h.includes("note"));

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const emailCliente = (emailIdx >= 0 ? row[emailIdx] : "")?.trim().toLowerCase();
            if (!emailCliente || !emailCliente.includes("@")) continue;

            const dataOra = (dateIdx >= 0 ? row[dateIdx] : "") || new Date().toISOString();
            const nomeEsercizio = (exIdx >= 0 ? row[exIdx] : "") || "Esercizio Landmine";
            const caricoKg = loadIdx >= 0 ? parseFloat(row[loadIdx]) || null : null;
            const feedback = feedIdx >= 0 ? row[feedIdx] : null;

            // Controllo duplicato
            const exists = db.diario_utente.some(
              (d) =>
                d.email_cliente?.toLowerCase() === emailCliente &&
                d.nome_esercizio?.toLowerCase() === nomeEsercizio.toLowerCase() &&
                d.data_ora === dataOra
            );

            if (!exists) {
              db.diario_utente.push({
                id: Date.now() + Math.floor(Math.random() * 1000000),
                email_cliente: emailCliente,
                nome_esercizio: nomeEsercizio,
                carico_kg: caricoKg,
                feedback: feedback,
                data_ora: dataOra,
                created_at: new Date().toISOString(),
              });
              report.voci_diario_aggiunte++;
            }
          }
        } else {
          console.log("ℹ️ Foglio Google 'Diario' presente ma al momento privo di righe atleti.");
        }
      }
    } catch (err) {
      report.avvisi_e_problematiche.push(`Errore lettura foglio Google Diario: ${err.message}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SORGENTE 2: File Locali CSV/JSON esportati da Glide (data/glide_export/)
  // ───────────────────────────────────────────────────────────────────────────
  if (!fs.existsSync(GLIDE_DIR)) {
    fs.mkdirSync(GLIDE_DIR, { recursive: true });
  }

  const files = fs.readdirSync(GLIDE_DIR);
  for (const f of files) {
    const fullPath = path.join(GLIDE_DIR, f);
    if (f.endsWith(".json")) {
      report.sorgenti_trovate.push(`File locale ${f}`);
      try {
        const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        if (Array.isArray(content.utenti)) {
          for (const u of content.utenti) {
            if (!u.email) continue;
            const email = u.email.trim().toLowerCase();
            const existing = db.profili_utenti.find((p) => p.email.toLowerCase() === email);
            if (existing) {
              if (u.nome) existing.nome = u.nome;
              if (u.cognome) existing.cognome = u.cognome;
              if (u.telefono) existing.telefono = u.telefono;
              if (u.codice_fiscale) existing.codice_fiscale = u.codice_fiscale;
              report.utenti_aggiornati++;
            } else {
              db.profili_utenti.push({
                id: `usr-glide-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                email,
                nome: u.nome || email.split("@")[0],
                cognome: u.cognome || "",
                telefono: u.telefono || "",
                codice_fiscale: u.codice_fiscale || "",
                ruolo: "atleta",
                crediti: 0,
                data_scadenza_crediti: null,
                tipo_abbonamento: "standard",
                tempo_cancellazione_ore: 24,
                data_ultimo_accesso: new Date().toISOString(),
              });
              report.utenti_aggiunti++;
            }
          }
        }
        if (Array.isArray(content.diario)) {
          for (const d of content.diario) {
            if (!d.email_cliente || !d.nome_esercizio) continue;
            const email = d.email_cliente.trim().toLowerCase();
            const exists = db.diario_utente.some(
              (ex) =>
                ex.email_cliente.toLowerCase() === email &&
                ex.nome_esercizio.toLowerCase() === d.nome_esercizio.toLowerCase() &&
                ex.data_ora === d.data_ora
            );
            if (!exists) {
              db.diario_utente.push({
                id: Date.now() + Math.floor(Math.random() * 1000000),
                email_cliente: email,
                nome_esercizio: d.nome_esercizio,
                carico_kg: d.carico_kg ?? null,
                ripetizioni: d.ripetizioni ?? null,
                serie: d.serie ?? null,
                sets_json: d.sets_json ?? null,
                feedback: d.feedback || null,
                data_ora: d.data_ora || new Date().toISOString(),
                created_at: new Date().toISOString(),
              });
              report.voci_diario_aggiunte++;
            }
          }
        }
      } catch (err) {
        report.avvisi_e_problematiche.push(`Errore lettura file ${f}: ${err.message}`);
      }
    } else if (f.endsWith(".csv") || f.endsWith(".xlsx") || f.endsWith(".xls")) {
      report.sorgenti_trovate.push(`File CSV/Excel ${f}`);
      try {
        const wb = xlsx.readFile(fullPath);
        for (const sheetName of wb.SheetNames) {
          const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
          if (!rows || rows.length === 0) continue;

          const first = rows[0];
          const keys = Object.keys(first).map((k) => k.toLowerCase().trim());
          const isDiario = keys.some((k) => k.includes("carico") || k.includes("ripetiz") || k.includes("feedback") || (k.includes("esercizio") && keys.some(x => x.includes("mail"))));
          const isUtenti = !isDiario && keys.some((k) => k.includes("mail") || k.includes("email"));

          if (isUtenti) {
            for (const r of rows) {
              const emailKey = Object.keys(r).find((k) => k.toLowerCase().includes("mail"));
              const email = emailKey ? String(r[emailKey]).trim().toLowerCase() : "";
              if (!email || !email.includes("@")) continue;

              const nomeKey = Object.keys(r).find((k) => k.toLowerCase() === "nome" || k.toLowerCase().includes("first name") || k.toLowerCase().includes("nominativo"));
              const cognomeKey = Object.keys(r).find((k) => k.toLowerCase() === "cognome" || k.toLowerCase().includes("last name"));
              const telKey = Object.keys(r).find((k) => k.toLowerCase().includes("tel") || k.toLowerCase().includes("phone") || k.toLowerCase().includes("cell"));
              const cfKey = Object.keys(r).find((k) => k.toLowerCase().includes("fiscale") || k.toLowerCase().includes("cf"));

              const nomeVal = nomeKey ? String(r[nomeKey]).trim() : "";
              const cognomeVal = cognomeKey ? String(r[cognomeKey]).trim() : "";
              const telVal = telKey ? String(r[telKey]).trim() : "";
              const cfVal = cfKey ? String(r[cfKey]).trim().toUpperCase() : "";

              const existing = db.profili_utenti.find((p) => p.email.toLowerCase() === email);
              if (existing) {
                if (nomeVal) existing.nome = nomeVal;
                if (cognomeVal) existing.cognome = cognomeVal;
                if (telVal) existing.telefono = telVal;
                if (cfVal) existing.codice_fiscale = cfVal;
                report.utenti_aggiornati++;
              } else {
                db.profili_utenti.push({
                  id: `usr-glide-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  email,
                  nome: nomeVal || email.split("@")[0],
                  cognome: cognomeVal || "",
                  telefono: telVal,
                  codice_fiscale: cfVal,
                  ruolo: "atleta",
                  crediti: 0,
                  data_scadenza_crediti: null,
                  tipo_abbonamento: "standard",
                  tempo_cancellazione_ore: 24,
                  data_ultimo_accesso: new Date().toISOString(),
                });
                report.utenti_aggiunti++;
              }
            }
          } else if (isDiario) {
            for (const r of rows) {
              const emailKey = Object.keys(r).find((k) => k.toLowerCase().includes("mail") || k.toLowerCase().includes("cliente"));
              const email = emailKey ? String(r[emailKey]).trim().toLowerCase() : "";
              if (!email || !email.includes("@")) continue;

              const exKey = Object.keys(r).find((k) => k.toLowerCase().includes("esercizio"));
              const loadKey = Object.keys(r).find((k) => k.toLowerCase().includes("carico") || k.toLowerCase().includes("kg") || k.toLowerCase().includes("peso"));
              const feedKey = Object.keys(r).find((k) => k.toLowerCase().includes("feedback") || k.toLowerCase().includes("note"));
              const dateKey = Object.keys(r).find((k) => k.toLowerCase().includes("data") || k.toLowerCase().includes("date"));

              const nomeEsercizio = exKey ? String(r[exKey]).trim() : "Esercizio Landmine";
              const caricoKg = loadKey ? parseFloat(String(r[loadKey])) || null : null;
              const feedback = feedKey ? String(r[feedKey]).trim() : null;
              const dataOra = dateKey && r[dateKey] ? String(r[dateKey]) : new Date().toISOString();

              const exists = db.diario_utente.some(
                (ex) =>
                  ex.email_cliente.toLowerCase() === email &&
                  ex.nome_esercizio.toLowerCase() === nomeEsercizio.toLowerCase() &&
                  ex.data_ora === dataOra
              );
              if (!exists) {
                db.diario_utente.push({
                  id: Date.now() + Math.floor(Math.random() * 1000000),
                  email_cliente: email,
                  nome_esercizio: nomeEsercizio,
                  carico_kg: caricoKg,
                  feedback,
                  data_ora: dataOra,
                  created_at: new Date().toISOString(),
                });
                report.voci_diario_aggiunte++;
              }
            }
          }
        }
      } catch (err) {
        report.avvisi_e_problematiche.push(`Errore lettura file CSV/Excel ${f}: ${err.message}`);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SALVATAGGIO DEI DATI FUSI
  // ───────────────────────────────────────────────────────────────────────────
  fs.writeFileSync(DEMO_DATA_PATH, JSON.stringify(db, null, 2), "utf-8");

  // Rimuovi eventuale cache temporanea /tmp/demo-data.json
  try {
    if (fs.existsSync("/tmp/demo-data.json")) {
      fs.unlinkSync("/tmp/demo-data.json");
    }
  } catch {}

  console.log("-------------------------------------------------------");
  console.log(`📊 RISULTATO SINCRONIZZAZIONE:`);
  console.log(`- Sorgenti attive: ${report.sorgenti_trovate.length > 0 ? report.sorgenti_trovate.join(", ") : "In attesa del collegamento con Glide"}`);
  console.log(`- Utenti anagrafica aggiunti: ${report.utenti_aggiunti}`);
  console.log(`- Utenti anagrafica aggiornati: ${report.utenti_aggiornati}`);
  console.log(`- Voci Diario importate: ${report.voci_diario_aggiunte}`);
  if (report.avvisi_e_problematiche.length > 0) {
    console.log(`⚠️ Note & Problematiche:`);
    report.avvisi_e_problematiche.forEach((p) => console.log(`  • ${p}`));
  }
  console.log("=======================================================");

  return report;
}

// Esegui se lanciato direttamente
const isDirectRun = process.argv[1] && process.argv[1].endsWith("sync_glide.mjs");
if (isDirectRun) {
  runGlideSync().catch((err) => {
    console.error("FATAL ERROR IN GLIDE SYNC:", err);
    process.exit(1);
  });
}
