import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import defaultData from "./demo-data.json";
import { analyzeAudioWithGemini, fallbackClinicalAnalysis } from "./server/ai-audio-analyzer";
import { parseVoiceWorkoutSet } from "./server/voice-set-parser";
import {
  insertAudioNote,
  getAudioNotes,
  updateAudioNoteStatus,
  updateAudioNoteAnalysis,
  deleteAudioNotePermanently,
  insertAppSegnalazione,
  getAppSegnalazioni,
  updateAppSegnalazioneStatus,
  deleteAppSegnalazionePermanently,
  setMemoryStore,
} from "./server/audio-feedback-repo";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_SANDBOX = process.env.AREA46_MODE === "sandbox" || process.env.SANDBOX === "true";
const SANDBOX_FILE = path.resolve(__dirname, "data", "sandbox-data.json");
const TMP_DATA_FILE = IS_SANDBOX ? "/tmp/sandbox-data.json" : "/tmp/demo-data.json";

export function isBookingIdCancelled(id: any, cancelledList?: any[]): boolean {
  if (!id || !cancelledList || !Array.isArray(cancelledList) || cancelledList.length === 0) return false;
  const raw = String(id).trim();
  const clean = raw.startsWith("lab_") ? raw.slice(4) : raw;
  const lab = raw.startsWith("lab_") ? raw : `lab_${raw}`;
  return cancelledList.includes(raw) || cancelledList.includes(clean) || cancelledList.includes(lab);
}

export function parseSafeDate(iso: any): Date {
  if (!iso) return new Date(0);
  if (typeof iso === "string" && (iso.includes("T") || iso.includes("-") || iso.includes("/"))) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  const num = typeof iso === "number" ? iso : parseFloat(String(iso));
  if (!isNaN(num) && num > 20000 && num < 70000) {
    const epochMs = (num - 25569) * 86400 * 1000;
    const d = new Date(epochMs);
    if (!isNaN(d.getTime())) return d;
  }
  const fallback = new Date(iso);
  return isNaN(fallback.getTime()) ? new Date(0) : fallback;
}

function loadData() {
  let loaded: any = null;
  if (IS_SANDBOX && fs.existsSync(SANDBOX_FILE)) {
    try {
      const raw = fs.readFileSync(SANDBOX_FILE, "utf-8");
      return JSON.parse(raw);
    } catch {}
  }

  // 1. Inizializza con defaultData come template base
  try {
    loaded = JSON.parse(JSON.stringify(defaultData));
  } catch {
    loaded = {
      livelli: [],
      ordine_livelli: [],
      database_esercizi: [],
      allenamenti: [],
      diario_utente: [],
      stato_allenamenti: [],
      preferenze_utente: [],
      profili_utenti: [],
      configurazione_lab: {},
      prenotazioni_slot: [],
      tariffario_pacchetti: [],
      transazioni_pagamenti: [],
      movimenti_crediti: [],
      eccezioni_calendario: [],
      attivita_lab: [],
      regole_palinsesto: [],
      active_user_id: "usr-atleta-01",
    };
  }

  // 2. VAULT AS SINGLE SOURCE OF TRUTH (Priorità Assoluta al Boot!)
  const vaultCandidates = [
    path.resolve(process.cwd(), "data", "vault"),
    path.resolve(__dirname, "data", "vault"),
    path.resolve(__dirname, "..", "data", "vault"),
  ];
  const vaultDir = vaultCandidates.find((p) => fs.existsSync(p));

  if (vaultDir) {
    try {
      // Modulo 1: Utenti, Crediti, Transazioni
      const mod1File = path.join(vaultDir, "1_gestionale_utenti_crediti.json");
      if (fs.existsSync(mod1File)) {
        const mod1 = JSON.parse(fs.readFileSync(mod1File, "utf-8"));
        if (Array.isArray(mod1.profili_utenti) && mod1.profili_utenti.length > 0) {
          loaded.profili_utenti = mod1.profili_utenti;
        }
        if (Array.isArray(mod1.movimenti_crediti)) loaded.movimenti_crediti = mod1.movimenti_crediti;
        if (Array.isArray(mod1.transazioni_pagamenti)) loaded.transazioni_pagamenti = mod1.transazioni_pagamenti;
        if (Array.isArray(mod1.transazioni_cancellate)) loaded.transazioni_cancellate = mod1.transazioni_cancellate;
        if (Array.isArray(mod1.utenti_cancellati)) loaded.utenti_cancellati = mod1.utenti_cancellati;
        if (Array.isArray(mod1.tariffario_pacchetti)) loaded.tariffario_pacchetti = mod1.tariffario_pacchetti;
      }

      // Modulo 2: Calendario, Slot ed Eccezioni (PROTEZIONE AUREA)
      const mod2File = path.join(vaultDir, "2_gestionale_calendario.json");
      if (fs.existsSync(mod2File)) {
        const mod2 = JSON.parse(fs.readFileSync(mod2File, "utf-8"));
        if (Array.isArray(mod2.prenotazioni_slot)) loaded.prenotazioni_slot = mod2.prenotazioni_slot;
        if (Array.isArray(mod2.prenotazioni_cancellate)) loaded.prenotazioni_cancellate = mod2.prenotazioni_cancellate;
        if (Array.isArray(mod2.eccezioni_calendario) && mod2.eccezioni_calendario.length > 0) {
          loaded.eccezioni_calendario = mod2.eccezioni_calendario;
        }
        if (Array.isArray(mod2.regole_palinsesto)) loaded.regole_palinsesto = mod2.regole_palinsesto;
        if (Array.isArray(mod2.richieste_cancellazione_tardiva)) loaded.richieste_cancellazione_tardiva = mod2.richieste_cancellazione_tardiva;
      }

      // Modulo 3: Diario e Allenamenti Atleti
      const mod3File = path.join(vaultDir, "3_atleti_diario_progressi.json");
      if (fs.existsSync(mod3File)) {
        const mod3 = JSON.parse(fs.readFileSync(mod3File, "utf-8"));
        if (Array.isArray(mod3.diario_utente)) loaded.diario_utente = mod3.diario_utente;
        if (Array.isArray(mod3.stato_allenamenti)) loaded.stato_allenamenti = mod3.stato_allenamenti;
        if (Array.isArray(mod3.preferenze_utente)) loaded.preferenze_utente = mod3.preferenze_utente;
      }
    } catch (vErr) {
      console.warn("⚠️ [VAULT BOOT LOADER] Avviso lettura vault:", vErr);
    }
  }

  // 3. Se esiste TMP_DATA_FILE con mutazioni recenti valide, unisci stati
  if (fs.existsSync(TMP_DATA_FILE)) {
    try {
      const raw = fs.readFileSync(TMP_DATA_FILE, "utf-8");
      const tmpData = JSON.parse(raw);
      if (tmpData && typeof tmpData === "object") {
        if (Array.isArray(tmpData.eccezioni_calendario) && tmpData.eccezioni_calendario.length >= (loaded.eccezioni_calendario || []).length) {
          loaded.eccezioni_calendario = tmpData.eccezioni_calendario;
        }
        if (Array.isArray(tmpData.prenotazioni_slot) && tmpData.prenotazioni_slot.length >= (loaded.prenotazioni_slot || []).length) {
          loaded.prenotazioni_slot = tmpData.prenotazioni_slot;
        }
      }
    } catch {}
  }

  // Salvaguardia metodologia: mai permettere a un file temporaneo stantio di declassare i parametri degli allenamenti
  if (defaultData && Array.isArray((defaultData as any).allenamenti)) {
    const defaultAllenamenti = (defaultData as any).allenamenti;
    const defaultMissing = defaultAllenamenti.filter((a: any) => !(a.parametri || "").trim()).length;
    const loadedMissing = (loaded.allenamenti || []).filter((a: any) => !(a.parametri || "").trim()).length;
    if (defaultMissing < loadedMissing || !loaded.allenamenti || loaded.allenamenti.length < defaultAllenamenti.length) {
      loaded.allenamenti = JSON.parse(JSON.stringify(defaultAllenamenti));
    }
  }

  if (loaded.utenti_cancellati && Array.isArray(loaded.utenti_cancellati)) {
    const delUsers = loaded.utenti_cancellati;
    loaded.profili_utenti = (loaded.profili_utenti || []).filter(
      (p: any) => !delUsers.includes(p.id) && !delUsers.includes(p.email?.toLowerCase())
    );
  }
  if (loaded.prenotazioni_cancellate && Array.isArray(loaded.prenotazioni_cancellate)) {
    const delBks = loaded.prenotazioni_cancellate;
    loaded.prenotazioni_slot = (loaded.prenotazioni_slot || []).filter(
      (p: any) => !isBookingIdCancelled(p.id, delBks)
    );
  }
  loaded.richieste_cancellazione_tardiva = loaded.richieste_cancellazione_tardiva || [];
  loaded.shadow_event_log = loaded.shadow_event_log || [];
  loaded.audio_note_feedback = loaded.audio_note_feedback || [];
  loaded.app_segnalazioni_bug = loaded.app_segnalazioni_bug || [];
  try {
    setMemoryStore(loaded.audio_note_feedback, loaded.app_segnalazioni_bug);
  } catch {}
  return loaded;
}

function mergeStati(baseList: any[], incomingList: any[]): any[] {
  const map = new Map<string, any>();
  const makeKey = (item: any) =>
    `${(item?.email_cliente || "").trim().toLowerCase()}__${item?.livello || ""}__${item?.giorno}`;

  for (const item of (baseList || [])) {
    if (!item || !item.email_cliente) continue;
    map.set(makeKey(item), item);
  }

  for (const item of (incomingList || [])) {
    if (!item || !item.email_cliente) continue;
    const key = makeKey(item);
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      const existing = map.get(key);
      const existingTime = new Date(existing.updated_at || 0).getTime();
      const incomingTime = new Date(item.updated_at || 0).getTime();
      if (incomingTime >= existingTime) {
        map.set(key, item);
      }
    }
  }

  return Array.from(map.values());
}

let gdriveSyncQueue: Promise<void> = Promise.resolve();
let pendingSyncDb: any = null;

function queueDriveSync(data: any): Promise<void> {
  pendingSyncDb = data;
  gdriveSyncQueue = gdriveSyncQueue
    .catch(() => {})
    .then(async () => {
      if (!pendingSyncDb) return;
      const snapshot = pendingSyncDb;
      pendingSyncDb = null;
      await syncDataToGoogleDrive(snapshot);
    })
    .catch(() => {});
  return gdriveSyncQueue;
}

let lastAutoBackupTime = 0;

function validateDataIntegrity(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  // Guardrail 1: controllo profili utenti minimi (impedisce azzeramento anagrafiche e crediti)
  if (Array.isArray(data.profili_utenti) && data.profili_utenti.length < 3) {
    console.error(`🚨 [AREA46 SAFETY LOCK] Tentativo di salvataggio anomalo: solo ${data.profili_utenti.length} utenti trovati. Salvataggio bloccato per protezione dati!`);
    return false;
  }
  // Guardrail 2: controllo catalogo esercizi
  if (Array.isArray(data.database_esercizi) && data.database_esercizi.length < 30) {
    console.error(`🚨 [AREA46 SAFETY LOCK] Tentativo di salvataggio anomalo: solo ${data.database_esercizi.length} esercizi trovati. Salvataggio bloccato!`);
    return false;
  }
  // Guardrail 3: salvaguardia eccezioni calendario (impedisce regressione/svuotamento eccezioni)
  if (data && Array.isArray(data.eccezioni_calendario)) {
    try {
      const vaultCandidates = [
        path.resolve(__dirname, "data", "vault", "2_gestionale_calendario.json"),
        path.resolve(__dirname, "..", "data", "vault", "2_gestionale_calendario.json"),
      ];
      const vaultFile = vaultCandidates.find((p) => fs.existsSync(p));
      if (vaultFile) {
        const vRaw = fs.readFileSync(vaultFile, "utf-8");
        const vData = JSON.parse(vRaw);
        const vCount = (vData.eccezioni_calendario || []).length;
        if (vCount > 10 && data.eccezioni_calendario.length < Math.floor(vCount * 0.5)) {
          console.error(`🚨 [AREA46 SAFETY LOCK] Tentativo anomalo di azzeramento eccezioni calendario: ${data.eccezioni_calendario.length} presenti vs ${vCount} nel vault. Salvataggio bloccato per protezione calendario!`);
          return false;
        }
      }
    } catch {}
  }
  return true;
}

const SHADOW_LOG_LIMIT = 1000;
function logShadowEvent(eventType: string, athleteIdOrEmail: string, payload: Record<string, any> = {}) {
  try {
    if (!db) return;
    db.shadow_event_log = db.shadow_event_log || [];
    const event = {
      id: `shd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      event_type: eventType,
      athlete: athleteIdOrEmail || "anonymous",
      payload,
    };
    db.shadow_event_log.unshift(event);
    if (db.shadow_event_log.length > SHADOW_LOG_LIMIT) {
      db.shadow_event_log.length = SHADOW_LOG_LIMIT;
    }

    const v2Endpoint = process.env.SHADOW_V2_ENDPOINT || db.configurazione_lab?.shadow_v2_url;
    if (v2Endpoint && typeof fetch === "function") {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      fetch(v2Endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        signal: controller.signal,
      })
        .catch(() => {})
        .finally(() => clearTimeout(timeoutId));
    }
  } catch {
    // Fail-safe
  }
}

const processedWebhooks = new Map<string, number>();
function isWebhookDuplicate(eventId: string): boolean {
  if (!eventId) return false;
  const now = Date.now();
  for (const [id, ts] of processedWebhooks.entries()) {
    if (now - ts > 10 * 60 * 1000) processedWebhooks.delete(id);
  }
  if (processedWebhooks.has(eventId)) return true;
  processedWebhooks.set(eventId, now);
  return false;
}

function saveData(data: any, skipCloudSync = false): Promise<void> {
  if (!validateDataIntegrity(data)) {
    console.warn("⚠️ [AREA46 SAFETY LOCK] Scrittura su disco e cloud ignorata a causa del fallimento delle regole di integrità.");
    return Promise.resolve();
  }

  db = data;
  if (IS_SANDBOX) {
    try {
      fs.writeFileSync(SANDBOX_FILE, JSON.stringify(data, null, 2), "utf-8");
      fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch {}
    return Promise.resolve(); // Isolamento assoluto: nessun tocco a demo-data.json reale né sincronizzazione Google Drive!
  }

  try {
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Ignore in read-only / restricted environments
  }
  try {
    const directPath = path.resolve(__dirname, "demo-data.json");
    const parentPath = path.resolve(__dirname, "..", "demo-data.json");
    const destPath = fs.existsSync(directPath) ? directPath : fs.existsSync(parentPath) ? parentPath : null;
    if (destPath) {
      const sanitized = JSON.parse(JSON.stringify(data));
      if (sanitized.configurazione_lab && sanitized.configurazione_lab.stripe_secret_key) {
        sanitized.configurazione_lab.stripe_secret_key = "";
      }
      fs.writeFileSync(destPath, JSON.stringify(sanitized, null, 2), "utf-8");
      
      // Allinea moduli vault
      try {
        const vaultDir = path.resolve(path.dirname(destPath), "data", "vault");
        if (fs.existsSync(vaultDir)) {
          const mod1 = {
            profili_utenti: data.profili_utenti || [],
            movimenti_crediti: data.movimenti_crediti || [],
            transazioni_pagamenti: data.transazioni_pagamenti || [],
            transazioni_cancellate: data.transazioni_cancellate || [],
            utenti_cancellati: data.utenti_cancellati || [],
            tariffario_pacchetti: data.tariffario_pacchetti || [],
          };
          fs.writeFileSync(path.join(vaultDir, "1_gestionale_utenti_crediti.json"), JSON.stringify(mod1, null, 2), "utf-8");

          const mod2 = {
            prenotazioni_slot: data.prenotazioni_slot || [],
            prenotazioni_cancellate: data.prenotazioni_cancellate || [],
            eccezioni_calendario: data.eccezioni_calendario || [],
            regole_palinsesto: data.regole_palinsesto || [],
            richieste_cancellazione_tardiva: data.richieste_cancellazione_tardiva || [],
          };
          fs.writeFileSync(path.join(vaultDir, "2_gestionale_calendario.json"), JSON.stringify(mod2, null, 2), "utf-8");

          const modDiario = {
            diario_utente: data.diario_utente || [],
            stato_allenamenti: data.stato_allenamenti || [],
            preferenze_utente: data.preferenze_utente || [],
            audio_note_feedback: data.audio_note_feedback || [],
            app_segnalazioni_bug: data.app_segnalazioni_bug || [],
          };
          fs.writeFileSync(path.join(vaultDir, "3_atleti_diario_progressi.json"), JSON.stringify(modDiario, null, 2), "utf-8");

          const mod4 = {
            database_esercizi: data.database_esercizi || [],
            livelli: data.livelli || [],
            ordine_livelli: data.ordine_livelli || [],
          };
          fs.writeFileSync(path.join(vaultDir, "4_metodologia_esercizi.json"), JSON.stringify(mod4, null, 2), "utf-8");
        }
      } catch {}
      
      // Auto-backup periodico ogni 4 ore in ambiente locale
      const now = Date.now();
      if (now - lastAutoBackupTime > 4 * 3600 * 1000) {
        lastAutoBackupTime = now;
        const bkpDir = path.resolve(path.dirname(destPath), "backups");
        if (fs.existsSync(bkpDir)) {
          const bkpFile = path.join(bkpDir, `auto_backup_${new Date().toISOString().slice(0, 10)}.json`);
          fs.writeFileSync(bkpFile, JSON.stringify(data, null, 2), "utf-8");
        }
      }
    }
  } catch {
    // Read-only filesystem on Vercel lambda, expected
  }

  // Sincronizzazione cloud automatica su Google Drive con serializzazione
  if (!skipCloudSync) {
    return queueDriveSync(data).catch(() => {});
  }
  return Promise.resolve();
}

const FALLBACK_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "landmine-lab-level-pro",
  private_key_id: "f12a0fb3f48bd15c458740288a8ca0762caf0617",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDpPC+nKFWPGxvF\nFRpBUCYWNruYlikCCB4dNVFifVTkof847hde7XzLDa8s+PAfhrxbX/vxjMlI+R9i\nogLrG5p46+S1eoflGNCwedeuNgGVqW4rqw+Hs5x3RetXPHPzq0coua3IQNI6x81g\nJjXTAhM5rTa+5L0bfCu4F/tYYAuJCiNGP+amrFw+iPnZsfwowgeOJaZ07bTgifMJ\n8rDTTBomPBDfzY8oHdv4SeDYGbywIvCjgiuXkF+649RpLLuRtk7rLL/9w7tXi35w\n1LdFbilaHA6bq4c4OJLZKT1j5T39EKshmuXLRzT2VZ1otv/RA4sZW27vmZTw+JNj\n0kj60G3/AgMBAAECggEACIX9i9NKhSdNdX9W7UobijZH1sSuDPf0+cZIChxgbNaK\nuC7jRcHSDK2cWD1ksRJAceppD6PAe103S2h2SNdCZubf/c3Th4jHn5tkSWaJ2klN\n0GS49ZGXxzgT6KU564631AItGqNby3AfzkK3NtXdk/8DgChlzMpV4q1lrw4bfc+C\nKPdIXYLP8M+MvjjoFpo+IIIGbL5Y1r+etmjLaOcJ6M23fPZ0vuS3RBcQoSltOpZi\nyXLegBuQrq+3W+3VOWzaPyh2VxmBkzvkmEGSb3nITzlCjC6qu1HFZIydH4T6IR19\npeIKqFm5HfG3wsS60iVNl8pjUuzBBfYLb27+eosISQKBgQD+Drnuv6w2R4Vk+Z1C\nb0THh8i65HDDyVL6DFR7tQ+T6s8K4g0VRsUSspS7JoIvfs6DlBDuAxLtxn5knsZG\nr/U0o6Nh7/GhaNkicuD4hKItSqWZURo1tnTqP2ZL+MQczpUEHlA+tgoHtEaYTPr1\n2ZWdjXYk9KxXnNDmT9F2amxg/QKBgQDrBLQb8jR5znNUH+5tB83ERg2CMjxs27w2\n4GIMUZot9Viu6SDQh7llrBJ92mrv2Z1kNMiTGBBVY2ljAHc4yE5yCNLaoH1EExiQ\nWhKrS01X/A4NPZxxrpqk00RryuQ9f1T719IhbeqbtdZmbrwwkR9/wta9YyKwlf3X\nCNdAfunJqwKBgC6gjUdgLj8YCUdq+I3E1h64sQJ8AqYsQOpbcPXzWRSQt8cLjdMl\n1e2EkP94JdSJtWU4u5KzRboWAAR/j2xRxvMORWIoI3S4RYGpC9kQnqMpXBMza1gI\nUJTdZezzjyqqT3ceCSQ5TMX1NC+nkTel42uzFsfZj/fUdBKQ+6R8C8ARAoGBAJ7z\nhnFkRhOgCyZ5lkONxKCcFKTbHz0s/MZMymO0iUfOKZXbPQNs2Hqof7U5FZx1HVtZ\ny9KYsutdmjiIZxozd8LurtWJOE/jbnirQvcxrfT1F/filL3aruMNtLgG+ImTZkIS\n/R74/XUk7gZHnOZoMNqzR5O9ygeO2qkmZJdNfweTAoGASpJvdiWY0OBlF4DlkXsC\nycgiiqzqhIM1di1IcaDg3yFm1bVl6ybU73Bj+8QRqI8Lt59+vmKSWh3vc/Oa6Bgv\n6JptY/0yFilq2AAWH4NEAuYdH4FuPKcjcLCHYsOZiemwKY4sMIZkMN9vnOQdUeEH\npoUCIINFimi2Qu2AFcE+w2k=\n-----END PRIVATE KEY-----\n",
  client_email: "bot-allenamenti@landmine-lab-level-pro.iam.gserviceaccount.com",
  client_id: "102154547582805007074",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/bot-allenamenti%40landmine-lab-level-pro.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

const CREDENZIALI_PATH = fs.existsSync(path.resolve(__dirname, "credenziali.json"))
  ? path.resolve(__dirname, "credenziali.json")
  : path.resolve(__dirname, "..", "credenziali.json");
const GDRIVE_DEMO_DATA_ID = "129ts4wdwsypvWCB2cBHXWw3WTIKmtktA";

function base64url(str: string) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleDriveAccessToken() {
  let creds: any = null;
  if (fs.existsSync(CREDENZIALI_PATH)) {
    try {
      creds = JSON.parse(fs.readFileSync(CREDENZIALI_PATH, "utf-8"));
    } catch {}
  }
  if (!creds && process.env.GOOGLE_SERVICE_ACCOUNT) {
    try {
      creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    } catch {}
  }
  if (!creds) {
    creds = FALLBACK_SERVICE_ACCOUNT;
  }
  if (!creds || !creds.client_email || !creds.private_key) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: creds.token_uri,
      exp: now + 3600,
      iat: now,
    };
    const signInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signInput);
    const jwt = `${signInput}.${signer.sign(creds.private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;

    const res = await fetch(creds.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch {
    return null;
  }
}

const GCAL_CALENDAR_ID = "firenzepersonaltrainer@gmail.com";

async function getGoogleCalendarAccessToken(): Promise<string | null> {
  let creds: any = null;
  if (fs.existsSync(CREDENZIALI_PATH)) {
    try {
      creds = JSON.parse(fs.readFileSync(CREDENZIALI_PATH, "utf-8"));
    } catch {}
  }
  if (!creds && process.env.GOOGLE_SERVICE_ACCOUNT) {
    try {
      creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    } catch {}
  }
  if (!creds) {
    creds = FALLBACK_SERVICE_ACCOUNT;
  }
  if (!creds || !creds.client_email || !creds.private_key) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
      aud: creds.token_uri,
      exp: now + 3600,
      iat: now,
    };
    const signInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signInput);
    const jwt = `${signInput}.${signer.sign(creds.private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;

    const res = await fetch(creds.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) {
      console.error("[GCAL AUTH] Errore richiesta token:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.error("[GCAL AUTH ERROR]", err);
    return null;
  }
}

function calculateSlotEndTime(startTime: string): string {
  try {
    const parts = startTime.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || "0", 10);
    const tot = h * 60 + m + 15;
    const endH = Math.floor(tot / 60) % 24;
    const endM = tot % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  } catch {
    return startTime;
  }
}

function getRomeOffsetString(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      timeZoneName: "shortOffset",
    }).formatToParts(d);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "";
    const match = tzPart.match(/([+-]\d+)/);
    if (match) {
      const h = parseInt(match[1], 10);
      const sign = h >= 0 ? "+" : "-";
      return `${sign}${String(Math.abs(h)).padStart(2, "0")}:00`;
    }
  } catch {}
  return "+01:00";
}

export async function createGoogleCalendarLabSlot(slot: {
  bookingId: string;
  data: string;
  orario: string;
  nomeCliente: string;
  emailCliente?: string;
  note?: string;
}): Promise<string | null> {
  try {
    const token = await getGoogleCalendarAccessToken();
    if (!token) return null;

    const endOrario = calculateSlotEndTime(slot.orario);
    const summary = `🏋️ [LAB] ${slot.nomeCliente || "Atleta Landmine"}`;
    const description = `Prenotazione slot da Area46 Landmine Lab\nAtleta: ${slot.nomeCliente || "Atleta"}\nEmail: ${slot.emailCliente || ""}\nNote: ${slot.note || "Nessuna"}\n[ID Prenotazione: ${slot.bookingId}]`;
    const romeOffset = getRomeOffsetString(slot.data);

    const payload = {
      summary,
      description,
      colorId: "6", // Tangerine / Arancione Google Calendar
      start: {
        dateTime: `${slot.data}T${slot.orario}:00${romeOffset}`,
        timeZone: "Europe/Rome",
      },
      end: {
        dateTime: `${slot.data}T${endOrario}:00${romeOffset}`,
        timeZone: "Europe/Rome",
      },
      extendedProperties: {
        private: {
          origin: "AREA46_LAB",
          booking_id: slot.bookingId,
          athlete_name: slot.nomeCliente || "",
        },
      },
    };

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[GCAL SYNC] Creato slot arancione 15m (${slot.data} ${slot.orario}-${endOrario}) per ${slot.nomeCliente}. EventId: ${data.id}`);
      return data.id || null;
    } else {
      console.error(`[GCAL SYNC ERROR] Errore creazione evento: ${res.status}`, await res.text());
      return null;
    }
  } catch (err) {
    console.error("[GCAL SYNC ERROR] Eccezione:", err);
    return null;
  }
}

export async function deleteGoogleCalendarLabSlot(
  googleEventId?: string,
  fallbackInfo?: { data: string; orario: string; nomeCliente: string; bookingId?: string }
): Promise<boolean> {
  try {
    const token = await getGoogleCalendarAccessToken();
    if (!token) return false;

    let directDeleted = false;
    if (googleEventId) {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events/${googleEventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200 || res.status === 204 || res.status === 404 || res.status === 410) {
        console.log(`[GCAL DELETE OK] Evento ${googleEventId} cancellato con successo da Google Calendar (chiamata diretta)`);
        directDeleted = true;
        return true;
      } else {
        console.warn(`[GCAL DELETE WARNING] DELETE diretta non completata (${res.status}) per EventId: ${googleEventId}, avvio fallback...`);
      }
    }

    if (!directDeleted && fallbackInfo?.data) {
      const timeMin = `${fallbackInfo.data}T00:00:00Z`;
      const timeMax = `${fallbackInfo.data}T23:59:59Z`;
      const searchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=250`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const startTarget = fallbackInfo.orario ? `${fallbackInfo.data}T${fallbackInfo.orario}` : "";
        const cleanName = (fallbackInfo.nomeCliente || "").toLowerCase().trim();

        for (const it of searchData.items || []) {
          if (it.status === "cancelled") continue;

          const priv = it.extendedProperties?.private || {};
          const itBookingId = priv.booking_id || priv.slot_id;
          const descHasBookingId = fallbackInfo.bookingId && (it.description || "").includes(fallbackInfo.bookingId);
          const bookingIdMatch = fallbackInfo.bookingId && (itBookingId === fallbackInfo.bookingId || descHasBookingId);

          const timeMatch = startTarget && it.start?.dateTime?.startsWith(startTarget);
          const summaryLower = (it.summary || "").toLowerCase();
          const nameMatch = cleanName && (summaryLower.includes(cleanName) || cleanName.includes(summaryLower.replace("🏋️ [lab]", "").trim()));

          if (bookingIdMatch || (timeMatch && nameMatch)) {
            const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events/${it.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (delRes.status === 200 || delRes.status === 204 || delRes.status === 404 || delRes.status === 410) {
              console.log(`[GCAL DELETE OK] Evento ${it.id} (${it.summary}) cancellato con successo da Google Calendar (fallback search)`);
              return true;
            } else {
              console.error(`[GCAL DELETE ERROR] Errore cancellazione evento fallback ${it.id}: status ${delRes.status}`);
            }
          }
        }
      }
    }
    return true;
  } catch (err) {
    console.error("[GCAL SYNC DELETE ERROR]", err);
    return false;
  }
}

export async function updateGoogleCalendarLabSlot(
  googleEventId?: string,
  updates?: {
    data?: string;
    orario?: string;
    nomeCliente?: string;
    note?: string;
  }
): Promise<boolean> {
  if (!googleEventId || !updates) return false;
  try {
    const token = await getGoogleCalendarAccessToken();
    if (!token) return false;

    const patchBody: any = {};
    if (updates.nomeCliente) {
      patchBody.summary = `🏋️ [LAB] ${updates.nomeCliente}`;
    }
    if (updates.data && updates.orario) {
      const endTime = calculateSlotEndTime(updates.orario);
      patchBody.start = {
        dateTime: `${updates.data}T${updates.orario}:00+01:00`,
        timeZone: "Europe/Rome",
      };
      patchBody.end = {
        dateTime: `${updates.data}T${endTime}:00+01:00`,
        timeZone: "Europe/Rome",
      };
    }
    if (updates.note !== undefined) {
      patchBody.description = `Prenotazione slot da Area46 Landmine Lab\nAtleta: ${updates.nomeCliente || "Atleta"}\nNote: ${updates.note || "Nessuna"}`;
    }

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events/${googleEventId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patchBody),
    });

    if (res.ok) {
      console.log(`[GCAL UPDATE OK] Evento ${googleEventId} aggiornato con successo su Google Calendar (${updates.data || ""} ${updates.orario || ""})`);
      return true;
    } else {
      console.warn(`[GCAL UPDATE WARNING] Status ${res.status} durante update di ${googleEventId}:`, await res.text());
      return false;
    }
  } catch (err) {
    console.error("[GCAL UPDATE ERROR]", err);
    return false;
  }
}

export async function cleanupOrphanLabSlots(): Promise<{ checked: number; deleted: number; errors: number; details: string[] }> {
  const result = { checked: 0, deleted: 0, errors: 0, details: [] as string[] };
  try {
    const token = await getGoogleCalendarAccessToken();
    if (!token) {
      result.details.push("Token Google Calendar non disponibile");
      return result;
    }

    const db = loadData();
    const confirmedSlots = (db.prenotazioni_slot || []).filter(
      (p: any) => p && (p.stato === "confermata" || p.stato === "CONFIRMED" || p.stato === "CONFERMATA")
    );
    const activeBookingIds = new Set(confirmedSlots.map((p: any) => p.id));
    const activeGcalIds = new Set(confirmedSlots.map((p: any) => p.google_event_id).filter(Boolean));
    const cancelledBookingIds = new Set([
      ...(db.prenotazioni_cancellate || []),
      ...(db.prenotazioni_slot || [])
        .filter((p: any) => p && (p.stato === "cancellata" || p.stato === "CANCELLED"))
        .map((p: any) => p.id)
    ]);

    const now = new Date();
    const timeMin = new Date(now.getTime() - 7 * 86400000).toISOString();
    const timeMax = new Date(now.getTime() + 35 * 86400000).toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=250`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      result.details.push(`Errore richiesta eventi Google: ${res.status}`);
      return result;
    }

    const data = await res.json();
    const items = data.items || [];
    result.checked = items.length;

    for (const it of items) {
      if (it.status === "cancelled") continue;
      const isLab = (
        it.extendedProperties?.private?.origin === "AREA46_LAB" ||
        (it.summary && (it.summary.startsWith("🏋️") || it.summary.includes("[LAB]")))
      );
      if (!isLab) continue;

      const gcalEventId = it.id;
      const bookingId = it.extendedProperties?.private?.booking_id || it.extendedProperties?.private?.slot_id;
      const descMatch = (it.description || "").match(/\[ID Prenotazione: ([^\]]+)\]/);
      const parsedBookingId = bookingId || (descMatch ? descMatch[1] : null);

      const startDt = it.start?.dateTime || "";
      const datePart = startDt.slice(0, 10);
      const timePart = startDt.slice(11, 16);
      const summary = it.summary || "";

      let isOrphan = false;
      let reason = "";

      const cleanBookingId = (parsedBookingId || "").replace(/^lab_/, "");
      const isBookingCancelled = (parsedBookingId && cancelledBookingIds.has(parsedBookingId)) || (cleanBookingId && cancelledBookingIds.has(cleanBookingId));
      const isBookingActive = (parsedBookingId && activeBookingIds.has(parsedBookingId)) || (cleanBookingId && activeBookingIds.has(cleanBookingId));

      if (isBookingCancelled) {
        isOrphan = true;
        reason = `Booking ID ${parsedBookingId} presente in prenotazioni_cancellate`;
      } else if (cleanBookingId && !isBookingActive) {
        isOrphan = true;
        reason = `Booking ID ${parsedBookingId} non presente in prenotazioni attive`;
      } else if (!activeGcalIds.has(gcalEventId) && !isBookingActive) {
        const hasMatchingActiveSlot = confirmedSlots.some((p: any) =>
          p.data === datePart && p.orario === timePart && (
            summary.toLowerCase().includes((p.nome_cliente || "").toLowerCase()) ||
            (p.nome_cliente || "").toLowerCase().includes(summary.toLowerCase().replace("🏋️ [lab]", "").trim())
          )
        );
        if (!hasMatchingActiveSlot) {
          isOrphan = true;
          reason = `Nessuna prenotazione attiva corrispondente per ${datePart} ${timePart} (${summary})`;
        }
      }

      if (isOrphan) {
        console.log(`[GCAL CLEANUP ORPHAN] Trovato slot orfano: ${it.id} (${summary} del ${datePart} ${timePart}) - Motivo: ${reason}`);
        const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events/${it.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (delRes.status === 200 || delRes.status === 204 || delRes.status === 404 || delRes.status === 410) {
          result.deleted++;
          result.details.push(`Eliminato: ${summary} (${datePart} ${timePart}) - ID ${it.id} - ${reason}`);
        } else {
          result.errors++;
          result.details.push(`Errore eliminazione ${it.id}: status ${delRes.status}`);
        }
      }
    }
  } catch (err: any) {
    result.errors++;
    result.details.push(`Eccezione cleanup: ${err.message || String(err)}`);
  }
  return result;
}

let lastGcalPullTime = 0;

export async function pullGoogleCalendarLabSlots(
  options: { daysBack?: number; daysAhead?: number; force?: boolean } = {}
): Promise<{ synced: number; added: number; updated: number; removed: number }> {
  const { daysBack = 14, daysAhead = 60, force = false } = options;
  const now = Date.now();
  if (!force && lastGcalPullTime > 0 && now - lastGcalPullTime < 8000) {
    return { synced: 0, added: 0, updated: 0, removed: 0 };
  }
  lastGcalPullTime = now;

  try {
    const token = await getGoogleCalendarAccessToken();
    if (!token) return { synced: 0, added: 0, updated: 0, removed: 0 };

    const timeMin = new Date(now - daysBack * 86400000).toISOString();
    const timeMax = new Date(now + daysAhead * 86400000).toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events?timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&showDeleted=true&maxResults=2500`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn("[GCAL PULL ERROR] Status:", res.status);
      return { synced: 0, added: 0, updated: 0, removed: 0 };
    }
    const data = await res.json();
    const items = data.items || [];
    if (!db) {
      db = loadData();
    }
    await ensureLatestDataFromDrive();
    db.prenotazioni_slot = db.prenotazioni_slot || [];
    db.prenotazioni_cancellate = db.prenotazioni_cancellate || [];
    const users: any[] = db.profili_utenti || [];

    let added = 0;
    let updated = 0;
    let removed = 0;
    let changed = false;

    for (const ev of items) {
      const gcalId = ev.id;
      const isCancelled = ev.status === "cancelled";
      const summary = ev.summary || "";
      const isLab = summary.includes("[LAB]") || ev.extendedProperties?.private?.origin === "AREA46_LAB";

      if (!isLab) continue;

      const bookingId = ev.extendedProperties?.private?.booking_id || ev.extendedProperties?.private?.slot_id;

      if (isCancelled) {
        const existingToCancel = db.prenotazioni_slot.find(
          (b: any) =>
            b.google_event_id === gcalId || (bookingId && b.id === bookingId)
        );
        if (existingToCancel && (existingToCancel.stato === "confermata" || !existingToCancel.stato || existingToCancel.stato === "attiva")) {
          existingToCancel.stato = "cancellata_in_tempo";
          existingToCancel.cancellato_il = new Date().toISOString();
          existingToCancel.note = existingToCancel.note ? `${existingToCancel.note} (Annullata su Google Calendar)` : "Annullata su Google Calendar";

          const atleta = users.find(
            (u: any) => u.id === existingToCancel.atleta_id || u.email?.toLowerCase() === existingToCancel.email_cliente?.toLowerCase()
          );
          if (atleta && existingToCancel.credito_scalato) {
            const walletOwner = getWalletOwner(atleta, db) || atleta;
            walletOwner.crediti = (walletOwner.crediti ?? 0) + 1;
            walletOwner.updated_at = new Date().toISOString();
            atleta.updated_at = new Date().toISOString();
            alignSharedPartnersCredits(walletOwner, db);

            addMovimentoCrediti(db, {
              atleta_id: walletOwner.id,
              email_cliente: walletOwner.email,
              nome_cliente: `${walletOwner.nome || ""} ${walletOwner.cognome || ""}`.trim() || walletOwner.name || "Atleta",
              tipo: "rimborso_cancellazione",
              delta_crediti: 1,
              saldo_risultante: walletOwner.crediti,
              motivazione: `Rimborso slot ${existingToCancel.data} ${existingToCancel.orario} cancellato su Google Calendar`,
              operatore: "coach",
            });
          }
          removed++;
          changed = true;
          console.log(`[GCAL PULL] Annullato slot da Google Calendar: ${existingToCancel.data} ${existingToCancel.orario} (Credito riaccreditato)`);
        }
        continue;
      }

      const startDateTime = ev.start?.dateTime;
      if (!startDateTime) continue;

      const slotDate = startDateTime.slice(0, 10);
      const slotTime = startDateTime.slice(11, 16);

      let athleteName = ev.extendedProperties?.private?.athlete_name || "";
      if (!athleteName && summary) {
        athleteName = summary.replace(/🏋️\s*\[LAB\]\s*/i, "").replace(/\[LAB\]\s*/i, "").trim();
      }

      let email = "";
      const desc = ev.description || "";
      const emailMatch = desc.match(/Email:\s*([^\s\n\r]+)/i);
      if (emailMatch) email = emailMatch[1].trim().toLowerCase();

      let note = "";
      const noteMatch = desc.match(/Note:\s*([^\n\r]+)/i);
      if (noteMatch) {
        note = noteMatch[1].trim();
        if (note === "Nessuna") note = "";
      }

      const matchedUser = users.find(
        (u: any) =>
          (email && u.email && u.email.toLowerCase() === email) ||
          (athleteName &&
            ((u.name && u.name.toLowerCase() === athleteName.toLowerCase()) ||
              (`${u.nome || ""} ${u.cognome || ""}`.trim().toLowerCase() === athleteName.toLowerCase())))
      );

      // 🛡️ SCUDO ANTI-FANTASMA & AUTO-HEALING: se lo slot è stato cancellato su Area46,
      // non solo è VIETATO reimportarlo o riscalare crediti, ma va eliminato fisicamente da Google Calendar!
      const isAlreadyCancelled =
        (bookingId && isBookingIdCancelled(bookingId, db.prenotazioni_cancellate || [])) ||
        (gcalId && (
          isBookingIdCancelled(gcalId, db.prenotazioni_cancellate || []) ||
          isBookingIdCancelled(`bk-${gcalId}`, db.prenotazioni_cancellate || [])
        ));

      if (isAlreadyCancelled) {
        console.log(
          `[GCAL AUTO-CLEANUP] Rilevato evento su Google Calendar per slot già cancellato su Area46 (${slotDate} ${slotTime} per ${athleteName || "Atleta"}, GCalId: ${gcalId}, BookingId: ${bookingId || "N/D"}). Rimozione automatica da GCal...`
        );
        deleteGoogleCalendarLabSlot(gcalId, {
          data: slotDate,
          orario: slotTime,
          nomeCliente: athleteName,
          bookingId: bookingId,
        }).catch((err) => console.warn(`[GCAL AUTO-CLEANUP WARNING] Fallita rimozione orfano ${gcalId}:`, err));
        continue;
      }

      const existing = db.prenotazioni_slot.find(
        (b: any) =>
          b.google_event_id === gcalId ||
          (bookingId && b.id === bookingId) ||
          (b.data === slotDate &&
            b.orario === slotTime &&
            ((matchedUser && b.atleta_id === matchedUser.id) ||
              (email && b.email_cliente?.toLowerCase() === email) ||
              (athleteName && b.nome_cliente?.toLowerCase() === athleteName.toLowerCase())))
      );

      if (existing) {
        let itemChanged = false;
        if (!existing.google_event_id) {
          existing.google_event_id = gcalId;
          itemChanged = true;
        }
        if (existing.data !== slotDate || existing.orario !== slotTime) {
          existing.data = slotDate;
          existing.orario = slotTime;
          itemChanged = true;
        }
        if (matchedUser && (!existing.atleta_id || existing.atleta_id.startsWith("usr-gcal"))) {
          existing.atleta_id = matchedUser.id;
          itemChanged = true;
        }
        if (itemChanged) {
          updated++;
          changed = true;
        }
      } else {
        const newBkId = bookingId || `bk-${gcalId}`;
        const newBk = {
          id: newBkId,
          data: slotDate,
          orario: slotTime,
          atleta_id: matchedUser ? matchedUser.id : `usr-gcal-${Date.now()}`,
          email_cliente: matchedUser ? matchedUser.email : email || "",
          nome_cliente: athleteName || (matchedUser ? matchedUser.name : "Atleta"),
          telefono_cliente: matchedUser ? matchedUser.telefono || "" : "",
          stato: "confermata",
          credito_scalato: true,
          note: note || (athleteName ? "Assegnazione diretta dal Coach" : ""),
          google_event_id: gcalId,
          created_at: ev.created || new Date().toISOString(),
        };
        db.prenotazioni_slot.push(newBk);
        added++;
        changed = true;

        // Scalamento crediti effettivo e tracciamento nel ledger
        if (matchedUser) {
          const walletOwner = getWalletOwner(matchedUser, db) || matchedUser;
          const isShared = walletOwner && walletOwner.id !== matchedUser.id;
          walletOwner.crediti = Math.max(0, (walletOwner.crediti ?? 0) - 1);
          walletOwner.updated_at = new Date().toISOString();
          matchedUser.data_ultimo_accesso = new Date().toISOString();
          if (isShared) {
            walletOwner.data_ultimo_accesso = new Date().toISOString();
            matchedUser.updated_at = new Date().toISOString();
          }

          alignSharedPartnersCredits(walletOwner, db);

          addMovimentoCrediti(db, {
            atleta_id: walletOwner.id,
            email_cliente: walletOwner.email,
            nome_cliente: `${walletOwner.nome || ""} ${walletOwner.cognome || ""}`.trim() || walletOwner.name || "Atleta",
            tipo: "prenotazione_slot",
            delta_crediti: -1,
            saldo_risultante: walletOwner.crediti,
            motivazione: isShared
              ? `Prenotazione slot del ${slotDate} ore ${slotTime} per ${matchedUser.nome || matchedUser.name} [Borsellino Condiviso - Da Google Calendar]`
              : `Prenotazione slot del ${slotDate} ore ${slotTime} [Da Google Calendar]`,
            operatore: "coach",
          });
        }

        console.log(
          `[GCAL PULL] Inserito nuovo slot da Google Calendar: ${slotDate} ${slotTime} per ${newBk.nome_cliente} (Credito scalato, saldo: ${matchedUser ? getWalletOwner(matchedUser, db)?.crediti : "N/D"}) (ID: ${newBk.id})`
        );
      }
    }

    if (changed) {
      db.prenotazioni_slot.sort((a: any, b: any) => (a.data + a.orario).localeCompare(b.data + b.orario));
      await saveData(db);
      try {
        const vaultCalCandidates = [
          path.resolve(process.cwd(), "data", "vault", "2_gestionale_calendario.json"),
          path.resolve(__dirname, "data", "vault", "2_gestionale_calendario.json"),
          path.resolve(__dirname, "..", "data", "vault", "2_gestionale_calendario.json"),
        ];
        const targetVault = vaultCalCandidates.find((f) => fs.existsSync(f));
        if (targetVault) {
          const vData = JSON.parse(fs.readFileSync(targetVault, "utf-8"));
          vData.prenotazioni_slot = db.prenotazioni_slot;
          vData.prenotazioni_cancellate = db.prenotazioni_cancellate;
          fs.writeFileSync(targetVault, JSON.stringify(vData, null, 2), "utf-8");
        }
      } catch (vErr) {
        console.warn("[GCAL PULL] Vault file update:", vErr);
      }
    }

    return { synced: items.length, added, updated, removed };
  } catch (err) {
    console.error("[GCAL PULL EXCEPTION]", err);
    return { synced: 0, added: 0, updated: 0, removed: 0 };
  }
}

async function syncConfigToGoogleDrive(config: any) {
  return syncDataToGoogleDrive({ configurazione_lab: config });
}

async function sendPaymentToSggCloud(tx: any) {
  if (!tx) return;
  try {
    const importo = Number(tx.importo_euro || tx.importo || 0);
    if (isNaN(importo) || importo <= 0) return;

    const payload = {
      transaction_id: tx.codice_transazione || tx.id,
      amount: importo,
      payment_date: tx.created_at ? tx.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      payment_method: tx.metodo === "bonifico" ? "Bonifico" : (tx.metodo === "contanti" ? "Contanti" : (tx.metodo === "pos" ? "POS" : "Stripe")),
      description: tx.nome_pacchetto || tx.descrizione || "Pacchetto Landmine Lab",
      athlete_name: tx.nome_cliente || tx.atleta_nome || "Atleta Landmine",
      athlete_email: tx.email_cliente || tx.atleta_email || "",
      athlete_fiscal_code: tx.codice_fiscale || "",
      athlete_address: tx.indirizzo || "",
      athlete_id: tx.atleta_id || "",
    };

    const sggSecret = process.env.SGG_LANDMINE_SECRET || "d7588785876d30eab9c614cc74cf04bd032f4f7a1533a9c8e82164936d71f9f3";
    const res = await fetch("https://sistema-gestionale-globale.onrender.com/api/integrations/landmine-lab/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Landmine-Secret": sggSecret,
      },
      body: JSON.stringify(payload),
    });
    const data: any = await res.json().catch(() => ({}));
    console.log("📡 [SGG CLOUD SYNC] Risultato sync Render:", res.status, data?.data?.message || data?.message || data?.status);
  } catch (err: any) {
    console.warn("⚠️ [SGG CLOUD SYNC] Errore invio webhook a Render:", err.message);
  }
}

async function triggerSggSyncAsync(singleTx?: any) {
  if (singleTx) {
    await sendPaymentToSggCloud(singleTx).catch((e: any) => {
      console.warn("⚠️ [SGG SYNC] Errore push a Render:", e?.message);
    });
  }
  try {
    const direct = path.resolve(__dirname, "scripts", "sync_to_sgg.py");
    const parent = path.resolve(__dirname, "..", "scripts", "sync_to_sgg.py");
    const scriptPath = fs.existsSync(direct) ? direct : fs.existsSync(parent) ? parent : null;
    if (scriptPath) {
      import("node:child_process").then(({ exec }) => {
        exec(`python3 "${scriptPath}"`, (err) => {
          if (err) {
            console.warn("⚠️ [SGG SYNC] Background sync SGG:", err.message);
          } else {
            console.log("🔄 [SGG SYNC] Sincronizzazione automatica SGG completata con successo.");
          }
        });
      }).catch(() => {});
    }
  } catch {}
}

let lastCloudFetchTime = 0;

async function syncDataToGoogleDrive(fullDb: any) {
  try {
    const token = await getGoogleDriveAccessToken();
    if (!token) return;
    const resGet = await fetch(`https://www.googleapis.com/drive/v3/files/${GDRIVE_DEMO_DATA_ID}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resGet.ok) return;
    const driveDb = await resGet.json();
    if (fullDb.transazioni_pagamenti !== undefined) {
      driveDb.transazioni_pagamenti = fullDb.transazioni_pagamenti || [];
    }
    if (fullDb.transazioni_cancellate !== undefined) {
      driveDb.transazioni_cancellate = fullDb.transazioni_cancellate || [];
    }
    if (fullDb.utenti_cancellati !== undefined) {
      driveDb.utenti_cancellati = fullDb.utenti_cancellati || [];
    }
    if (fullDb.profili_utenti !== undefined) {
      const incoming = fullDb.profili_utenti || [];
      const existing = driveDb.profili_utenti || [];
      const userMap = new Map<string, any>();
      for (const u of existing) {
        if (u && u.id) userMap.set(u.id, u);
      }
      for (const u of incoming) {
        if (u && u.id) {
          const prev = userMap.get(u.id);
          if (!prev) {
            userMap.set(u.id, u);
          } else {
            const prevTime = prev.updated_at ? new Date(prev.updated_at).getTime() : 0;
            const newTime = u.updated_at ? new Date(u.updated_at).getTime() : 0;
            userMap.set(u.id, newTime >= prevTime ? u : prev);
          }
        }
      }
      driveDb.profili_utenti = Array.from(userMap.values());
    }
    if (fullDb.prenotazioni_cancellate !== undefined) {
      driveDb.prenotazioni_cancellate = Array.from(
        new Set([...(driveDb.prenotazioni_cancellate || []), ...(fullDb.prenotazioni_cancellate || [])])
      );
    }
    if (fullDb.prenotazioni_slot !== undefined) {
      const incoming = fullDb.prenotazioni_slot || [];
      const existing = driveDb.prenotazioni_slot || [];
      const bkMap = new Map<string, any>();
      for (const b of existing) {
        if (b.id) bkMap.set(b.id, b);
      }
      for (const b of incoming) {
        if (b.id) bkMap.set(b.id, b);
      }
      driveDb.prenotazioni_slot = Array.from(bkMap.values());
    }
    if (fullDb.movimenti_crediti !== undefined) {
      const incoming = fullDb.movimenti_crediti || [];
      const existing = driveDb.movimenti_crediti || [];
      const movMap = new Map<string, any>();
      for (const m of existing) {
        if (m && m.id) movMap.set(m.id, m);
      }
      for (const m of incoming) {
        if (m && m.id && !movMap.has(m.id)) {
          movMap.set(m.id, m);
        }
      }
      driveDb.movimenti_crediti = Array.from(movMap.values()).sort((a: any, b: any) => {
        const da = a.data_movimento || a.data_ora || a.created_at || "";
        const dbTime = b.data_movimento || b.data_ora || b.created_at || "";
        return dbTime.localeCompare(da);
      });
    }
    if (fullDb.diario_utente !== undefined) {
      driveDb.diario_utente = fullDb.diario_utente || [];
    }
    if (fullDb.stato_allenamenti !== undefined) {
      driveDb.stato_allenamenti = mergeStati(driveDb.stato_allenamenti || [], fullDb.stato_allenamenti || []);
    }
    if (fullDb.preferenze_utente !== undefined) {
      driveDb.preferenze_utente = fullDb.preferenze_utente || [];
    }
    if (fullDb.notifiche_email !== undefined) {
      driveDb.notifiche_email = fullDb.notifiche_email || [];
    }
    if (fullDb.eccezioni_calendario !== undefined) {
      driveDb.eccezioni_calendario = fullDb.eccezioni_calendario || [];
    }
    if (fullDb.regole_palinsesto !== undefined) {
      driveDb.regole_palinsesto = fullDb.regole_palinsesto || [];
    }
    if (fullDb.tariffario_pacchetti !== undefined) {
      driveDb.tariffario_pacchetti = fullDb.tariffario_pacchetti || [];
    }
    if (fullDb.attivita_lab !== undefined) {
      driveDb.attivita_lab = fullDb.attivita_lab || [];
    }
    if (fullDb.allenamenti !== undefined && Array.isArray(fullDb.allenamenti) && fullDb.allenamenti.length > 50) {
      driveDb.allenamenti = fullDb.allenamenti;
    }
    if (fullDb.configurazione_lab) {
      driveDb.configurazione_lab = {
        ...(driveDb.configurazione_lab || {}),
        ...fullDb.configurazione_lab,
      };
    }
    driveDb.last_cloud_sync = new Date().toISOString();
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${GDRIVE_DEMO_DATA_ID}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(driveDb, null, 2),
    });
    lastCloudFetchTime = Date.now();
  } catch {
    // Non-fatal
  }
}

async function tryLoadConfigFromGoogleDrive() {
  try {
    const token = await getGoogleDriveAccessToken();
    if (!token) return;
    const resGet = await fetch(`https://www.googleapis.com/drive/v3/files/${GDRIVE_DEMO_DATA_ID}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resGet.ok) return;
    const driveDb = await resGet.json();
    if (driveDb.configurazione_lab) {
      db.configurazione_lab = {
        ...(db.configurazione_lab || {}),
        ...driveDb.configurazione_lab,
      };
    }
    if (driveDb.transazioni_cancellate && Array.isArray(driveDb.transazioni_cancellate)) {
      db.transazioni_cancellate = Array.from(
        new Set([...(db.transazioni_cancellate || []), ...driveDb.transazioni_cancellate, ...FICTITIOUS_TX_IDS])
      );
    }
    if (driveDb.transazioni_pagamenti && Array.isArray(driveDb.transazioni_pagamenti)) {
      db.transazioni_pagamenti = driveDb.transazioni_pagamenti.filter(
        (t: any) => !db.transazioni_cancellate?.includes(t.id) && !db.transazioni_cancellate?.includes(t.codice_transazione)
      );
    }
    if (driveDb.utenti_cancellati && Array.isArray(driveDb.utenti_cancellati)) {
      db.utenti_cancellati = Array.from(
        new Set([...(db.utenti_cancellati || []), ...driveDb.utenti_cancellati])
      );
    }
    // 🛡️ MERGE DINAMICO PROFILI UTENTI: Unione intelligente Cloud Drive <-> Locale basata su updated_at
    if (driveDb.profili_utenti && Array.isArray(driveDb.profili_utenti)) {
      db.profili_utenti = db.profili_utenti || [];
      const userMap = new Map<string, any>();
      for (const p of db.profili_utenti) {
        if (!p) continue;
        const key = p.id || p.email?.toLowerCase().trim();
        if (key) userMap.set(key, p);
      }

      for (const dp of driveDb.profili_utenti) {
        if (!dp) continue;
        const key = dp.id || dp.email?.toLowerCase().trim();
        if (!key) continue;
        if (db.utenti_cancellati?.includes(dp.id) || db.utenti_cancellati?.includes(dp.email?.toLowerCase())) {
          continue;
        }

        if (!userMap.has(key)) {
          userMap.set(key, dp);
          db.profili_utenti.push(dp);
        } else {
          const lp = userMap.get(key);
          const dTime = new Date(dp.updated_at || 0).getTime();
          const lTime = new Date(lp.updated_at || 0).getTime();
          // Se la versione di Drive è più recente o uguale (o locale privo di timestamp), aggiorna campi dinamici
          if (dTime >= lTime) {
            lp.crediti = dp.crediti !== undefined ? dp.crediti : lp.crediti;
            lp.anticipi_da_scontare = dp.anticipi_da_scontare !== undefined ? dp.anticipi_da_scontare : lp.anticipi_da_scontare;
            lp.data_scadenza_crediti = dp.data_scadenza_crediti !== undefined ? dp.data_scadenza_crediti : lp.data_scadenza_crediti;
            lp.stato_iscrizione = dp.stato_iscrizione || lp.stato_iscrizione;
            lp.updated_at = dp.updated_at || lp.updated_at;
            if (dp.note_coach) lp.note_coach = dp.note_coach;
            if (dp.shared_wallet_with !== undefined) lp.shared_wallet_with = dp.shared_wallet_with;
            if (dp.data_ultimo_accesso) lp.data_ultimo_accesso = dp.data_ultimo_accesso;
            if (dp.tipo_abbonamento) lp.tipo_abbonamento = dp.tipo_abbonamento;
            if (dp.telefono) lp.telefono = dp.telefono;
            if (dp.codice_fiscale) lp.codice_fiscale = dp.codice_fiscale;
            if (dp.indirizzo) lp.indirizzo = dp.indirizzo;
          }
        }
      }
    }
    db.active_user_id = null;
    if (driveDb.prenotazioni_cancellate && Array.isArray(driveDb.prenotazioni_cancellate)) {
      db.prenotazioni_cancellate = Array.from(
        new Set([...(db.prenotazioni_cancellate || []), ...driveDb.prenotazioni_cancellate])
      );
      db.prenotazioni_slot = (db.prenotazioni_slot || []).filter(
        (p: any) => !isBookingIdCancelled(p.id, db.prenotazioni_cancellate)
      );
    }
    if (driveDb.prenotazioni_slot && Array.isArray(driveDb.prenotazioni_slot)) {
      db.prenotazioni_slot = driveDb.prenotazioni_slot.filter(
        (p: any) => !isBookingIdCancelled(p.id, db.prenotazioni_cancellate)
      );
    }
    // 🛡️ MERGE ADDITIVO MOVIMENTI CREDITI
    if (driveDb.movimenti_crediti && Array.isArray(driveDb.movimenti_crediti)) {
      const movMap = new Map<string, any>();
      for (const m of (db.movimenti_crediti || [])) {
        if (m && m.id) movMap.set(m.id, m);
      }
      for (const m of driveDb.movimenti_crediti) {
        if (m && m.id && !movMap.has(m.id)) {
          movMap.set(m.id, m);
        }
      }
      db.movimenti_crediti = Array.from(movMap.values()).sort((a: any, b: any) =>
        new Date(b.data_ora || b.created_at || 0).getTime() - new Date(a.data_ora || a.created_at || 0).getTime()
      );
    }
    // 🛡️ MERGE ADDITIVO TRANSAZIONI PAGAMENTI
    if (driveDb.transazioni_pagamenti && Array.isArray(driveDb.transazioni_pagamenti)) {
      const txMap = new Map<string, any>();
      for (const t of (db.transazioni_pagamenti || [])) {
        if (!t) continue;
        const key = t.codice_transazione || t.id;
        if (key && !db.transazioni_cancellate?.includes(key)) txMap.set(key, t);
      }
      for (const t of driveDb.transazioni_pagamenti) {
        if (!t) continue;
        const key = t.codice_transazione || t.id;
        if (key && !db.transazioni_cancellate?.includes(key)) {
          if (!txMap.has(key)) {
            txMap.set(key, t);
          } else {
            const existing = txMap.get(key);
            if (t.stato === "completato" && existing.stato !== "completato") {
              txMap.set(key, t);
            }
          }
        }
      }
      db.transazioni_pagamenti = Array.from(txMap.values()).sort((a: any, b: any) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    }
    if (driveDb.diario_utente && Array.isArray(driveDb.diario_utente)) {
      db.diario_utente = driveDb.diario_utente;
    }
    if (driveDb.stato_allenamenti && Array.isArray(driveDb.stato_allenamenti)) {
      db.stato_allenamenti = mergeStati(db.stato_allenamenti || [], driveDb.stato_allenamenti);
    }
    if (driveDb.preferenze_utente && Array.isArray(driveDb.preferenze_utente)) {
      db.preferenze_utente = driveDb.preferenze_utente;
    }
    if (driveDb.notifiche_email && Array.isArray(driveDb.notifiche_email)) {
      db.notifiche_email = driveDb.notifiche_email;
    }
    if (driveDb.eccezioni_calendario && Array.isArray(driveDb.eccezioni_calendario)) {
      const excMap = new Map<string, any>();
      // 1. Prima eccezioni dal cloud
      for (const e of driveDb.eccezioni_calendario) {
        if (!e) continue;
        const key = e.id || `${e.data || e.dataInizio || ""}__${e.orario || "all"}`;
        excMap.set(key, e);
      }
      // 2. Poi eccezioni locali (hanno precedenza assoluta per non perdere chiusure o modifiche recenti)
      for (const e of (db.eccezioni_calendario || [])) {
        if (!e) continue;
        const key = e.id || `${e.data || e.dataInizio || ""}__${e.orario || "all"}`;
        excMap.set(key, e);
      }
      db.eccezioni_calendario = Array.from(excMap.values()).sort((a: any, b: any) =>
        (a.data || a.dataInizio || "").localeCompare(b.data || b.dataInizio || "")
      );
    }
    if (driveDb.regole_palinsesto && Array.isArray(driveDb.regole_palinsesto)) {
      db.regole_palinsesto = driveDb.regole_palinsesto;
    }
    if (driveDb.tariffario_pacchetti && Array.isArray(driveDb.tariffario_pacchetti)) {
      db.tariffario_pacchetti = driveDb.tariffario_pacchetti;
    }
    if (driveDb.attivita_lab && Array.isArray(driveDb.attivita_lab)) {
      db.attivita_lab = driveDb.attivita_lab;
    }
    if (driveDb.allenamenti && Array.isArray(driveDb.allenamenti) && driveDb.allenamenti.length > 50) {
      const cloudMissing = driveDb.allenamenti.filter((a: any) => !(a.parametri || "").trim()).length;
      const currentMissing = (db.allenamenti || []).filter((a: any) => !(a.parametri || "").trim()).length;
      if (cloudMissing <= currentMissing) {
        db.allenamenti = driveDb.allenamenti;
      } else {
        console.log(`🛡️ [AREA46 GUARDIAN] Mantenuta versione allenamenti locale (${currentMissing} mancanti) rispetto al cloud (${cloudMissing} mancanti).`);
      }
    }
    saveData(db, true);
  } catch {
    // Non-fatal
  }
}

async function ensureLatestDataFromDrive(force = false) {
  const now = Date.now();
  if (!force && lastCloudFetchTime > 0 && now - lastCloudFetchTime < 10000) {
    return;
  }
  await tryLoadConfigFromGoogleDrive();
  lastCloudFetchTime = Date.now();
}

tryLoadConfigFromGoogleDrive().catch(() => {});

const FICTITIOUS_TX_IDS = [
  "TX-46-2026-001",
  "TX-46-2026-002",
  "TX-46-2026-003",
  "TX-46-2026-004",
  "TX-46-2026-005",
];

let db = loadData();
db.transazioni_cancellate = Array.from(new Set([...(db.transazioni_cancellate || []), ...FICTITIOUS_TX_IDS]));
db.transazioni_pagamenti = (db.transazioni_pagamenti || []).filter(
  (t: any) => !db.transazioni_cancellate.includes(t.codice_transazione) && !db.transazioni_cancellate.includes(t.id)
);

export function getWalletOwner(atleta: any, database: any) {
  if (!atleta) return null;
  if (atleta.shared_wallet_with) {
    const master = (database?.profili_utenti || []).find(
      (p: any) =>
        p.id === atleta.shared_wallet_with ||
        p.email?.toLowerCase() === atleta.shared_wallet_with?.toLowerCase()
    );
    if (master) return master;
  }
  return atleta;
}

export function alignSharedPartnersCredits(walletOwner: any, database: any) {
  if (!walletOwner || !database?.profili_utenti) return;
  const masterId = walletOwner.shared_wallet_with || walletOwner.id;
  const masterUser = (database.profili_utenti || []).find((u: any) => u.id === masterId) || walletOwner;
  const currentCredits = Number(masterUser.crediti ?? 0);
  const currentExpiry = masterUser.data_scadenza_crediti;

  for (const u of database.profili_utenti) {
    if (u.id === masterId) {
      u.crediti = currentCredits;
    } else if (
      u.shared_wallet_with === masterId ||
      (u.shared_wallet_with && u.shared_wallet_with.toLowerCase() === masterUser.email?.toLowerCase())
    ) {
      u.crediti = currentCredits;
      if (currentExpiry) u.data_scadenza_crediti = currentExpiry;
    }
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    if (!name) return;
    const value = parts.slice(1).join("=").trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

export async function sendEmailNotification(
  arg1: any,
  arg2?: any
) {
  const params = (arg2 && typeof arg2 === "object" ? arg2 : arg1) || {};
  const recipient = (params.to || "").trim();
  const subject = (params.subject || "Notifica Area46 Landmine Lab").trim();
  const bodyText = (params.body || "").toString();
  const htmlBody = params.html || (bodyText ? `<p style="font-family: sans-serif; font-size: 14px; color: #333; line-height: 1.6;">${bodyText.split("\n").join("<br>")}</p>` : "<p>Notifica Area46 Landmine Lab</p>");

  const emailRecord = {
    id: `email-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    destinatario: recipient,
    oggetto: subject,
    corpo: bodyText,
    html: htmlBody,
    inviato_il: new Date().toISOString(),
    tipo: params.tipo || "sistema",
    stato: "inviata",
  };

  db.notifiche_email = db.notifiche_email || [];
  db.notifiche_email.unshift(emailRecord);

  // 1. TENTATIVO DI INVIO REALE VIA GMAIL SMTP (Se configurata GMAIL_APP_PASSWORD)
  const gmailUser = "firenzepersonaltrainer@gmail.com";
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD || db.configurazione_lab?.gmail_app_password || "").replace(/\s+/g, "");

  if (gmailPass && recipient) {
    try {
      console.log(`[GMAIL SMTP ATTEMPT] Invio email a "${recipient}" da "${gmailUser}"...`);
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      await transporter.sendMail({
        from: `Area46 Landmine Lab <${gmailUser}>`,
        to: recipient,
        subject: subject,
        text: bodyText,
        html: htmlBody,
      });

      console.log(`[GMAIL SMTP SUCCESS] Email inviata con successo via Gmail a ${recipient}`);
      saveData(db);
      return emailRecord;
    } catch (err: any) {
      console.error("[GMAIL SMTP ERROR]", err?.message || err);
      if (params.throwOnError) {
        throw new Error(`Errore invio Gmail SMTP: ${err?.message || err}`);
      }
    }
  }

  // 2. TENTATIVO DI INVIO VIA RESEND (Fallback)
  const resendApiKey = db.configurazione_lab?.resend_api_key || process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn(`[NOTIFICA EMAIL WARNING] RESEND_API_KEY / GMAIL_APP_PASSWORD non configurate. Email registrata nel diario locale.`);
    saveData(db);
    if (params.throwOnError) {
      throw new Error("Variabile d'ambiente GMAIL_APP_PASSWORD o RESEND_API_KEY non configurata su Vercel.");
    }
    return emailRecord;
  }

  if (!recipient) {
    console.warn(`[NOTIFICA EMAIL WARNING] Indirizzo email destinatario vuoto.`);
    saveData(db);
    if (params.throwOnError) {
      throw new Error("Indirizzo email destinatario non valido.");
    }
    return emailRecord;
  }

  try {
    console.log(`[RESEND ATTEMPT] Invio email a "${recipient}" (Oggetto: ${subject})...`);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Area46 Landmine Lab <onboarding@resend.dev>",
        to: [recipient],
        subject: subject,
        text: bodyText,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[RESEND API REJECTION] HTTP ${response.status}: ${errText}`);
      if (params.throwOnError) {
        throw new Error(`Resend ha rifiutato l'invio (${response.status}): ${errText}`);
      }
    } else {
      const resData = await response.json().catch(() => ({}));
      console.log(`[EMAIL DISPATCH SUCCESS] Inviata via Resend a ${recipient}. ID:`, resData?.id);
    }
  } catch (err: any) {
    console.warn("[NOTIFICA EMAIL ERROR]", err?.message || err);
    if (params.throwOnError) {
      throw err;
    }
  }

  saveData(db);
  return emailRecord;
}

export async function sendAdminPaymentNotification(
  tipo: "bonifico" | "stripe" | "manuale",
  transazione: any,
  extra?: { pacchetto?: any; atleta?: any }
) {
  const emailCoach =
    db?.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";
  let oggetto = "";
  let corpo = "";

  const nomeAtleta = transazione.nome_cliente || "Atleta";
  const importoStr = `€ ${Number(transazione.importo_euro || 0).toFixed(2)}`;
  const nomePack = transazione.nome_pacchetto || "Pacchetto Lab";

  if (tipo === "bonifico") {
    oggetto = `🔔 [AREA46 FISCO] Nuova Richiesta Bonifico — ${nomeAtleta} (${importoStr})`;
    corpo = `
NOTIFICA RICEZIONE RICHIESTA BONIFICO BANCARIO
=============================================================================
Data: ${new Date().toLocaleString("it-IT")}
Atleta: ${nomeAtleta}
Email: ${transazione.email_cliente}
Codice Fiscale: ${transazione.codice_fiscale || "Non specificato"}
Pacchetto Scelto: ${nomePack} (${transazione.crediti_acquistati || extra?.pacchetto?.crediti || "-"} crediti)
Importo da Riscuotere: ${importoStr}
Causale Generata: ${transazione.causale_bonifico || "-"}
Codice Transazione: ${transazione.codice_transazione}
=============================================================================
STATO ATTUALE:
- Transazione memorizzata in Prima Nota con stato 'in_attesa_bonifico'.
- I crediti NON sono stati ancora accreditati (in attesa di tua conferma).
- L'atleta è stata invitata ad avvisarti su WhatsApp e non potrà prenotare prima di 24 ore.

COME APPROVARE L'ACCREDITO:
Quando avrai verificato l'accredito sul tuo conto corrente MPS:
1. Accedi alla sezione Manager Fisco dell'App.
2. Troverai la card in evidenza "Bonifici in attesa di verifica".
3. Clicca su "Approva ed Accredita Crediti": il sistema caricherà istantaneamente i crediti nel wallet dell'atleta e invierà l'email di conferma.
=============================================================================
Area46 Landmine Lab — Sistema Fiscale Automatizzato
    `.trim();
  } else if (tipo === "stripe") {
    oggetto = `💰 [AREA46 INCASSO STRIPE] Pagamento Ricevuto — ${nomeAtleta} (${importoStr})`;
    corpo = `
INCASSO CARTA / STRIPE COMPLETATO CON SUCCESSO
=============================================================================
Data: ${new Date().toLocaleString("it-IT")}
Atleta: ${nomeAtleta}
Email: ${transazione.email_cliente}
Pacchetto: ${nomePack}
Importo Incassato: ${importoStr}
Crediti Aggiunti: +${transazione.crediti_effettivi_aggiunti} (Nuovo Saldo: ${extra?.atleta?.crediti ?? "-"})
Codice Transazione: ${transazione.codice_transazione}
ID Sessione Stripe: ${transazione.stripe_session_id || "-"}
=============================================================================
REGISTRAZIONE CONTABILE:
- Movimento registrato automaticamente nel Registro Incassi / Fisco.
- Ricevuta emessa nel diario dell'atleta.
- Ricorda di emettere fattura o ricevuta fiscale secondo il tuo regime.
=============================================================================
Area46 Landmine Lab
    `.trim();
  } else if (tipo === "manuale") {
    oggetto = `📝 [AREA46 FISCO] Registrato Versamento Manuale — ${nomeAtleta} (${importoStr})`;
    corpo = `
REGISTRAZIONE VERSAMENTO MANUALE IN PRIMA NOTA
=============================================================================
Data: ${new Date().toLocaleString("it-IT")}
Atleta: ${nomeAtleta}
Importo: ${importoStr}
Metodo: ${transazione.metodo?.toUpperCase()}
Descrizione: ${transazione.nome_pacchetto}
Codice Fiscale: ${transazione.codice_fiscale || "-"}
Codice Transazione: ${transazione.codice_transazione}
=============================================================================
Movimento memorizzato nel registro fiscale.
    `.trim();
  }

  await sendEmailNotification({
    to: emailCoach,
    subject: oggetto,
    body: corpo,
    tipo: "fisco_pagamento",
  }).catch(() => {});
}

export function getHydratedUser(user: any, database: any) {
  if (!user) return null;
  const walletOwner = getWalletOwner(user, database);
  const isShared = walletOwner && walletOwner.id !== user.id;
  const partners = (database.profili_utenti || []).filter(
    (other: any) =>
      other.id !== user.id &&
      (other.shared_wallet_with === user.id ||
        other.shared_wallet_with?.toLowerCase() === user.email?.toLowerCase())
  );
  return {
    ...user,
    name: `${user.nome} ${user.cognome}`.trim(),
    crediti: isShared ? walletOwner.crediti : user.crediti,
    data_scadenza_crediti: isShared ? walletOwner.data_scadenza_crediti : user.data_scadenza_crediti,
    is_shared_wallet: isShared,
    shared_master_nome: isShared ? `${walletOwner.nome} ${walletOwner.cognome}`.trim() : undefined,
    is_wallet_master: partners.length > 0,
    shared_partners_count: partners.length,
    shared_partner_names: partners.map((x: any) => `${x.nome} ${x.cognome}`.trim()),
    anticipi_da_scontare: isShared
      ? Number(walletOwner.anticipi_da_scontare || 0)
      : Number(user.anticipi_da_scontare || 0),
  };
}

const AREA46_AUTH_SECRET = process.env.AREA46_AUTH_SECRET || "area46-secret-vault-auth-key-2026";

export function signUserId(userId: string): string {
  const hmac = crypto.createHmac("sha256", AREA46_AUTH_SECRET).update(userId).digest("hex").slice(0, 16);
  return `${userId}.${hmac}`;
}

export function verifySignedUserId(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [userId, sig] = parts;
  const expected = crypto.createHmac("sha256", AREA46_AUTH_SECRET).update(userId).digest("hex").slice(0, 16);
  try {
    if (sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return userId;
    }
  } catch {
    return null;
  }
  return null;
}

export function getCurrentUser(reqOrDb: any, maybeDb?: any) {
  const req = maybeDb ? reqOrDb : null;
  const database = maybeDb || reqOrDb;

  let candidate: string | null = null;
  let isCryptographicallySigned = false;

  if (req && req.headers) {
    const cookies = parseCookies(req.headers.cookie);
    const cookieUser = cookies["area46_user_id"] || cookies["area46_user_email"];
    
    const bearer = typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.slice(7).trim()
      : null;

    const rawToken = bearer || cookieUser;
    if (rawToken) {
      const verifiedId = verifySignedUserId(rawToken);
      if (verifiedId) {
        candidate = verifiedId;
        isCryptographicallySigned = true;
      }
    }

    if (!candidate) {
      const headerUser = req.headers["x-area46-user"] || req.headers["x-user-id"] || bearer;
      candidate = (headerUser || cookieUser || "").trim() || null;
    }
  }

  // 1. Identificativo presente nella sessione del browser (header o cookie)
  if (candidate) {
    const user = (database.profili_utenti || []).find(
      (u: any) =>
        u.id === candidate ||
        u.email?.toLowerCase() === candidate.toLowerCase()
    );
    if (user) {
      return getHydratedUser(user, database);
    }
  }

  // IMPORTANTE: Se non vi è sessione (finestra anonima/incognito o logout), restituire rigorosamente null.
  return null;
}

export function resolveTargetEmail(
  req: IncomingMessage,
  database: any,
  currentUser: any,
  explicitEmail?: string | null
): string | null {
  if (explicitEmail && typeof explicitEmail === "string" && explicitEmail.trim()) {
    return explicitEmail.trim().toLowerCase();
  }
  if (currentUser && currentUser.email) {
    return currentUser.email.trim().toLowerCase();
  }
  if (req && req.headers) {
    const headerUser =
      req.headers["x-area46-user"] ||
      req.headers["x-user-id"] ||
      (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    const cookies = parseCookies(req.headers.cookie);
    const cookieUser = cookies["area46_user_id"] || cookies["area46_user_email"];
    const candidate = String(headerUser || cookieUser || "").trim();

    if (candidate) {
      const user = (database.profili_utenti || []).find(
        (u: any) =>
          u.id === candidate ||
          u.email?.toLowerCase() === candidate.toLowerCase()
      );
      if (user && user.email) {
        return user.email.trim().toLowerCase();
      }
      if (candidate.includes("@")) {
        return candidate.toLowerCase();
      }
    }
  }
  return null;
}

function addMovimentoCrediti(
  database: any,
  params: {
    atleta_id: string;
    email_cliente: string;
    nome_cliente: string;
    tipo: string;
    delta_crediti: number;
    saldo_risultante: number;
    motivazione: string;
    operatore?: string;
  }
) {
  database.movimenti_crediti = database.movimenti_crediti || [];
  const mov = {
    id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    atleta_id: params.atleta_id,
    email_cliente: params.email_cliente,
    nome_cliente: params.nome_cliente,
    data_ora: new Date().toISOString(),
    tipo: params.tipo,
    delta_crediti: params.delta_crediti,
    saldo_risultante: params.saldo_risultante,
    motivazione: params.motivazione,
    operatore: params.operatore || "sistema",
  };
  database.movimenti_crediti.unshift(mov);
  return mov;
}

export async function handleLocalApi(
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void
) {
  if (!db) {
    db = loadData();
  }
  await ensureLatestDataFromDrive();
  const host = req.headers?.host || "localhost:5173";
  const url = new URL(req.url ?? "/", `http://${host}`);
  let pathname = url.pathname;

  if (pathname.startsWith("/uploads/audio_notes/")) {
    const fileName = path.basename(pathname);
    let filePath = path.resolve(__dirname, "uploads", "audio_notes", fileName);
    if (!fs.existsSync(filePath)) {
      filePath = path.resolve(__dirname, "api", "uploads", "audio_notes", fileName);
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join("/tmp/uploads/audio_notes", fileName);
    }

    // Auto-recovery se il file fisico non esiste ma è salvato come base64 nel database
    if (!fs.existsSync(filePath)) {
      try {
        const targetUrl = `/uploads/audio_notes/${fileName}`;
        const matchEntry =
          (db.audio_note_feedback || []).find((n: any) => n.audio_url === targetUrl && n.audio_base64) ||
          (db.diario_utente || []).find((d: any) => d.audio_url === targetUrl && d.audio_base64);
        if (matchEntry && matchEntry.audio_base64) {
          const rawB64 = matchEntry.audio_base64;
          const cleanB64 = rawB64.includes("base64,") ? rawB64.split("base64,")[1] : rawB64;
          const recoveredBuf = Buffer.from(cleanB64, "base64");
          const targetDir = path.resolve(__dirname, "uploads", "audio_notes");
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          filePath = path.join(targetDir, fileName);
          fs.writeFileSync(filePath, recoveredBuf);
          console.log(`[AUDIO RECOVERY] File ${fileName} ricostruito con successo da audio_base64 (${recoveredBuf.length} bytes).`);
        }
      } catch (recErr) {
        console.warn("[AUDIO RECOVERY ERROR]", recErr);
      }
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(fileName).toLowerCase();
      const mime =
        ext === ".mp4" || ext === ".m4a"
          ? "audio/mp4"
          : ext === ".wav"
          ? "audio/wav"
          : "audio/webm";
      res.setHeader("Content-Type", mime);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Accept-Ranges", "bytes");
      const stat = fs.statSync(filePath);
      res.setHeader("Content-Length", stat.size);
      const stream = fs.createReadStream(filePath);
      return stream.pipe(res);
    } else {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      return res.end("Audio not found");
    }
  }

  if (!pathname.startsWith("/app-api")) {
    const route = url.searchParams.get("__route");
    if (route) {
      pathname = `/app-api/${route.replace(/^\/+/, "")}`;
      url.searchParams.delete("__route");
    }
  }

  if (!pathname.startsWith("/app-api")) {
    if (next) return next();
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: "Endpoint non trovato" }));
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  const method = req.method?.toUpperCase() ?? "GET";

  if (method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const getBody = async (): Promise<{ parsedBody: any; rawBody: string }> => {
    if ((req as any).body !== undefined && (req as any).body !== null) {
      if (typeof (req as any).body === "string") {
        try {
          return { parsedBody: JSON.parse((req as any).body), rawBody: (req as any).body };
        } catch {
          return { parsedBody: {}, rawBody: (req as any).body };
        }
      }
      return { parsedBody: (req as any).body, rawBody: JSON.stringify((req as any).body) };
    }

    return new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => {
        if (!data) return resolve({ parsedBody: {}, rawBody: "" });
        try {
          resolve({ parsedBody: JSON.parse(data), rawBody: data });
        } catch {
          resolve({ parsedBody: {}, rawBody: data });
        }
      });
      req.on("error", () => resolve({ parsedBody: {}, rawBody: "" }));
    });
  };

  const { parsedBody, rawBody } = await getBody();
  const currentUser = getCurrentUser(req, db);

    // ─────────────────────────────────────────────────────────────────────────
    // AUTH & PROFILI UTENTI
    // ─────────────────────────────────────────────────────────────────────────

    // GET /app-api/auth/current-user
    if (pathname === "/app-api/auth/current-user" && method === "GET") {
      return res.end(JSON.stringify(currentUser));
    }

    // GET /app-api/auth/login-demo (Disabilitato per sicurezza)
    if (pathname === "/app-api/auth/login-demo") {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, error: "Accesso demo disabilitato per motivi di sicurezza." }));
    }

    // POST /app-api/auth/logout (Disconnessione Utente)
    if (pathname === "/app-api/auth/logout" && method === "POST") {
      res.setHeader(
        "Set-Cookie",
        "area46_user_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; HttpOnly"
      );
      return res.end(JSON.stringify({ ok: true, messaggio: "Disconnessione effettuata." }));
    }

    // POST /app-api/auth/login-email (Opzione A: Email con codice OTP)
    if (pathname === "/app-api/auth/login-email" && method === "POST") {
      const email = (parsedBody.email || "").trim().toLowerCase();
      const code = (parsedBody.code || "").trim();
      const requestOtpOnly = !!parsedBody.requestOtpOnly;

      if (!email || !email.includes("@")) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Inserisci un indirizzo email valido." }));
      }

      const isCoachEmail = email === "firenzepersonaltrainer@gmail.com";
      let found = (db.profili_utenti || []).find(
        (u: any) => u.email?.toLowerCase() === email
      );

      // BLOCCO WHITELIST: Se l'email non è censita in anagrafica e non è il coach, impedire l'accesso
      if (!found && !isCoachEmail) {
        res.statusCode = 403;
        return res.end(
          JSON.stringify({
            error: "Email non abilitata. L'accesso ad Area46 è riservato agli atleti censiti dal Coach Stefano Tronconi. Contatta il Lab per richiedere l'abilitazione.",
          })
        );
      }

      if (requestOtpOnly) {
        console.log(`[AUTH] Richiesta invio OTP per email abilitata: "${email}"`);
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        try {
          await sendEmailNotification({
            to: email,
            subject: "Codice di Accesso - Area46 Landmine Lab",
            body: `Il tuo codice OTP di verifica per accedere ad Area46 Landmine Lab è: ${otpCode}`,
            html: `<div style="font-family: sans-serif; padding: 24px; background-color: #f8f9fa; border-radius: 16px;">
              <h2 style="color: #09090b; margin-top: 0;">Area46 Landmine Lab</h2>
              <p style="color: #3f3f46; font-size: 14px;">Inserisci il seguente codice di verifica nell'applicazione per accedere al tuo account:</p>
              <div style="background-color: #ffffff; border: 2px solid #1c00ff; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #1c00ff;">${otpCode}</span>
              </div>
              <p style="color: #71717a; font-size: 12px;">Se non hai richiesto tu questo codice, puoi ignorare questa email.</p>
            </div>`,
            tipo: "sistema",
            throwOnError: true,
          });

          console.log(`[AUTH] Email OTP inviata realmente via Resend a "${email}"`);
          return res.end(
            JSON.stringify({
              ok: true,
              messaggio: `Codice OTP inviato a ${email}`,
            })
          );
        } catch (err: any) {
          console.warn(`[AUTH OTP FALLBACK] Resend Sandbox/Restrizione per "${email}":`, err?.message || err);
          return res.end(
            JSON.stringify({
              ok: true,
              messaggio: `Codice temporaneo generato per ${email}`,
              sandboxOtp: otpCode,
              isSandbox: true,
            })
          );
        }
      }

      if (found) {
        if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
          db.utenti_cancellati = db.utenti_cancellati.filter(
            (u: string) => u !== found.id && u.toLowerCase() !== email
          );
        }
        found.data_ultimo_accesso = new Date().toISOString();

        // NOTIFICA AL COACH AL PRIMO LOGIN DELL'ATLETA
        if (!found.primo_accesso_notificato && !isCoachEmail) {
          found.primo_accesso_notificato = new Date().toISOString();
          saveData(db);
          try {
            await sendEmailNotification({
              to: "firenzepersonaltrainer@gmail.com",
              subject: `Alert Primo Accesso Atleta - ${found.nome} ${found.cognome}`,
              body: `L'atleta ${found.nome} ${found.cognome} (${found.email}) ha appena effettuato il suo primo accesso alla Web App Area46 Landmine Lab.`,
              html: `<div style="font-family: sans-serif; padding: 20px; background-color: #f8f9fa; border-radius: 12px;">
                <h3 style="color: #09090b; margin-top: 0;">Alert Primo Accesso Atleta</h3>
                <p style="font-size: 14px; color: #3f3f46;">L'atleta <strong>${found.nome} ${found.cognome}</strong> (<code>${found.email}</code>) si è appena collegato per la prima volta alla Web App Area46 Landmine Lab.</p>
                <p style="font-size: 12px; color: #71717a;">Data e ora: ${new Date().toLocaleString("it-IT")}</p>
              </div>`,
              tipo: "notifica_coach",
            });
            console.log(`[ALERT COACH] Notificato primo accesso per ${found.email}`);
          } catch (err) {
            console.warn("[ALERT COACH WARNING]", err);
          }
        } else {
          saveData(db);
        }

        res.setHeader(
          "Set-Cookie",
          `area46_user_id=${encodeURIComponent(signUserId(found.id))}; Path=/; Max-Age=31536000; SameSite=Lax`
        );
        return res.end(JSON.stringify({ ok: true, user: getHydratedUser(found, db) }));
      }

      if (email === "firenzepersonaltrainer@gmail.com") {
        if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
          db.utenti_cancellati = db.utenti_cancellati.filter(
            (u: string) => u !== "usr-coach-01" && u.toLowerCase() !== email
          );
        }
        const coach = {
          id: "usr-coach-01",
          email: "firenzepersonaltrainer@gmail.com",
          nome: "Stefano",
          cognome: "Tronconi",
          ruolo: "manager",
          crediti: 999,
          data_ultimo_accesso: new Date().toISOString(),
        };
        db.profili_utenti = db.profili_utenti || [];
        db.profili_utenti.push(coach);
        saveData(db);
        await syncDataToGoogleDrive(db);
        res.setHeader(
          "Set-Cookie",
          `area46_user_id=${encodeURIComponent(signUserId(coach.id))}; Path=/; Max-Age=31536000; SameSite=Lax`
        );
        return res.end(JSON.stringify({ ok: true, user: getHydratedUser(coach, db) }));
      }

      // Nuovo atleta (es. seconda email di Stefano per testare o nuovo iscritto)
      const cleanName = email.split("@")[0].replace(/[._-]/g, " ");
      const parts = cleanName.split(" ").filter(Boolean);
      const nome = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Nuovo";
      const cognome = parts.slice(1).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") || "Atleta";

      const nuovoAtleta = {
        id: `usr-atleta-${Date.now()}`,
        email: email,
        nome: nome,
        cognome: cognome,
        name: `${nome} ${cognome}`.trim(),
        ruolo: "atleta",
        crediti: 0,
        tempo_cancellazione_ore: 24,
        tempo_anticipo_prenotazione_ore: 24,
        data_scadenza_crediti: null,
        tipo_abbonamento: "standard",
        data_ultimo_accesso: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
        db.utenti_cancellati = db.utenti_cancellati.filter(
          (u: string) => u !== nuovoAtleta.id && u.toLowerCase() !== email
        );
      }
      db.profili_utenti = db.profili_utenti || [];
      db.profili_utenti.push(nuovoAtleta);
      saveData(db);
      await syncDataToGoogleDrive(db);

      // Notifica email al Coach Stefano Tronconi per nuovo log e registrazione
      const emailCoach = db.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";
      const notificaCoachBody = `
NOTIFICA NUOVO ACCESSO ATLETA — AREA46 TRAINING LAB
=============================================================================
Data e Ora: ${new Date().toLocaleString("it-IT")}
Evento: Un nuovo atleta ha effettuato il primo accesso all'applicazione

DATI DEL NUOVO ATLETA:
- Nome e Cognome: ${nuovoAtleta.nome} ${nuovoAtleta.cognome}
- Email: ${nuovoAtleta.email}
- Ruolo: Atleta
- Saldo Crediti: 0 crediti

STATO ACCOUNT:
L'atleta è stato aggiunto automaticamente all'anagrafica del tuo gestionale.
Ha accesso immediato e gratuito a tutti i programmi di allenamento del Lab.
Puoi visualizzare la sua posizione, assegnare crediti o configurare pacchetti
direttamente dal Pannello Manager Atleti.
=============================================================================
      `.trim();

      await sendEmailNotification({
        to: emailCoach,
        subject: `[AREA46 NOTIFICA] Nuovo Atleta Registrato — ${nuovoAtleta.nome} ${nuovoAtleta.cognome}`,
        body: notificaCoachBody,
        tipo: "nuovo_utente_registrato",
      });

      res.setHeader(
        "Set-Cookie",
        `area46_user_id=${encodeURIComponent(nuovoAtleta.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
      );
      return res.end(JSON.stringify({ ok: true, user: getHydratedUser(nuovoAtleta, db), isNew: true }));
    }

    // POST /app-api/auth/oauth-login (Opzione C: Accedi con Google o Apple)
    if (pathname === "/app-api/auth/oauth-login" && method === "POST") {
      const provider = parsedBody.provider || "google";
      const email = (parsedBody.email || "").trim().toLowerCase();
      const name = parsedBody.name || "";

      if (!email || !email.includes("@")) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Email account social non valida." }));
      }

      if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
        db.utenti_cancellati = db.utenti_cancellati.filter(
          (u: string) => u.toLowerCase() !== email
        );
      }

      let found = (db.profili_utenti || []).find(
        (u: any) => u.email?.toLowerCase() === email
      );

      let isNewOauth = false;
      if (!found) {
        isNewOauth = true;
        found = {
          id: `usr-${provider}-${Date.now()}`,
          email: email,
          nome: name.split(" ")[0] || email.split("@")[0],
          cognome: name.split(" ").slice(1).join(" ") || "",
          name: name || email.split("@")[0],
          ruolo: email === "firenzepersonaltrainer@gmail.com" ? "manager" : "atleta",
          crediti: 0,
          tempo_cancellazione_ore: 24,
          data_scadenza_crediti: null,
          tipo_abbonamento: "standard",
          data_ultimo_accesso: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        db.profili_utenti = db.profili_utenti || [];
        db.profili_utenti.push(found);
        saveData(db);
        await syncDataToGoogleDrive(db);

        // Notifica al Coach se nuovo utente social registrato
        if (found.ruolo === "atleta") {
          const emailCoach = db.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";
          const notificaSocialBody = `
NOTIFICA NUOVO ACCESSO SOCIAL ATLETA — AREA46 TRAINING LAB
=============================================================================
Data e Ora: ${new Date().toLocaleString("it-IT")}
Evento: Un nuovo atleta ha effettuato il primo accesso tramite social (${provider.toUpperCase()})

DATI DEL NUOVO ATLETA:
- Nome e Cognome: ${found.nome} ${found.cognome}
- Email: ${found.email}
- Ruolo: Atleta
- Saldo Crediti: 0 crediti

STATO ACCOUNT:
L'atleta è stato aggiunto automaticamente all'anagrafica del tuo gestionale.
Ha accesso immediato e gratuito a tutti i programmi di allenamento del Lab.
Puoi visualizzare la sua posizione, assegnare crediti o configurare pacchetti
direttamente dal Pannello Manager Atleti.
=============================================================================
          `.trim();

          await sendEmailNotification({
            to: emailCoach,
            subject: `[AREA46 NOTIFICA] Nuovo Atleta Registrato — ${found.nome} ${found.cognome}`,
            body: notificaSocialBody,
            tipo: "nuovo_utente_registrato",
          });
        }
      } else {
        found.data_ultimo_accesso = new Date().toISOString();
        saveData(db);
      }

      res.setHeader(
        "Set-Cookie",
        `area46_user_id=${encodeURIComponent(found.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
      );
      return res.end(JSON.stringify({ ok: true, user: getHydratedUser(found, db), isNew: isNewOauth }));
    }

    // POST /app-api/auth/switch-user (Switch Ruolo protetto da PIN per Coach)
    if (pathname === "/app-api/auth/switch-user" && method === "POST") {
      const targetId = parsedBody.userId;
      const pin = (parsedBody.pin || "").trim();
      const found = (db.profili_utenti || []).find(
        (u: any) => u.id === targetId || u.email?.toLowerCase() === targetId?.toLowerCase()
      );
      if (found) {
        if (found.ruolo === "manager" && currentUser?.ruolo !== "manager") {
          if (pin !== "4646") {
            res.statusCode = 401;
            return res.end(JSON.stringify({ error: "PIN Coach errato o mancante." }));
          }
        }
        found.data_ultimo_accesso = new Date().toISOString();
        saveData(db);
        res.setHeader(
          "Set-Cookie",
          `area46_user_id=${encodeURIComponent(found.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
        );
        return res.end(JSON.stringify(getHydratedUser(found, db)));
      }
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Utente non trovato" }));
    }

    // POST /app-api/manager/migrazione-glide (Importazione o anteprima dati Glide)
    if (pathname === "/app-api/manager/migrazione-glide" && method === "POST") {
      const isApply = parsedBody.mode === "apply";
      const payload = {
        utenti: parsedBody.utenti || [],
        diario: parsedBody.diario || [],
      };

      const stats = {
        utenti_aggiornati: 0,
        utenti_creati: 0,
        voci_diario_inserite: 0,
        errori: [] as string[],
      };

      if (payload.utenti.length > 0) {
        db.profili_utenti = db.profili_utenti || [];
        for (const u of payload.utenti) {
          if (!u.email || !u.email.includes("@")) {
            stats.errori.push(`Email non valida: ${u.email}`);
            continue;
          }
          const email = u.email.trim().toLowerCase();
          const existing = db.profili_utenti.find((p: any) => p.email.toLowerCase() === email);
          if (existing) {
            if (u.nome) existing.nome = u.nome;
            if (u.cognome) existing.cognome = u.cognome;
            existing.name = `${existing.nome} ${existing.cognome || ""}`.trim();
            if (u.telefono) existing.telefono = u.telefono;
            if (u.codice_fiscale) existing.codice_fiscale = u.codice_fiscale;
            if (u.indirizzo) existing.indirizzo = u.indirizzo;
            if (u.crediti !== undefined) existing.crediti = Number(u.crediti);
            if (u.data_scadenza_crediti) existing.data_scadenza_crediti = u.data_scadenza_crediti;
            if (u.tipo_abbonamento) existing.tipo_abbonamento = u.tipo_abbonamento;
            stats.utenti_aggiornati++;
          } else {
            const nuovo = {
              id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              email,
              nome: u.nome || email.split("@")[0],
              cognome: u.cognome || "",
              name: `${u.nome || email.split("@")[0]} ${u.cognome || ""}`.trim(),
              telefono: u.telefono || "",
              codice_fiscale: u.codice_fiscale || "",
              indirizzo: u.indirizzo || "",
              ruolo: email === "firenzepersonaltrainer@gmail.com" ? "manager" : "atleta",
              crediti: Number(u.crediti || 0),
              tempo_cancellazione_ore: 24,
              data_scadenza_crediti: u.data_scadenza_crediti || null,
              tipo_abbonamento: u.tipo_abbonamento || "standard",
              data_ultimo_accesso: new Date().toISOString(),
            };
            db.profili_utenti.push(nuovo);
            stats.utenti_creati++;
          }
        }
      }

      if (payload.diario.length > 0) {
        db.diario_utente = db.diario_utente || [];
        for (const d of payload.diario) {
          if (!d.email_cliente || !d.nome_esercizio) continue;
          const email = d.email_cliente.trim().toLowerCase();
          const dup = db.diario_utente.some(
            (e: any) => e.email_cliente.toLowerCase() === email && e.nome_esercizio.toLowerCase() === d.nome_esercizio.toLowerCase() && e.data_ora === d.data_ora
          );
          if (!dup) {
            db.diario_utente.push({
              id: Date.now() + Math.floor(Math.random() * 100000),
              email_cliente: email,
              id_esercizio: d.id_esercizio || null,
              nome_esercizio: d.nome_esercizio,
              carico_kg: d.carico_kg ?? null,
              ripetizioni: d.ripetizioni ?? null,
              serie: d.serie ?? null,
              sets_json: d.sets_json ?? null,
              feedback: d.feedback || null,
              data_ora: d.data_ora || new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
            stats.voci_diario_inserite++;
          }
        }
      }

      if (isApply) {
        saveData(db);
      }

      return res.end(JSON.stringify({ ok: true, isApply, stats }));
    }

    // GET /app-api/profili (Lista atleti & coach con policy personale)
    if (pathname === "/app-api/profili" && method === "GET") {
      const now = new Date();
      const delUsers = db.utenti_cancellati || [];
      const profili = (db.profili_utenti || [])
        .filter((p: any) => !delUsers.includes(p.id) && !delUsers.includes(p.email?.toLowerCase()))
        .map((p: any) => {
        const walletOwner = getWalletOwner(p, db);
        const isShared = walletOwner && walletOwner.id !== p.id;
        const effectiveCrediti = isShared ? walletOwner.crediti : p.crediti;
        const effectiveScadenza = isShared ? walletOwner.data_scadenza_crediti : p.data_scadenza_crediti;

        const partners = (db.profili_utenti || []).filter(
          (other: any) =>
            other.id !== p.id &&
            (other.shared_wallet_with === p.id ||
              other.shared_wallet_with?.toLowerCase() === p.email?.toLowerCase())
        );
        const isMaster = partners.length > 0;

        let avviso_scadenza = false;
        let giorni_a_scadenza = null;
        if (effectiveScadenza) {
          const diffDays = Math.ceil(
            (new Date(effectiveScadenza).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          giorni_a_scadenza = diffDays;
          if (diffDays <= 7) avviso_scadenza = true;
        }

        let mesi_inattivita = 0;
        let avviso_inattivita = false;
        if (p.data_ultimo_accesso) {
          const diffMesi =
            (now.getTime() - new Date(p.data_ultimo_accesso).getTime()) /
            (1000 * 60 * 60 * 24 * 30.43);
          mesi_inattivita = Math.floor(diffMesi);
          if (mesi_inattivita >= 5) avviso_inattivita = true;
        }

        return {
          ...p,
          crediti: effectiveCrediti,
          data_scadenza_crediti: effectiveScadenza,
          shared_wallet_with: p.shared_wallet_with || null,
          is_shared_wallet: isShared,
          shared_master_nome: isShared ? `${walletOwner.nome} ${walletOwner.cognome}`.trim() : undefined,
          is_wallet_master: isMaster,
          shared_partners_count: partners.length,
          shared_partner_names: partners.map((x: any) => `${x.nome} ${x.cognome}`.trim()),
          tempo_cancellazione_ore: p.tempo_cancellazione_ore || 24,
          tempo_anticipo_prenotazione_ore: p.tempo_anticipo_prenotazione_ore || 24,
          anticipi_da_scontare: isShared
            ? Number(walletOwner.anticipi_da_scontare || 0)
            : Number(p.anticipi_da_scontare || 0),
          giorni_a_scadenza,
          avviso_scadenza,
          mesi_inattivita,
          avviso_inattivita,
        };
      });
      return res.end(JSON.stringify(profili));
    }

    // POST /app-api/profili (Nuovo atleta con policy cancellazione & anticipo personalizzate)
    if (pathname === "/app-api/profili" && method === "POST") {
      const creditiIniziali = Number(parsedBody.crediti ?? 0);
      const email = (parsedBody.email || `atleta${Date.now()}@area46lab.it`).trim().toLowerCase();
      const existingId = parsedBody.id || `usr-atleta-${Date.now()}`;

      // Rimuovi da utenti_cancellati se presente (riattivazione/nuovo inserimento)
      if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
        db.utenti_cancellati = db.utenti_cancellati.filter(
          (u: string) => u !== existingId && u.toLowerCase() !== email
        );
      }

      db.profili_utenti = db.profili_utenti || [];
      const existingIndex = db.profili_utenti.findIndex(
        (p: any) => (p.id && p.id === existingId) || (p.email && p.email.toLowerCase() === email)
      );

      const nuovo = {
        ...(existingIndex >= 0 ? db.profili_utenti[existingIndex] : {}),
        id: existingIndex >= 0 ? db.profili_utenti[existingIndex].id : existingId,
        nome: (parsedBody.nome || "Nuovo").trim(),
        cognome: (parsedBody.cognome || "Atleta").trim(),
        email: email,
        telefono: (parsedBody.telefono || "").trim(),
        codice_fiscale: (parsedBody.codice_fiscale || "").trim().toUpperCase(),
        partita_iva: (parsedBody.partita_iva || "").trim(),
        pec: (parsedBody.pec || "").trim().toLowerCase(),
        codice_sdi: (parsedBody.codice_sdi || "0000000").trim().toUpperCase(),
        indirizzo: (() => {
          const rawVia = (parsedBody.indirizzo_via || "").trim();
          const rawCiv = (parsedBody.civico || "").trim();
          const rawCap = (parsedBody.cap || "").trim();
          const rawCit = (parsedBody.citta || "").trim();
          const rawPrv = (parsedBody.provincia || "").trim().toUpperCase();
          if (rawVia) {
            return [
              `${rawVia}${rawCiv ? " " + rawCiv : ""}`,
              [rawCap, rawCit].filter(Boolean).join(" ") + (rawPrv ? ` (${rawPrv})` : "")
            ].filter(Boolean).join(", ");
          }
          return (parsedBody.indirizzo || "").trim();
        })(),
        indirizzo_via: (parsedBody.indirizzo_via || "").trim(),
        civico: (parsedBody.civico || "").trim(),
        cap: (parsedBody.cap || "").trim(),
        citta: (parsedBody.citta || "").trim(),
        provincia: (parsedBody.provincia || "").trim().toUpperCase(),
        ruolo: parsedBody.ruolo || "atleta",
        crediti: creditiIniziali,
        anticipi_da_scontare: Number(parsedBody.anticipi_da_scontare || 0),
        shared_wallet_with: parsedBody.shared_wallet_with?.trim() || null,
        tipo_abbonamento:
          parsedBody.tipo_abbonamento ||
          (existingIndex >= 0 && db.profili_utenti[existingIndex].tipo_abbonamento
            ? db.profili_utenti[existingIndex].tipo_abbonamento
            : "standard"),
        stato_iscrizione:
          parsedBody.stato_iscrizione ||
          (existingIndex >= 0 && db.profili_utenti[existingIndex].stato_iscrizione
            ? db.profili_utenti[existingIndex].stato_iscrizione
            : "attivo"),
        tempo_cancellazione_ore: Number(parsedBody.tempo_cancellazione_ore || 24),
        tempo_anticipo_prenotazione_ore: Number(parsedBody.tempo_anticipo_prenotazione_ore || 24),
        data_scadenza_crediti: parsedBody.data_scadenza_crediti || null,
        data_ultimo_accesso: new Date().toISOString(),
        note_coach: parsedBody.note_coach || "",
        created_at:
          existingIndex >= 0 && db.profili_utenti[existingIndex].created_at
            ? db.profili_utenti[existingIndex].created_at
            : new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        db.profili_utenti[existingIndex] = nuovo;
      } else {
        db.profili_utenti.push(nuovo);

        // INVIO AUTOMATICO EMAIL DI BENVENUTO / INVITO ALL'ATLETA
        if (nuovo.email && nuovo.email.includes("@")) {
          try {
            await sendEmailNotification({
              to: nuovo.email,
              subject: "Invito ad Area46 Landmine Lab - Profilo Atleta Attivato",
              body: `Ciao ${nuovo.nome} ${nuovo.cognome}!\n\nIl tuo profilo atleta su Area46 Landmine Lab è stato attivato dal Coach Stefano Tronconi.\n\nAccedi alla Web App dal link:\nhttps://area46-app.vercel.app\n\nPuoi salvare l'applicazione direttamente sulla schermata Home del tuo smartphone per consultare i tuoi allenamenti, il diario ed i crediti.`,
              html: `<div style="font-family: sans-serif; padding: 24px; background-color: #f8f9fa; border-radius: 16px;">
                <h2 style="color: #09090b; margin-top: 0;">Benvenuto in Area46 Landmine Lab!</h2>
                <p style="color: #3f3f46; font-size: 15px;">Ciao <strong>${nuovo.nome} ${nuovo.cognome}</strong>,</p>
                <p style="color: #3f3f46; font-size: 14px;">Il tuo profilo atleta è stato attivato dal Coach Stefano Tronconi su Area46 Landmine Lab.</p>
                <div style="background-color: #ffffff; border: 2px solid #1c00ff; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
                  <a href="https://area46-app.vercel.app" style="font-weight: 900; font-size: 16px; color: #1c00ff; text-decoration: none;">Apri Area46 Web App &rarr;</a>
                </div>
                <p style="color: #71717a; font-size: 12px; margin-top: 16px;">📱 <strong>Istruzioni Smartphone:</strong> Apri il link dal tuo browser mobile (Safari su iPhone o Chrome su Android) e seleziona "Aggiungi a Home" per salvare l'App sullo schermo del telefono.</p>
              </div>`,
              tipo: "invito_atleta",
            });
            console.log(`[INVITO AUTOMATICO] Inviata mail di benvenuto a ${nuovo.email}`);
          } catch (err: any) {
            console.warn("[INVITO AUTOMATICO WARNING]", err?.message || err);
          }
        }
      }

      if (creditiIniziali !== 0) {
        addMovimentoCrediti(db, {
          atleta_id: nuovo.id,
          email_cliente: nuovo.email,
          nome_cliente: `${nuovo.nome} ${nuovo.cognome}`,
          tipo: creditiIniziali > 0 ? "bonus_regalo" : "penalty",
          delta_crediti: creditiIniziali,
          saldo_risultante: creditiIniziali,
          motivazione: "Crediti configurati in anagrafica",
          operatore: "coach",
        });
      }

      // Notifica email all'atleta con istruzioni PWA se è un nuovo profilo inserito dal Coach
      let notificaEmail = null;
      if (existingIndex < 0 && nuovo.ruolo === "atleta" && nuovo.email.includes("@")) {
        const appUrl = "https://area46-app.vercel.app";
        const welcomeBody = `
Ciao ${nuovo.nome}!

Il Coach Stefano Tronconi ha creato il tuo profilo atleta ufficiale nell'applicazione di Area46 Landmine Lab!
Da adesso puoi consultare tutti i tuoi programmi di allenamento, guardare i video tecnici e seguire le sessioni direttamente dal tuo smartphone.

=============================================================================
📱 COME SALVARE E INSTALLARE L'APP SUL TUO TELEFONO (COME UNA VERA APP)
=============================================================================

Per avere l'app sempre a portata di mano sul display del tuo smartphone, segui questa velocissima procedura in base al tuo telefono:

🍏 SE USI IPHONE (APPLE):
1. Apri questo link con il browser SAFARI: ${appUrl}
2. In basso al centro dello schermo, tocca l'icona di Condivisione (il quadrato con la freccetta verso l'alto ⎋).
3. Scorri le opzioni verso il basso e tocca "Aggiungi alla schermata Home" (+).
4. In alto a destra tocca "Aggiungi".
Fatto! L'icona di Area46 apparirà sul tuo schermo: toccandola, l'app si aprirà a schermo intero come una vera applicazione di sistema.

🤖 SE USI ANDROID (SAMSUNG, XIAOMI, GOOGLE PIXEL, MOTOROLA, ECC.):
1. Apri questo link con il browser GOOGLE CHROME: ${appUrl}
2. In alto a destra, tocca i tre puntini verticali (⋮).
3. Tocca la voce "Installa app" oppure "Aggiungi a schermata Home".
4. Conferma toccando "Installa".
Fatto! Troverai l'app Area46 tra le tue applicazioni e sulla tua schermata principale.

=============================================================================
🔑 COME ACCEDERE AL TUO PROFILO
=============================================================================
1. Apri l'app Area46 dal display del telefono.
2. Inserisci la tua email: ${nuovo.email}
3. Clicca su "Ricevi Codice di Accesso (OTP)": non hai bisogno di password complesse, riceverai un comodo codice numerico per accedere in sicurezza istantaneamente.

Buon allenamento con Landmine Lab!
Per qualsiasi dubbio o supporto, chiedi pure a Stefano al Lab.

— Area46 Landmine Lab Firenze
firenzepersonaltrainer@gmail.com
        `.trim();

        notificaEmail = await sendEmailNotification({
          to: nuovo.email,
          subject: `Benvenuto in Area46 Landmine Lab — Il tuo profilo atleta è attivo! 🏋️‍♂️`,
          body: welcomeBody,
          tipo: "benvenuto_nuovo_atleta",
        });
      }

      saveData(db);
      triggerSggSyncAsync();
      await syncDataToGoogleDrive(db);
      res.statusCode = 201;
      return res.end(JSON.stringify({ ...nuovo, notifica_email: notificaEmail, isNew: existingIndex < 0 }));
    }

    // POST /app-api/profili/:id/modifica-crediti
    const modCreditiMatch = pathname.match(/^\/app-api\/profili\/([a-zA-Z0-9_-]+)\/modifica-crediti$/);
    if (modCreditiMatch && method === "POST") {
      const targetId = modCreditiMatch[1];
      const profilo = (db.profili_utenti || []).find((p: any) => p.id === targetId);
      if (!profilo) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Profilo non trovato" }));
      }

      const saldoPrecedente = Number(profilo.crediti) || 0;
      let delta = 0;

      const walletOwner = getWalletOwner(profilo, db);
      const isShared = walletOwner && walletOwner.id !== profilo.id;

      if (parsedBody.crediti !== undefined) {
        const nuovoVal = Number(parsedBody.crediti);
        delta = nuovoVal - saldoPrecedente;
        profilo.crediti = nuovoVal;
        if (isShared && walletOwner) {
          walletOwner.crediti = nuovoVal;
        }
      } else if (parsedBody.delta !== undefined) {
        delta = Number(parsedBody.delta);
        profilo.crediti = saldoPrecedente + delta;
        if (isShared && walletOwner) {
          walletOwner.crediti = (walletOwner.crediti || 0) + delta;
        }
      }

      if (parsedBody.data_scadenza_crediti !== undefined) {
        const valScad = parsedBody.data_scadenza_crediti ? String(parsedBody.data_scadenza_crediti).trim() : null;
        profilo.data_scadenza_crediti = valScad;
        if (isShared && walletOwner) {
          walletOwner.data_scadenza_crediti = valScad;
        }
      }

      if (parsedBody.anticipi_da_scontare !== undefined) {
        const valAnt = Math.max(0, Number(parsedBody.anticipi_da_scontare));
        profilo.anticipi_da_scontare = valAnt;
        if (isShared && walletOwner) {
          walletOwner.anticipi_da_scontare = valAnt;
        }
      } else if (parsedBody.e_anticipo) {
        const deltaPos = delta > 0 ? delta : (Number(parsedBody.crediti ?? 0) - saldoPrecedente);
        if (deltaPos > 0) {
          profilo.anticipi_da_scontare = (profilo.anticipi_da_scontare || 0) + deltaPos;
          if (isShared && walletOwner) {
            walletOwner.anticipi_da_scontare = (walletOwner.anticipi_da_scontare || 0) + deltaPos;
          }
        }
      }

      // Registra nel ledger movimenti crediti
      if (delta !== 0) {
        const isAnticipo = parsedBody.e_anticipo || (parsedBody.tipo === "anticipo_crediti");
        addMovimentoCrediti(db, {
          atleta_id: isShared && walletOwner ? walletOwner.id : profilo.id,
          email_cliente: isShared && walletOwner ? walletOwner.email : profilo.email,
          nome_cliente: isShared && walletOwner ? `${walletOwner.nome} ${walletOwner.cognome}` : `${profilo.nome} ${profilo.cognome}`,
          tipo:
            parsedBody.tipo ||
            (isAnticipo
              ? "modifica_manuale"
              : delta > 0
              ? "bonus_regalo"
              : delta < 0
              ? "penalty"
              : "modifica_manuale"),
          delta_crediti: delta,
          saldo_risultante: profilo.crediti,
          motivazione:
            parsedBody.motivazione ||
            (isAnticipo
              ? `Anticipo di ${delta} crediti concesso dal Coach (da scalare al prossimo acquisto pacchetto)`
              : delta > 0
              ? "Bonus/Regalo assegnato dal Coach"
              : "Rettifica/Penalty manuale Coach"),
          operatore: "coach",
        });
      }

      alignSharedPartnersCredits(walletOwner || profilo, db);

      profilo.updated_at = new Date().toISOString();
      if (isShared && walletOwner) walletOwner.updated_at = new Date().toISOString();
      saveData(db);
      await syncDataToGoogleDrive(db).catch(() => {});
      return res.end(JSON.stringify(profilo));
    }

    // PUT /app-api/profili/:id (Modifica anagrafica profilo e policy cancellazione)
    const profiliPutMatch = pathname.match(/^\/app-api\/profili\/([a-zA-Z0-9_-]+)$/);
    if (profiliPutMatch && method === "PUT") {
      const targetId = profiliPutMatch[1];
      const profilo = (db.profili_utenti || []).find((p: any) => p.id === targetId);
      if (!profilo) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Profilo non trovato" }));
      }
      const walletOwner = getWalletOwner(profilo, db);
      const isShared = walletOwner && walletOwner.id !== profilo.id;

      if (parsedBody.nome !== undefined) profilo.nome = parsedBody.nome;
      if (parsedBody.cognome !== undefined) profilo.cognome = parsedBody.cognome;
      if (parsedBody.email !== undefined) profilo.email = parsedBody.email;
      if (parsedBody.telefono !== undefined) profilo.telefono = parsedBody.telefono;
      if (parsedBody.codice_fiscale !== undefined) {
        profilo.codice_fiscale = parsedBody.codice_fiscale ? String(parsedBody.codice_fiscale).trim().toUpperCase() : "";
      }
      if (parsedBody.partita_iva !== undefined) {
        profilo.partita_iva = parsedBody.partita_iva ? String(parsedBody.partita_iva).trim() : "";
      }
      if (parsedBody.pec !== undefined) {
        profilo.pec = parsedBody.pec ? String(parsedBody.pec).trim().toLowerCase() : "";
      }
      if (parsedBody.codice_sdi !== undefined) {
        profilo.codice_sdi = parsedBody.codice_sdi ? String(parsedBody.codice_sdi).trim().toUpperCase() : "0000000";
      }
      if (parsedBody.indirizzo_via !== undefined) {
        profilo.indirizzo_via = parsedBody.indirizzo_via ? String(parsedBody.indirizzo_via).trim() : "";
      }
      if (parsedBody.civico !== undefined) {
        profilo.civico = parsedBody.civico ? String(parsedBody.civico).trim() : "";
      }
      if (parsedBody.cap !== undefined) {
        profilo.cap = parsedBody.cap ? String(parsedBody.cap).trim() : "";
      }
      if (parsedBody.citta !== undefined) {
        profilo.citta = parsedBody.citta ? String(parsedBody.citta).trim() : "";
      }
      if (parsedBody.provincia !== undefined) {
        profilo.provincia = parsedBody.provincia ? String(parsedBody.provincia).trim().toUpperCase() : "";
      }

      if (
        parsedBody.indirizzo_via !== undefined ||
        parsedBody.civico !== undefined ||
        parsedBody.cap !== undefined ||
        parsedBody.citta !== undefined ||
        parsedBody.provincia !== undefined
      ) {
        const vVia = (profilo.indirizzo_via || "").trim();
        const vCiv = (profilo.civico || "").trim();
        const vCap = (profilo.cap || "").trim();
        const vCit = (profilo.citta || "").trim();
        const vPrv = (profilo.provincia || "").trim();
        if (vVia) {
          profilo.indirizzo = [
            `${vVia}${vCiv ? " " + vCiv : ""}`,
            [vCap, vCit].filter(Boolean).join(" ") + (vPrv ? ` (${vPrv})` : "")
          ].filter(Boolean).join(", ");
        }
      } else if (parsedBody.indirizzo !== undefined) {
        profilo.indirizzo = parsedBody.indirizzo;
      }
      if (parsedBody.crediti !== undefined) {
        profilo.crediti = Number(parsedBody.crediti);
        if (isShared && walletOwner) walletOwner.crediti = Number(parsedBody.crediti);
      }
      if (parsedBody.anticipi_da_scontare !== undefined) {
        const valAnt = Math.max(0, Number(parsedBody.anticipi_da_scontare));
        profilo.anticipi_da_scontare = valAnt;
        if (isShared && walletOwner) walletOwner.anticipi_da_scontare = valAnt;
      }
      if (parsedBody.tempo_cancellazione_ore !== undefined) {
        profilo.tempo_cancellazione_ore = Number(parsedBody.tempo_cancellazione_ore);
      }
      if (parsedBody.tempo_anticipo_prenotazione_ore !== undefined) {
        profilo.tempo_anticipo_prenotazione_ore = Number(parsedBody.tempo_anticipo_prenotazione_ore);
      }
      if (parsedBody.data_scadenza_crediti !== undefined) {
        const valScad = parsedBody.data_scadenza_crediti ? String(parsedBody.data_scadenza_crediti).trim() : null;
        profilo.data_scadenza_crediti = valScad;
        if (isShared && walletOwner) walletOwner.data_scadenza_crediti = valScad;
      }
      if (parsedBody.note_coach !== undefined) profilo.note_coach = parsedBody.note_coach;
      if (parsedBody.shared_wallet_with !== undefined) {
        profilo.shared_wallet_with = parsedBody.shared_wallet_with?.trim() || null;
      }
      if (parsedBody.tipo_abbonamento !== undefined) {
        profilo.tipo_abbonamento = parsedBody.tipo_abbonamento;
      }
      if (parsedBody.stato_iscrizione !== undefined) {
        profilo.stato_iscrizione = parsedBody.stato_iscrizione;
      }
      profilo.updated_at = new Date().toISOString();
      if (isShared && walletOwner) walletOwner.updated_at = new Date().toISOString();
      alignSharedPartnersCredits(walletOwner || profilo, db);
      saveData(db);
      triggerSggSyncAsync();
      await syncDataToGoogleDrive(db);
      return res.end(JSON.stringify(profilo));
    }

    // DELETE /app-api/atleti/:id oppure /app-api/profili/:id (Cancellazione definitiva completa di atleta, fisco e storico)
    const atletaDeleteMatch = pathname.match(/^\/app-api\/(?:atleti|profili)\/([a-zA-Z0-9_@.-]+)$/);
    if (atletaDeleteMatch && method === "DELETE") {
      const targetIdentifier = decodeURIComponent(atletaDeleteMatch[1]);

      const atleta = (db.profili_utenti || []).find(
        (p: any) => p.id === targetIdentifier || p.email?.toLowerCase() === targetIdentifier.toLowerCase()
      );

      const targetId = atleta ? atleta.id : targetIdentifier;
      const targetEmail = atleta ? atleta.email?.toLowerCase() : targetIdentifier.toLowerCase();

      // 1. Rimuovi da profili_utenti e registra in utenti_cancellati
      db.profili_utenti = (db.profili_utenti || []).filter(
        (p: any) => p.id !== targetId && p.email?.toLowerCase() !== targetEmail
      );
      db.utenti_cancellati = db.utenti_cancellati || [];
      if (targetId && !db.utenti_cancellati.includes(targetId)) {
        db.utenti_cancellati.push(targetId);
      }
      if (targetEmail && !db.utenti_cancellati.includes(targetEmail)) {
        db.utenti_cancellati.push(targetEmail);
      }

      // NOTA FISCALE: le transazioni in db.transazioni_pagamenti NON vengono cancellate:
      // i movimenti fiscali e gli incassi storici devono restare a norma contabile.

      // 2. Rimuovi da prenotazioni_slot e traccia in prenotazioni_cancellate
      const bksToRemove = (db.prenotazioni_slot || []).filter(
        (p: any) => p.atleta_id === targetId || p.email_cliente?.toLowerCase() === targetEmail
      );
      const bksToRemoveIds = bksToRemove.map((p: any) => p.id);
      db.prenotazioni_cancellate = Array.from(
        new Set([...(db.prenotazioni_cancellate || []), ...bksToRemoveIds])
      );
      db.prenotazioni_slot = (db.prenotazioni_slot || []).filter(
        (p: any) => p.atleta_id !== targetId && p.email_cliente?.toLowerCase() !== targetEmail
      );

      // 4. Rimuovi da movimenti_crediti
      db.movimenti_crediti = (db.movimenti_crediti || []).filter(
        (m: any) => m.atleta_id !== targetId && m.email_cliente?.toLowerCase() !== targetEmail
      );

      // 5. Rimuovi da diario_utente
      db.diario_utente = (db.diario_utente || []).filter(
        (d: any) => d.email_cliente?.toLowerCase() !== targetEmail
      );

      // 6. Rimuovi da stato_allenamenti
      db.stato_allenamenti = (db.stato_allenamenti || []).filter(
        (s: any) => s.email_cliente?.toLowerCase() !== targetEmail
      );

      // 7. Rimuovi da preferenze_utente
      db.preferenze_utente = (db.preferenze_utente || []).filter(
        (pref: any) => pref.email?.toLowerCase() !== targetEmail
      );

      saveData(db);
      await syncDataToGoogleDrive(db);
      return res.end(
        JSON.stringify({
          success: true,
          message: "Atleta e tutti i dati associati eliminati definitivamente con successo",
        })
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DISMISSIONE ANTICIPATA ATLETA (Penale automatica, ricalcolo, cancellazione slot)
    // ─────────────────────────────────────────────────────────────────────────

    // GET /app-api/atleti/:id/anteprima-dismissione
    const dismAnteprimaMatch = pathname.match(
      /^\/app-api\/atleti\/([a-zA-Z0-9_-]+)\/anteprima-dismissione$/
    );
    if (dismAnteprimaMatch && method === "GET") {
      const atletaId = dismAnteprimaMatch[1];
      const atleta = (db.profili_utenti || []).find((p: any) => p.id === atletaId);
      if (!atleta) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Atleta non trovato" }));
      }

      const tipoAbb = atleta.tipo_abbonamento || "standard";
      const isContinuativo = tipoAbb.startsWith("lab_continuativo");
      const tariffaPiena = tipoAbb === "lab_continuativo_2x" ? 35.0 : 33.25;
      const todayStr = new Date().toISOString().slice(0, 10);
      const currentTimeStr = new Date().toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const tuttePrenotazioni = (db.prenotazioni_slot || []).filter(
        (p: any) => p.atleta_id === atleta.id || p.email_cliente === atleta.email
      );

      const seduteSvolteList = tuttePrenotazioni.filter(
        (p: any) =>
          p.stato === "confermata" &&
          (p.data < todayStr || (p.data === todayStr && p.orario <= currentTimeStr))
      );
      const seduteSvolteCount = seduteSvolteList.length;

      const prenotazioniFuture = tuttePrenotazioni.filter(
        (p: any) =>
          p.stato === "confermata" &&
          (p.data > todayStr || (p.data === todayStr && p.orario > currentTimeStr))
      );

      const transazioniAtleta = (db.transazioni_pagamenti || []).filter(
        (t: any) =>
          (t.atleta_id === atleta.id || t.email_cliente === atleta.email) &&
          t.stato === "completato"
      );
      // Calcolo quota mensile standard pre-approvata (quota esatta del piano senza formule arbitrarie)
      let quotaMensileStandard = 250.0;
      const txContinuativo = transazioniAtleta.find(
        (t: any) =>
          t.id_pacchetto?.includes("continuativo") ||
          t.nome_pacchetto?.toLowerCase().includes("continuativo")
      );
      if (txContinuativo && Number(txContinuativo.importo_euro) > 0) {
        quotaMensileStandard = Number(txContinuativo.importo_euro);
      } else if (tipoAbb.includes("3x")) {
        quotaMensileStandard = tipoAbb.includes("annuale") ? 329.0 : 359.0;
      } else if (tipoAbb.includes("2x")) {
        quotaMensileStandard = tipoAbb.includes("annuale") ? 230.0 : 250.0;
      } else if ((atleta as any).quota_mensile_euro) {
        quotaMensileStandard = Number((atleta as any).quota_mensile_euro);
      }

      const totaleDaAddebitare = isContinuativo ? quotaMensileStandard : 0.0;

      const emailCoach =
        db.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";

      return res.end(
        JSON.stringify({
          atleta: {
            id: atleta.id,
            nome: atleta.nome,
            cognome: atleta.cognome,
            email: atleta.email,
            telefono: atleta.telefono,
            codice_fiscale: atleta.codice_fiscale,
            indirizzo: atleta.indirizzo,
            crediti: atleta.crediti,
            tipo_abbonamento: tipoAbb,
            stato_iscrizione: atleta.stato_iscrizione || "attivo",
          },
          tipo_abbonamento: tipoAbb,
          quota_mensile_standard: quotaMensileStandard,
          totale_da_addebitare: totaleDaAddebitare,
          sedute_svolte: seduteSvolteCount,
          prenotazioni_future: prenotazioniFuture,
          email_coach: emailCoach,
        })
      );
    }

    // POST /app-api/atleti/:id/dismissione-anticipata
    const dismExecuteMatch = pathname.match(
      /^\/app-api\/atleti\/([a-zA-Z0-9_-]+)\/dismissione-anticipata$/
    );
    if (dismExecuteMatch && method === "POST") {
      const atletaId = dismExecuteMatch[1];
      const atleta = (db.profili_utenti || []).find((p: any) => p.id === atletaId);
      if (!atleta) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Atleta non trovato" }));
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const currentTimeStr = new Date().toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // 1. Cancella e libera tutte le prenotazioni future
      const prenotazioniCancellate: any[] = [];
      (db.prenotazioni_slot || []).forEach((p: any) => {
        const isThisAthlete = p.atleta_id === atleta.id || p.email_cliente === atleta.email;
        const isFuture = p.data > todayStr || (p.data === todayStr && p.orario >= currentTimeStr);
        if (isThisAthlete && isFuture && p.stato === "confermata") {
          p.stato = "cancellata_dismissione";
          p.cancellato_il = new Date().toISOString();
          p.note = "Cancellata per dismissione anticipata atleta";
          prenotazioniCancellate.push({ id: p.id, data: p.data, orario: p.orario });
        }
      });

      // 2. Determinazione quota mensile di saldo (identica alla tariffa approvata)
      const tipoAbb = atleta.tipo_abbonamento || "standard";
      const isContinuativo = tipoAbb.startsWith("lab_continuativo");
      const defaultQuota = isContinuativo ? (tipoAbb.includes("3x") ? 359.0 : 250.0) : 0.0;
      const quotaFinale = Number(
        parsedBody.quota_mensile_saldo ?? parsedBody.penale_euro ?? defaultQuota
      );

      // 3. Registra transazione incasso / fatturazione chiusura accordo
      const txCode = `TX-DISM-${Date.now().toString().slice(-6)}`;
      const nuovaTransazione = {
        codice_transazione: txCode,
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: `${atleta.nome} ${atleta.cognome}`.trim(),
        codice_fiscale: atleta.codice_fiscale || "",
        indirizzo: atleta.indirizzo || "",
        id_pacchetto: "dismissione-anticipata",
        nome_pacchetto: `Saldo chiusura accordo continuativo Lab e svincolo slot (preavviso 30 giorni ex art. 1373 c.c.)`,
        importo_euro: quotaFinale,
        metodo: "carta",
        crediti_acquistati: 0,
        debiti_decurtati: 0,
        crediti_effettivi_aggiunti: 0,
        stato: "completato",
        stato_fattura: "da_emettere",
        note: parsedBody.note || "Chiusura accordo con preavviso 30 giorni",
        created_at: new Date().toISOString(),
      };
      db.transazioni_pagamenti = db.transazioni_pagamenti || [];
      db.transazioni_pagamenti.unshift(nuovaTransazione);

      // 4. Aggiorna stato atleta nel database
      const creditiPrecedenti = atleta.crediti || 0;
      atleta.crediti = 0;
      atleta.stato_iscrizione = "dismesso";
      atleta.tipo_abbonamento = "nessuno";
      atleta.data_ultimo_accesso = new Date().toISOString();
      const notaAggiunta = `[DISMESSO il ${new Date().toLocaleDateString(
        "it-IT"
      )}: quota chiusura € ${quotaFinale.toFixed(2)} (preavviso 30 giorni). Revocati ${
        prenotazioniCancellate.length
      } slot.]`;
      atleta.note_coach = atleta.note_coach
        ? `${atleta.note_coach} | ${notaAggiunta}`
        : notaAggiunta;

      // 5. Movimento audit crediti
      addMovimentoCrediti(db, {
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: `${atleta.nome} ${atleta.cognome}`,
        tipo: "penalty",
        delta_crediti: -creditiPrecedenti,
        saldo_risultante: 0,
        motivazione: `Dismissione: saldo ultima mensilità contrattuale (€ ${quotaFinale.toFixed(2)}) e revoca di ${prenotazioniCancellate.length} slot futuri.`,
        operatore: "coach",
      });

      // 6. Genera e invia notifica email al coach
      const emailCoach =
        db.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";
      const emailBody = `
RIEPILOGO CHIUSURA ACCORDO & PREAVVISO — AREA46 TRAINING LAB
=============================================================================
Data Operazione: ${new Date().toLocaleString("it-IT")}
Codice Transazione: ${txCode}
Stato Fiscale: DA EMETTERE

DATI FISCALI CLIENTE:
- Nome e Cognome: ${atleta.nome} ${atleta.cognome}
- Codice Fiscale: ${atleta.codice_fiscale || "NON SPECIFICATO"}
- Indirizzo Fatturazione: ${atleta.indirizzo || "NON SPECIFICATO"}
- Email: ${atleta.email}
- Telefono: ${atleta.telefono || "-"}

CONTEGGIO CHIUSURA ACCORDO:
- Importo Mensilità di Chiusura / Preavviso (art. 1373 c.c.): € ${quotaFinale.toFixed(2)}
- Slot revocati e liberati a calendario: ${prenotazioniCancellate.length} prenotazioni rimosse.
-----------------------------------------------------------------------------
TOTALE NETTO ADDEBITATO DA FATTURARE: € ${quotaFinale.toFixed(2)}
=============================================================================

INDICAZIONI PER EMISSIONE FATTURA (SDI / GESTIONALE):
- Oggetto / Descrizione: "Saldo per risoluzione e chiusura accordo continuativo Lab, conguaglio preavviso 30 giorni e svincolo slot riservati ex art. 1373 c.c."
- Importo Imponibile: € ${quotaFinale.toFixed(2)}
- Regime: Forfettario (esente IVA ex L. 190/2014) o Ordinario.
- Termine di emissione: Entro 12 giorni dalla data odierna.

CALENDARIO E PRENOTAZIONI:
- Slot revocati e liberati con successo: ${prenotazioniCancellate.length} prenotazioni rimosse.
- Posizione atleta: ARCHIVIATA / DISMESSA.
      `.trim();

      db.notifiche_email = db.notifiche_email || [];
      const emailRecord = {
        id: `email-${Date.now()}`,
        destinatario: emailCoach,
        oggetto: `[AREA46 FISCO] Chiusura Accordo ${atleta.nome} ${atleta.cognome} — Dati per Emissione Fattura`,
        corpo: emailBody,
        inviato_il: new Date().toISOString(),
        stato: "inviata",
      };
      db.notifiche_email.unshift(emailRecord);
      saveData(db);

      console.log(`[EMAIL DISMISSIONE] Inviata a ${emailCoach}:`, emailRecord.oggetto);

      return res.end(
        JSON.stringify({
          ok: true,
          messaggio: `Dismissione completata con successo! Revocate ${prenotazioniCancellate.length} prenotazioni future. Addebitata quota di chiusura di € ${quotaFinale.toFixed(2)}.`,
          dettagli: {
            atleta_id: atleta.id,
            nome_cliente: `${atleta.nome} ${atleta.cognome}`,
            codice_transazione: txCode,
            totale_addebitato: quotaFinale,
            quota_mensile: quotaFinale,
            prenotazioni_cancellate: prenotazioniCancellate,
          },
        })
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MOVIMENTI CREDITI (Ledger / Storico contabile per cliente)
    // ─────────────────────────────────────────────────────────────────────────

    // GET /app-api/movimenti-crediti
    if (pathname === "/app-api/movimenti-crediti" && method === "GET") {
      const atletaId = url.searchParams.get("atleta_id");
      const emailParam = url.searchParams.get("email");

      let rows = db.movimenti_crediti || [];
      if (currentUser?.ruolo === "atleta") {
        rows = rows.filter(
          (m: any) => m.email_cliente === currentUser?.email || m.atleta_id === currentUser?.id
        );
      } else if (atletaId) {
        rows = rows.filter((m: any) => m.atleta_id === atletaId);
      } else if (emailParam) {
        rows = rows.filter((m: any) => m.email_cliente === emailParam);
      }

      rows.sort(
        (a: any, b: any) => new Date(b.data_ora).getTime() - new Date(a.data_ora).getTime()
      );
      return res.end(JSON.stringify(rows));
    }

    // POST /app-api/movimenti-crediti (Registrazione Bonus, Penalty o Regalo del Coach)
    if (pathname === "/app-api/movimenti-crediti" && method === "POST") {
      const atletaId = parsedBody.atleta_id;
      const atleta = (db.profili_utenti || []).find((p: any) => p.id === atletaId);
      if (!atleta) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Atleta non trovato" }));
      }

      const delta = Number(parsedBody.delta_crediti || 0);
      atleta.crediti = (Number(atleta.crediti) || 0) + delta;
      atleta.updated_at = new Date().toISOString();

      const mov = addMovimentoCrediti(db, {
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: `${atleta.nome} ${atleta.cognome}`,
        tipo: parsedBody.tipo || (delta >= 0 ? "bonus_regalo" : "penalty"),
        delta_crediti: delta,
        saldo_risultante: atleta.crediti,
        motivazione: parsedBody.motivazione || (delta >= 0 ? "Regalo Coach" : "Penalty"),
        operatore: "coach",
      });

      saveData(db);
      res.statusCode = 201;
      return res.end(JSON.stringify({ ok: true, movimento: mov, crediti_attuali: atleta.crediti }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ECCEZIONI CALENDARIO (Slot straordinari, blocchi, ferie, chiusure Lab)
    // ─────────────────────────────────────────────────────────────────────────

    // GET /app-api/eccezioni-calendario
    if (pathname === "/app-api/eccezioni-calendario" && method === "GET") {
      const dataFilter = url.searchParams.get("data");
      let list = db.eccezioni_calendario || [];
      if (dataFilter) {
        list = list.filter((e: any) => e.data === dataFilter);
      }
      return res.end(JSON.stringify(list));
    }

    // POST /app-api/eccezioni-calendario (supporta singolo slot, array o orari multipli)
    if (pathname === "/app-api/eccezioni-calendario" && method === "POST") {
      db.eccezioni_calendario = db.eccezioni_calendario || [];

      // Se riceve un array di orari per la stessa data (blocco multiplo)
      if (parsedBody.orari && Array.isArray(parsedBody.orari) && parsedBody.orari.length > 0) {
        const createList = [];
        for (const o of parsedBody.orari) {
          const nuova = {
            id: `exc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            data: parsedBody.data,
            orario: o,
            tipo: parsedBody.tipo || "slot_bloccato",
            motivo: parsedBody.motivo || "",
            created_at: new Date().toISOString(),
          };
          db.eccezioni_calendario.push(nuova);
          createList.push(nuova);
        }
        saveData(db);
        res.statusCode = 201;
        return res.end(JSON.stringify(createList));
      }

      const nuova = {
        id: `exc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        data: parsedBody.data,
        orario: parsedBody.orario || null,
        tipo: parsedBody.tipo || "slot_straordinario", // 'slot_straordinario', 'slot_bloccato', 'chiusura_giornata'
        motivo: parsedBody.motivo || "",
        created_at: new Date().toISOString(),
      };
      db.eccezioni_calendario.push(nuova);

      // Rimborso automatico se chiusura giornata o blocco slot con prenotazioni attive
      const prorogaGiorniSingola = Number(parsedBody.proroga_giorni) || 0;
      if (parsedBody.tipo === "chiusura_giornata" || parsedBody.tipo === "slot_bloccato") {
        (db.prenotazioni_slot || []).forEach((bk: any) => {
          const matchData = bk.data === parsedBody.data;
          const matchOrario = parsedBody.tipo === "chiusura_giornata" || bk.orario === parsedBody.orario;
          if (matchData && matchOrario && (bk.stato === "confermata" || !bk.stato || bk.stato === "attiva")) {
            bk.stato = "cancellata_in_tempo";
            bk.cancellato_il = new Date().toISOString();
            bk.note = `Annullata per chiusura studio: ${parsedBody.motivo || "Chiusura del Coach"}`;
            const atleta = (db.profili_utenti || []).find(
              (p: any) => p.id === bk.atleta_id || p.email?.toLowerCase() === bk.email_cliente?.toLowerCase()
            );
            const walletOwner = atleta ? getWalletOwner(atleta, db) : null;
            if (walletOwner && bk.credito_scalato) {
              walletOwner.crediti = (walletOwner.crediti ?? 0) + 1;
              walletOwner.updated_at = new Date().toISOString();
              if (atleta) atleta.updated_at = new Date().toISOString();

              if (prorogaGiorniSingola > 0 && walletOwner.data_scadenza_crediti) {
                const sDate = new Date(walletOwner.data_scadenza_crediti + "T00:00:00");
                sDate.setDate(sDate.getDate() + prorogaGiorniSingola);
                const y = sDate.getFullYear();
                const m = String(sDate.getMonth() + 1).padStart(2, "0");
                const d = String(sDate.getDate()).padStart(2, "0");
                walletOwner.data_scadenza_crediti = `${y}-${m}-${d}`;
              }

              alignSharedPartnersCredits(walletOwner, db);
              addMovimentoCrediti(db, {
                atleta_id: walletOwner.id,
                email_cliente: walletOwner.email,
                nome_cliente: `${walletOwner.nome} ${walletOwner.cognome}`.trim(),
                tipo: "rimborso_cancellazione",
                delta_crediti: 1,
                saldo_risultante: walletOwner.crediti,
                motivazione: `Rimborso slot ${bk.data} ${bk.orario} per chiusura studio (${parsedBody.motivo || "Chiusura del Coach"})${
                  prorogaGiorniSingola > 0 ? ` [Proroga carnet +${prorogaGiorniSingola}gg]` : ""
                }`,
                operatore: "coach",
              });
            }
          }
        });
      }

      saveData(db);
      res.statusCode = 201;
      return res.end(JSON.stringify(nuova));
    }

    // POST /app-api/eccezioni-calendario/chiusura-periodo (Chiusura studio con proroga automatica scadenze)
    if (pathname === "/app-api/eccezioni-calendario/chiusura-periodo" && method === "POST") {
      const { data_inizio, data_fine, motivo, proroga_scadenze, proroga_giorni } = parsedBody;
      if (!data_inizio || !data_fine) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Date di inizio e fine periodo obbligatorie" }));
      }

      db.eccezioni_calendario = db.eccezioni_calendario || [];
      const start = new Date(data_inizio);
      const end = new Date(data_fine);
      const diffMs = end.getTime() - start.getTime();
      const giorniChiusura = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

      // Giorni proroga selezionati da roulette (o default giorni chiusura se non specificato)
      const giorniEffettiviProroga =
        proroga_giorni !== undefined && proroga_giorni !== null ? Number(proroga_giorni) : giorniChiusura;

      // Crea eccezioni giorno per giorno
      const dateCreate: string[] = [];
      const cur = new Date(start);
      const atletiCoinvolti = new Set<string>();

      while (cur <= end) {
        const dStr = cur.toISOString().slice(0, 10);
        dateCreate.push(dStr);
        const existing = db.eccezioni_calendario.find(
          (e: any) => e.data === dStr && e.tipo === "chiusura_giornata"
        );
        if (!existing) {
          db.eccezioni_calendario.push({
            id: `exc-close-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            data: dStr,
            orario: null,
            tipo: "chiusura_giornata",
            motivo: motivo || "Chiusura programmata dello studio",
            created_at: new Date().toISOString(),
          });
        }

        // Annulla e rimborsa eventuali prenotazioni atleti già presenti in questo giorno
        (db.prenotazioni_slot || []).forEach((bk: any) => {
          if (bk.data === dStr && (bk.stato === "confermata" || !bk.stato || bk.stato === "attiva")) {
            bk.stato = "cancellata_in_tempo";
            bk.cancellato_il = new Date().toISOString();
            bk.note = `Annullata per chiusura studio: ${motivo || "Chiusura programmata"}`;
            const atleta = (db.profili_utenti || []).find(
              (p: any) => p.id === bk.atleta_id || p.email?.toLowerCase() === bk.email_cliente?.toLowerCase()
            );
            const walletOwner = atleta ? getWalletOwner(atleta, db) : null;
            if (walletOwner && bk.credito_scalato) {
              walletOwner.crediti = (walletOwner.crediti ?? 0) + 1;
              walletOwner.updated_at = new Date().toISOString();
              if (atleta) atleta.updated_at = new Date().toISOString();
              atletiCoinvolti.add(walletOwner.id);

              alignSharedPartnersCredits(walletOwner, db);
              addMovimentoCrediti(db, {
                atleta_id: walletOwner.id,
                email_cliente: walletOwner.email,
                nome_cliente: `${walletOwner.nome} ${walletOwner.cognome}`.trim(),
                tipo: "rimborso_cancellazione",
                delta_crediti: 1,
                saldo_risultante: walletOwner.crediti,
                motivazione: `Rimborso slot ${bk.data} ${bk.orario} per chiusura studio (${
                  motivo || "Chiusura programmata"
                })`,
                operatore: "coach",
              });
            }
          }
        });

        cur.setDate(cur.getDate() + 1);
      }

      // Se proroga_scadenze è true o giorniEffettiviProroga > 0: slitta la scadenza degli atleti
      let atletiAggiornati = 0;
      if (proroga_scadenze !== false && giorniEffettiviProroga > 0) {
        (db.profili_utenti || []).forEach((p: any) => {
          if (
            p.ruolo === "atleta" &&
            p.stato_iscrizione !== "dismesso" &&
            p.data_scadenza_crediti
          ) {
            // Proroga applicata agli atleti con prenotazioni nel periodo o con scadenza >= inizio
            if (p.data_scadenza_crediti >= data_inizio || atletiCoinvolti.has(p.id)) {
              const oldScad = new Date(p.data_scadenza_crediti + "T00:00:00");
              oldScad.setDate(oldScad.getDate() + giorniEffettiviProroga);
              const y = oldScad.getFullYear();
              const m = String(oldScad.getMonth() + 1).padStart(2, "0");
              const d = String(oldScad.getDate()).padStart(2, "0");
              p.data_scadenza_crediti = `${y}-${m}-${d}`;
              p.updated_at = new Date().toISOString();
              atletiAggiornati++;

              addMovimentoCrediti(db, {
                atleta_id: p.id,
                email_cliente: p.email,
                nome_cliente: `${p.nome} ${p.cognome}`.trim(),
                tipo: "bonus_regalo",
                delta_crediti: 0,
                saldo_risultante: p.crediti,
                motivazione: `Proroga di +${giorniEffettiviProroga} giorni per chiusura studio (${
                  motivo || "Ferie / Festività"
                }). Nuova scadenza: ${p.data_scadenza_crediti}`,
                operatore: "coach",
              });
            }
          }
        });
      }

      saveData(db);
      res.statusCode = 201;
      return res.end(
        JSON.stringify({
          ok: true,
          giorni_chiusura: giorniChiusura,
          giorni_proroga: giorniEffettiviProroga,
          date_bloccate: dateCreate.length,
          atleti_prorogati: atletiAggiornati,
          messaggio: `Chiusura studio registrata per ${giorniChiusura} giorni (${data_inizio} ➔ ${data_fine}). ${
            giorniEffettiviProroga > 0
              ? `Scadenze prorogate di +${giorniEffettiviProroga} giorni per ${atletiAggiornati} atleti.`
              : ""
          }`,
        })
      );
    }

    // DELETE /app-api/eccezioni-calendario/:id
    const excDeleteMatch = pathname.match(/^\/app-api\/eccezioni-calendario\/([a-zA-Z0-9_-]+)$/);
    if (excDeleteMatch && method === "DELETE") {
      const id = excDeleteMatch[1];
      db.eccezioni_calendario = (db.eccezioni_calendario || []).filter((e: any) => e.id !== id);
      saveData(db);
      return res.end(JSON.stringify({ ok: true }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ATTIVITÀ LAB (Landmine Lab, Personal, Mobility, ecc.)
    // ─────────────────────────────────────────────────────────────────────────

    // GET /app-api/attivita
    if (pathname === "/app-api/attivita" && method === "GET") {
      return res.end(JSON.stringify(db.attivita_lab || []));
    }

    // POST /app-api/attivita
    if (pathname === "/app-api/attivita" && method === "POST") {
      db.attivita_lab = db.attivita_lab || [];
      const nuovaAttivita = {
        id: parsedBody.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nome: parsedBody.nome || "Nuova Attività",
        descrizione: parsedBody.descrizione || "",
        costo_crediti: Number(parsedBody.costo_crediti) ?? 1,
        max_partecipanti: Number(parsedBody.max_partecipanti) ?? 1,
        durata_minuti: Number(parsedBody.durata_minuti) ?? 60,
        colore: parsedBody.colore || "#1c00ff",
        attiva: parsedBody.attiva !== false,
        created_at: new Date().toISOString(),
      };
      db.attivita_lab.push(nuovaAttivita);
      saveData(db);
      res.statusCode = 201;
      return res.end(JSON.stringify(nuovaAttivita));
    }

    // PUT /app-api/attivita/:id
    const actPutMatch = pathname.match(/^\/app-api\/attivita\/([a-zA-Z0-9_-]+)$/);
    if (actPutMatch && method === "PUT") {
      const id = actPutMatch[1];
      db.attivita_lab = db.attivita_lab || [];
      const idx = db.attivita_lab.findIndex((a: any) => a.id === id);
      if (idx === -1) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Attività non trovata" }));
      }
      db.attivita_lab[idx] = { ...db.attivita_lab[idx], ...parsedBody, id };
      saveData(db);
      return res.end(JSON.stringify(db.attivita_lab[idx]));
    }

    // DELETE /app-api/attivita/:id
    const actDelMatch = pathname.match(/^\/app-api\/attivita\/([a-zA-Z0-9_-]+)$/);
    if (actDelMatch && method === "DELETE") {
      const id = actDelMatch[1];
      db.attivita_lab = (db.attivita_lab || []).filter((a: any) => a.id !== id);
      saveData(db);
      return res.end(JSON.stringify({ ok: true }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGOLE DI PALINSESTO RICORRENTE (Stile Bookyway)
    // ─────────────────────────────────────────────────────────────────────────

    // GET /app-api/regole-palinsesto
    if (pathname === "/app-api/regole-palinsesto" && method === "GET") {
      return res.end(JSON.stringify(db.regole_palinsesto || []));
    }

    // POST /app-api/regole-palinsesto
    if (pathname === "/app-api/regole-palinsesto" && method === "POST") {
      db.regole_palinsesto = db.regole_palinsesto || [];
      const nuovaRegola = {
        id: parsedBody.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nome: parsedBody.nome || "Nuovo Palinsesto",
        id_attivita: parsedBody.id_attivita || "act-landmine-lab",
        data_inizio: parsedBody.data_inizio || new Date().toISOString().slice(0, 10),
        data_fine: parsedBody.data_fine || null,
        giorni_settimana: Array.isArray(parsedBody.giorni_settimana) ? parsedBody.giorni_settimana : [1, 3, 5],
        fasce_orarie: Array.isArray(parsedBody.fasce_orarie) ? parsedBody.fasce_orarie : [],
        attiva: parsedBody.attiva !== false,
        created_at: new Date().toISOString(),
      };
      db.regole_palinsesto.push(nuovaRegola);
      saveData(db);
      res.statusCode = 201;
      return res.end(JSON.stringify(nuovaRegola));
    }

    // PUT /app-api/regole-palinsesto/:id
    const rulePutMatch = pathname.match(/^\/app-api\/regole-palinsesto\/([a-zA-Z0-9_-]+)$/);
    if (rulePutMatch && method === "PUT") {
      const id = rulePutMatch[1];
      db.regole_palinsesto = db.regole_palinsesto || [];
      const idx = db.regole_palinsesto.findIndex((r: any) => r.id === id);
      if (idx === -1) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Regola di palinsesto non trovata" }));
      }
      db.regole_palinsesto[idx] = { ...db.regole_palinsesto[idx], ...parsedBody, id };
      saveData(db);
      return res.end(JSON.stringify(db.regole_palinsesto[idx]));
    }

    // DELETE /app-api/regole-palinsesto/:id
    const ruleDelMatch = pathname.match(/^\/app-api\/regole-palinsesto\/([a-zA-Z0-9_-]+)$/);
    if (ruleDelMatch && method === "DELETE") {
      const id = ruleDelMatch[1];
      db.regole_palinsesto = (db.regole_palinsesto || []).filter((r: any) => r.id !== id);
      saveData(db);
      return res.end(JSON.stringify({ ok: true }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIGURAZIONE LAB (Policy globale di default, orari, IBAN)
    // ─────────────────────────────────────────────────────────────────────────

    if (pathname === "/app-api/lab-config" && method === "GET") {
      const reqSecret = (req.headers["x-stripe-secret-key"] as string)?.trim();
      const reqPub = (req.headers["x-stripe-publishable-key"] as string)?.trim();
      if (reqSecret && (!db.configurazione_lab?.stripe_secret_key || (!db.configurazione_lab.stripe_secret_key.startsWith("sk_") && !db.configurazione_lab.stripe_secret_key.startsWith("rk_")))) {
        db.configurazione_lab = db.configurazione_lab || {};
        db.configurazione_lab.stripe_secret_key = reqSecret;
        if (reqPub) db.configurazione_lab.stripe_publishable_key = reqPub;
        db.configurazione_lab.stripe_collegato = true;
        saveData(db);
      } else if (process.env.STRIPE_SECRET_KEY && (!db.configurazione_lab?.stripe_secret_key || (!db.configurazione_lab.stripe_secret_key.startsWith("sk_") && !db.configurazione_lab.stripe_secret_key.startsWith("rk_")))) {
        db.configurazione_lab = db.configurazione_lab || {};
        db.configurazione_lab.stripe_secret_key = process.env.STRIPE_SECRET_KEY.trim();
        if (process.env.STRIPE_PUBLISHABLE_KEY) {
          db.configurazione_lab.stripe_publishable_key = process.env.STRIPE_PUBLISHABLE_KEY.trim();
        }
        if (process.env.STRIPE_WEBHOOK_SECRET) {
          db.configurazione_lab.stripe_webhook_secret = process.env.STRIPE_WEBHOOK_SECRET.trim();
        }
        db.configurazione_lab.stripe_collegato = true;
        saveData(db);
      }
      return res.end(JSON.stringify(db.configurazione_lab || {}));
    }

    if (pathname === "/app-api/lab-config" && method === "PUT") {
      db.configurazione_lab = {
        ...(db.configurazione_lab || {}),
        ...parsedBody,
      };
      saveData(db);
      syncConfigToGoogleDrive(db.configurazione_lab).catch(() => {});
      return res.end(JSON.stringify(db.configurazione_lab));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRENOTAZIONI SLOT 1:1
    // ─────────────────────────────────────────────────────────────────────────

    // POST /app-api/sync-gcal (Sincronizzazione manuale o forzata con Google Calendar)
    if (pathname === "/app-api/sync-gcal" && method === "POST") {
      const result = await pullGoogleCalendarLabSlots({ force: true });
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: true, ...result }));
    }

    // GET /app-api/prenotazioni
    if (pathname === "/app-api/prenotazioni" && method === "GET") {
      const syncParam = url.searchParams.get("sync");
      const forceSync = syncParam === "true" || syncParam === "1";
      await pullGoogleCalendarLabSlots({ force: forceSync });

      const dataFilter = url.searchParams.get("data");
      const emailFilter = url.searchParams.get("email");
      const atletaIdFilter = url.searchParams.get("atleta_id");
      const delBks = db.prenotazioni_cancellate || [];
      let prenotazioni = (db.prenotazioni_slot || []).filter(
        (p: any) =>
          !isBookingIdCancelled(p.id, delBks) &&
          (p.stato === "confermata" || !p.stato || p.stato === "attiva") &&
          !p.stato?.startsWith("cancellata")
      );
      if (dataFilter) {
        prenotazioni = prenotazioni.filter((p: any) => p.data === dataFilter);
      }
      if (emailFilter) {
        const ef = emailFilter.toLowerCase();
        prenotazioni = prenotazioni.filter(
          (p: any) => p.email_cliente?.toLowerCase() === ef || p.atleta_id === emailFilter
        );
      }
      if (atletaIdFilter) {
        prenotazioni = prenotazioni.filter((p: any) => p.atleta_id === atletaIdFilter);
      }
      return res.end(JSON.stringify(prenotazioni));
    }

    // POST /app-api/prenotazioni/batch (Prenotazione Multipla Rapida a blocchi)
    if (pathname === "/app-api/prenotazioni/batch" && method === "POST") {
      const atletaId = parsedBody.atleta_id || parsedBody.email_cliente || currentUser?.id;
      if (!atletaId) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Atleta non specificato o sessione non valida." }));
      }
      const atleta =
        (db.profili_utenti || []).find(
          (p: any) =>
            p.id === atletaId ||
            p.email?.toLowerCase() === atletaId?.toLowerCase() ||
            p.email?.toLowerCase() === parsedBody.email_cliente?.toLowerCase()
        ) || (currentUser && (currentUser.id === atletaId || currentUser.email?.toLowerCase() === atletaId?.toLowerCase()) ? currentUser : null);

      if (!atleta) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: `Atleta "${atletaId}" non trovato nel database.` }));
      }
      const requestedSlots: Array<{ data: string; orario: string; note?: string }> =
        parsedBody.slots || [];

      if (!Array.isArray(requestedSlots) || requestedSlots.length === 0) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Nessuno slot specificato per la prenotazione multipla." }));
      }

      const isManager = currentUser?.ruolo === "manager";
      const totalCost = requestedSlots.length;
      const walletOwner = getWalletOwner(atleta, db) || atleta;
      const isShared = walletOwner && walletOwner.id !== atleta.id;

      if (!isManager) {
        if (atleta.stato_iscrizione === "sospeso_insoluto") {
          res.statusCode = 403;
          return res.end(
            JSON.stringify({
              error:
                "Account temporaneamente sospeso per rinnovo mensile non saldato. Contatta Coach Stefano o aggiorna la carta per sbloccare le prenotazioni.",
              motivo: "sospeso_insoluto",
            })
          );
        }
        if (atleta.stato_iscrizione === "dismesso") {
          res.statusCode = 403;
          return res.end(
            JSON.stringify({
              error:
                "Posizione contrattuale dismessa. Non è possibile prenotare nuove sessioni.",
              motivo: "dismesso",
            })
          );
        }

        if ((walletOwner.crediti ?? 0) < totalCost) {
          res.statusCode = 403;
          return res.end(
            JSON.stringify({
              error: `Crediti insufficienti. ${isShared ? `Il borsellino condiviso (${walletOwner.nome} ${walletOwner.cognome}) ha` : "Hai"} ${walletOwner.crediti ?? 0} crediti ma hai selezionato ${totalCost} slot. Acquista un nuovo Pacchetto Lab o riduci la selezione.`,
              motivo: "crediti_insufficienti",
              crediti: walletOwner.crediti,
              richiesti: totalCost,
            })
          );
        }

        if (walletOwner.data_scadenza_crediti) {
          const scadenza = new Date(walletOwner.data_scadenza_crediti);
          for (const s of requestedSlots) {
            if (new Date(s.data) > scadenza) {
              res.statusCode = 403;
              return res.end(
                JSON.stringify({
                  error: `Uno o più slot selezionati (${s.data}) superano la data di scadenza del pacchetto (${walletOwner.data_scadenza_crediti}). Rinnova il pacchetto per prenotare.`,
                  motivo: "crediti_scaduti",
                  scadenza: walletOwner.data_scadenza_crediti,
                })
              );
            }
          }
        }

        const anticipoOre = Number(
          atleta?.tempo_anticipo_prenotazione_ore ??
          db.configurazione_lab?.tempo_anticipo_prenotazione_ore ??
          24
        );
        if (anticipoOre > 0) {
          const nowMs = Date.now();
          for (const s of requestedSlots) {
            const slotTs = new Date(`${s.data}T${s.orario}:00`).getTime();
            const oreDiff = (slotTs - nowMs) / (1000 * 60 * 60);
            if (oreDiff < anticipoOre) {
              res.statusCode = 400;
              return res.end(
                JSON.stringify({
                  error: `Lo slot del ${s.data} alle ${s.orario} non può essere prenotato: la policy richiede almeno ${anticipoOre} ore di preavviso prima dell'inizio della sessione.`,
                  motivo: "anticipo_insufficiente",
                  anticipo_ore: anticipoOre,
                })
              );
            }
          }
        }
      }

      // Controllo disponibilità di tutti gli slot richiesti
      db.prenotazioni_slot = db.prenotazioni_slot || [];
      const eccezioni = db.eccezioni_calendario || [];

      for (const s of requestedSlots) {
        const bloccato = eccezioni.find(
          (e: any) =>
            e.data === s.data &&
            (e.tipo === "chiusura_giornata" || (e.tipo === "slot_bloccato" && e.orario === s.orario))
        );
        if (bloccato) {
          res.statusCode = 400;
          return res.end(
            JSON.stringify({
              error: `Lo slot del ${s.data} alle ${s.orario} non è disponibile: ${bloccato.motivo || "Chiusura o ferie del Lab"}.`,
            })
          );
        }

        const slotGiaOccupato = db.prenotazioni_slot.find(
          (p: any) => p.data === s.data && p.orario === s.orario && p.stato === "confermata"
        );
        if (slotGiaOccupato) {
          res.statusCode = 409;
          return res.end(
            JSON.stringify({
              error: `Lo slot del ${s.data} alle ${s.orario} è già stato prenotato da un altro atleta. Capienza massima raggiunta per questa postazione.`,
            })
          );
        }
      }

      // Tutto verificato: applica le prenotazioni
      walletOwner.crediti = Math.max(0, (walletOwner.crediti ?? 0) - totalCost);
      walletOwner.updated_at = new Date().toISOString();
      atleta.data_ultimo_accesso = new Date().toISOString();
      atleta.updated_at = new Date().toISOString();
      if (isShared) {
        walletOwner.data_ultimo_accesso = new Date().toISOString();
      }
      alignSharedPartnersCredits(walletOwner, db);

      const createPrenotazioni: any[] = [];
      const now = Date.now();

      requestedSlots.forEach((s, idx) => {
        const bk = {
          id: `bk-${now}-${idx}`,
          data: s.data,
          orario: s.orario,
          atleta_id: atleta.id,
          email_cliente: atleta.email,
          nome_cliente:
            `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
          telefono_cliente: atleta.telefono || "",
          stato: "confermata",
          credito_scalato: true,
          note: s.note || "Prenotazione Multipla Rapida",
          created_at: new Date().toISOString(),
        };

        db.prenotazioni_slot.push(bk);
        createPrenotazioni.push(bk);
      });

      // Sincronizzazione automatica degli slot Landmine Lab su Google Calendar (15 min, arancione)
      for (const bk of createPrenotazioni) {
        try {
          const gcalId = await createGoogleCalendarLabSlot({
            bookingId: bk.id,
            data: bk.data,
            orario: bk.orario,
            nomeCliente: bk.nome_cliente,
            emailCliente: bk.email_cliente,
            note: bk.note,
          });
          bk.google_event_id = gcalId || null;
        } catch (gErr) {
          console.warn("[GCAL BATCH WARNING] Impossibile creare evento Google Calendar per slot:", bk.id, gErr);
        }
      }

      // Tracciamento movimento crediti unico cumulativo
      addMovimentoCrediti(db, {
        atleta_id: walletOwner.id,
        email_cliente: walletOwner.email,
        nome_cliente: `${walletOwner.nome || ""} ${walletOwner.cognome || ""}`.trim() || walletOwner.name || "Atleta",
        tipo: "prenotazione_slot",
        delta_crediti: -totalCost,
        saldo_risultante: walletOwner.crediti,
        motivazione: isShared
          ? `Prenotazione a blocchi di ${totalCost} sessioni per ${atleta.nome} ${atleta.cognome} [Borsellino Condiviso]`
          : `Prenotazione multipla di ${totalCost} sessioni`,
        operatore: isManager ? "coach" : "atleta",
      });

      saveData(db);
      await syncDataToGoogleDrive(db);

      res.statusCode = 201;
      return res.end(
        JSON.stringify({
          ok: true,
          count: createPrenotazioni.length,
          prenotazioni: createPrenotazioni,
          crediti_rimanenti: walletOwner.crediti,
          messaggio: `${createPrenotazioni.length} sessioni prenotate con successo!`,
        })
      );
    }

    // POST /app-api/prenotazioni
    if (pathname === "/app-api/prenotazioni" && method === "POST") {
      const isManager = currentUser?.ruolo === "manager";
      const atletaId = parsedBody.atleta_id || parsedBody.email_cliente || currentUser?.id;
      if (!atletaId) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Atleta non specificato o sessione non valida." }));
      }
      const atleta =
        (db.profili_utenti || []).find(
          (p: any) =>
            p.id === atletaId ||
            p.email?.toLowerCase() === atletaId?.toLowerCase() ||
            p.email?.toLowerCase() === parsedBody.email_cliente?.toLowerCase()
        ) || (currentUser && (currentUser.id === atletaId || currentUser.email?.toLowerCase() === atletaId?.toLowerCase()) ? currentUser : null);

      if (!atleta) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: `Atleta non trovato con identificativo "${atletaId}".` }));
      }
      const dataSlot = parsedBody.data;
      const orarioSlot = parsedBody.orario;

      if (!dataSlot || !orarioSlot) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Data e orario sono obbligatori." }));
      }

      // Controllo chiusure o blocchi del Coach
      const eccezioni = db.eccezioni_calendario || [];
      const bloccato = eccezioni.find(
        (e: any) =>
          e.data === dataSlot &&
          (e.tipo === "chiusura_giornata" || (e.tipo === "slot_bloccato" && e.orario === orarioSlot))
      );
      if (bloccato) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            error: `Lo slot non è prenotabile: ${
              bloccato.motivo || "Chiusura straordinaria o ferie del Lab."
            }`,
          })
        );
      }

      db.prenotazioni_slot = db.prenotazioni_slot || [];

      // 1. Controllo Capienza Rigorosa 1:1
      const slotGiaOccupato = db.prenotazioni_slot.find(
        (p: any) => p.data === dataSlot && p.orario === orarioSlot && (p.stato === "confermata" || !p.stato || p.stato === "attiva")
      );
      if (slotGiaOccupato) {
        res.statusCode = 409;
        return res.end(
          JSON.stringify({
            error: `Lo slot del ${dataSlot} alle ${orarioSlot} è già stato prenotato da ${slotGiaOccupato.nome_cliente}. Capienza massima raggiunta per questa postazione.`,
          })
        );
      }

      // 2. Controllo Crediti e Scadenza
      const walletOwner = getWalletOwner(atleta, db) || atleta;
      const isShared = walletOwner && walletOwner.id !== atleta.id;

      if (!isManager) {
        if (atleta.stato_iscrizione === "sospeso_insoluto") {
          res.statusCode = 403;
          return res.end(
            JSON.stringify({
              error:
                "Account temporaneamente sospeso per rinnovo mensile non saldato. Contatta Coach Stefano o aggiorna la carta per sbloccare le prenotazioni.",
              motivo: "sospeso_insoluto",
            })
          );
        }
        if (atleta.stato_iscrizione === "dismesso") {
          res.statusCode = 403;
          return res.end(
            JSON.stringify({
              error:
                "Posizione contrattuale dismessa. Non è possibile prenotare nuove sessioni.",
              motivo: "dismesso",
            })
          );
        }
        if ((walletOwner.crediti ?? 0) <= 0) {
          res.statusCode = 403;
          return res.end(
            JSON.stringify({
              error: isShared
                ? `Crediti esauriti sul borsellino condiviso (${walletOwner.nome} ${walletOwner.cognome}). Rinnova il pacchetto per procedere con la prenotazione.`
                : "Crediti esauriti o saldo a debito. Acquista un nuovo pacchetto lab per procedere con la prenotazione.",
              motivo: "crediti_insufficienti",
              crediti: walletOwner.crediti,
            })
          );
        }

        if (walletOwner.data_scadenza_crediti) {
          const scadenza = new Date(walletOwner.data_scadenza_crediti);
          const dataPrenotazione = new Date(dataSlot);
          if (dataPrenotazione > scadenza) {
            res.statusCode = 403;
            return res.end(
              JSON.stringify({
                error: `Il pacchetto crediti è scaduto il ${walletOwner.data_scadenza_crediti}. Rinnova il pacchetto per prenotare questa data.`,
                motivo: "crediti_scaduti",
                scadenza: walletOwner.data_scadenza_crediti,
              })
            );
          }
        }

        const anticipoOre = Number(
          atleta?.tempo_anticipo_prenotazione_ore ??
          db.configurazione_lab?.tempo_anticipo_prenotazione_ore ??
          24
        );
        if (anticipoOre > 0) {
          const slotTs = new Date(`${dataSlot}T${orarioSlot}:00`).getTime();
          const oreDiff = (slotTs - Date.now()) / (1000 * 60 * 60);
          if (oreDiff < anticipoOre) {
            res.statusCode = 400;
            return res.end(
              JSON.stringify({
                error: `Prenotazione non consentita: la policy richiede almeno ${anticipoOre} ore di preavviso prima dell'inizio dello slot.`,
                motivo: "anticipo_insufficiente",
                anticipo_ore: anticipoOre,
              })
            );
          }
        }
      }

      // 3. Scalamento del credito (1 credito = 1 sessione)
      walletOwner.crediti = Math.max(0, (walletOwner.crediti ?? 0) - 1);
      walletOwner.updated_at = new Date().toISOString();
      atleta.data_ultimo_accesso = new Date().toISOString();
      atleta.updated_at = new Date().toISOString();
      if (isShared) {
        walletOwner.data_ultimo_accesso = new Date().toISOString();
      }
      alignSharedPartnersCredits(walletOwner, db);

      const nuovaPrenotazione = {
        id: `bk-${Date.now()}`,
        data: dataSlot,
        orario: orarioSlot,
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente:
          `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
        telefono_cliente: atleta.telefono || "",
        stato: "confermata",
        credito_scalato: true,
        note: parsedBody.note || (isManager ? "Assegnazione diretta dal Coach" : ""),
        created_at: new Date().toISOString(),
      };

      // Sincronizzazione automatica dello slot Landmine Lab su Google Calendar (15 min, arancione)
      try {
        const gcalId = await createGoogleCalendarLabSlot({
          bookingId: nuovaPrenotazione.id,
          data: dataSlot,
          orario: orarioSlot,
          nomeCliente: nuovaPrenotazione.nome_cliente,
          emailCliente: nuovaPrenotazione.email_cliente,
          note: nuovaPrenotazione.note,
        });
        (nuovaPrenotazione as any).google_event_id = gcalId || null;
      } catch (gErr) {
        console.warn("[GCAL SYNC WARNING] Impossibile creare evento Google Calendar per slot:", nuovaPrenotazione.id, gErr);
      }

      db.prenotazioni_slot.push(nuovaPrenotazione);

      // Tracciamento nel registro movimenti crediti
      addMovimentoCrediti(db, {
        atleta_id: walletOwner.id,
        email_cliente: walletOwner.email,
        nome_cliente: `${walletOwner.nome || ""} ${walletOwner.cognome || ""}`.trim() || walletOwner.name || "Atleta",
        tipo: "prenotazione_slot",
        delta_crediti: -1,
        saldo_risultante: walletOwner.crediti,
        motivazione: isShared
          ? `Prenotazione slot del ${dataSlot} ore ${orarioSlot} per ${atleta.nome} ${atleta.cognome} [Borsellino Condiviso]`
          : `Prenotazione slot del ${dataSlot} ore ${orarioSlot}`,
        operatore: isManager ? "coach" : "atleta",
      });

      logShadowEvent("BOOKING_CREATED", atleta.email, {
        bookingId: nuovaPrenotazione.id,
        data: dataSlot,
        orario: orarioSlot,
      });

      saveData(db);
      await syncDataToGoogleDrive(db);

      if (isManager) {
        console.log(`[NOTIFICA AUTOMATICA EMAIL] A: ${atleta.email} - Conferma Prenotazione Area46: ${dataSlot} ore ${orarioSlot}`);
      }

      res.statusCode = 201;
      return res.end(
        JSON.stringify({
          ok: true,
          prenotazione: nuovaPrenotazione,
          crediti_rimanenti: walletOwner.crediti,
          messaggio: `Slot confermato per il ${dataSlot} alle ${orarioSlot}. Ti aspettiamo al Lab!`,
          notifica: {
            email_inviata: true,
            email_destinatario: atleta.email,
            nome_destinatario: nuovaPrenotazione.nome_cliente,
            telefono_destinatario: atleta.telefono || "",
          },
        })
      );
    }

    // DELETE /app-api/prenotazioni/:id (Cancellazione conforme a policy personale atleta)
    const bkDeleteMatch = pathname.match(/^\/app-api\/prenotazioni\/([a-zA-Z0-9_-]+)$/);
    if (bkDeleteMatch && method === "DELETE") {
      const bkId = bkDeleteMatch[1];
      const bk = (db.prenotazioni_slot || []).find((p: any) => p.id === bkId);
      if (!bk) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Prenotazione non trovata" }));
      }

      const isManager =
        currentUser?.ruolo === "manager" ||
        req.headers["x-area46-user"] === "usr-coach-01" ||
        req.headers["x-user-id"] === "usr-coach-01" ||
        parsedBody?.is_manager === true;
      const atleta = (db.profili_utenti || []).find(
        (p: any) => p.email === bk.email_cliente || p.id === bk.atleta_id
      );
      const walletOwner = atleta ? getWalletOwner(atleta, db) : null;
      const isShared = walletOwner && atleta && walletOwner.id !== atleta.id;

      // Policy personalizzata dell'atleta (o fallback configurazione lab)
      const oreLimite =
        atleta?.tempo_cancellazione_ore || db.configurazione_lab?.tempo_cancellazione_ore || 24;

      const slotTimestamp = new Date(`${bk.data}T${bk.orario}:00`).getTime();
      const nowTimestamp = Date.now();
      const orePreavviso = (slotTimestamp - nowTimestamp) / (1000 * 60 * 60);

      let rimborsato = false;
      let statoFinale = "cancellata_tardiva";
      let messaggio = "";

      // Supporto roulette proroga_giorni (1 giorno alla volta) e fallback retrocompatibile
      const rawProrogaGiorni = url.searchParams.get("proroga_giorni") ?? parsedBody?.proroga_giorni;
      let giorniProroga = rawProrogaGiorni !== undefined && rawProrogaGiorni !== null ? Number(rawProrogaGiorni) : 0;
      if (isNaN(giorniProroga) || giorniProroga < 0) giorniProroga = 0;
      if (
        giorniProroga === 0 &&
        (url.searchParams.get("proroga") === "true" ||
          url.searchParams.get("proroga") === "7" ||
          parsedBody?.proroga === true ||
          parsedBody?.proroga === "true")
      ) {
        giorniProroga = 7;
      }

      if (orePreavviso >= oreLimite || isManager) {
        rimborsato = true;
        statoFinale = "cancellata_in_tempo";
        if (bk.credito_scalato && atleta && walletOwner) {
          walletOwner.crediti = (walletOwner.crediti ?? 0) + 1;
          walletOwner.updated_at = new Date().toISOString();
          atleta.updated_at = new Date().toISOString();
          alignSharedPartnersCredits(walletOwner, db);

          let prorogaMsg = "";
          if (isManager && giorniProroga > 0 && walletOwner.data_scadenza_crediti) {
            const scadenzaDate = new Date(walletOwner.data_scadenza_crediti + "T00:00:00");
            scadenzaDate.setDate(scadenzaDate.getDate() + giorniProroga);
            const y = scadenzaDate.getFullYear();
            const m = String(scadenzaDate.getMonth() + 1).padStart(2, "0");
            const d = String(scadenzaDate.getDate()).padStart(2, "0");
            walletOwner.data_scadenza_crediti = `${y}-${m}-${d}`;
            prorogaMsg = ` (Scadenza carnet prorogata di +${giorniProroga}gg al ${new Date(
              walletOwner.data_scadenza_crediti + "T00:00:00"
            ).toLocaleDateString("it-IT")})`;
          }

          addMovimentoCrediti(db, {
            atleta_id: walletOwner.id,
            email_cliente: walletOwner.email,
            nome_cliente: `${walletOwner.nome} ${walletOwner.cognome}`.trim(),
            tipo: "rimborso_cancellazione",
            delta_crediti: 1,
            saldo_risultante: walletOwner.crediti,
            motivazione: isManager
              ? (giorniProroga > 0
                  ? `Rimborso slot ${bk.data} ${bk.orario} per ${atleta.nome} ${atleta.cognome}${isShared ? " [Borsellino Condiviso]" : ""} [Con proroga scadenza carnet +${giorniProroga}gg]`
                  : `Ripristino credito per cancellazione/spostamento slot ${bk.data} ${bk.orario} per ${atleta.nome} ${atleta.cognome}${isShared ? " [Borsellino Condiviso]" : ""}`)
              : `Rimborso per cancellazione in tempo slot del ${bk.data} ${bk.orario}${isShared ? " [Borsellino Condiviso]" : ""}`,
            operatore: isManager ? "coach" : "atleta",
          });

          messaggio = isManager
            ? (giorniProroga > 0
                ? `Sessione annullata dal Coach. 1 credito riaccreditato e scadenza prorogata di +${giorniProroga} giorni.`
                : `Sessione annullata dal Coach. 1 credito riaccreditato per consentire lo spostamento dello slot.`)
            : `Prenotazione annullata con successo. Preavviso rispettato (${Math.max(
                0,
                Math.round(orePreavviso)
              )}h rimaste su ${oreLimite}h richieste). 1 credito è stato rimborsato al tuo wallet.`;
        } else {
          messaggio = "Prenotazione annullata con successo.";
        }
      } else {
        rimborsato = false;
        statoFinale = "cancellata_tardiva";
        if (atleta && walletOwner) {
          addMovimentoCrediti(db, {
            atleta_id: walletOwner.id,
            email_cliente: walletOwner.email,
            nome_cliente: `${walletOwner.nome} ${walletOwner.cognome}`.trim(),
            tipo: "penalty",
            delta_crediti: 0,
            saldo_risultante: walletOwner.crediti,
            motivazione: `Cancellazione tardiva slot del ${bk.data} ${bk.orario} (preavviso < ${oreLimite}h: credito trattenuto in attesa triage)`,
            operatore: "sistema",
          });
        }

        // Coda Triage Coach No-Show (<24h)
        db.richieste_cancellazione_tardiva = db.richieste_cancellazione_tardiva || [];
        const triageItem = {
          id: `triage_${Date.now()}_${bk.id}`,
          prenotazione_id: bk.id,
          data: bk.data,
          orario: bk.orario,
          atleta_id: atleta?.id || bk.atleta_id,
          nome_cliente: bk.nome_cliente,
          email_cliente: bk.email_cliente,
          telefono_cliente: atleta?.telefono || bk.telefono_cliente || "",
          ore_preavviso: Math.round(orePreavviso * 10) / 10,
          ore_limite: oreLimite,
          stato_triage: "in_attesa",
          created_at: new Date().toISOString(),
        };
        db.richieste_cancellazione_tardiva.unshift(triageItem);

        messaggio = `Prenotazione annullata oltre il termine di tolleranza di ${oreLimite} ore (preavviso di sole ${Math.max(
          0,
          Math.round(orePreavviso)
        )}h). Lo slot è stato liberato per altri atleti. Il Coach verificherà la richiesta per eventuale riaccredito di cortesia.`;
      }

      // Traccia ID cancellato ed elimina fisicamente lo slot attivo
      db.prenotazioni_cancellate = db.prenotazioni_cancellate || [];
      const cleanBkId = String(bkId).replace(/^lab_/, "");
      if (!db.prenotazioni_cancellate.includes(cleanBkId)) {
        db.prenotazioni_cancellate.push(cleanBkId);
      }
      if (!db.prenotazioni_cancellate.includes(`lab_${cleanBkId}`)) {
        db.prenotazioni_cancellate.push(`lab_${cleanBkId}`);
      }
      // Eliminazione istantanea da Google Calendar (lo slot sparisce all'istante sia da GCal che da SGG)
      try {
        await deleteGoogleCalendarLabSlot((bk as any).google_event_id, {
          data: bk.data,
          orario: bk.orario,
          nomeCliente: bk.nome_cliente,
          bookingId: bk.id,
        });
      } catch (gErr) {
        console.warn("[GCAL DELETE WARNING] Errore cancellazione da Google Calendar:", gErr);
      }

      db.prenotazioni_slot = (db.prenotazioni_slot || []).filter((p: any) => p.id !== bkId);

      logShadowEvent("BOOKING_CANCELLED", atleta?.email || bk.email_cliente, {
        bookingId: bk.id,
        data: bk.data,
        orario: bk.orario,
        rimborsato,
        statoFinale,
        orePreavviso: Math.round(orePreavviso * 10) / 10,
      });

      saveData(db);
      await syncDataToGoogleDrive(db);

      if (isManager) {
        console.log(
          `[NOTIFICA AUTOMATICA EMAIL] A: ${atleta?.email || bk.email_cliente} - Avviso Annullamento Seduta Area46: ${bk.data} alle ${bk.orario}`
        );
      }

      return res.end(
        JSON.stringify({
          ok: true,
          rimborsato,
          stato: statoFinale,
          ore_preavviso: Math.round(orePreavviso * 10) / 10,
          ore_limite: oreLimite,
          crediti_attuali: walletOwner ? walletOwner.crediti : atleta?.crediti,
          messaggio,
          notifica: {
            email_inviata: true,
            email_destinatario: atleta?.email || bk.email_cliente,
            nome_destinatario: bk.nome_cliente,
            telefono_destinatario: atleta?.telefono || bk.telefono_cliente || "",
          },
        })
      );
    }

    // GET /app-api/prenotazioni/triage (Richieste cancellazione tardiva da esaminare)
    if (pathname === "/app-api/prenotazioni/triage" && method === "GET") {
      db.richieste_cancellazione_tardiva = db.richieste_cancellazione_tardiva || [];
      return res.end(JSON.stringify(db.richieste_cancellazione_tardiva));
    }

    // POST /app-api/prenotazioni/triage/:id oppure POST /app-api/prenotazioni/:id/triage
    const triageMatch =
      pathname.match(/^\/app-api\/prenotazioni\/triage\/([a-zA-Z0-9_-]+)$/) ||
      pathname.match(/^\/app-api\/prenotazioni\/([a-zA-Z0-9_-]+)\/triage$/);
    if (triageMatch && method === "POST") {
      const targetId = triageMatch[1];
      db.richieste_cancellazione_tardiva = db.richieste_cancellazione_tardiva || [];
      const item = db.richieste_cancellazione_tardiva.find(
        (t: any) => t.id === targetId || t.prenotazione_id === targetId
      );
      if (!item) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Richiesta triage non trovata" }));
      }

      const azione = parsedBody?.azione; // "scalare" | "riaccreditare"
      const atleta = (db.profili_utenti || []).find(
        (p: any) => p.id === item.atleta_id || p.email === item.email_cliente
      );
      const walletOwner = atleta ? getWalletOwner(atleta, db) : null;
      const isShared = walletOwner && atleta && walletOwner.id !== atleta.id;

      let messaggioWhatsApp = "";
      if (azione === "scalare") {
        item.stato_triage = "scalato";
        item.triaged_at = new Date().toISOString();
        item.triaged_by = currentUser?.nome || "coach";

        messaggioWhatsApp = `Ciao ${item.nome_cliente || atleta?.nome || ""}, ti confermo l'annullamento della seduta del ${item.data} alle ${item.orario}. Come previsto dal regolamento del Lab, con preavviso inferiore alle 24h il credito viene scalato per tutelare l'organizzazione dei turni. Ci vediamo carichi al prossimo allenamento!`.trim();

        logShadowEvent("BOOKING_TRIAGED", item.email_cliente, { triageId: item.id, azione: "scalare" });
      } else if (azione === "riaccreditare") {
        item.stato_triage = "riaccreditato";
        item.triaged_at = new Date().toISOString();
        item.triaged_by = currentUser?.nome || "coach";

        if (walletOwner) {
          walletOwner.crediti = (walletOwner.crediti ?? 0) + 1;
          walletOwner.updated_at = new Date().toISOString();
          alignSharedPartnersCredits(walletOwner, db);
          addMovimentoCrediti(db, {
            atleta_id: walletOwner.id,
            email_cliente: walletOwner.email,
            nome_cliente: `${walletOwner.nome} ${walletOwner.cognome}`.trim(),
            tipo: "rimborso_cancellazione",
            delta_crediti: 1,
            saldo_risultante: walletOwner.crediti,
            motivazione: `Riaccredito eccezionale per cancellazione slot ${item.data} ${item.orario}${isShared ? " [Borsellino Condiviso]" : ""}`,
            operatore: "coach",
          });
        }

        messaggioWhatsApp = `Ciao ${item.nome_cliente || atleta?.nome || ""}, ho visto il tuo imprevisto per la seduta del ${item.data} alle ${item.orario}. Per questa volta ho riaccreditato eccezionalmente il credito sul tuo borsellino così potrai recuperarla appena possibile. A presto!`.trim();

        logShadowEvent("BOOKING_TRIAGED", item.email_cliente, { triageId: item.id, azione: "riaccreditare" });
      } else {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Azione non valida. Utilizzare 'scalare' o 'riaccreditare'." }));
      }

      saveData(db);
      await syncDataToGoogleDrive(db);

      const phoneClean = (item.telefono_cliente || atleta?.telefono || "").replace(/[^0-9+]/g, "");
      const whatsappUrl = phoneClean
        ? `https://api.whatsapp.com/send?phone=${phoneClean.replace(/^\+/, "")}&text=${encodeURIComponent(messaggioWhatsApp)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(messaggioWhatsApp)}`;

      return res.end(
        JSON.stringify({
          ok: true,
          stato_triage: item.stato_triage,
          crediti_attuali: walletOwner ? walletOwner.crediti : atleta?.crediti,
          messaggio_whatsapp: messaggioWhatsApp,
          whatsapp_url: whatsappUrl,
        })
      );
    }

    // POST /app-api/webhooks/calendar-sync (Ricezione eventi real-time da Google Calendar/SGG)
    if (pathname === "/app-api/webhooks/calendar-sync" && method === "POST") {
      const eventId = parsedBody?.event_id || parsedBody?.id || `evt_${Date.now()}`;
      if (isWebhookDuplicate(eventId)) {
        return res.end(JSON.stringify({ ok: true, duplicate: true, message: "Evento già elaborato (idempotenza)" }));
      }

      const action = parsedBody?.action || parsedBody?.tipo || "PING";
      logShadowEvent("WEBHOOK_CALENDAR_SYNC", parsedBody?.email || "external", { eventId, action, body: parsedBody });

      return res.end(JSON.stringify({ ok: true, processed: true, event_id: eventId, action }));
    }

    // GET /app-api/shadow/events (Audit Omni-System Shadow Mode)
    if (pathname === "/app-api/shadow/events" && method === "GET") {
      const limit = Math.min(200, parseInt(url.searchParams.get("limit") || "50", 10));
      const events = (db.shadow_event_log || []).slice(0, limit);
      return res.end(JSON.stringify({ ok: true, count: events.length, events }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TARIFFARIO PACCHETTI (8, 12, 24, 36)
    // ─────────────────────────────────────────────────────────────────────────

    // GET /app-api/tariffario
    if (pathname === "/app-api/tariffario" && method === "GET") {
      return res.end(JSON.stringify(db.tariffario_pacchetti || []));
    }

    // PUT /app-api/tariffario/:id
    const tarPutMatch = pathname.match(/^\/app-api\/tariffario\/([a-zA-Z0-9_-]+)$/);
    if (tarPutMatch && method === "PUT") {
      const packId = tarPutMatch[1];
      const pack = (db.tariffario_pacchetti || []).find((p: any) => p.id === packId);
      if (!pack) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Pacchetto non trovato" }));
      }
      Object.assign(pack, parsedBody);
      saveData(db);
      return res.end(JSON.stringify(pack));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRANSAZIONI PAGAMENTI & MECCANISMO DEBITI
    // ─────────────────────────────────────────────────────────────────────────

    // GET /app-api/transazioni
    if (pathname === "/app-api/transazioni" && method === "GET") {
      const cancellate: string[] = db.transazioni_cancellate || [];
      const txs = (db.transazioni_pagamenti || []).filter(
        (t: any) =>
          !cancellate.includes(t.id) &&
          !cancellate.includes(t.codice_transazione) &&
          !FICTITIOUS_TX_IDS.includes(t.id) &&
          !FICTITIOUS_TX_IDS.includes(t.codice_transazione)
      );
      return res.end(JSON.stringify(txs));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTEGRAZIONE PAGAMENTI STRIPE & INCASSO DIRETTO SU CONTO BANCARIO
    // ─────────────────────────────────────────────────────────────────────────

    // POST /app-api/config/stripe/test-connection (Verifica API Key Stripe)
    if (pathname === "/app-api/config/stripe/test-connection" && method === "POST") {
      const secretKey =
        parsedBody.stripe_secret_key ||
        (req.headers["x-stripe-secret-key"] as string) ||
        db.configurazione_lab?.stripe_secret_key ||
        process.env.STRIPE_SECRET_KEY;

      if (!secretKey) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({ ok: false, error: "Nessuna Stripe Secret Key fornita per il test." })
        );
      }

      try {
        const stripeRes = await fetch("https://api.stripe.com/v1/balance", {
          headers: {
            Authorization: `Bearer ${secretKey.trim()}`,
          },
        });
        const stripeData = await stripeRes.json();

        if (!stripeRes.ok) {
          res.statusCode = 400;
          return res.end(
            JSON.stringify({
              ok: false,
              error: stripeData.error?.message || "Chiave segreta Stripe non valida o non autorizzata.",
            })
          );
        }

        db.configurazione_lab = db.configurazione_lab || {};
        db.configurazione_lab.stripe_collegato = true;
        if (parsedBody.stripe_secret_key) {
          db.configurazione_lab.stripe_secret_key = parsedBody.stripe_secret_key.trim();
        } else if (secretKey) {
          db.configurazione_lab.stripe_secret_key = secretKey.trim();
        }
        if (parsedBody.stripe_publishable_key) {
          db.configurazione_lab.stripe_publishable_key = parsedBody.stripe_publishable_key.trim();
        }
        if (parsedBody.stripe_mode) {
          db.configurazione_lab.stripe_mode = parsedBody.stripe_mode;
        }
        saveData(db);
        syncConfigToGoogleDrive(db.configurazione_lab).catch(() => {});

        return res.end(
          JSON.stringify({
            ok: true,
            livemode: stripeData.livemode,
            message: `Connessione a Stripe riuscita! Modalità: ${
              stripeData.livemode ? "LIVE (Incassi Reali attivi)" : "TEST (Sandbox di prova)"
            }`,
          })
        );
      } catch (err: any) {
        res.statusCode = 500;
        return res.end(
          JSON.stringify({
            ok: false,
            error: err.message || "Impossibile contattare i server di Stripe.",
          })
        );
      }
    }

    // POST /app-api/pagamenti/stripe-checkout (Creazione Sessione di Pagamento Stripe)
    if (pathname === "/app-api/pagamenti/stripe-checkout" && method === "POST") {
      const atletaId = parsedBody.atleta_id || currentUser?.id;
      const atleta =
        (db.profili_utenti || []).find((p: any) => p.id === atletaId || p.email === atletaId) ||
        currentUser;
      const packId = parsedBody.id_pacchetto;
      const pacchetto = (db.tariffario_pacchetti || []).find((p: any) => p.id === packId);

      if (!pacchetto) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Pacchetto selezionato non valido" }));
      }

      const secretKey =
        parsedBody.stripe_secret_key ||
        (req.headers["x-stripe-secret-key"] as string) ||
        db.configurazione_lab?.stripe_secret_key ||
        process.env.STRIPE_SECRET_KEY;
      const origin = req.headers.origin || "http://localhost:5173";

      // SE LE CHIAVI STRIPE SONO VALIDE: GENERA SESSIONE DI CHECKOUT REALE SU STRIPE
      if (secretKey && (secretKey.startsWith("sk_") || secretKey.startsWith("rk_"))) {
        if (!db.configurazione_lab?.stripe_secret_key) {
          db.configurazione_lab = db.configurazione_lab || {};
          db.configurazione_lab.stripe_secret_key = secretKey.trim();
          db.configurazione_lab.stripe_collegato = true;
          saveData(db);
        }
        try {
          const returnPath = parsedBody.return_url || "/account";
          const buildParams = (includePayPal: boolean) => {
            const p = new URLSearchParams();
            p.append("mode", "payment");
            p.append("payment_method_types[0]", "card");
            if (includePayPal) {
              p.append("payment_method_types[1]", "paypal");
            }
            p.append("line_items[0][price_data][currency]", "eur");
            p.append("line_items[0][price_data][unit_amount]", String(Math.round(pacchetto.prezzo_euro * 100)));
            p.append("line_items[0][price_data][product_data][name]", pacchetto.nome);
            p.append(
              "line_items[0][price_data][product_data][description]",
              pacchetto.descrizione || "Pacchetto ingressi Area46 Landmine Lab"
            );
            p.append("line_items[0][quantity]", "1");
            p.append("customer_email", atleta.email);
            p.append("client_reference_id", atleta.id);
            p.append("metadata[pack_id]", pacchetto.id);
            p.append("metadata[pack_nome]", pacchetto.nome);
            p.append("metadata[pack_crediti]", String(pacchetto.crediti));
            p.append("metadata[giorni_validita]", String(pacchetto.giorni_validita || 60));
            p.append("metadata[atleta_id]", atleta.id);
            p.append("metadata[atleta_email]", atleta.email);
            p.append("metadata[codice_fiscale]", parsedBody.codice_fiscale || atleta.codice_fiscale || "");
            p.append("metadata[indirizzo]", parsedBody.indirizzo || atleta.indirizzo || "");
            p.append(
              "success_url",
              `${origin}${returnPath}?session_id={CHECKOUT_SESSION_ID}&success=true`
            );
            p.append("cancel_url", `${origin}${returnPath}?canceled=true`);
            return p;
          };

          const wantsPayPal = parsedBody.metodo === "paypal";
          let params = buildParams(wantsPayPal);

          let stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secretKey.trim()}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          });

          let session = await stripeRes.json();
          // Se PayPal non è abilitato nella dashboard del coach, riprova subito con carta/Apple Pay per non bloccare l'atleta
          if (!stripeRes.ok && wantsPayPal) {
            params = buildParams(false);
            stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${secretKey.trim()}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: params.toString(),
            });
            session = await stripeRes.json();
          }

          if (!stripeRes.ok) {
            throw new Error(session.error?.message || "Errore nella creazione della sessione di pagamento Stripe");
          }

          return res.end(
            JSON.stringify({
              ok: true,
              checkout_url: session.url,
              session_id: session.id,
            })
          );
        } catch (err: any) {
          res.statusCode = 502;
          return res.end(JSON.stringify({ error: err.message || "Errore di connessione a Stripe" }));
        }
      }

      // SE LE CHIAVI STRIPE NON SONO DISPONIBILI SUL SERVER: BLOCCO DI SICUREZZA
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          error:
            "Il gateway di pagamento con carta non è al momento collegato o configurato. Seleziona Bonifico Bancario oppure contatta il Coach/Lab.",
        })
      );
    }

    // POST /app-api/pagamenti/stripe-verify (Verifica sessione al rientro dell'atleta da Stripe)
    if (pathname === "/app-api/pagamenti/stripe-verify" && method === "POST") {
      const sessionId = parsedBody.session_id;
      if (!sessionId) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Session ID mancante" }));
      }

      // Verifica se già registrata per evitare doppi accrediti
      const existingTx = (db.transazioni_pagamenti || []).find(
        (t: any) => t.codice_transazione === sessionId || t.stripe_session_id === sessionId
      );
      if (existingTx) {
        return res.end(
          JSON.stringify({
            ok: true,
            already_processed: true,
            transazione: existingTx,
            messaggio: "Pagamento già registrato con successo.",
          })
        );
      }

      const secretKey =
        parsedBody.stripe_secret_key ||
        (req.headers["x-stripe-secret-key"] as string) ||
        db.configurazione_lab?.stripe_secret_key ||
        process.env.STRIPE_SECRET_KEY;

      if (!secretKey) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Stripe non configurato" }));
      }

      if (secretKey && (secretKey.startsWith("sk_") || secretKey.startsWith("rk_")) && !db.configurazione_lab?.stripe_secret_key) {
        db.configurazione_lab = db.configurazione_lab || {};
        db.configurazione_lab.stripe_secret_key = secretKey.trim();
        db.configurazione_lab.stripe_collegato = true;
        saveData(db);
      }

      try {
        const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${secretKey.trim()}` },
        });
        const session = await stripeRes.json();

        if (!stripeRes.ok) {
          throw new Error(session.error?.message || "Sessione non valida");
        }

        if (session.payment_status !== "paid") {
          res.statusCode = 400;
          return res.end(
            JSON.stringify({ error: `Stato pagamento non completato: ${session.payment_status}` })
          );
        }

        const meta = session.metadata || {};
        const packId = meta.pack_id;
        const atletaEmail = meta.atleta_email || session.customer_email;
        const pacchetto =
          (db.tariffario_pacchetti || []).find((p: any) => p.id === packId) || {
            id: packId,
            nome: meta.pack_nome || "Pacchetto Lab",
            crediti: Number(meta.pack_crediti) || 10,
            prezzo_euro: (session.amount_total || 0) / 100,
            giorni_validita: Number(meta.giorni_validita) || 60,
          };

        const atleta =
          (db.profili_utenti || []).find(
            (p: any) => p.email === atletaEmail || p.id === meta.atleta_id
          ) || currentUser;

        const walletOwner = getWalletOwner(atleta, db) || atleta;
        const currentCrediti = Number(walletOwner.crediti) || 0;
        const packCrediti = Number(pacchetto.crediti) || 0;
        const anticipiAttuali = Number(walletOwner.anticipi_da_scontare) || 0;

        let debitiDecurtati = 0;
        let anticipiScontati = 0;

        if (currentCrediti < 0) {
          debitiDecurtati = Math.min(Math.abs(currentCrediti), packCrediti);
        }

        const creditiRimanentiDopoDebito = packCrediti - debitiDecurtati;
        if (anticipiAttuali > 0) {
          anticipiScontati = Math.min(anticipiAttuali, creditiRimanentiDopoDebito);
          walletOwner.anticipi_da_scontare = Math.max(0, anticipiAttuali - anticipiScontati);
        }

        const creditiEffettivi = packCrediti - debitiDecurtati - anticipiScontati;

        const nuovaTransazione = {
          codice_transazione: `TX-ST-${Date.now().toString().slice(-6)}`,
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
          atleta_id: atleta.id,
          email_cliente: atleta.email,
          nome_cliente: `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
          codice_fiscale: meta.codice_fiscale || atleta.codice_fiscale || "",
          indirizzo: meta.indirizzo || atleta.indirizzo || "",
          id_pacchetto: pacchetto.id,
          nome_pacchetto: pacchetto.nome,
          importo_euro: (session.amount_total || 0) / 100,
          metodo: "stripe_card",
          crediti_acquistati: packCrediti,
          debiti_decurtati: debitiDecurtati,
          anticipi_decurtati: anticipiScontati,
          crediti_effettivi_aggiunti: creditiEffettivi,
          causale_bonifico: null,
          stato: "completato",
          stato_fattura: "da_emettere",
          created_at: new Date().toISOString(),
        };

        if (currentCrediti < 0) {
          walletOwner.crediti = currentCrediti + debitiDecurtati + creditiEffettivi;
        } else {
          walletOwner.crediti = currentCrediti + creditiEffettivi;
        }
        const nuovaScadenza = new Date(Date.now() + (pacchetto.giorni_validita || 60) * 86400000)
          .toISOString()
          .slice(0, 10);
        if (!walletOwner.data_scadenza_crediti || nuovaScadenza > walletOwner.data_scadenza_crediti) {
          walletOwner.data_scadenza_crediti = nuovaScadenza;
        }
        const nowIso = new Date().toISOString();
        walletOwner.data_ultimo_accesso = nowIso;
        walletOwner.updated_at = nowIso;
        if (atleta.id !== walletOwner.id) {
          atleta.data_ultimo_accesso = nowIso;
          atleta.updated_at = nowIso;
        }
        alignSharedPartnersCredits(walletOwner, db);

        let motivazioneExtra = "";
        if (debitiDecurtati > 0 && anticipiScontati > 0) {
          motivazioneExtra = ` (sanati ${debitiDecurtati} crediti di debito e scalati ${anticipiScontati} anticipi)`;
        } else if (debitiDecurtati > 0) {
          motivazioneExtra = ` (sanati ${debitiDecurtati} crediti di debito)`;
        } else if (anticipiScontati > 0) {
          motivazioneExtra = ` (scontati ${anticipiScontati} crediti concessi in anticipo)`;
        }

        addMovimentoCrediti(db, {
          atleta_id: walletOwner.id,
          email_cliente: walletOwner.email,
          nome_cliente: nuovaTransazione.nome_cliente,
          tipo: "acquisto_carnet",
          delta_crediti: creditiEffettivi,
          saldo_risultante: walletOwner.crediti,
          motivazione: `Acquisto Stripe ${pacchetto.nome}${motivazioneExtra}`,
          operatore: "stripe",
        });

        db.transazioni_pagamenti = db.transazioni_pagamenti || [];
        db.transazioni_pagamenti.unshift(nuovaTransazione);
        saveData(db);
        await syncDataToGoogleDrive(db).catch(() => {});

        return res.end(
          JSON.stringify({
            ok: true,
            verified: true,
            transazione: nuovaTransazione,
            crediti_attuali: walletOwner.crediti,
            messaggio: "Pagamento Stripe confermato con successo! Crediti accreditati nel wallet.",
          })
        );
      } catch (err: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message || "Errore verifica sessione Stripe" }));
      }
    }

    // POST /app-api/pagamenti/stripe-webhook (Webhook Stripe per eventi asincroni)
    if (
      (pathname === "/app-api/pagamenti/stripe-webhook" ||
        pathname === "/app-api/stripe-webhook" ||
        pathname === "/api/stripe-webhook") &&
      method === "POST"
    ) {
      const event = parsedBody;
      const sigHeader = (req.headers["stripe-signature"] as string) || "";
      const webhookSecret =
        db.configurazione_lab?.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

      // Verifica firma crittografica se il webhook secret è impostato
      if (webhookSecret && sigHeader && rawBody) {
        try {
          const parts = sigHeader.split(",").reduce((acc: any, part: string) => {
            const [k, v] = part.split("=");
            if (k && v) acc[k.trim()] = v.trim();
            return acc;
          }, {});
          if (parts.t && parts.v1) {
            const expectedSig = crypto
              .createHmac("sha256", webhookSecret.trim())
              .update(`${parts.t}.${rawBody}`)
              .digest("hex");
            if (parts.v1 !== expectedSig) {
              console.warn("[Stripe Webhook] Firma HMAC non valida.");
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: "Firma webhook non valida" }));
            }
          }
        } catch (sigErr) {
          console.error("[Stripe Webhook] Errore verifica firma:", sigErr);
        }
      }

      // Gestione evento completamento checkout
      if (event?.type === "checkout.session.completed") {
        const session = event.data?.object;
        if (session && session.id) {
          const existingTx = (db.transazioni_pagamenti || []).find(
            (t: any) => t.codice_transazione === session.id || t.stripe_session_id === session.id
          );

          if (!existingTx && session.payment_status === "paid") {
            const meta = session.metadata || {};
            const packId = meta.pack_id;
            const atletaEmail = meta.atleta_email || session.customer_email;
            const pacchetto =
              (db.tariffario_pacchetti || []).find((p: any) => p.id === packId) || {
                id: packId,
                nome: meta.pack_nome || "Pacchetto Lab",
                crediti: Number(meta.pack_crediti) || 10,
                prezzo_euro: (session.amount_total || 0) / 100,
                giorni_validita: Number(meta.giorni_validita) || 60,
              };

            const atleta =
              (db.profili_utenti || []).find(
                (p: any) => p.email === atletaEmail || p.id === meta.atleta_id
              ) || currentUser;

            const walletOwner = getWalletOwner(atleta, db) || atleta;
            const currentCrediti = Number(walletOwner.crediti) || 0;
            const packCrediti = Number(pacchetto.crediti) || 0;
            const anticipiAttuali = Number(walletOwner.anticipi_da_scontare) || 0;

            let debitiDecurtati = 0;
            let anticipiScontati = 0;

            if (currentCrediti < 0) {
              debitiDecurtati = Math.min(Math.abs(currentCrediti), packCrediti);
            }

            const creditiRimanentiDopoDebito = packCrediti - debitiDecurtati;
            if (anticipiAttuali > 0) {
              anticipiScontati = Math.min(anticipiAttuali, creditiRimanentiDopoDebito);
              walletOwner.anticipi_da_scontare = Math.max(0, anticipiAttuali - anticipiScontati);
            }

            const creditiEffettivi = packCrediti - debitiDecurtati - anticipiScontati;

            const nuovaTransazione = {
              codice_transazione: `TX-ST-${Date.now().toString().slice(-6)}`,
              stripe_session_id: session.id,
              stripe_payment_intent: session.payment_intent,
              atleta_id: atleta.id,
              email_cliente: atleta.email,
              nome_cliente:
                `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
              codice_fiscale: meta.codice_fiscale || atleta.codice_fiscale || "",
              indirizzo: meta.indirizzo || atleta.indirizzo || "",
              id_pacchetto: pacchetto.id,
              nome_pacchetto: pacchetto.nome,
              importo_euro: (session.amount_total || 0) / 100,
              metodo: "stripe_card",
              crediti_acquistati: packCrediti,
              debiti_decurtati: debitiDecurtati,
              anticipi_decurtati: anticipiScontati,
              crediti_effettivi_aggiunti: creditiEffettivi,
              causale_bonifico: null,
              stato: "completato",
              stato_fattura: "da_emettere",
              created_at: new Date().toISOString(),
            };

            if (currentCrediti < 0) {
              walletOwner.crediti = currentCrediti + debitiDecurtati + creditiEffettivi;
            } else {
              walletOwner.crediti = currentCrediti + creditiEffettivi;
            }
            const nuovaScadenza = new Date(Date.now() + (pacchetto.giorni_validita || 60) * 86400000)
              .toISOString()
              .slice(0, 10);
            if (!walletOwner.data_scadenza_crediti || nuovaScadenza > walletOwner.data_scadenza_crediti) {
              walletOwner.data_scadenza_crediti = nuovaScadenza;
            }
            const nowIso = new Date().toISOString();
            walletOwner.data_ultimo_accesso = nowIso;
            walletOwner.updated_at = nowIso;
            if (atleta.id !== walletOwner.id) {
              atleta.data_ultimo_accesso = nowIso;
              atleta.updated_at = nowIso;
            }
            alignSharedPartnersCredits(walletOwner, db);

            let motivazioneExtra = "";
            if (debitiDecurtati > 0 && anticipiScontati > 0) {
              motivazioneExtra = ` (sanati ${debitiDecurtati} crediti di debito e scalati ${anticipiScontati} anticipi)`;
            } else if (debitiDecurtati > 0) {
              motivazioneExtra = ` (sanati ${debitiDecurtati} crediti di debito)`;
            } else if (anticipiScontati > 0) {
              motivazioneExtra = ` (scontati ${anticipiScontati} crediti concessi in anticipo)`;
            }

            addMovimentoCrediti(db, {
              atleta_id: walletOwner.id,
              email_cliente: walletOwner.email,
              nome_cliente: nuovaTransazione.nome_cliente,
              tipo: "acquisto_carnet",
              delta_crediti: creditiEffettivi,
              saldo_risultante: walletOwner.crediti,
              motivazione: `Webhook Stripe ${pacchetto.nome}${motivazioneExtra}`,
              operatore: "stripe_webhook",
            });

            db.transazioni_pagamenti = db.transazioni_pagamenti || [];
            db.transazioni_pagamenti.unshift(nuovaTransazione);
            saveData(db);
            await syncDataToGoogleDrive(db).catch(() => {});
            await sendAdminPaymentNotification("stripe", nuovaTransazione, { pacchetto, atleta: walletOwner }).catch(() => {});
          }
        }
      }

      // Gestione eventi fallimento pagamento / rinnovo ricorrente Stripe
      if (
        event?.type === "invoice.payment_failed" ||
        event?.type === "payment_intent.payment_failed"
      ) {
        const obj = event.data?.object;
        const customerEmail = (
          obj?.customer_email ||
          obj?.receipt_email ||
          obj?.billing_details?.email ||
          obj?.metadata?.atleta_email ||
          ""
        )
          .toLowerCase()
          .trim();
        const atletaId = obj?.metadata?.atleta_id || obj?.client_reference_id;
        const customerId = obj?.customer;
        const amountCents = obj?.amount_due ?? obj?.amount ?? 0;
        const amountFailed = amountCents > 0 ? amountCents / 100 : 0;
        const failureReason =
          obj?.last_payment_error?.message ||
          obj?.last_finalization_error?.message ||
          obj?.failure_message ||
          "Fondi insufficienti o carta rifiutata";

        const atleta = (db.profili_utenti || []).find((p: any) => {
          if (atletaId && p.id === atletaId) return true;
          if (customerEmail && p.email?.toLowerCase().trim() === customerEmail) return true;
          if (customerId && p.stripe_customer_id === customerId) return true;
          return false;
        });

        if (atleta) {
          atleta.stato_iscrizione = "sospeso_insoluto";
          (atleta as any).ultimo_insoluto = {
            data: new Date().toISOString(),
            importo_euro: amountFailed,
            motivo: failureReason,
            evento: event.type,
          };
          const notaAlert = `[⚠️ ALLERTA RINNOVO FALLITO il ${new Date().toLocaleDateString(
            "it-IT"
          )}: € ${amountFailed.toFixed(2)} non riscosso (${failureReason}). Posizione sospesa.]`;
          atleta.note_coach = atleta.note_coach ? `${atleta.note_coach} | ${notaAlert}` : notaAlert;

          // Invia email immediata al coach
          const emailCoach =
            db.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";
          const emailRecord = {
            id: `email-fail-${Date.now()}`,
            destinatario: emailCoach,
            oggetto: `[ALLARME AREA46] Rinnovo Fallito / Insoluto — ${atleta.nome} ${atleta.cognome}`,
            corpo: `
ATTENZIONE: TENTATIVO DI ADDEBITO STRIPE FALLITO
=============================================================================
Data: ${new Date().toLocaleString("it-IT")}
Evento Stripe: ${event.type}
Atleta: ${atleta.nome} ${atleta.cognome}
Email: ${atleta.email}
Telefono: ${atleta.telefono || "-"}
Importo non riscosso: € ${amountFailed.toFixed(2)}
Motivo rifiuto: ${failureReason}
=============================================================================
AZIONI AUTOMATICHE APPLICATE DALL'APP:
1. Stato atleta impostato su: SOSPESO PER INSOLUTO.
2. Blocco preventivo delle prenotazioni di ulteriori slot.
3. Segnalazione visiva rossa accesa nel pannello Manager Atleti.
=============================================================================
Contatta l'atleta o invia un link di pagamento per regolarizzare la quota.
            `.trim(),
            inviato_il: new Date().toISOString(),
            stato: "inviata",
          };

          db.notifiche_email = db.notifiche_email || [];
          db.notifiche_email.unshift(emailRecord);
          saveData(db);
          console.warn(
            `[STRIPE WEBHOOK] Allerta insoluto registrata per ${atleta.email} (€ ${amountFailed})`
          );
        }
      }

      return res.end(JSON.stringify({ received: true }));
    }

    // POST /app-api/transazioni/manuale (Registrazione Versamento Manuale dal Coach nel Fisco)
    if (pathname === "/app-api/transazioni/manuale" && method === "POST") {
      const atletaId = parsedBody.atleta_id || parsedBody.email_cliente;
      if (!atletaId) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Atleta obbligatorio" }));
      }
      const atleta = (db.profili_utenti || []).find(
        (p: any) =>
          p.id === atletaId ||
          p.email?.toLowerCase() === String(atletaId).toLowerCase()
      );
      if (!atleta) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Atleta non trovato in anagrafica" }));
      }

      const importoEuro = Number(parsedBody.importo_euro);
      if (isNaN(importoEuro) || importoEuro <= 0) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({ error: "Importo non valido (deve essere un valore numerico maggiore di zero)" })
        );
      }

      const metodo = (parsedBody.metodo || "bonifico").toLowerCase();
      const packId = parsedBody.id_pacchetto || "manuale";
      const pacchettoTrovato = (db.tariffario_pacchetti || []).find((p: any) => p.id === packId);
      const nomePacchetto =
        parsedBody.nome_pacchetto ||
        parsedBody.descrizione ||
        pacchettoTrovato?.nome ||
        (metodo === "bonifico" ? "Bonifico Bancario" : "Versamento Manuale");

      const creditiDaAccreditare = Number(parsedBody.crediti_da_accreditare) || 0;
      const dataPagamento = parsedBody.data_pagamento
        ? new Date(parsedBody.data_pagamento).toISOString()
        : new Date().toISOString();

      const txCode = `TX-MAN-46-${Date.now().toString().slice(-6)}`;
      const causaleBonifico =
        parsedBody.causale_bonifico ||
        (metodo === "bonifico"
          ? `AREA46-${(atleta.cognome || "ATLETA").toUpperCase()}-${txCode.slice(-4)}`
          : null);

      const walletOwner = getWalletOwner(atleta, db) || atleta;
      const anticipiAttuali = Number(walletOwner.anticipi_da_scontare) || 0;
      let anticipiScontati = 0;
      let creditiEffettivi = creditiDaAccreditare;

      if (creditiDaAccreditare > 0 && anticipiAttuali > 0 && parsedBody.sconta_anticipi !== false) {
        anticipiScontati = Math.min(anticipiAttuali, creditiDaAccreditare);
        walletOwner.anticipi_da_scontare = Math.max(0, anticipiAttuali - anticipiScontati);
        creditiEffettivi = creditiDaAccreditare - anticipiScontati;
      }

      const nuovaTransazione = {
        id: `tx-man-${Date.now()}`,
        codice_transazione: txCode,
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente:
          `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
        codice_fiscale: parsedBody.codice_fiscale || atleta.codice_fiscale || "",
        indirizzo: parsedBody.indirizzo || atleta.indirizzo || "",
        id_pacchetto: packId,
        nome_pacchetto: nomePacchetto,
        importo_euro: importoEuro,
        metodo: metodo,
        crediti_acquistati: creditiDaAccreditare,
        debiti_decurtati: 0,
        anticipi_decurtati: anticipiScontati,
        crediti_effettivi_aggiunti: creditiEffettivi,
        causale_bonifico: causaleBonifico,
        stato: "completato",
        stato_fattura: "da_emettere",
        created_at: dataPagamento,
        note: parsedBody.note || "",
        inserito_da: "coach_manuale",
      };

      if (creditiDaAccreditare > 0) {
        const currentCrediti = Number(walletOwner.crediti) || 0;
        walletOwner.crediti = currentCrediti + creditiEffettivi;

        if (parsedBody.data_scadenza_crediti) {
          walletOwner.data_scadenza_crediti = parsedBody.data_scadenza_crediti;
        } else if (parsedBody.giorni_validita || pacchettoTrovato?.giorni_validita) {
          const days = Number(parsedBody.giorni_validita || pacchettoTrovato?.giorni_validita);
          const nuovaScadenza = new Date(Date.now() + days * 86400000)
            .toISOString()
            .slice(0, 10);
          if (!walletOwner.data_scadenza_crediti || nuovaScadenza > walletOwner.data_scadenza_crediti) {
            walletOwner.data_scadenza_crediti = nuovaScadenza;
          }
        }
        const nowIso = new Date().toISOString();
        walletOwner.data_ultimo_accesso = nowIso;
        walletOwner.updated_at = nowIso;
        if (atleta.id !== walletOwner.id) {
          atleta.data_ultimo_accesso = nowIso;
          atleta.updated_at = nowIso;
        }
        alignSharedPartnersCredits(walletOwner, db);

        let motivazioneExtra = "";
        if (anticipiScontati > 0) {
          motivazioneExtra = ` (scontati ${anticipiScontati} crediti concessi in anticipo)`;
        }

        addMovimentoCrediti(db, {
          atleta_id: walletOwner.id,
          email_cliente: walletOwner.email,
          nome_cliente:
            `${walletOwner.nome || ""} ${walletOwner.cognome || ""}`.trim() ||
            walletOwner.name ||
            "Atleta",
          tipo: "versamento_manuale",
          delta_crediti: creditiEffettivi,
          saldo_risultante: walletOwner.crediti,
          motivazione: `Versamento manuale ${nomePacchetto} (€ ${importoEuro.toFixed(2)}) registrato dal Coach${motivazioneExtra}`,
          operatore: "coach",
        });
      }

      db.transazioni_pagamenti = db.transazioni_pagamenti || [];
      if (db.transazioni_cancellate && Array.isArray(db.transazioni_cancellate)) {
        db.transazioni_cancellate = db.transazioni_cancellate.filter(
          (c: string) => c !== nuovaTransazione.id && c !== nuovaTransazione.codice_transazione
        );
      }
      db.transazioni_pagamenti.unshift(nuovaTransazione);
      await saveData(db);
      await syncDataToGoogleDrive(db).catch(() => {});
      await triggerSggSyncAsync(nuovaTransazione);
      await sendAdminPaymentNotification("manuale", nuovaTransazione).catch(() => {});

      res.statusCode = 201;
      return res.end(
        JSON.stringify({
          ok: true,
          transazione: nuovaTransazione,
          crediti_attuali: walletOwner.crediti,
          data_scadenza_crediti: walletOwner.data_scadenza_crediti,
          messaggio: `Versamento di € ${importoEuro.toFixed(2)} per ${nuovaTransazione.nome_cliente} registrato con successo nel Registro Fisco.`,
        })
      );
    }

    // POST /app-api/transazioni/checkout (Checkout Manuale / Bonifico)
    if (pathname === "/app-api/transazioni/checkout" && method === "POST") {
      const atletaId = parsedBody.atleta_id || currentUser?.id;
      const atleta =
        (db.profili_utenti || []).find((p: any) => p.id === atletaId || p.email === atletaId) ||
        currentUser;
      const packId = parsedBody.id_pacchetto;
      const pacchetto = (db.tariffario_pacchetti || []).find((p: any) => p.id === packId);

      if (!pacchetto) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Pacchetto selezionato non valido" }));
      }

      const metodo = parsedBody.metodo || "carta";
      const isBonifico = metodo === "bonifico";
      const walletOwner = getWalletOwner(atleta, db) || atleta;
      const currentCrediti = Number(walletOwner.crediti) || 0;
      const packCrediti = Number(pacchetto.crediti) || 0;
      const anticipiAttuali = Number(walletOwner.anticipi_da_scontare) || 0;

      // FORMULA DETRAZIONE DEBITI E ANTICIPI
      let debitiDecurtati = 0;
      let anticipiScontati = 0;

      if (currentCrediti < 0) {
        debitiDecurtati = Math.min(Math.abs(currentCrediti), packCrediti);
      }

      const creditiRimanentiDopoDebito = packCrediti - debitiDecurtati;
      if (anticipiAttuali > 0 && !isBonifico) {
        anticipiScontati = Math.min(anticipiAttuali, creditiRimanentiDopoDebito);
        walletOwner.anticipi_da_scontare = Math.max(0, anticipiAttuali - anticipiScontati);
      }

      const creditiEffettivi = packCrediti - debitiDecurtati - anticipiScontati;

      const txCode = `TX-46-${Date.now().toString().slice(-6)}`;
      const causaleBonifico = `AREA46-${(atleta.cognome || "ATLETA").toUpperCase()}-${pacchetto.id.toUpperCase()}-${txCode.slice(-4)}`;

      const nuovaTransazione = {
        codice_transazione: txCode,
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente:
          `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
        codice_fiscale: parsedBody.codice_fiscale || atleta.codice_fiscale || "",
        partita_iva: parsedBody.partita_iva || atleta.partita_iva || "",
        pec: parsedBody.pec || atleta.pec || "",
        codice_sdi: parsedBody.codice_sdi || atleta.codice_sdi || "0000000",
        indirizzo: parsedBody.indirizzo || atleta.indirizzo || "",
        id_pacchetto: pacchetto.id,
        nome_pacchetto: pacchetto.nome,
        importo_euro: pacchetto.prezzo_euro,
        metodo,
        crediti_acquistati: packCrediti,
        debiti_decurtati: debitiDecurtati,
        anticipi_decurtati: anticipiScontati,
        crediti_effettivi_aggiunti: creditiEffettivi,
        causale_bonifico: isBonifico ? causaleBonifico : null,
        stato: isBonifico ? "in_attesa_bonifico" : "completato",
        stato_fattura: "da_emettere",
        created_at: new Date().toISOString(),
      };

      if (!isBonifico) {
        if (currentCrediti < 0) {
          walletOwner.crediti = currentCrediti + debitiDecurtati + creditiEffettivi;
        } else {
          walletOwner.crediti = currentCrediti + creditiEffettivi;
        }
        const nuovaScadenza = new Date(Date.now() + pacchetto.giorni_validita * 86400000)
          .toISOString()
          .slice(0, 10);
        if (!walletOwner.data_scadenza_crediti || nuovaScadenza > walletOwner.data_scadenza_crediti) {
          walletOwner.data_scadenza_crediti = nuovaScadenza;
        }
        walletOwner.data_ultimo_accesso = new Date().toISOString();
        if (atleta.id !== walletOwner.id) atleta.data_ultimo_accesso = new Date().toISOString();

        let motivazioneExtra = "";
        if (debitiDecurtati > 0 && anticipiScontati > 0) {
          motivazioneExtra = ` (sanati ${debitiDecurtati} crediti di debito e scalati ${anticipiScontati} anticipi)`;
        } else if (debitiDecurtati > 0) {
          motivazioneExtra = ` (sanati ${debitiDecurtati} crediti di debito)`;
        } else if (anticipiScontati > 0) {
          motivazioneExtra = ` (scontati ${anticipiScontati} crediti concessi in anticipo)`;
        }

        addMovimentoCrediti(db, {
          atleta_id: walletOwner.id,
          email_cliente: walletOwner.email,
          nome_cliente: nuovaTransazione.nome_cliente,
          tipo: "acquisto_carnet",
          delta_crediti: creditiEffettivi,
          saldo_risultante: walletOwner.crediti,
          motivazione: `Acquisto ${pacchetto.nome}${motivazioneExtra}`,
          operatore: "atleta",
        });
      }

      db.transazioni_pagamenti = db.transazioni_pagamenti || [];
      db.transazioni_pagamenti.unshift(nuovaTransazione);
      saveData(db);
      await syncDataToGoogleDrive(db).catch(() => {});
      await sendAdminPaymentNotification(isBonifico ? "bonifico" : "manuale", nuovaTransazione, { pacchetto, atleta }).catch(() => {});

      res.statusCode = 201;
      return res.end(
        JSON.stringify({
          ok: true,
          transazione: nuovaTransazione,
          crediti_attuali: walletOwner.crediti,
          data_scadenza_crediti: walletOwner.data_scadenza_crediti,
          debiti_estinti: debitiDecurtati,
          anticipi_scontati: anticipiScontati,
          ricevuta: {
            titolo: "RICEVUTA DI PAGAMENTO — AREA46 TRAINING LAB",
            codice: txCode,
            cliente: nuovaTransazione.nome_cliente,
            codice_fiscale: nuovaTransazione.codice_fiscale,
            importo: `${pacchetto.prezzo_euro} €`,
            descrizione: pacchetto.nome,
            metodo: metodo.toUpperCase(),
            data: new Date().toLocaleDateString("it-IT"),
          },
        })
      );
    }

    // POST /app-api/transazioni/:codice/approva-bonifico
    const bonificoMatch = pathname.match(
      /^\/app-api\/transazioni\/([a-zA-Z0-9_-]+)\/approva-bonifico$/
    );
    if (bonificoMatch && method === "POST") {
      const txCode = bonificoMatch[1];
      const tx = (db.transazioni_pagamenti || []).find((t: any) => t.codice_transazione === txCode);
      if (!tx) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Transazione non trovata" }));
      }
      if (tx.stato === "completato") {
        return res.end(
          JSON.stringify({ ok: true, messaggio: "Bonifico già approvato precedentemente.", tx })
        );
      }

      const atleta = (db.profili_utenti || []).find(
        (p: any) => p.id === tx.atleta_id || p.email === tx.email_cliente
      );
      if (atleta) {
        const walletOwner = getWalletOwner(atleta, db) || atleta;
        const currentCrediti = Number(walletOwner.crediti) || 0;
        const packCrediti = Number(tx.crediti_acquistati) || 0;
        const anticipiAttuali = Number(walletOwner.anticipi_da_scontare) || 0;

        let debitiDecurtati = 0;
        let anticipiScontati = 0;

        if (currentCrediti < 0) {
          debitiDecurtati = Math.min(Math.abs(currentCrediti), packCrediti);
        }

        const creditiRimanenti = packCrediti - debitiDecurtati;
        if (anticipiAttuali > 0) {
          anticipiScontati = Math.min(anticipiAttuali, creditiRimanenti);
          walletOwner.anticipi_da_scontare = Math.max(0, anticipiAttuali - anticipiScontati);
        }

        const creditiEffettivi = packCrediti - debitiDecurtati - anticipiScontati;
        if (currentCrediti < 0) {
          walletOwner.crediti = currentCrediti + debitiDecurtati + creditiEffettivi;
        } else {
          walletOwner.crediti = currentCrediti + creditiEffettivi;
        }

        const pack = (db.tariffario_pacchetti || []).find((p: any) => p.id === tx.id_pacchetto);
        const giorni = pack?.giorni_validita || 60;
        const nuovaScadenza = new Date(Date.now() + giorni * 86400000).toISOString().slice(0, 10);
        if (!walletOwner.data_scadenza_crediti || nuovaScadenza > walletOwner.data_scadenza_crediti) {
          walletOwner.data_scadenza_crediti = nuovaScadenza;
        }
        const nowIso = new Date().toISOString();
        walletOwner.data_ultimo_accesso = nowIso;
        walletOwner.updated_at = nowIso;
        if (atleta.id !== walletOwner.id) {
          atleta.data_ultimo_accesso = nowIso;
          atleta.updated_at = nowIso;
        }
        alignSharedPartnersCredits(walletOwner, db);

        let motivazioneExtra = "";
        if (debitiDecurtati > 0 && anticipiScontati > 0) {
          motivazioneExtra = ` (sanati ${debitiDecurtati} crediti di debito e scalati ${anticipiScontati} anticipi)`;
        } else if (debitiDecurtati > 0) {
          motivazioneExtra = ` (sanati ${debitiDecurtati} crediti di debito)`;
        } else if (anticipiScontati > 0) {
          motivazioneExtra = ` (scontati ${anticipiScontati} crediti concessi in anticipo)`;
        }

        tx.debiti_decurtati = debitiDecurtati;
        tx.anticipi_decurtati = anticipiScontati;
        tx.crediti_effettivi_aggiunti = creditiEffettivi;

        addMovimentoCrediti(db, {
          atleta_id: walletOwner.id,
          email_cliente: walletOwner.email,
          nome_cliente: `${walletOwner.nome || ""} ${walletOwner.cognome || ""}`.trim() || tx.nome_cliente,
          tipo: "acquisto_carnet",
          delta_crediti: creditiEffettivi,
          saldo_risultante: walletOwner.crediti,
          motivazione: `Bonifico confermato per ${tx.nome_pacchetto}${motivazioneExtra}`,
          operatore: "coach",
        });

        // Invia email di conferma all'atleta
        await sendEmailNotification({
          to: walletOwner.email,
          subject: `✅ Bonifico Ricevuto e Crediti Attivati — Area46 Landmine Lab`,
          body: `
Ciao ${walletOwner.nome}!

Il Coach Stefano Tronconi ha verificato e approvato il tuo bonifico bancario per ${tx.nome_pacchetto}.
I tuoi crediti sono stati caricati ed il tuo wallet è attivo:

- Crediti aggiunti: +${creditiEffettivi} sedute${motivazioneExtra}
- Saldo totale disponibile: ${walletOwner.crediti} crediti
- Nuova data scadenza: ${walletOwner.data_scadenza_crediti}

Da adesso puoi accedere all'App e prenotare liberamente i tuoi slot di allenamento:
https://area46-app.vercel.app

Buon allenamento con Landmine Lab!
— Coach Stefano Tronconi
          `.trim(),
          tipo: "conferma_bonifico_atleta",
        }).catch(() => {});
      }

      tx.stato = "completato";
      tx.approvato_il = new Date().toISOString();
      await saveData(db);
      await syncDataToGoogleDrive(db).catch(() => {});
      await triggerSggSyncAsync(tx);

      return res.end(JSON.stringify({ ok: true, tx, crediti_atleta: atleta?.crediti }));
    }

    // DELETE /app-api/transazioni/:id (Elimina solo il movimento fiscale, ricalcola registro incassi)
    const txDeleteMatch = pathname.match(/^\/app-api\/transazioni\/([a-zA-Z0-9_@.-]+)$/);
    if (txDeleteMatch && method === "DELETE") {
      const targetParam = decodeURIComponent(txDeleteMatch[1]);
      const initialCount = (db.transazioni_pagamenti || []).length;
      db.transazioni_cancellate = db.transazioni_cancellate || [];
      if (!db.transazioni_cancellate.includes(targetParam)) {
        db.transazioni_cancellate.push(targetParam);
      }
      db.transazioni_pagamenti = (db.transazioni_pagamenti || []).filter((t: any) => {
        return t.id !== targetParam && t.codice_transazione !== targetParam;
      });
      await saveData(db);
      await syncDataToGoogleDrive(db).catch(() => {});
      triggerSggSyncAsync();
      return res.end(
        JSON.stringify({
          success: true,
          deletedCount: initialCount - (db.transazioni_pagamenti || []).length,
          message: "Movimento fiscale eliminato con successo. Registro incassi ricalcolato.",
        })
      );
    }

    // POST /app-api/transazioni/svuota-tutto (Elimina tutti i movimenti fiscali permanentemente)
    if (pathname === "/app-api/transazioni/svuota-tutto" && method === "POST") {
      const allCodes = (db.transazioni_pagamenti || []).map((t: any) => t.codice_transazione || t.id);
      db.transazioni_cancellate = Array.from(
        new Set([...(db.transazioni_cancellate || []), ...allCodes, ...FICTITIOUS_TX_IDS])
      );
      db.transazioni_pagamenti = [];
      saveData(db);
      syncDataToGoogleDrive(db).catch(() => {});
      return res.end(
        JSON.stringify({
          success: true,
          message: "Tutti i movimenti fiscali sono stati eliminati permanentemente.",
        })
      );
    }

    // GET /app-api/transazioni/export-invoicebuddy
    if (pathname === "/app-api/transazioni/export-invoicebuddy" && method === "GET") {
      const transazioni = (db.transazioni_pagamenti || []).map((t: any) => ({
        codice: t.codice_transazione,
        data: t.created_at?.slice(0, 10),
        cliente: t.nome_cliente,
        codice_fiscale: t.codice_fiscale || "N/D",
        indirizzo: t.indirizzo || "Firenze",
        descrizione: `${t.nome_pacchetto} (${t.crediti_acquistati} crediti Lab)`,
        importo_netto: Number(t.importo_euro || 0).toFixed(2),
        regime_fiscale: "Forfettario (art. 1, commi 54-89, L. 190/2014)",
        metodo_pagamento: t.metodo,
        stato: t.stato,
        stringa_copia_rapida: `${t.created_at?.slice(0, 10) || ""} | ${t.nome_cliente} | CF: ${
          t.codice_fiscale || "N/D"
        } | ${t.nome_pacchetto} | € ${t.importo_euro}`,
      }));
      return res.end(JSON.stringify(transazioni));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MOTORE ALLENAMENTI & DIARIO CARICHI (Preservato 100%)
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Livelli
    if (pathname === "/app-api/livelli" && method === "GET") {
      const livelli = db.livelli || [];
      return res.end(JSON.stringify(livelli));
    }

    // 2. Allenamenti (lista giorni)
    if (pathname === "/app-api/allenamenti" && method === "GET") {
      const livello = url.searchParams.get("livello");
      let all = db.allenamenti.filter(
        (a: any) =>
          a.giorno !== null &&
          ((a.nome_esercizio && a.nome_esercizio.trim() !== "") ||
            (a.id_esercizio && a.id_esercizio.trim() !== ""))
      );
      if (livello) {
        all = all.filter((a: any) => a.livello === livello);
      }

      const map = new Map<string, any>();
      for (const row of all) {
        const numMatch = String(row.giorno).match(/[0-9]+/);
        const giorno_num = numMatch ? parseInt(numMatch[0], 10) : 1;
        const key = `${row.livello ?? ""}-${row.settimana ?? ""}-${giorno_num}`;
        if (!map.has(key)) {
          map.set(key, {
            livello: row.livello,
            giorno: row.giorno,
            settimana: row.settimana || "Ciclo unico",
            giorno_num,
          });
        }
      }

      const result = Array.from(map.values()).sort((a, b) => {
        if (a.livello !== b.livello) return a.livello.localeCompare(b.livello);
        if (a.settimana !== b.settimana) return a.settimana.localeCompare(b.settimana);
        return a.giorno_num - b.giorno_num;
      });

      return res.end(JSON.stringify(result));
    }

    // 3. Approfondimenti ed extra
    if (pathname === "/app-api/approfondimenti" && method === "GET") {
      const rows = db.allenamenti
        .filter((a: any) => a.livello === "Approfondimenti ed extra")
        .map((a: any) => ({
          nome_esercizio: a.nome_esercizio,
          note_tecniche: a.note_tecniche,
          link_video: a.link_video,
          data_pubblicazione: a.data_pubblicazione,
          immagine: a.immagine || null,
        }))
        .sort((a: any, b: any) => {
          if (a.data_pubblicazione && !b.data_pubblicazione) return -1;
          if (!a.data_pubblicazione && b.data_pubblicazione) return 1;
          if (a.data_pubblicazione && b.data_pubblicazione) {
            return b.data_pubblicazione.localeCompare(a.data_pubblicazione);
          }
          return 0;
        });
      return res.end(JSON.stringify(rows));
    }

    // 4. Dettaglio Giorno: GET /app-api/allenamenti/:livello/:giorno
    const giornoMatch = pathname.match(/^\/app-api\/allenamenti\/([^/]+)\/([^/]+)$/);
    if (giornoMatch && method === "GET") {
      const livello = decodeURIComponent(giornoMatch[1]);
      const giornoInt = parseInt(giornoMatch[2], 10);

      const rows = db.allenamenti
        .filter((a: any) => {
          if (a.livello !== livello) return false;
          const m = String(a.giorno).match(/[0-9]+/);
          return m && parseInt(m[0], 10) === giornoInt;
        })
        .map((a: any) => {
          const ex = db.database_esercizi.find((d: any) => d.id_esercizio === a.id_esercizio);
          return {
            ...a,
            link_video: ex?.link_video ?? a.link_video,
            target: ex?.target ?? null,
            attrezzatura: ex?.attrezzatura ?? null,
            livello_catalogo: ex?.livello ?? null,
            note_catalogo: ex?.note_tecniche ?? null,
            pattern_motorio: ex?.pattern_motorio ?? null,
            fulcro_articolare: ex?.fulcro_articolare ?? null,
            meridiano_miofasciale: ex?.meridiano_miofasciale ?? null,
            cue_esecutiva: ex?.cue_esecutiva ?? null,
          };
        })
        .sort((a: any, b: any) => (a.sequenza ?? "").localeCompare(b.sequenza ?? "", undefined, { numeric: true }));

      logShadowEvent("WORKOUT_VIEW", currentUser?.email || "anonymous", {
        livello,
        giorno: giornoInt,
        count: rows.length,
      });

      return res.end(JSON.stringify(rows));
    }

    // 5. Singolo Esercizio: GET /app-api/esercizi/:id
    const esMatch = pathname.match(/^\/app-api\/esercizi\/([^/]+)$/);
    if (esMatch && method === "GET") {
      const id = decodeURIComponent(esMatch[1]);
      const ex = db.database_esercizi.find((d: any) => d.id_esercizio === id);
      if (!ex) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Esercizio non trovato" }));
      }
      return res.end(JSON.stringify(ex));
    }

    // 6. Libreria Attrezzi: GET /app-api/libreria/attrezzi
    if (pathname === "/app-api/libreria/attrezzi" && method === "GET") {
      const attrezzi = new Set<string>();
      for (const ex of db.database_esercizi || []) {
        const att = ex.attrezzo || ex.attrezzatura;
        if (att) {
          for (const item of String(att).split(",")) {
            const trimmed = item.trim();
            if (trimmed) attrezzi.add(trimmed);
          }
        }
      }
      return res.end(JSON.stringify(Array.from(attrezzi).sort((a, b) => a.localeCompare(b))));
    }

    // 7. Libreria Esercizi: GET /app-api/libreria
    if (pathname === "/app-api/libreria" && method === "GET") {
      if (!currentUser) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({ error: "Accesso riservato. Effettua l'accesso per visualizzare la libreria esercizi." }));
      }
      const search = (url.searchParams.get("search") || url.searchParams.get("q") || "").toLowerCase().trim();
      const target = url.searchParams.get("target") || "";
      const attrezzo = (url.searchParams.get("attrezzo") || "").toLowerCase().trim();
      const livello = url.searchParams.get("livello") || "";

      let filtered = (db.database_esercizi || []).filter((ex: any) => {
        const nome = (ex.nome_reale || ex.nome_esercizio || "").toLowerCase();
        const tag = (ex.tag_biomeccanici || "").toLowerCase();
        const pattern = (ex.pattern_biomeccanico || "").toLowerCase();
        const exAttrezzo = (ex.attrezzo || ex.attrezzatura || "").toLowerCase();

        if (search) {
          const match =
            nome.includes(search) ||
            tag.includes(search) ||
            pattern.includes(search) ||
            exAttrezzo.includes(search) ||
            String(ex.id_esercizio || "").includes(search);
          if (!match) return false;
        }

        if (target && ex.target !== target && ex.ruolo !== target) return false;
        if (attrezzo && !exAttrezzo.includes(attrezzo)) return false;
        if (livello && ex.livello !== livello) return false;
        return true;
      });

      filtered.sort((a: any, b: any) => {
        const nomeA = a.nome_reale || a.nome_esercizio || "";
        const nomeB = b.nome_reale || b.nome_esercizio || "";
        return nomeA.localeCompare(nomeB);
      });
      return res.end(JSON.stringify(filtered));
    }

    // 7b. Video Vault Semantic Fast Search: GET /app-api/vault/search
    if (pathname === "/app-api/vault/search" && method === "GET") {
      if (!currentUser) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({ error: "Accesso riservato. Effettua l'accesso per effettuare ricerche nel Vault." }));
      }
      const q = (url.searchParams.get("q") || "").toLowerCase().trim();
      const fulcro = (url.searchParams.get("fulcro") || "").toLowerCase().trim();
      const meridiano = (url.searchParams.get("meridiano") || "").toLowerCase().trim();
      const pattern = (url.searchParams.get("pattern") || "").toLowerCase().trim();
      const cue = (url.searchParams.get("cue") || "").toLowerCase().trim();
      const attrezzo = (url.searchParams.get("attrezzo") || "").toLowerCase().trim();

      const startTime = Date.now();
      const items = (db.database_esercizi || []).filter((ex: any) => {
        const nome = (ex.nome_reale || ex.nome_esercizio || "").toLowerCase();
        const idStr = String(ex.id_esercizio || "");
        const att = (ex.attrezzo || ex.attrezzatura || "").toLowerCase();
        const exPattern = (ex.pattern_motorio || ex.pattern_biomeccanico || "").toLowerCase();
        const exFulcro = (ex.fulcro_articolare || "").toLowerCase();
        const exMeridiano = (ex.meridiano_miofasciale || "").toLowerCase();
        const exCue = (ex.cue_esecutiva || "").toLowerCase();
        const tag = (ex.tag_biomeccanici || "").toLowerCase();

        if (fulcro && !exFulcro.includes(fulcro)) return false;
        if (meridiano && !exMeridiano.includes(meridiano)) return false;
        if (pattern && !exPattern.includes(pattern)) return false;
        if (cue && !exCue.includes(cue)) return false;
        if (attrezzo && !att.includes(attrezzo)) return false;

        if (q) {
          const tokens = q.split(/\s+/).filter(Boolean);
          const fullText = `${nome} ${idStr} ${att} ${exPattern} ${exFulcro} ${exMeridiano} ${exCue} ${tag}`;
          const matchesAll = tokens.every((token) => fullText.includes(token));
          if (!matchesAll) return false;
        }
        return true;
      });

      const durationMs = Date.now() - startTime;
      logShadowEvent("VAULT_SEARCH", currentUser?.email || "coach", {
        q,
        fulcro,
        meridiano,
        count: items.length,
        durationMs,
      });

      const results = items.map((ex: any) => {
        const videoUrl = ex.link_video || "";
        const whatsappText = `🎥 *Area46 Lab Video Clip (15s)*: ${ex.nome_reale || ex.nome_esercizio}\n🔑 *Cue Esecutiva:* ${ex.cue_esecutiva || "Allineamento neutro"}\n⚙️ *Pattern:* ${ex.pattern_motorio || ex.pattern_biomeccanico || ""}\n${videoUrl ? `Guarda la pillola: ${videoUrl}` : ""}`.trim();

        return {
          id: ex.id,
          id_esercizio: ex.id_esercizio,
          nome_reale: ex.nome_reale || ex.nome_esercizio,
          attrezzo: ex.attrezzo || ex.attrezzatura || "",
          pattern_motorio: ex.pattern_motorio || ex.pattern_biomeccanico || "",
          fulcro_articolare: ex.fulcro_articolare || "",
          meridiano_miofasciale: ex.meridiano_miofasciale || "",
          cue_esecutiva: ex.cue_esecutiva || "",
          tag_biomeccanici: ex.tag_biomeccanici || "",
          link_video: videoUrl,
          whatsapp_text: whatsappText,
          whatsapp_share_url: `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`,
        };
      });

      return res.end(
        JSON.stringify({
          ok: true,
          duration_ms: durationMs,
          total: results.length,
          data: results,
        })
      );
    }

    // 7c. Video Vault Metadata per Chip Filtri: GET /app-api/vault/meta
    if (pathname === "/app-api/vault/meta" && method === "GET") {
      const patterns = new Set<string>();
      const fulcri = new Set<string>();
      const meridiani = new Set<string>();
      const cues = new Set<string>();

      for (const ex of db.database_esercizi || []) {
        if (ex.pattern_motorio) patterns.add(ex.pattern_motorio);
        if (ex.fulcro_articolare) fulcri.add(ex.fulcro_articolare);
        if (ex.meridiano_miofasciale) meridiani.add(ex.meridiano_miofasciale);
        if (ex.cue_esecutiva) cues.add(ex.cue_esecutiva);
      }

      return res.end(
        JSON.stringify({
          patterns: Array.from(patterns).sort(),
          fulcri: Array.from(fulcri).sort(),
          meridiani: Array.from(meridiani).sort(),
          cues: Array.from(cues).sort(),
        })
      );
    }

    // 8. Stati Allenamenti: GET /app-api/stati
    if (pathname === "/app-api/stati" && method === "GET") {
      const explicitEmail = url.searchParams.get("email");
      let targetEmail = resolveTargetEmail(req, db, currentUser, explicitEmail);
      if (!targetEmail) {
        targetEmail = "firenzepersonaltrainer@gmail.com";
      }
      const rows = (db.stato_allenamenti || []).filter(
        (s: any) => (s.email_cliente || "").trim().toLowerCase() === targetEmail
      );
      return res.end(JSON.stringify(rows));
    }

    // 8b. Reset Preview: GET /app-api/stati/reset-preview
    if (pathname === "/app-api/stati/reset-preview" && method === "GET") {
      const explicitEmail = url.searchParams.get("email");
      const targetEmail = resolveTargetEmail(req, db, currentUser, explicitEmail);
      if (!targetEmail) {
        return res.end(JSON.stringify({ count: 0 }));
      }
      const livello = url.searchParams.get("livello") || "";
      const giornoInt = parseInt(url.searchParams.get("giorno") || "0", 10);

      const eserciziGiorno = (db.allenamenti || [])
        .filter((a: any) => {
          if (a.livello !== livello) return false;
          const m = String(a.giorno).match(/[0-9]+/);
          return m && parseInt(m[0], 10) === giornoInt;
        })
        .map((a: any) => a.id_esercizio);

      const count = (db.diario_utente || []).filter(
        (d: any) =>
          (d.email_cliente || "").trim().toLowerCase() === targetEmail &&
          eserciziGiorno.includes(d.id_esercizio)
      ).length;

      return res.end(JSON.stringify({ count }));
    }

    // 9. Conteggio Diario per Giorno: GET /app-api/diario/conteggio/:livello/:giorno
    const diarioCountMatch = pathname.match(/^\/app-api\/diario\/conteggio\/([^/]+)\/([^/]+)$/);
    if (diarioCountMatch && method === "GET") {
      const livello = decodeURIComponent(diarioCountMatch[1]);
      const giornoInt = parseInt(diarioCountMatch[2], 10);
      const explicitEmail = url.searchParams.get("email");
      const targetEmail = resolveTargetEmail(req, db, currentUser, explicitEmail);

      if (!targetEmail) {
        return res.end(JSON.stringify({ count: 0 }));
      }

      const eserciziGiorno = (db.allenamenti || [])
        .filter((a: any) => {
          if (a.livello !== livello) return false;
          const m = String(a.giorno).match(/[0-9]+/);
          return m && parseInt(m[0], 10) === giornoInt;
        })
        .map((a: any) => a.id_esercizio);

      const count = (db.diario_utente || []).filter(
        (d: any) =>
          (d.email_cliente || "").trim().toLowerCase() === targetEmail &&
          eserciziGiorno.includes(d.id_esercizio)
      ).length;

      return res.end(JSON.stringify({ count }));
    }

    // 10. Reset: POST /app-api/stati/reset
    if (pathname === "/app-api/stati/reset" && method === "POST") {
      const explicitEmail = parsedBody.email_cliente || parsedBody.email;
      const targetEmail = resolveTargetEmail(req, db, currentUser, explicitEmail);
      if (!targetEmail) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ ok: false, error: "Utente non identificato" }));
      }

      const { livello, giorno } = parsedBody;
      const giornoInt = parseInt(String(giorno), 10);

      const eserciziGiorno = (db.allenamenti || [])
        .filter((a: any) => {
          if (a.livello !== livello) return false;
          const m = String(a.giorno).match(/[0-9]+/);
          return m && parseInt(m[0], 10) === giornoInt;
        })
        .map((a: any) => a.id_esercizio);

      const initialCount = (db.diario_utente || []).length;
      db.diario_utente = (db.diario_utente || []).filter(
        (d: any) =>
          !((d.email_cliente || "").trim().toLowerCase() === targetEmail && eserciziGiorno.includes(d.id_esercizio))
      );
      const eliminati = initialCount - (db.diario_utente || []).length;

      const existing = (db.stato_allenamenti || []).find(
        (s: any) =>
          (s.email_cliente || "").trim().toLowerCase() === targetEmail &&
          s.livello === livello &&
          Number(s.giorno) === giornoInt
      );
      const nowIso = new Date().toISOString();
      if (existing) {
        existing.stato = "non_iniziato";
        existing.updated_at = nowIso;
      } else {
        if (!Array.isArray(db.stato_allenamenti)) db.stato_allenamenti = [];
        db.stato_allenamenti.push({
          email_cliente: targetEmail,
          livello,
          giorno: giornoInt,
          stato: "non_iniziato",
          updated_at: nowIso,
        });
      }
      await saveData(db);
      return res.end(JSON.stringify({ ok: true, eliminati }));
    }

    // 10b. Salva Stato Batch (Atomico): POST /app-api/stati/batch
    if (pathname === "/app-api/stati/batch" && method === "POST") {
      const explicitEmail = parsedBody.email_cliente || parsedBody.email;
      let targetEmail = resolveTargetEmail(req, db, currentUser, explicitEmail);
      if (!targetEmail) {
        targetEmail = "firenzepersonaltrainer@gmail.com";
      }

      const updates: Array<any> = parsedBody.updates || [];
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.end(JSON.stringify({ ok: true, count: 0 }));
      }

      if (!Array.isArray(db.stato_allenamenti)) {
        db.stato_allenamenti = [];
      }

      const nowIso = new Date().toISOString();
      for (const item of updates) {
        const lv = String(item.livello || "").trim();
        const gNum = Number(item.giorno ?? item.giornoNum);
        const st = String(item.stato || "non_iniziato");
        if (!lv || isNaN(gNum)) continue;

        const existing = db.stato_allenamenti.find(
          (s: any) =>
            (s.email_cliente || "").trim().toLowerCase() === targetEmail &&
            (s.livello || "").trim().toLowerCase() === lv.toLowerCase() &&
            Number(s.giorno) === gNum
        );
        if (existing) {
          existing.stato = st;
          existing.updated_at = nowIso;
        } else {
          db.stato_allenamenti.push({
            email_cliente: targetEmail,
            livello: lv,
            giorno: gNum,
            stato: st,
            updated_at: nowIso,
          });
        }
      }

      await saveData(db);
      return res.end(JSON.stringify({ ok: true, count: updates.length }));
    }

    // 11. Salva Stato Singolo: POST /app-api/stati
    if (pathname === "/app-api/stati" && method === "POST") {
      const explicitEmail = parsedBody.email_cliente || parsedBody.email;
      let targetEmail = resolveTargetEmail(req, db, currentUser, explicitEmail);
      if (!targetEmail) {
        targetEmail = "firenzepersonaltrainer@gmail.com";
      }

      const { livello, stato } = parsedBody;
      const giornoNum = Number(parsedBody.giorno ?? parsedBody.giornoNum);
      const nowIso = new Date().toISOString();

      if (!Array.isArray(db.stato_allenamenti)) {
        db.stato_allenamenti = [];
      }

      const existing = db.stato_allenamenti.find(
        (s: any) =>
          (s.email_cliente || "").trim().toLowerCase() === targetEmail &&
          s.livello === livello &&
          Number(s.giorno) === giornoNum
      );
      if (existing) {
        existing.stato = stato;
        existing.updated_at = nowIso;
      } else {
        db.stato_allenamenti.push({
          email_cliente: targetEmail,
          livello,
          giorno: giornoNum,
          stato,
          updated_at: nowIso,
        });
      }
      await saveData(db);
      return res.end(JSON.stringify({ ok: true, stato, livello, giorno: giornoNum }));
    }

    // 12. Diario: GET /app-api/diario
    if (pathname === "/app-api/diario" && method === "GET") {
      const explicitEmail = url.searchParams.get("email")?.trim().toLowerCase();
      const userEmail = resolveTargetEmail(req, db, currentUser);

      if (!userEmail) {
        return res.end(JSON.stringify([]));
      }

      let filterEmail = userEmail;
      if (explicitEmail) {
        if (currentUser?.ruolo === "manager" || explicitEmail === userEmail) {
          filterEmail = explicitEmail;
        }
      }

      const exMap = new Map();
      (db.database_esercizi || []).forEach((e: any) => {
        if (e.id) exMap.set(String(e.id), e.nome_reale);
        if (e.id_esercizio) {
          exMap.set(String(e.id_esercizio), e.nome_reale);
          const trimmed = String(e.id_esercizio).replace(/^0+/, "");
          if (trimmed) exMap.set(trimmed, e.nome_reale);
        }
      });

      const rows = [...db.diario_utente]
        .filter((d: any) => (d.email_cliente || "").trim().toLowerCase() === filterEmail)
        .map((d: any) => {
          let nome = d.nome_esercizio;
          if (!nome || /^\d+$/.test(String(nome).trim()) || nome === d.id_esercizio) {
            const real = exMap.get(String(d.id_esercizio || nome).trim()) || exMap.get(String(d.id_esercizio || nome).replace(/^0+/, ""));
            if (real) nome = real;
          }
          let sets = d.sets_json;
          if (typeof sets === "string") {
            try { sets = JSON.parse(sets); } catch {}
          }
          return {
            ...d,
            nome_esercizio: nome || "Esercizio Landmine",
            sets_json: sets,
          };
        })
        .sort((a, b) => parseSafeDate(b.data_ora).getTime() - parseSafeDate(a.data_ora).getTime());
      return res.end(JSON.stringify(rows));
    }

    // 13. Diario Esercizio: GET /app-api/diario/esercizio/:idEsercizio
    const diarioExMatch = pathname.match(/^\/app-api\/diario\/esercizio\/([^/]+)$/);
    if (diarioExMatch && method === "GET") {
      const idEsercizio = decodeURIComponent(diarioExMatch[1]);
      const explicitEmail = url.searchParams.get("email")?.trim().toLowerCase();
      const userEmail = resolveTargetEmail(req, db, currentUser);

      if (!userEmail) {
        return res.end(JSON.stringify([]));
      }

      let filterEmail = userEmail;
      if (explicitEmail) {
        if (currentUser?.ruolo === "manager" || explicitEmail === userEmail) {
          filterEmail = explicitEmail;
        }
      }

      const exMap = new Map();
      (db.database_esercizi || []).forEach((e: any) => {
        if (e.id) exMap.set(String(e.id), e.nome_reale);
        if (e.id_esercizio) {
          exMap.set(String(e.id_esercizio), e.nome_reale);
          const trimmed = String(e.id_esercizio).replace(/^0+/, "");
          if (trimmed) exMap.set(trimmed, e.nome_reale);
        }
      });

      const rows = [...db.diario_utente]
        .filter(
          (d: any) =>
            (d.email_cliente || "").trim().toLowerCase() === filterEmail &&
            (d.id_esercizio === idEsercizio ||
             String(d.id_esercizio).replace(/^0+/, "") === idEsercizio.replace(/^0+/, "") ||
             d.nome_esercizio?.toLowerCase() === idEsercizio.toLowerCase())
        )
        .map((d: any) => {
          let nome = d.nome_esercizio;
          if (!nome || /^\d+$/.test(String(nome).trim()) || nome === d.id_esercizio) {
            const real = exMap.get(String(d.id_esercizio || nome).trim()) || exMap.get(String(d.id_esercizio || nome).replace(/^0+/, ""));
            if (real) nome = real;
          }
          let sets = d.sets_json;
          if (typeof sets === "string") {
            try { sets = JSON.parse(sets); } catch {}
          }
          return {
            ...d,
            nome_esercizio: nome || "Esercizio Landmine",
            sets_json: sets,
          };
        })
        .sort((a, b) => parseSafeDate(b.data_ora).getTime() - parseSafeDate(a.data_ora).getTime());
      return res.end(JSON.stringify(rows));
    }

    // 14. Diario Salva: POST /app-api/diario
    if (pathname === "/app-api/diario" && method === "POST") {
      const authorEmail = resolveTargetEmail(req, db, currentUser, parsedBody?.email_cliente);
      if (!authorEmail) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: "Non autorizzato" }));
      }
      let aiAnalysisResult: any = null;
      if (parsedBody.tipo === "feedback_seduta") {
        aiAnalysisResult = fallbackClinicalAnalysis("biofeedback_workout", {
          livello: parsedBody.livello,
          giorno: parsedBody.giorno,
          rpe: Number(parsedBody.rpe_globale) || 8,
          sensazioni: parsedBody.sensazioni || [],
          noteTesto: parsedBody.note_cinestesiche || parsedBody.note || parsedBody.feedback || "",
        });
      }

      const newEntry = {
        id: Date.now(),
        email_cliente: authorEmail,
        tipo: parsedBody.tipo || "esercizio",
        livello: parsedBody.livello ?? null,
        giorno: parsedBody.giorno ?? null,
        rpe_globale: parsedBody.rpe_globale ?? null,
        sensazioni: parsedBody.sensazioni ?? [],
        note_cinestesiche: parsedBody.note_cinestesiche ?? parsedBody.note ?? null,
        id_esercizio: parsedBody.id_esercizio ?? null,
        nome_esercizio:
          parsedBody.nome_esercizio ??
          (parsedBody.tipo === "feedback_seduta" ? `Feedback Seduta Giorno ${parsedBody.giorno || ""}` : null),
        carico_kg: parsedBody.sets_json ? null : (parsedBody.carico_kg ?? null),
        feedback: parsedBody.feedback ?? parsedBody.note_cinestesiche ?? null,
        ripetizioni: parsedBody.sets_json ? null : (parsedBody.ripetizioni ?? null),
        serie: parsedBody.sets_json ? null : (parsedBody.serie ?? null),
        sets_json: parsedBody.sets_json ?? null,
        rpe_json: parsedBody.rpe_json ?? null,
        ai_allerta: aiAnalysisResult?.allerta ?? null,
        ai_sintesi: aiAnalysisResult?.sintesi ?? null,
        ai_proposta_azione: aiAnalysisResult?.proposta_azione ?? null,
        consiglio_coach: aiAnalysisResult?.consiglio_coach ?? null,
        consiglio_approvato_coach: false, // SOLO su approvazione esplicita del Coach Stefano
        giorno_destinazione: aiAnalysisResult?.giorno_destinazione ?? null,
        tipo_intervento: aiAnalysisResult?.tipo_intervento ?? "consolidamento",
        data_ora: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      db.diario_utente.push(newEntry);

      if (parsedBody.tipo === "feedback_seduta") {
        try {
          const audioRec = insertAudioNote({
            utente_id: currentUser?.id || null,
            email_cliente: authorEmail,
            nome_cliente: currentUser?.name || currentUser?.nome || null,
            contesto: "biofeedback_workout",
            audio_url: parsedBody.audio_url || "",
            audio_base64: parsedBody.audio_base64 || null,
            durata_sec: Number(parsedBody.durata_sec) || 0,
            trascrizione_testo: parsedBody.note_cinestesiche || parsedBody.note || parsedBody.feedback || null,
            ai_allerta: aiAnalysisResult?.allerta || "verde",
            ai_sintesi: aiAnalysisResult?.sintesi || null,
            ai_proposta_azione: aiAnalysisResult?.proposta_azione || null,
            stato: "nuovo",
            consiglio_coach: aiAnalysisResult?.consiglio_coach || null,
            consiglio_approvato_coach: false,
            giorno_destinazione: aiAnalysisResult?.giorno_destinazione || null,
            tipo_intervento: aiAnalysisResult?.tipo_intervento || "consolidamento",
          });
          db.audio_note_feedback = db.audio_note_feedback || [];
          db.audio_note_feedback.unshift(audioRec);
        } catch (audioNoteErr) {
          console.warn("[FEEDBACK SYNC TO AUDIO NOTE ERROR]", audioNoteErr);
        }

        // Notifica automatica immediata al Coach Stefano
        try {
          const athleteName = currentUser?.name || currentUser?.nome || authorEmail;
          const emailSubject = `🎙️ Nuovo Feedback Seduta: ${athleteName} - Giorno ${parsedBody.giorno || "?"} (${parsedBody.livello || "PRO"})`;
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 16px; background: #ffffff;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1c00ff; padding-bottom: 12px; margin-bottom: 16px;">
                <span style="font-size: 18px; font-weight: 900; color: #09090b; letter-spacing: -0.5px;">AREA46 TRAINING LAB</span>
                <span style="font-size: 11px; font-weight: 800; background: #1c00ff; color: #e3ff00; padding: 4px 8px; border-radius: 8px; text-transform: uppercase;">Feedback Workout</span>
              </div>
              <h2 style="font-size: 16px; font-weight: 800; color: #09090b; margin: 0 0 12px 0;">
                Nuovo Biofeedback Seduta Recapitato
              </h2>
              <p style="font-size: 14px; color: #52525b; line-height: 1.5; margin: 0 0 16px 0;">
                L'atleta <strong>${athleteName}</strong> (${authorEmail}) ha inviato il proprio feedback post-seduta.
              </p>
              <div style="background: #f4f4f5; border-radius: 12px; padding: 14px; margin-bottom: 16px; font-size: 13px; line-height: 1.6;">
                <div><strong>Seduta:</strong> Giorno ${parsedBody.giorno || "?"} — Livello ${parsedBody.livello || "PRO"}</div>
                <div><strong>RPE Globale:</strong> <span style="font-weight: 900; color: #1c00ff;">${parsedBody.rpe_globale || 8}/10</span></div>
                ${parsedBody.sensazioni && parsedBody.sensazioni.length ? `<div><strong>Sensazioni:</strong> ${Array.isArray(parsedBody.sensazioni) ? parsedBody.sensazioni.join(", ") : parsedBody.sensazioni}</div>` : ""}
                ${parsedBody.note_cinestesiche ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #d4d4d8;"><strong>Note Atleta:</strong><br><em style="color: #18181b;">"${parsedBody.note_cinestesiche}"</em></div>` : ""}
              </div>
              ${aiAnalysisResult ? `
              <div style="background: #eff6ff; border-left: 4px solid #1c00ff; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #1c00ff; margin-bottom: 4px;">Sintesi AI preventiva:</div>
                <div style="font-size: 13px; color: #1e3a8a;">${aiAnalysisResult.sintesi || "Analisi effettuata con successo."}</div>
                ${aiAnalysisResult.proposta_azione ? `<div style="font-size: 12px; color: #2563eb; margin-top: 6px;"><strong>Proposta per Seduta Successiva:</strong> ${aiAnalysisResult.proposta_azione}</div>` : ""}
              </div>` : ""}
              <div style="text-align: center;">
                <p style="font-size: 12px; color: #71717a; margin: 0 0 12px 0;">Il feedback è disponibile nella tua <strong>Bacheca Note Coach</strong> nell'app per revisione ed approvazione prima della prossima seduta.</p>
              </div>
            </div>
          `;
          sendEmailNotification({
            to: "firenzepersonaltrainer@gmail.com",
            subject: emailSubject,
            body: `Nuovo feedback da ${athleteName}: Giorno ${parsedBody.giorno || "?"} (${parsedBody.livello || "PRO"}), RPE ${parsedBody.rpe_globale || 8}/10. ${parsedBody.note_cinestesiche || ""}`,
            html: emailHtml,
            tipo: "biofeedback_coach",
          }).catch((mailErr: any) => console.warn("[FEEDBACK MAIL NOTIFY ERROR]", mailErr));
        } catch (mailWrapErr) {
          console.warn("[FEEDBACK NOTIFY EXCEPTION]", mailWrapErr);
        }
      }

      logShadowEvent("WORKOUT_FEEDBACK", authorEmail, {
        tipo: newEntry.tipo,
        livello: newEntry.livello,
        giorno: newEntry.giorno,
        giorno_destinazione: newEntry.giorno_destinazione,
        tipo_intervento: newEntry.tipo_intervento,
        rpe_globale: newEntry.rpe_globale,
        sensazioni: newEntry.sensazioni,
      });
      saveData(db);
      res.statusCode = 201;
      return res.end(JSON.stringify({ ...newEntry, ai: aiAnalysisResult }));
    }

    // 15. Diario Modifica: PATCH /app-api/diario/:id
    const diarioPatchMatch = pathname.match(/^\/app-api\/diario\/(\d+)$/);
    if (diarioPatchMatch && method === "PATCH") {
      const id = parseInt(diarioPatchMatch[1], 10);
      const entry = db.diario_utente.find((d: any) => d.id === id);
      if (!entry) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Not found" }));
      }
      entry.sets_json = parsedBody.sets_json ?? entry.sets_json;
      entry.feedback = parsedBody.feedback ?? entry.feedback;
      if (parsedBody.sets_json) {
        entry.rpe_json = parsedBody.sets_json.map((s: any) => s.rpe ?? null);
      }
      saveData(db);
      return res.end(JSON.stringify(entry));
    }

    // 16. Diario Elimina: DELETE /app-api/diario/:id
    const diarioDeleteMatch = pathname.match(/^\/app-api\/diario\/(\d+)$/);
    if (diarioDeleteMatch && method === "DELETE") {
      const id = parseInt(diarioDeleteMatch[1], 10);
      db.diario_utente = db.diario_utente.filter((d: any) => d.id !== id);
      saveData(db);
      return res.end(JSON.stringify({ ok: true }));
    }

    // 17. Preferenze: GET /app-api/preferenze
    if (pathname === "/app-api/preferenze" && method === "GET") {
      if (!currentUser?.email) {
        return res.end(JSON.stringify({ memoria_livello: null }));
      }
      const pref = db.preferenze_utente.find((p: any) => p.email_cliente === currentUser.email);
      return res.end(JSON.stringify({ memoria_livello: pref?.memoria_livello ?? null }));
    }

    // 18. Preferenze Salva: POST /app-api/preferenze/livello
    if (pathname === "/app-api/preferenze/livello" && method === "POST") {
      if (!currentUser?.email) {
        return res.end(JSON.stringify({ ok: false, error: "Non autenticato" }));
      }
      const existing = db.preferenze_utente.find((p: any) => p.email_cliente === currentUser.email);
      if (existing) {
        existing.memoria_livello = parsedBody.livello ?? null;
        existing.updated_at = new Date().toISOString();
      } else {
        db.preferenze_utente.push({
          email_cliente: currentUser.email,
          memoria_livello: parsedBody.livello ?? null,
          updated_at: new Date().toISOString(),
        });
      }
      saveData(db);
      return res.end(JSON.stringify({ ok: true }));
    }

    // 19. Tonnellaggio: GET /app-api/tonnellaggio
    if (pathname === "/app-api/tonnellaggio" && method === "GET") {
      if (!currentUser?.email) {
        return res.end(JSON.stringify([]));
      }
      const rows = db.diario_utente
        .filter((d: any) => d.email_cliente === currentUser.email)
        .map((d: any) => {
          let tonnellaggio_voce = 0;
          if (d.sets_json && Array.isArray(d.sets_json)) {
            tonnellaggio_voce = d.sets_json.reduce((acc: number, s: any) => {
              const kg = Number(s.carico_kg) || 0;
              const reps = Number(s.ripetizioni) || 0;
              return acc + kg * reps;
            }, 0);
          } else if (d.carico_kg != null && d.ripetizioni != null && d.serie != null) {
            tonnellaggio_voce = Number(d.carico_kg) * Number(d.ripetizioni) * Number(d.serie);
          }
          return {
            id: d.id,
            data_ora: d.data_ora,
            nome_esercizio: d.nome_esercizio,
            carico_kg: d.carico_kg,
            ripetizioni: d.ripetizioni,
            serie: d.serie,
            sets_json: d.sets_json,
            tonnellaggio_voce,
          };
        })
        .sort((a: any, b: any) => new Date(a.data_ora).getTime() - new Date(b.data_ora).getTime());
      return res.end(JSON.stringify(rows));
    }

    // ─── 20. AUDIO FEEDBACK & SEGNALAZIONI BUG ────────────────────────────────

    // POST /app-api/audio-note (Ricezione file audio fisico + Analisi AI multimodale)
    if (pathname === "/app-api/audio-note" && method === "POST") {
      try {
        const {
          audioBase64,
          audioData,
          formato,
          durata_sec,
          contesto,
          livello,
          giorno,
          rpe,
          sensazioni,
          noteTesto,
          tipoSegnalazione,
          titolo,
          descrizione,
          anonimo,
          deviceInfo,
        } = parsedBody;

        const effectiveContesto = contesto || "biofeedback_workout";
        const effectiveDuration = Number(durata_sec) || 0;
        const effectiveAnonimo = !!anonimo;

        // Gestione atleta o anonimo
        const utenteId = effectiveAnonimo ? null : (currentUser?.id || "usr-atleta-01");
        const emailCliente = effectiveAnonimo ? null : (currentUser?.email || "atleta@area46.it");

        // Salvataggio fisico del file audio su disco in uploads/audio_notes/
        const rawAudio = audioBase64 || audioData || "";
        let audioFileName = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const ext = formato ? (formato.startsWith(".") ? formato.slice(1) : formato) : "webm";
        audioFileName += `.${ext}`;

        const isServerless =
          process.env.VERCEL === "1" ||
          !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
          process.env.NODE_ENV === "production";
        let uploadDir = isServerless
          ? "/tmp/uploads/audio_notes"
          : path.resolve(__dirname, "uploads", "audio_notes");

        try {
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
        } catch {
          uploadDir = "/tmp/uploads/audio_notes";
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
        }
        const fullFilePath = path.join(uploadDir, audioFileName);

        if (rawAudio) {
          const cleanBase64 = rawAudio.includes("base64,") ? rawAudio.split("base64,")[1] : rawAudio;
          fs.writeFileSync(fullFilePath, Buffer.from(cleanBase64, "base64"));
        } else {
          // File placeholder fittizio a salvaguardia (es. test audio)
          fs.writeFileSync(fullFilePath, Buffer.from("RIFF....WAVEfmt ....data...."));
        }

        const audioUrl = `/uploads/audio_notes/${audioFileName}`;
        const clientTranscript = parsedBody.transcript || parsedBody.trascrizione_live || "";

        // Esecuzione Pipeline Agente AI di Trascrizione & Analisi Clinico-Semantica
        const aiAnalysis = await analyzeAudioWithGemini(fullFilePath, effectiveContesto, {
          livello,
          giorno,
          rpe: Number(rpe) || undefined,
          sensazioni,
          noteTesto,
          trascrizioneLive: clientTranscript,
          tipoSegnalazione,
          titolo,
          descrizione,
          deviceInfo,
        });

        // Inserimento permanente nel database SQLite e memoria
        const audioRecord = insertAudioNote({
          utente_id: utenteId,
          email_cliente: emailCliente,
          nome_cliente: currentUser?.name || currentUser?.nome || null,
          contesto: effectiveContesto,
          audio_url: audioUrl,
          audio_base64: rawAudio || null,
          durata_sec: effectiveDuration,
          trascrizione_testo: aiAnalysis.trascrizione || clientTranscript || null,
          ai_allerta: aiAnalysis.allerta,
          ai_sintesi: aiAnalysis.sintesi,
          ai_proposta_azione: aiAnalysis.proposta_azione,
          stato: "nuovo",
        });

        // Persistenza blindata su db JSON principale
        db.audio_note_feedback = db.audio_note_feedback || [];
        db.audio_note_feedback.unshift(audioRecord);
        saveData(db);

        // Se è un biofeedback di allenamento, arricchiamo anche il diario utente
        if (effectiveContesto === "biofeedback_workout" && emailCliente) {
          const newDiaryEntry = {
            id: Date.now(),
            email_cliente: emailCliente,
            tipo: "feedback_seduta",
            livello: livello ?? null,
            giorno: giorno ?? null,
            rpe_globale: Number(rpe) || 8,
            sensazioni: sensazioni || [],
            note_cinestesiche: aiAnalysis.trascrizione || clientTranscript || noteTesto || null,
            nome_esercizio: `Feedback Vocale Giorno ${giorno || ""}`,
            feedback: `Nota Vocale (${effectiveDuration}s) • ${aiAnalysis.sintesi} • Allerta: ${aiAnalysis.allerta.toUpperCase()}`,
            audio_url: audioUrl,
            audio_base64: rawAudio || null,
            ai_allerta: aiAnalysis.allerta,
            ai_sintesi: aiAnalysis.sintesi,
            ai_proposta_azione: aiAnalysis.proposta_azione,
            consiglio_coach: aiAnalysis.consiglio_coach || aiAnalysis.proposta_azione || null,
            consiglio_approvato_coach: false, // SOLO su decisione esplicita del Coach Stefano
            giorno_destinazione: aiAnalysis.giorno_destinazione || null,
            tipo_intervento: aiAnalysis.tipo_intervento || "consolidamento",
            data_ora: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };
          db.diario_utente.push(newDiaryEntry);
          saveData(db);

          // Notifica automatica immediata al Coach Stefano
          try {
            const atletaNome = currentUser?.name || currentUser?.nome || emailCliente || "Atleta";
            const emailSubject = `🎙️ Nuova Nota Vocale Post-Workout: ${atletaNome} - Giorno ${giorno || "?"} (${livello || "PRO"})`;
            const emailHtml = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 16px; background: #ffffff;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1c00ff; padding-bottom: 12px; margin-bottom: 16px;">
                  <span style="font-size: 18px; font-weight: 900; color: #09090b; letter-spacing: -0.5px;">AREA46 TRAINING LAB</span>
                  <span style="font-size: 11px; font-weight: 800; background: #1c00ff; color: #e3ff00; padding: 4px 8px; border-radius: 8px; text-transform: uppercase;">Nota Vocale Post-Workout</span>
                </div>
                <h2 style="font-size: 16px; font-weight: 800; color: #09090b; margin: 0 0 12px 0;">
                  Nuova Nota Vocale Seduta Recapitata
                </h2>
                <p style="font-size: 14px; color: #52525b; line-height: 1.5; margin: 0 0 16px 0;">
                  L'atleta <strong>${atletaNome}</strong> (${emailCliente}) ha inviato una nota vocale al termine dell'allenamento.
                </p>
                <div style="background: #f4f4f5; border-radius: 12px; padding: 14px; margin-bottom: 16px; font-size: 13px; line-height: 1.6;">
                  <div><strong>Seduta:</strong> Giorno ${giorno || "?"} — Livello ${livello || "PRO"}</div>
                  <div><strong>RPE Globale:</strong> <span style="font-weight: 900; color: #1c00ff;">${rpe || 8}/10</span></div>
                  ${sensazioni && sensazioni.length ? `<div><strong>Sensazioni:</strong> ${Array.isArray(sensazioni) ? sensazioni.join(", ") : sensazioni}</div>` : ""}
                  ${effectiveDuration ? `<div><strong>Durata Audio:</strong> ${effectiveDuration} secondi</div>` : ""}
                  ${aiAnalysis.trascrizione ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #d4d4d8;"><strong>Trascrizione Nota Vocale:</strong><br><em style="color: #18181b;">"${aiAnalysis.trascrizione}"</em></div>` : ""}
                  ${noteTesto && noteTesto !== aiAnalysis.trascrizione ? `<div style="margin-top: 8px;"><strong>Note Aggiuntive:</strong> ${noteTesto}</div>` : ""}
                </div>
                <div style="background: #eff6ff; border-left: 4px solid #1c00ff; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                  <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #1c00ff; margin-bottom: 4px;">Sintesi AI preventiva:</div>
                  <div style="font-size: 13px; color: #1e3a8a;">${aiAnalysis.sintesi || "Analisi effettuata con successo."}</div>
                  ${aiAnalysis.proposta_azione ? `<div style="font-size: 12px; color: #2563eb; margin-top: 6px;"><strong>Proposta per Seduta Successiva:</strong> ${aiAnalysis.proposta_azione}</div>` : ""}
                </div>
                <div style="text-align: center;">
                  <p style="font-size: 12px; color: #71717a; margin: 0 0 12px 0;">Puoi ascoltare la nota vocale ed approvare il tuo consiglio nella <strong>Bacheca Note Coach</strong> prima della prossima seduta.</p>
                </div>
              </div>
            `;
            sendEmailNotification({
              to: "firenzepersonaltrainer@gmail.com",
              subject: emailSubject,
              body: `Nuova nota vocale da ${atletaNome}: Giorno ${giorno || "?"} (${livello || "PRO"}), RPE ${rpe || 8}/10. Trascrizione: "${aiAnalysis.trascrizione || noteTesto || ""}"`,
              html: emailHtml,
              tipo: "biofeedback_coach",
            }).catch((mailErr: any) => console.warn("[VOICE MAIL NOTIFY ERROR]", mailErr));
          } catch (mailWrapErr) {
            console.warn("[VOICE NOTIFY EXCEPTION]", mailWrapErr);
          }
        }

        // Se è una segnalazione bug/consiglio con audio allegato
        let bugRecord: any = null;
        if (effectiveContesto === "app_feedback" || titolo || descrizione) {
          bugRecord = insertAppSegnalazione({
            utente_id: utenteId,
            email_cliente: emailCliente,
            anonimo: effectiveAnonimo,
            tipo: (tipoSegnalazione as any) || "consiglio",
            titolo: titolo || "Nota Vocale Feedback",
            descrizione: descrizione || aiAnalysis.trascrizione || clientTranscript || "Nessuna descrizione testuale",
            audio_id: audioRecord.id,
            audio_base64: rawAudio || null,
            device_info: deviceInfo || "Web / Mobile",
            ai_diagnosi_tecnica: aiAnalysis.diagnosi_tecnica || "In attesa di revisione",
            stato: "aperto",
          });

          db.app_segnalazioni_bug = db.app_segnalazioni_bug || [];
          db.app_segnalazioni_bug.unshift(bugRecord);
          saveData(db);
        }

        res.statusCode = 201;
        return res.end(
          JSON.stringify({
            ok: true,
            audio: audioRecord,
            segnalazione: bugRecord,
            ai: aiAnalysis,
          })
        );
      } catch (err: any) {
        console.error("Errore salvataggio audio note:", err);
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message || "Errore elaborazione audio note" }));
      }
    }

    // GET /app-api/audio-notes (Bacheca note audio per il Coach)
    if (pathname === "/app-api/audio-notes" && method === "GET") {
      const contesto = url.searchParams.get("contesto") || undefined;
      const stato = url.searchParams.get("stato") || undefined;
      const email = url.searchParams.get("email") || undefined;
      
      const rawDb = db.audio_note_feedback || [];
      const rawSql = getAudioNotes();
      const map = new Map<number, any>();
      rawDb.forEach((n: any) => { if (n && n.id) map.set(Number(n.id), n); });
      rawSql.forEach((n: any) => {
        if (n && n.id) {
          const existing = map.get(Number(n.id)) || {};
          map.set(Number(n.id), { ...existing, ...n });
        }
      });

      // Inclusione bidirezionale resiliente da diario_utente (qualsiasi biofeedback registrato)
      (db.diario_utente || []).forEach((d: any) => {
        if (!d) return;
        const isFeedback =
          d.tipo === "feedback_seduta" ||
          !!d.audio_url ||
          !!d.audio_base64 ||
          (d.nome_esercizio && String(d.nome_esercizio).startsWith("Feedback"));
        if (!isFeedback) return;
        const entryId = Number(d.id);
        const existing = map.get(entryId) || {};
        const profile = (db.profili_utenti || []).find(
          (u: any) => (u.email || "").toLowerCase() === (d.email_cliente || "").toLowerCase()
        );
        map.set(entryId, {
          id: entryId,
          utente_id: d.utente_id || profile?.id || null,
          email_cliente: d.email_cliente || null,
          nome_cliente: profile?.nome || profile?.name || d.email_cliente || "Atleta",
          contesto: "biofeedback_workout",
          audio_url: d.audio_url || "",
          audio_base64: d.audio_base64 || null,
          durata_sec: d.durata_sec || 0,
          trascrizione_testo: d.note_cinestesiche || d.feedback || null,
          ai_allerta: d.ai_allerta || "verde",
          ai_sintesi: d.ai_sintesi || d.feedback || null,
          ai_proposta_azione: d.ai_proposta_azione || null,
          consiglio_coach: d.consiglio_coach || null,
          consiglio_approvato_coach: !!d.consiglio_approvato_coach,
          giorno_destinazione: d.giorno_destinazione || null,
          tipo_intervento: d.tipo_intervento || null,
          coach_audio_url: d.coach_audio_url || null,
          coach_audio_base64: d.coach_audio_base64 || null,
          coach_audio_durata_sec: d.coach_audio_durata_sec || 0,
          stato: d.stato || (d.consiglio_approvato_coach ? "applicato" : "nuovo"),
          data_creazione: d.data_ora || d.created_at || new Date().toISOString(),
          ...existing,
        });
      });

      let notes = Array.from(map.values());
      if (contesto) notes = notes.filter((n: any) => n.contesto === contesto);
      if (stato) {
        if (stato === "tutti") notes = notes.filter((n: any) => n.stato !== "cestino");
        else if (stato === "gestito") notes = notes.filter((n: any) => ["ascoltato", "applicato", "archiviato"].includes(n.stato));
        else notes = notes.filter((n: any) => n.stato === stato);
      }
      if (email) notes = notes.filter((n: any) => (n.email_cliente || "").toLowerCase() === email.toLowerCase());
      notes.sort((a: any, b: any) => (b.id || 0) - (a.id || 0));
      return res.end(JSON.stringify(notes));
    }

    // PATCH /app-api/audio-notes/:id (Aggiorna stato nota audio e/o approva e invia consiglio Coach)
    const matchAudioPatch = pathname.match(/^\/app-api\/audio-notes\/(\d+)$/);
    if (matchAudioPatch && method === "PATCH") {
      const id = parseInt(matchAudioPatch[1], 10);
      const stato = parsedBody.stato;
      const consiglioCoach = parsedBody.consiglio_coach;
      const consiglioApprovato = parsedBody.consiglio_approvato_coach !== undefined ? !!parsedBody.consiglio_approvato_coach : undefined;
      const giornoDestinazione = parsedBody.giorno_destinazione;
      const tipoIntervento = parsedBody.tipo_intervento;
      const coachAudioBase64 = parsedBody.coach_audio_base64;
      const coachAudioUrl = parsedBody.coach_audio_url;
      const coachAudioDurataSec = parsedBody.coach_audio_durata_sec !== undefined ? Number(parsedBody.coach_audio_durata_sec) : undefined;

      if (stato && !["nuovo", "ascoltato", "applicato", "archiviato", "cestino"].includes(stato)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Stato non valido" }));
      }
      const updated = updateAudioNoteStatus(id, stato || "applicato", {
        consiglio_coach: consiglioCoach,
        consiglio_approvato_coach: consiglioApprovato,
        giorno_destinazione: giornoDestinazione,
        tipo_intervento: tipoIntervento,
        coach_audio_base64: coachAudioBase64,
        coach_audio_url: coachAudioUrl,
        coach_audio_durata_sec: coachAudioDurataSec,
      });
      // Aggiornamento anche in db.diario_utente se id fa riferimento a una voce di diario o nota audio
      if (db.diario_utente) {
        let diaryEntry = db.diario_utente.find((d: any) => Number(d.id) === id);
        if (diaryEntry) {
          if (stato) diaryEntry.stato = stato;
          if (consiglioCoach !== undefined) diaryEntry.consiglio_coach = consiglioCoach;
          if (consiglioApprovato !== undefined) diaryEntry.consiglio_approvato_coach = consiglioApprovato;
          if (giornoDestinazione !== undefined) diaryEntry.giorno_destinazione = giornoDestinazione;
          if (tipoIntervento !== undefined) diaryEntry.tipo_intervento = tipoIntervento;
          if (coachAudioBase64 !== undefined) diaryEntry.coach_audio_base64 = coachAudioBase64;
          if (coachAudioUrl !== undefined) diaryEntry.coach_audio_url = coachAudioUrl;
          if (coachAudioDurataSec !== undefined) diaryEntry.coach_audio_durata_sec = coachAudioDurataSec;
        }
      }

      if (db.audio_note_feedback) {
        const found = db.audio_note_feedback.find((n: any) => Number(n.id) === id);
        if (found) {
          if (stato) found.stato = stato;
          if (consiglioCoach !== undefined) found.consiglio_coach = consiglioCoach;
          if (consiglioApprovato !== undefined) found.consiglio_approvato_coach = consiglioApprovato;
          if (giornoDestinazione !== undefined) found.giorno_destinazione = giornoDestinazione;
          if (tipoIntervento !== undefined) found.tipo_intervento = tipoIntervento;
          if (coachAudioBase64 !== undefined) found.coach_audio_base64 = coachAudioBase64;
          if (coachAudioUrl !== undefined) found.coach_audio_url = coachAudioUrl;
          if (coachAudioDurataSec !== undefined) found.coach_audio_durata_sec = coachAudioDurataSec;

          // Se il Coach ha approvato / inviato il consiglio o la nota vocale, propaga al diario atleta per renderlo visibile alla seduta successiva
          if (consiglioApprovato === true || consiglioCoach || coachAudioBase64 || coachAudioUrl) {
            const athleteEmail = found.email_cliente;
            if (athleteEmail && db.diario_utente) {
              const destGiorno = giornoDestinazione || found.giorno_destinazione || null;
              // Trova eventuale record recente collegato a questa nota o atleta
              let diaryEntry = db.diario_utente
                .filter((d: any) => (d.email_cliente || "").toLowerCase() === athleteEmail.toLowerCase())
                .reverse()
                .find((d: any) => d.audio_url === found.audio_url || d.id === found.id);

              if (diaryEntry) {
                if (consiglioCoach !== undefined) diaryEntry.consiglio_coach = consiglioCoach;
                if (consiglioApprovato !== undefined) diaryEntry.consiglio_approvato_coach = consiglioApprovato;
                if (destGiorno) diaryEntry.giorno_destinazione = destGiorno;
                if (tipoIntervento) diaryEntry.tipo_intervento = tipoIntervento;
                if (coachAudioBase64 !== undefined) diaryEntry.coach_audio_base64 = coachAudioBase64;
                if (coachAudioUrl !== undefined) diaryEntry.coach_audio_url = coachAudioUrl;
                if (coachAudioDurataSec !== undefined) diaryEntry.coach_audio_durata_sec = coachAudioDurataSec;
              } else {
                db.diario_utente.push({
                  id: Date.now(),
                  email_cliente: athleteEmail,
                  tipo: "feedback_seduta",
                  livello: "PRO",
                  giorno: destGiorno ? String(destGiorno) : null,
                  giorno_destinazione: destGiorno || null,
                  tipo_intervento: tipoIntervento || "spinta",
                  consiglio_coach: consiglioCoach || found.ai_proposta_azione || null,
                  coach_audio_base64: coachAudioBase64 || found.coach_audio_base64 || null,
                  coach_audio_url: coachAudioUrl || found.coach_audio_url || null,
                  coach_audio_durata_sec: coachAudioDurataSec || found.coach_audio_durata_sec || 0,
                  consiglio_approvato_coach: true,
                  feedback: `Consiglio del Coach Stefano per Seduta ${destGiorno || "successiva"}`,
                  data_ora: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                });
              }
            }
          }
        }
      }
      saveData(db);
      return res.end(JSON.stringify(updated || { id, stato: stato || "applicato" }));
    }

    // DELETE /app-api/audio-notes/:id (Elimina definitivamente nota audio)
    const matchAudioDelete = pathname.match(/^\/app-api\/audio-notes\/(\d+)$/);
    if (matchAudioDelete && method === "DELETE") {
      const id = parseInt(matchAudioDelete[1], 10);
      deleteAudioNotePermanently(id);
      if (db.audio_note_feedback) {
        db.audio_note_feedback = db.audio_note_feedback.filter((n: any) => Number(n.id) !== id);
        saveData(db);
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, deleted: id }));
    }

    // POST /app-api/segnalazioni-bug (Invio segnalazione bug/consiglio con o senza audio)
    if (pathname === "/app-api/segnalazioni-bug" && method === "POST") {
      try {
        const {
          tipo,
          titolo,
          descrizione,
          anonimo,
          audio_id,
          audioBase64,
          audio_base64,
          transcript,
          trascrizione_live,
          device_info,
        } = parsedBody;

        if (!titolo && !descrizione && !audioBase64 && !audio_base64) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: "Titolo o registrazione vocale obbligatori" }));
        }

        const isAnon = !!anonimo;
        const utenteId = isAnon ? null : (currentUser?.id || null);
        const emailCliente = isAnon ? null : (currentUser?.email || null);
        const clientTranscript = transcript || trascrizione_live || "";

        // Diagnosi preliminare intelligente
        const fallbackDiag = fallbackClinicalAnalysis("app_feedback", {
          tipoSegnalazione: tipo,
          titolo: titolo || "Segnalazione Atleta",
          descrizione: descrizione || clientTranscript || "Nessun dettaglio",
          trascrizioneLive: clientTranscript,
          deviceInfo: device_info,
        });

        const record = insertAppSegnalazione({
          utente_id: utenteId,
          email_cliente: emailCliente,
          anonimo: isAnon,
          tipo: (tipo as any) || "consiglio",
          titolo: titolo || (clientTranscript ? `Nota Vocale: ${clientTranscript.substring(0, 30)}...` : "Segnalazione"),
          descrizione: descrizione || clientTranscript || "Nota vocale allegata",
          audio_id: audio_id ? Number(audio_id) : null,
          audio_base64: audioBase64 || audio_base64 || null,
          device_info: device_info || "Browser Web",
          ai_diagnosi_tecnica: fallbackDiag.diagnosi_tecnica || "In valutazione",
          stato: "aperto",
        });

        db.app_segnalazioni_bug = db.app_segnalazioni_bug || [];
        db.app_segnalazioni_bug.unshift(record);
        saveData(db);

        res.statusCode = 201;
        return res.end(JSON.stringify(record));
      } catch (err: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message || "Errore salvataggio segnalazione" }));
      }
    }

    // GET /app-api/segnalazioni-bug (Elenco segnalazioni per il Coach)
    if (pathname === "/app-api/segnalazioni-bug" && method === "GET") {
      const stato = url.searchParams.get("stato") || undefined;
      const tipo = url.searchParams.get("tipo") || undefined;

      const rawDb = db.app_segnalazioni_bug || [];
      const rawSql = getAppSegnalazioni();
      const map = new Map<number, any>();
      rawDb.forEach((b: any) => { if (b && b.id) map.set(Number(b.id), b); });
      rawSql.forEach((b: any) => {
        if (b && b.id) {
          const existing = map.get(Number(b.id)) || {};
          map.set(Number(b.id), { ...existing, ...b });
        }
      });
      let segnalazioni = Array.from(map.values());
      if (stato) {
        if (stato === "tutti") segnalazioni = segnalazioni.filter((b: any) => b.stato !== "cestino");
        else if (stato === "gestito") segnalazioni = segnalazioni.filter((b: any) => ["in_valutazione", "risolto", "scartato"].includes(b.stato));
        else segnalazioni = segnalazioni.filter((b: any) => b.stato === stato);
      }
      if (tipo) segnalazioni = segnalazioni.filter((b: any) => b.tipo === tipo);
      segnalazioni.sort((a: any, b: any) => (b.id || 0) - (a.id || 0));
      return res.end(JSON.stringify(segnalazioni));
    }

    // PATCH /app-api/segnalazioni-bug/:id (Aggiorna stato segnalazione)
    const matchBugPatch = pathname.match(/^\/app-api\/segnalazioni-bug\/(\d+)$/);
    if (matchBugPatch && method === "PATCH") {
      const id = parseInt(matchBugPatch[1], 10);
      const stato = parsedBody.stato;
      if (!stato || !["aperto", "in_valutazione", "risolto", "scartato", "cestino"].includes(stato)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Stato non valido" }));
      }
      const updated = updateAppSegnalazioneStatus(id, stato);
      if (db.app_segnalazioni_bug) {
        const found = db.app_segnalazioni_bug.find((b: any) => Number(b.id) === id);
        if (found) {
          found.stato = stato;
          saveData(db);
        }
      }
      return res.end(JSON.stringify(updated || { id, stato }));
    }

    // DELETE /app-api/segnalazioni-bug/:id (Elimina definitivamente segnalazione)
    const matchBugDelete = pathname.match(/^\/app-api\/segnalazioni-bug\/(\d+)$/);
    if (matchBugDelete && method === "DELETE") {
      const id = parseInt(matchBugDelete[1], 10);
      deleteAppSegnalazionePermanently(id);
      if (db.app_segnalazioni_bug) {
        db.app_segnalazioni_bug = db.app_segnalazioni_bug.filter((b: any) => Number(b.id) !== id);
        saveData(db);
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, deleted: id }));
    }

    // POST /app-api/process-audio-note (Trigger manuale o re-analisi pipeline Gemini)
    if (pathname === "/app-api/process-audio-note" && method === "POST") {
      const { audio_id } = parsedBody;
      if (!audio_id) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "audio_id richiesto" }));
      }
      const notes = getAudioNotes();
      const note = notes.find((n: any) => n.id === Number(audio_id));
      if (!note) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Nota non trovata" }));
      }

      const filePath = path.resolve(__dirname, note.audio_url.replace(/^\/+/, ""));
      const analysis = await analyzeAudioWithGemini(filePath, note.contesto as any, {
        noteTesto: note.trascrizione_testo || undefined,
      });

      // Aggiorna record permanentemente nel DB
      const updated = updateAudioNoteAnalysis(note.id, analysis);

      return res.end(JSON.stringify({ ok: true, ai: analysis, note: updated }));
    }

    // POST /app-api/ai-parse-voice-set (Voice Workout Logger con Agente AI Aura & Socrates)
    if (pathname === "/app-api/ai-parse-voice-set" && method === "POST") {
      try {
        const { text, transcript, audioBase64, mimeType, audio, targetPrescrizione } = parsedBody || {};
        const rawAudio = audioBase64 || audio;
        const effectiveText = typeof text === "string" ? text : typeof transcript === "string" ? transcript : undefined;

        let audioClean = "";
        let audioMime = mimeType || "audio/webm";

        if (rawAudio && typeof rawAudio === "string") {
          const mimeMatch = rawAudio.match(/^data:(audio\/[a-zA-Z0-9.-]+);base64,/);
          if (mimeMatch) audioMime = mimeMatch[1];
          audioClean = rawAudio.replace(/^data:audio\/[a-zA-Z0-9.-]+;base64,/, "");
        }

        const result = await parseVoiceWorkoutSet({
          text: effectiveText,
          audioBase64: audioClean || undefined,
          mimeType: audioMime,
          targetPrescrizione: typeof targetPrescrizione === "string" ? targetPrescrizione : undefined,
        });

        res.statusCode = 200;
        return res.end(JSON.stringify(result));
      } catch (err: any) {
        console.error("Errore parsing voice set:", err);
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message || "Errore elaborazione vocale set" }));
      }
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Endpoint demo non trovato" }));
}
