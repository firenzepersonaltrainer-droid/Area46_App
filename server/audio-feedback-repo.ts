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

export function setMemoryStore(notes: any[], bugs: any[]) {
  if (Array.isArray(notes)) inMemoryAudioNotes = notes;
  if (Array.isArray(bugs)) inMemoryBugs = bugs;
}

export function getMemoryStore() {
  return { audioNotes: inMemoryAudioNotes, bugs: inMemoryBugs };
}

function getDb(): DatabaseSync | null {
  try {
    const targetPath = getDbPath();
    const db = new DatabaseSync(targetPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS audio_note_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        utente_id TEXT,
        email_cliente TEXT,
        contesto TEXT,
        audio_url TEXT NOT NULL,
        audio_base64 TEXT,
        durata_sec INTEGER DEFAULT 0,
        trascrizione_testo TEXT,
        ai_allerta TEXT DEFAULT 'verde',
        ai_sintesi TEXT,
        ai_proposta_azione TEXT,
        stato TEXT DEFAULT 'nuovo',
        data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_segnalazioni_bug (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        utente_id TEXT,
        email_cliente TEXT,
        anonimo BOOLEAN DEFAULT 0,
        tipo TEXT DEFAULT 'consiglio',
        titolo TEXT NOT NULL,
        descrizione TEXT NOT NULL,
        audio_id INTEGER,
        audio_base64 TEXT,
        device_info TEXT,
        ai_diagnosi_tecnica TEXT,
        stato TEXT DEFAULT 'aperto',
        data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migrazioni safe a caldo su colonne opzionali
    try { db.exec("ALTER TABLE audio_note_feedback ADD COLUMN audio_base64 TEXT;"); } catch {}
    try { db.exec("ALTER TABLE audio_note_feedback ADD COLUMN consiglio_coach TEXT;"); } catch {}
    try { db.exec("ALTER TABLE audio_note_feedback ADD COLUMN consiglio_approvato_coach BOOLEAN DEFAULT 0;"); } catch {}
    try { db.exec("ALTER TABLE audio_note_feedback ADD COLUMN giorno_destinazione TEXT;"); } catch {}
    try { db.exec("ALTER TABLE audio_note_feedback ADD COLUMN tipo_intervento TEXT;"); } catch {}
    try { db.exec("ALTER TABLE audio_note_feedback ADD COLUMN coach_audio_url TEXT;"); } catch {}
    try { db.exec("ALTER TABLE audio_note_feedback ADD COLUMN coach_audio_base64 TEXT;"); } catch {}
    try { db.exec("ALTER TABLE audio_note_feedback ADD COLUMN coach_audio_durata_sec INTEGER DEFAULT 0;"); } catch {}
    try { db.exec("ALTER TABLE app_segnalazioni_bug ADD COLUMN audio_base64 TEXT;"); } catch {}

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
  nome_cliente?: string | null;
  contesto: "biofeedback_workout" | "app_feedback";
  audio_url: string;
  audio_base64?: string | null;
  durata_sec?: number;
  trascrizione_testo?: string | null;
  ai_allerta?: "verde" | "giallo" | "rosso";
  ai_sintesi?: string | null;
  ai_proposta_azione?: string | null;
  consiglio_coach?: string | null;
  consiglio_approvato_coach?: boolean;
  giorno_destinazione?: string | number | null;
  tipo_intervento?: "spinta" | "scarico" | "consolidamento" | null;
  coach_audio_url?: string | null;
  coach_audio_base64?: string | null;
  coach_audio_durata_sec?: number | null;
  stato?: "nuovo" | "ascoltato" | "applicato" | "archiviato" | "cestino";
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
  audio_base64?: string | null;
  device_info?: string | null;
  ai_diagnosi_tecnica?: string | null;
  stato?: "aperto" | "in_valutazione" | "risolto" | "scartato" | "cestino";
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
        utente_id, email_cliente, contesto, audio_url, audio_base64, durata_sec,
        trascrizione_testo, ai_allerta, ai_sintesi, ai_proposta_azione, stato,
        consiglio_coach, consiglio_approvato_coach, giorno_destinazione, tipo_intervento,
        coach_audio_url, coach_audio_base64, coach_audio_durata_sec
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      record.utente_id || null,
      record.email_cliente || null,
      record.contesto,
      record.audio_url,
      record.audio_base64 || null,
      record.durata_sec || 0,
      record.trascrizione_testo || null,
      record.ai_allerta || "verde",
      record.ai_sintesi || null,
      record.ai_proposta_azione || null,
      record.stato || "nuovo",
      record.consiglio_coach || null,
      record.consiglio_approvato_coach ? 1 : 0,
      record.giorno_destinazione !== undefined ? record.giorno_destinazione : null,
      record.tipo_intervento || null,
      record.coach_audio_url || null,
      record.coach_audio_base64 || null,
      record.coach_audio_durata_sec || 0
    );

    const lastId = Number(info.lastInsertRowid);
    const getStmt = db.prepare("SELECT * FROM audio_note_feedback WHERE id = ?");
    const row = getStmt.get(lastId) as any;
    db.close();

    // Aggiorna anche store in memoria
    if (row) {
      inMemoryAudioNotes.unshift(row);
    }
    return row || record;
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
      if (filter.stato === "tutti") {
        query += " AND stato != 'cestino'";
      } else if (filter.stato === "gestito") {
        query += " AND stato IN ('ascoltato', 'applicato', 'archiviato')";
      } else {
        query += " AND stato = ?";
        params.push(filter.stato);
      }
    }
    if (filter?.email) {
      query += " AND email_cliente = ?";
      params.push(filter.email);
    }
    query += " ORDER BY id DESC";

    const rows = db.prepare(query).all(...params) as any[];
    db.close();
    return rows || [];
  }

  return inMemoryAudioNotes.filter((n) => {
    if (filter?.contesto && n.contesto !== filter.contesto) return false;
    if (filter?.stato) {
      if (filter.stato === "tutti") return n.stato !== "cestino";
      if (filter.stato === "gestito") return ["ascoltato", "applicato", "archiviato"].includes(n.stato);
      if (n.stato !== filter.stato) return false;
    }
    if (filter?.email && n.email_cliente !== filter.email) return false;
    return true;
  });
}

export function updateAudioNoteStatus(
  id: number,
  stato: "nuovo" | "ascoltato" | "applicato" | "archiviato" | "cestino",
  extraData: {
    consiglio_coach?: string;
    consiglio_approvato_coach?: boolean;
    giorno_destinazione?: string | number;
    tipo_intervento?: string;
    coach_audio_url?: string | null;
    coach_audio_base64?: string | null;
    coach_audio_durata_sec?: number | null;
  } = {}
): AudioNoteRecord | null {
  const db = getDb();
  if (db) {
    if (extraData.consiglio_coach !== undefined || extraData.coach_audio_base64 !== undefined || extraData.coach_audio_url !== undefined) {
      db.prepare(`
        UPDATE audio_note_feedback 
        SET stato = ?, consiglio_coach = ?, consiglio_approvato_coach = ?, giorno_destinazione = ?, tipo_intervento = ?,
            coach_audio_url = COALESCE(?, coach_audio_url),
            coach_audio_base64 = COALESCE(?, coach_audio_base64),
            coach_audio_durata_sec = COALESCE(?, coach_audio_durata_sec)
        WHERE id = ?
      `).run(
        stato,
        extraData.consiglio_coach !== undefined ? extraData.consiglio_coach : null,
        extraData.consiglio_approvato_coach ? 1 : 0,
        extraData.giorno_destinazione ? String(extraData.giorno_destinazione) : null,
        extraData.tipo_intervento || null,
        extraData.coach_audio_url !== undefined ? extraData.coach_audio_url : null,
        extraData.coach_audio_base64 !== undefined ? extraData.coach_audio_base64 : null,
        extraData.coach_audio_durata_sec !== undefined ? extraData.coach_audio_durata_sec : null,
        id
      );
    } else {
      const stmt = db.prepare("UPDATE audio_note_feedback SET stato = ? WHERE id = ?");
      stmt.run(stato, id);
    }
    const row = db.prepare("SELECT * FROM audio_note_feedback WHERE id = ?").get(id) as any;
    db.close();

    const mem = inMemoryAudioNotes.find((n) => n.id === id);
    if (mem) {
      mem.stato = stato;
      if (extraData.consiglio_coach !== undefined) mem.consiglio_coach = extraData.consiglio_coach;
      if (extraData.consiglio_approvato_coach !== undefined) mem.consiglio_approvato_coach = extraData.consiglio_approvato_coach;
      if (extraData.giorno_destinazione !== undefined) mem.giorno_destinazione = extraData.giorno_destinazione;
      if (extraData.tipo_intervento !== undefined) mem.tipo_intervento = extraData.tipo_intervento;
      if (extraData.coach_audio_url !== undefined) mem.coach_audio_url = extraData.coach_audio_url;
      if (extraData.coach_audio_base64 !== undefined) mem.coach_audio_base64 = extraData.coach_audio_base64;
      if (extraData.coach_audio_durata_sec !== undefined) mem.coach_audio_durata_sec = extraData.coach_audio_durata_sec;
    }
    return row || null;
  }

  const found = inMemoryAudioNotes.find((n) => n.id === id);
  if (found) {
    found.stato = stato;
    if (extraData.consiglio_coach !== undefined) found.consiglio_coach = extraData.consiglio_coach;
    if (extraData.consiglio_approvato_coach !== undefined) found.consiglio_approvato_coach = extraData.consiglio_approvato_coach;
    if (extraData.giorno_destinazione !== undefined) found.giorno_destinazione = extraData.giorno_destinazione;
    if (extraData.tipo_intervento !== undefined) found.tipo_intervento = extraData.tipo_intervento;
    if (extraData.coach_audio_url !== undefined) found.coach_audio_url = extraData.coach_audio_url;
    if (extraData.coach_audio_base64 !== undefined) found.coach_audio_base64 = extraData.coach_audio_base64;
    if (extraData.coach_audio_durata_sec !== undefined) found.coach_audio_durata_sec = extraData.coach_audio_durata_sec;
  }
  return found || null;
}

export function deleteAudioNotePermanently(id: number): boolean {
  const db = getDb();
  if (db) {
    try {
      db.prepare("DELETE FROM audio_note_feedback WHERE id = ?").run(id);
      db.close();
    } catch {}
  }
  const idx = inMemoryAudioNotes.findIndex((n) => n.id === id);
  if (idx !== -1) inMemoryAudioNotes.splice(idx, 1);
  return true;
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
        descrizione, audio_id, audio_base64, device_info, ai_diagnosi_tecnica, stato
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      record.anonimo ? null : record.utente_id || null,
      record.anonimo ? null : record.email_cliente || null,
      record.anonimo ? 1 : 0,
      record.tipo || "consiglio",
      record.titolo,
      record.descrizione,
      record.audio_id || null,
      record.audio_base64 || null,
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

    if (row) {
      inMemoryBugs.unshift(row);
    }
    return row || record;
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
      if (filter.stato === "tutti") {
        query += " AND s.stato != 'cestino'";
      } else if (filter.stato === "gestito") {
        query += " AND s.stato IN ('in_valutazione', 'risolto', 'scartato')";
      } else {
        query += " AND s.stato = ?";
        params.push(filter.stato);
      }
    }
    if (filter?.tipo) {
      query += " AND s.tipo = ?";
      params.push(filter.tipo);
    }
    query += " ORDER BY s.id DESC";

    const rows = db.prepare(query).all(...params) as any[];
    db.close();
    return rows || [];
  }

  return inMemoryBugs.filter((b) => {
    if (filter?.stato) {
      if (filter.stato === "tutti") return b.stato !== "cestino";
      if (filter.stato === "gestito") return ["in_valutazione", "risolto", "scartato"].includes(b.stato);
      if (b.stato !== filter.stato) return false;
    }
    if (filter?.tipo && b.tipo !== filter.tipo) return false;
    return true;
  });
}

export function updateAppSegnalazioneStatus(
  id: number,
  stato: "aperto" | "in_valutazione" | "risolto" | "scartato" | "cestino"
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

    const mem = inMemoryBugs.find((b) => b.id === id);
    if (mem) mem.stato = stato;
    return row || null;
  }

  const found = inMemoryBugs.find((b) => b.id === id);
  if (found) found.stato = stato;
  return found || null;
}

export function deleteAppSegnalazionePermanently(id: number): boolean {
  const db = getDb();
  if (db) {
    try {
      db.prepare("DELETE FROM app_segnalazioni_bug WHERE id = ?").run(id);
      db.close();
    } catch {}
  }
  const idx = inMemoryBugs.findIndex((b) => b.id === id);
  if (idx !== -1) inMemoryBugs.splice(idx, 1);
  return true;
}

export function emptyAudioNotesTrash(): boolean {
  const db = getDb();
  if (db) {
    try {
      db.prepare("DELETE FROM audio_note_feedback WHERE stato = 'cestino'").run();
      db.close();
    } catch {}
  }
  inMemoryAudioNotes = inMemoryAudioNotes.filter((n) => n.stato !== "cestino");
  return true;
}

export function emptyAppSegnalazioniTrash(): boolean {
  const db = getDb();
  if (db) {
    try {
      db.prepare("DELETE FROM app_segnalazioni_bug WHERE stato = 'cestino'").run();
      db.close();
    } catch {}
  }
  inMemoryBugs = inMemoryBugs.filter((b) => b.stato !== "cestino");
  return true;
}
