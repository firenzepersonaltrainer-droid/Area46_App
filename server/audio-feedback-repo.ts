import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

function getDbPath(): string {
  const isServerless =
    process.env.VERCEL === "1" ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === "production";

  const localDb = path.resolve(process.cwd(), "area46_v2.sqlite");
  const tmpDb = "/tmp/area46_v2.sqlite";

  if (isServerless) {
    if (!fs.existsSync(tmpDb)) {
      if (fs.existsSync(localDb)) {
        try {
          fs.copyFileSync(localDb, tmpDb);
        } catch {
          // fallback
        }
      }
    }
    return tmpDb;
  }

  // Verifica scrivibilità directory locale
  try {
    fs.accessSync(process.cwd(), fs.constants.W_OK);
    return localDb;
  } catch {
    if (!fs.existsSync(tmpDb) && fs.existsSync(localDb)) {
      try {
        fs.copyFileSync(localDb, tmpDb);
      } catch {}
    }
    return tmpDb;
  }
}

// Fallback in memory se SQLite non dovesse essere disponibile nell'ambiente serverless
let inMemoryAudioNotes: any[] = [];
let inMemoryBugs: any[] = [];

function getDb(): DatabaseSync | null {
  try {
    const targetPath = getDbPath();
    const db = new DatabaseSync(targetPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS audio_note_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        utente_id TEXT,
        email_cliente TEXT,
        contesto TEXT CHECK(contesto IN ('biofeedback_workout', 'app_feedback')),
        audio_url TEXT NOT NULL,
        durata_sec INTEGER DEFAULT 0,
        trascrizione_testo TEXT,
        ai_allerta TEXT CHECK(ai_allerta IN ('verde', 'giallo', 'rosso')) DEFAULT 'verde',
        ai_sintesi TEXT,
        ai_proposta_azione TEXT,
        stato TEXT CHECK(stato IN ('nuovo', 'ascoltato', 'applicato', 'archiviato')) DEFAULT 'nuovo',
        data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_segnalazioni_bug (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        utente_id TEXT,
        email_cliente TEXT,
        anonimo BOOLEAN DEFAULT 0,
        tipo TEXT CHECK(tipo IN ('consiglio', 'bug', 'altro')) DEFAULT 'consiglio',
        titolo TEXT NOT NULL,
        descrizione TEXT NOT NULL,
        audio_id INTEGER REFERENCES audio_note_feedback(id),
        device_info TEXT,
        ai_diagnosi_tecnica TEXT,
        stato TEXT CHECK(stato IN ('aperto', 'in_valutazione', 'risolto', 'scartato')) DEFAULT 'aperto',
        data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    return db;
  } catch (err) {
    console.warn("Avviso: fallback in-memory SQLite attivato:", err);
    return null;
  }
}

export interface AudioNoteRecord {
  id?: number;
  utente_id?: string | null;
  email_cliente?: string | null;
  contesto: "biofeedback_workout" | "app_feedback";
  audio_url: string;
  durata_sec?: number;
  trascrizione_testo?: string | null;
  ai_allerta?: "verde" | "giallo" | "rosso";
  ai_sintesi?: string | null;
  ai_proposta_azione?: string | null;
  stato?: "nuovo" | "ascoltato" | "applicato" | "archiviato";
  data_creazione?: string;
}

export interface AppSegnalazioneRecord {
  id?: number;
  utente_id?: string | null;
  email_cliente?: string | null;
  anonimo?: boolean;
  tipo: "consiglio" | "bug" | "altro";
  titolo: string;
  descrizione: string;
  audio_id?: number | null;
  device_info?: string | null;
  ai_diagnosi_tecnica?: string | null;
  stato?: "aperto" | "in_valutazione" | "risolto" | "scartato";
  data_creazione?: string;
  audio_url?: string | null;
  durata_sec?: number | null;
  trascrizione_testo?: string | null;
  ai_allerta?: string | null;
  ai_sintesi?: string | null;
}

export function insertAudioNote(record: AudioNoteRecord): AudioNoteRecord {
  const db = getDb();
  if (db) {
    const stmt = db.prepare(`
      INSERT INTO audio_note_feedback (
        utente_id, email_cliente, contesto, audio_url, durata_sec,
        trascrizione_testo, ai_allerta, ai_sintesi, ai_proposta_azione, stato
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      record.utente_id || null,
      record.email_cliente || null,
      record.contesto,
      record.audio_url,
      record.durata_sec || 0,
      record.trascrizione_testo || null,
      record.ai_allerta || "verde",
      record.ai_sintesi || null,
      record.ai_proposta_azione || null,
      record.stato || "nuovo"
    );

    const lastId = Number(info.lastInsertRowid);
    const getStmt = db.prepare("SELECT * FROM audio_note_feedback WHERE id = ?");
    const row = getStmt.get(lastId) as any;
    db.close();
    return row;
  }

  // Fallback in-memory resiliente
  const newRow: AudioNoteRecord = {
    ...record,
    id: Date.now(),
    data_creazione: new Date().toISOString(),
  };
  inMemoryAudioNotes.unshift(newRow);
  return newRow;
}

export function getAudioNotes(filter?: {
  contesto?: string;
  stato?: string;
  email?: string;
}): AudioNoteRecord[] {
  const db = getDb();
  if (db) {
    let query = "SELECT * FROM audio_note_feedback WHERE 1=1";
    const params: any[] = [];

    if (filter?.contesto) {
      query += " AND contesto = ?";
      params.push(filter.contesto);
    }
    if (filter?.stato) {
      query += " AND stato = ?";
      params.push(filter.stato);
    }
    if (filter?.email) {
      query += " AND email_cliente = ?";
      params.push(filter.email);
    }
    query += " ORDER BY id DESC";

    const rows = db.prepare(query).all(...params) as any[];
    db.close();
    return rows;
  }

  return inMemoryAudioNotes.filter((n) => {
    if (filter?.contesto && n.contesto !== filter.contesto) return false;
    if (filter?.stato && n.stato !== filter.stato) return false;
    if (filter?.email && n.email_cliente !== filter.email) return false;
    return true;
  });
}

export function updateAudioNoteStatus(
  id: number,
  stato: "nuovo" | "ascoltato" | "applicato" | "archiviato"
): AudioNoteRecord | null {
  const db = getDb();
  if (db) {
    const stmt = db.prepare("UPDATE audio_note_feedback SET stato = ? WHERE id = ?");
    stmt.run(stato, id);
    const row = db.prepare("SELECT * FROM audio_note_feedback WHERE id = ?").get(id) as any;
    db.close();
    return row || null;
  }

  const found = inMemoryAudioNotes.find((n) => n.id === id);
  if (found) found.stato = stato;
  return found || null;
}

export function updateAudioNoteAnalysis(
  id: number,
  analysis: {
    trascrizione: string;
    allerta: string;
    sintesi: string;
    proposta_azione: string;
  }
): AudioNoteRecord | null {
  const db = getDb();
  if (db) {
    db.prepare(`
      UPDATE audio_note_feedback
      SET trascrizione_testo = ?, ai_allerta = ?, ai_sintesi = ?, ai_proposta_azione = ?
      WHERE id = ?
    `).run(analysis.trascrizione, analysis.allerta, analysis.sintesi, analysis.proposta_azione, id);
    const row = db.prepare("SELECT * FROM audio_note_feedback WHERE id = ?").get(id) as any;
    db.close();
    return row || null;
  }

  const found = inMemoryAudioNotes.find((n) => n.id === id);
  if (found) {
    found.trascrizione_testo = analysis.trascrizione;
    found.ai_allerta = analysis.allerta;
    found.ai_sintesi = analysis.sintesi;
    found.ai_proposta_azione = analysis.proposta_azione;
  }
  return found || null;
}

export function insertAppSegnalazione(
  record: AppSegnalazioneRecord
): AppSegnalazioneRecord {
  const db = getDb();
  if (db) {
    const stmt = db.prepare(`
      INSERT INTO app_segnalazioni_bug (
        utente_id, email_cliente, anonimo, tipo, titolo,
        descrizione, audio_id, device_info, ai_diagnosi_tecnica, stato
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      record.anonimo ? null : record.utente_id || null,
      record.anonimo ? null : record.email_cliente || null,
      record.anonimo ? 1 : 0,
      record.tipo || "consiglio",
      record.titolo,
      record.descrizione,
      record.audio_id || null,
      record.device_info || null,
      record.ai_diagnosi_tecnica || null,
      record.stato || "aperto"
    );

    const lastId = Number(info.lastInsertRowid);
    const row = db.prepare(`
      SELECT s.*, a.audio_url, a.trascrizione_testo, a.ai_allerta, a.ai_sintesi
      FROM app_segnalazioni_bug s
      LEFT JOIN audio_note_feedback a ON s.audio_id = a.id
      WHERE s.id = ?
    `).get(lastId) as any;
    db.close();
    return row;
  }

  const newBug: AppSegnalazioneRecord = {
    ...record,
    id: Date.now(),
    data_creazione: new Date().toISOString(),
  };
  inMemoryBugs.unshift(newBug);
  return newBug;
}

export function getAppSegnalazioni(filter?: {
  stato?: string;
  tipo?: string;
}): AppSegnalazioneRecord[] {
  const db = getDb();
  if (db) {
    let query = `
      SELECT s.*, a.audio_url, a.durata_sec, a.trascrizione_testo, a.ai_allerta, a.ai_sintesi, a.ai_proposta_azione
      FROM app_segnalazioni_bug s
      LEFT JOIN audio_note_feedback a ON s.audio_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filter?.stato) {
      query += " AND s.stato = ?";
      params.push(filter.stato);
    }
    if (filter?.tipo) {
      query += " AND s.tipo = ?";
      params.push(filter.tipo);
    }
    query += " ORDER BY s.id DESC";

    const rows = db.prepare(query).all(...params) as any[];
    db.close();
    return rows;
  }

  return inMemoryBugs.filter((b) => {
    if (filter?.stato && b.stato !== filter.stato) return false;
    if (filter?.tipo && b.tipo !== filter.tipo) return false;
    return true;
  });
}

export function updateAppSegnalazioneStatus(
  id: number,
  stato: "aperto" | "in_valutazione" | "risolto" | "scartato"
): AppSegnalazioneRecord | null {
  const db = getDb();
  if (db) {
    const stmt = db.prepare("UPDATE app_segnalazioni_bug SET stato = ? WHERE id = ?");
    stmt.run(stato, id);
    const row = db.prepare(`
      SELECT s.*, a.audio_url, a.durata_sec, a.trascrizione_testo, a.ai_allerta, a.ai_sintesi
      FROM app_segnalazioni_bug s
      LEFT JOIN audio_note_feedback a ON s.audio_id = a.id
      WHERE s.id = ?
    `).get(id) as any;
    db.close();
    return row || null;
  }

  const found = inMemoryBugs.find((b) => b.id === id);
  if (found) found.stato = stato;
  return found || null;
}
