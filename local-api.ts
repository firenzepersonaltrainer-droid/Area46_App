import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import defaultData from "./demo-data.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMP_DATA_FILE = "/tmp/demo-data.json";

function loadData() {
  let loaded: any = null;
  if (fs.existsSync(TMP_DATA_FILE)) {
    try {
      const raw = fs.readFileSync(TMP_DATA_FILE, "utf-8");
      loaded = JSON.parse(raw);
    } catch {
      // fallback
    }
  }
  if (!loaded) {
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
      (p: any) => !delBks.includes(p.id)
    );
  }
  return loaded;
}

function saveData(data: any) {
  db = data;
  try {
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Ignore in read-only / restricted environments
  }
  try {
    const directPath = path.resolve(__dirname, "demo-data.json");
    const parentPath = path.resolve(__dirname, "..", "demo-data.json");
    if (fs.existsSync(directPath)) {
      fs.writeFileSync(directPath, JSON.stringify(data, null, 2), "utf-8");
    } else if (fs.existsSync(parentPath)) {
      fs.writeFileSync(parentPath, JSON.stringify(data, null, 2), "utf-8");
    }
  } catch {
    // Read-only filesystem on Vercel lambda, expected
  }
}

const CREDENZIALI_PATH = fs.existsSync(path.resolve(__dirname, "credenziali.json"))
  ? path.resolve(__dirname, "credenziali.json")
  : path.resolve(__dirname, "..", "credenziali.json");
const GDRIVE_DEMO_DATA_ID = "129ts4wdwsypvWCB2cBHXWw3WTIKmtktA";

function base64url(str: string) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleDriveAccessToken() {
  if (!fs.existsSync(CREDENZIALI_PATH)) return null;
  try {
    const creds = JSON.parse(fs.readFileSync(CREDENZIALI_PATH, "utf-8"));
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

async function syncConfigToGoogleDrive(config: any) {
  return syncDataToGoogleDrive({ configurazione_lab: config });
}

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
      driveDb.profili_utenti = fullDb.profili_utenti || [];
    }
    if (fullDb.prenotazioni_cancellate !== undefined) {
      driveDb.prenotazioni_cancellate = fullDb.prenotazioni_cancellate || [];
    }
    if (fullDb.prenotazioni_slot !== undefined) {
      driveDb.prenotazioni_slot = fullDb.prenotazioni_slot || [];
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
    if (driveDb.configurazione_lab && driveDb.configurazione_lab.stripe_secret_key) {
      db.configurazione_lab = {
        ...(db.configurazione_lab || {}),
        ...driveDb.configurazione_lab,
      };
    }
    if (driveDb.transazioni_cancellate && Array.isArray(driveDb.transazioni_cancellate)) {
      db.transazioni_cancellate = Array.from(
        new Set([...(db.transazioni_cancellate || []), ...driveDb.transazioni_cancellate, ...FICTITIOUS_TX_IDS])
      );
      db.transazioni_pagamenti = (db.transazioni_pagamenti || []).filter(
        (t: any) => !db.transazioni_cancellate.includes(t.id) && !db.transazioni_cancellate.includes(t.codice_transazione)
      );
    }
    if (driveDb.utenti_cancellati && Array.isArray(driveDb.utenti_cancellati)) {
      db.utenti_cancellati = Array.from(
        new Set([...(db.utenti_cancellati || []), ...driveDb.utenti_cancellati])
      );
      db.profili_utenti = (db.profili_utenti || []).filter(
        (p: any) => !db.utenti_cancellati.includes(p.id) && !db.utenti_cancellati.includes(p.email?.toLowerCase())
      );
    }
    if (driveDb.profili_utenti && Array.isArray(driveDb.profili_utenti)) {
      const existingMap = new Map((db.profili_utenti || []).map((p: any) => [p.id, p]));
      for (const p of driveDb.profili_utenti) {
        if (!db.utenti_cancellati.includes(p.id) && !db.utenti_cancellati.includes(p.email?.toLowerCase())) {
          if (p.id === "usr-coach-01") {
            p.email = "firenzepersonaltrainer@gmail.com";
            p.nome = "Stefano";
            p.cognome = "Tronconi";
            p.name = "Stefano Tronconi";
            p.ruolo = "manager";
          }
          existingMap.set(p.id, { ...(existingMap.get(p.id) || {}), ...p });
        }
      }
      db.profili_utenti = Array.from(existingMap.values());
    }
    db.active_user_id = null;
    if (driveDb.prenotazioni_cancellate && Array.isArray(driveDb.prenotazioni_cancellate)) {
      db.prenotazioni_cancellate = Array.from(
        new Set([...(db.prenotazioni_cancellate || []), ...driveDb.prenotazioni_cancellate])
      );
      db.prenotazioni_slot = (db.prenotazioni_slot || []).filter(
        (p: any) => !db.prenotazioni_cancellate.includes(p.id)
      );
    }
    saveData(db);
  } catch {
    // Non-fatal
  }
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
  };
}

export function getCurrentUser(reqOrDb: any, maybeDb?: any) {
  const req = maybeDb ? reqOrDb : null;
  const database = maybeDb || reqOrDb;

  let candidate: string | null = null;

  if (req && req.headers) {
    const headerUser =
      req.headers["x-area46-user"] ||
      req.headers["x-user-id"] ||
      (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    const cookies = parseCookies(req.headers.cookie);
    const cookieUser = cookies["area46_user_id"] || cookies["area46_user_email"];

    candidate = (headerUser || cookieUser || "").trim() || null;
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
  db = loadData();
  const host = req.headers?.host || "localhost:5173";
  const url = new URL(req.url ?? "/", `http://${host}`);
  let pathname = url.pathname;

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

    // POST /app-api/auth/logout (Disconnessione Utente)
    if (pathname === "/app-api/auth/logout" && method === "POST") {
      res.setHeader(
        "Set-Cookie",
        "area46_user_id=; Path=/; Max-Age=0; SameSite=Lax"
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

      if (requestOtpOnly) {
        return res.end(
          JSON.stringify({
            ok: true,
            messaggio: `Codice OTP generato per ${email}`,
            demoOtp: "464646",
          })
        );
      }

      const found = (db.profili_utenti || []).find(
        (u: any) => u.email?.toLowerCase() === email
      );

      if (found) {
        if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
          db.utenti_cancellati = db.utenti_cancellati.filter(
            (u: string) => u !== found.id && u.toLowerCase() !== email
          );
        }
        found.data_ultimo_accesso = new Date().toISOString();
        saveData(db);
        res.setHeader(
          "Set-Cookie",
          `area46_user_id=${encodeURIComponent(found.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
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
          `area46_user_id=${encodeURIComponent(coach.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
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

      if (!found) {
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
      } else {
        found.data_ultimo_accesso = new Date().toISOString();
        saveData(db);
      }

      res.setHeader(
        "Set-Cookie",
        `area46_user_id=${encodeURIComponent(found.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
      );
      return res.end(JSON.stringify({ ok: true, user: getHydratedUser(found, db) }));
    }

    // POST /app-api/auth/switch-user (Per switch rapido Coach / Atleta in test)
    if (pathname === "/app-api/auth/switch-user" && method === "POST") {
      const targetId = parsedBody.userId;
      const found = (db.profili_utenti || []).find(
        (u: any) => u.id === targetId || u.email?.toLowerCase() === targetId?.toLowerCase()
      );
      if (found) {
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
        codice_fiscale: (parsedBody.codice_fiscale || "").trim(),
        indirizzo: (parsedBody.indirizzo || "").trim(),
        ruolo: parsedBody.ruolo || "atleta",
        crediti: creditiIniziali,
        shared_wallet_with: parsedBody.shared_wallet_with?.trim() || null,
        tempo_cancellazione_ore: Number(parsedBody.tempo_cancellazione_ore || 24),
        tempo_anticipo_prenotazione_ore: Number(parsedBody.tempo_anticipo_prenotazione_ore || 24),
        data_scadenza_crediti:
          parsedBody.data_scadenza_crediti ||
          new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
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

      saveData(db);
      await syncDataToGoogleDrive(db);
      res.statusCode = 201;
      return res.end(JSON.stringify(nuovo));
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

      if (parsedBody.crediti !== undefined) {
        const nuovoVal = Number(parsedBody.crediti);
        delta = nuovoVal - saldoPrecedente;
        profilo.crediti = nuovoVal;
      } else if (parsedBody.delta !== undefined) {
        delta = Number(parsedBody.delta);
        profilo.crediti = saldoPrecedente + delta;
      }

      if (parsedBody.data_scadenza_crediti) {
        profilo.data_scadenza_crediti = parsedBody.data_scadenza_crediti;
      }

      // Registra nel ledger movimenti crediti
      if (delta !== 0) {
        addMovimentoCrediti(db, {
          atleta_id: profilo.id,
          email_cliente: profilo.email,
          nome_cliente: `${profilo.nome} ${profilo.cognome}`,
          tipo:
            parsedBody.tipo ||
            (delta > 0 ? "bonus_regalo" : delta < 0 ? "penalty" : "modifica_manuale"),
          delta_crediti: delta,
          saldo_risultante: profilo.crediti,
          motivazione:
            parsedBody.motivazione ||
            (delta > 0 ? "Bonus/Regalo assegnato dal Coach" : "Rettifica/Penalty manuale Coach"),
          operatore: "coach",
        });
      }

      profilo.updated_at = new Date().toISOString();
      saveData(db);
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
      if (parsedBody.nome !== undefined) profilo.nome = parsedBody.nome;
      if (parsedBody.cognome !== undefined) profilo.cognome = parsedBody.cognome;
      if (parsedBody.email !== undefined) profilo.email = parsedBody.email;
      if (parsedBody.telefono !== undefined) profilo.telefono = parsedBody.telefono;
      if (parsedBody.codice_fiscale !== undefined) profilo.codice_fiscale = parsedBody.codice_fiscale;
      if (parsedBody.indirizzo !== undefined) profilo.indirizzo = parsedBody.indirizzo;
      if (parsedBody.crediti !== undefined) profilo.crediti = Number(parsedBody.crediti);
      if (parsedBody.tempo_cancellazione_ore !== undefined) {
        profilo.tempo_cancellazione_ore = Number(parsedBody.tempo_cancellazione_ore);
      }
      if (parsedBody.tempo_anticipo_prenotazione_ore !== undefined) {
        profilo.tempo_anticipo_prenotazione_ore = Number(parsedBody.tempo_anticipo_prenotazione_ore);
      }
      if (parsedBody.data_scadenza_crediti !== undefined) {
        profilo.data_scadenza_crediti = parsedBody.data_scadenza_crediti;
      }
      if (parsedBody.note_coach !== undefined) profilo.note_coach = parsedBody.note_coach;
      if (parsedBody.shared_wallet_with !== undefined) {
        profilo.shared_wallet_with = parsedBody.shared_wallet_with?.trim() || null;
      }
      profilo.updated_at = new Date().toISOString();
      saveData(db);
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

      const tipoAbb = atleta.tipo_abbonamento || "lab_continuativo_3x";
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
      let totaleGiaVersato = 0;
      if (transazioniAtleta.length > 0) {
        totaleGiaVersato = Number(transazioniAtleta[0].importo_euro) || 0;
      } else {
        totaleGiaVersato = tipoAbb === "lab_continuativo_2x" ? 250 : 359;
      }

      const penaleStandard = 50.0;
      const valoreSedutePieno = Math.round(seduteSvolteCount * tariffaPiena * 100) / 100;
      const totaleDovuto = Math.round((valoreSedutePieno + penaleStandard) * 100) / 100;
      const totaleDaAddebitare = Math.max(
        0,
        Math.round((totaleDovuto - totaleGiaVersato) * 100) / 100
      );

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
          tariffa_seduta: tariffaPiena,
          sedute_svolte: seduteSvolteCount,
          valore_sedute_pieno: valoreSedutePieno,
          penale_standard: penaleStandard,
          totale_gia_versato: totaleGiaVersato,
          totale_dovuto: totaleDovuto,
          totale_da_addebitare: totaleDaAddebitare,
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

      // 2. Calcolo importi
      const tipoAbb = atleta.tipo_abbonamento || "lab_continuativo_3x";
      const defaultTariffa = tipoAbb === "lab_continuativo_2x" ? 35.0 : 33.25;
      const tariffa = Number(parsedBody.tariffa_seduta ?? defaultTariffa);
      const svolte = Number(parsedBody.sedute_svolte ?? 0);
      const penale = Number(parsedBody.penale_euro ?? 50.0);
      const versato = Number(
        parsedBody.totale_versato ?? (tipoAbb === "lab_continuativo_2x" ? 250 : 359)
      );

      const valoreSedute = Math.round(svolte * tariffa * 100) / 100;
      const totaleDovuto = Math.round((valoreSedute + penale) * 100) / 100;
      const totaleDaAddebitare = Math.max(0, Math.round((totaleDovuto - versato) * 100) / 100);

      // 3. Registra transazione incasso / addebito penale
      const txCode = `TX-DISM-${Date.now().toString().slice(-6)}`;
      const nuovaTransazione = {
        codice_transazione: txCode,
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: `${atleta.nome} ${atleta.cognome}`.trim(),
        codice_fiscale: atleta.codice_fiscale || "",
        indirizzo: atleta.indirizzo || "",
        id_pacchetto: "dismissione-anticipata",
        nome_pacchetto: `Penale e conguaglio recesso anticipato (${svolte} sedute x ${tariffa}€ + penale ${penale}€)`,
        importo_euro: totaleDaAddebitare,
        metodo: "carta",
        crediti_acquistati: 0,
        debiti_decurtati: 0,
        crediti_effettivi_aggiunti: 0,
        stato: "completato",
        stato_fattura: "da_emettere",
        note: parsedBody.note || "Dismissione anticipata richiesta dal coach",
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
      const notaAggiunta = `[DISMESSO ANTICIPATAMENTE il ${new Date().toLocaleDateString(
        "it-IT"
      )}: addebitato saldo € ${totaleDaAddebitare} (penale € ${penale}, sedute ${svolte}x${tariffa}€). Revocati ${
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
        motivazione: `Dismissione anticipata: ricalcolo sedute a tariffa piena (${tariffa}€) + penale recesso ${penale}€. Revocate ${prenotazioniCancellate.length} prenotazioni future.`,
        operatore: "coach",
      });

      // 6. Genera e invia notifica email al coach
      const emailCoach =
        db.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";
      const emailBody = `
RIEPILOGO DISMISSIONE ANTICIPATA — AREA46 TRAINING LAB
=============================================================================
Data Operazione: ${new Date().toLocaleString("it-IT")}
Codice Transazione: ${txCode}
Stato Fiscale: DA EMETTERE

DATI FISCALI CLIENTE:
- Nome e Cognome: ${atleta.nome} ${atleta.cognome}
- Codice Fiscale: ${atleta.codice_fiscale || "NON SPECIFICATO (Richiedere al cliente)"}
- Indirizzo Fatturazione: ${atleta.indirizzo || "NON SPECIFICATO"}
- Email: ${atleta.email}
- Telefono: ${atleta.telefono || "-"}

CONTEGGIO RECESSO ANTICIPATO:
1. Sedute Svolte: ${svolte} x € ${tariffa.toFixed(2)} = € ${valoreSedute.toFixed(2)} (Ricalcolo tariffa base piena)
2. Penale di Recesso / Spese Chiusura: € ${penale.toFixed(2)}
3. Totale Valore Contrattuale: € ${totaleDovuto.toFixed(2)}
4. Quota Già Versata dal Cliente: -€ ${versato.toFixed(2)}
-----------------------------------------------------------------------------
TOTALE NETTO ADDEBITATO DA FATTURARE: € ${totaleDaAddebitare.toFixed(2)}
=============================================================================

INDICAZIONI PER EMISSIONE FATTURA (SDI / GESTIONALE):
- Oggetto / Descrizione: "Saldo per risoluzione anticipata accordo continuativo Lab, conguaglio sedute fruite e penale di svincolo slot riservato."
- Importo Imponibile: € ${totaleDaAddebitare.toFixed(2)}
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
        oggetto: `[AREA46 FISCO] Dismissione Anticipata ${atleta.nome} ${atleta.cognome} — Dati per Emissione Fattura`,
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
          messaggio: `Dismissione completata con successo! Revocate ${prenotazioniCancellate.length} prenotazioni future. Addebitato saldo di € ${totaleDaAddebitare.toFixed(2)}.`,
          dettagli: {
            atleta_id: atleta.id,
            nome_cliente: `${atleta.nome} ${atleta.cognome}`,
            codice_transazione: txCode,
            totale_addebitato: totaleDaAddebitare,
            penale_applicata: penale,
            sedute_svolte: svolte,
            tariffa_seduta: tariffa,
            prenotazioni_cancellate: prenotazioniCancellate,
            email_notifica: emailRecord,
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
      if (currentUser.ruolo === "atleta") {
        rows = rows.filter(
          (m: any) => m.email_cliente === currentUser.email || m.atleta_id === currentUser.id
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
      saveData(db);
      res.statusCode = 201;
      return res.end(JSON.stringify(nuova));
    }

    // POST /app-api/eccezioni-calendario/chiusura-periodo (Chiusura studio con proroga automatica scadenze)
    if (pathname === "/app-api/eccezioni-calendario/chiusura-periodo" && method === "POST") {
      const { data_inizio, data_fine, motivo, proroga_scadenze } = parsedBody;
      if (!data_inizio || !data_fine) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Date di inizio e fine periodo obbligatorie" }));
      }

      db.eccezioni_calendario = db.eccezioni_calendario || [];
      const start = new Date(data_inizio);
      const end = new Date(data_fine);
      const diffMs = end.getTime() - start.getTime();
      const giorniChiusura = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

      // Crea eccezioni giorno per giorno
      const dateCreate: string[] = [];
      const cur = new Date(start);
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
          if (bk.data === dStr && bk.stato === "confermata") {
            bk.stato = "cancellata_in_tempo";
            bk.cancellato_il = new Date().toISOString();
            bk.note = `Annullata per chiusura studio: ${motivo || "Chiusura programmata"}`;
            const atleta = (db.profili_utenti || []).find(
              (p: any) => p.id === bk.atleta_id || p.email === bk.email_cliente
            );
            if (atleta && bk.credito_scalato) {
              atleta.crediti = (atleta.crediti ?? 0) + 1;
              addMovimentoCrediti(db, {
                atleta_id: atleta.id,
                email_cliente: atleta.email,
                nome_cliente: `${atleta.nome} ${atleta.cognome}`,
                tipo: "rimborso_cancellazione",
                delta_crediti: 1,
                saldo_risultante: atleta.crediti,
                motivazione: `Rimborso slot ${bk.data} ${bk.orario} per chiusura studio (${
                  motivo || "Chiusura programmata"
                })`,
                operatore: "sistema",
              });
            }
          }
        });

        cur.setDate(cur.getDate() + 1);
      }

      // Se proroga_scadenze è true: slitta la scadenza di tutti gli atleti attivi
      let atletiAggiornati = 0;
      if (proroga_scadenze !== false) {
        (db.profili_utenti || []).forEach((p: any) => {
          if (
            p.ruolo === "atleta" &&
            p.stato_iscrizione !== "dismesso" &&
            p.data_scadenza_crediti
          ) {
            if (p.data_scadenza_crediti >= data_inizio) {
              const oldScad = new Date(p.data_scadenza_crediti);
              oldScad.setDate(oldScad.getDate() + giorniChiusura);
              p.data_scadenza_crediti = oldScad.toISOString().slice(0, 10);
              atletiAggiornati++;

              addMovimentoCrediti(db, {
                atleta_id: p.id,
                email_cliente: p.email,
                nome_cliente: `${p.nome} ${p.cognome}`,
                tipo: "bonus_regalo",
                delta_crediti: 0,
                saldo_risultante: p.crediti,
                motivazione: `Proroga automatica di +${giorniChiusura} giorni alla scadenza per chiusura studio (${
                  motivo || "Ferie / Festività"
                }). Nuova scadenza: ${p.data_scadenza_crediti}`,
                operatore: "sistema",
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
          date_bloccate: dateCreate.length,
          atleti_prorogati: atletiAggiornati,
          messaggio: `Chiusura studio registrata per ${giorniChiusura} giorni (${data_inizio} ➔ ${data_fine}). ${
            proroga_scadenze !== false
              ? `Scadenze prorogate automaticamente di +${giorniChiusura} giorni per ${atletiAggiornati} atleti attivi.`
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
      if (reqSecret && (!db.configurazione_lab?.stripe_secret_key || !db.configurazione_lab.stripe_secret_key.startsWith("sk_"))) {
        db.configurazione_lab = db.configurazione_lab || {};
        db.configurazione_lab.stripe_secret_key = reqSecret;
        if (reqPub) db.configurazione_lab.stripe_publishable_key = reqPub;
        db.configurazione_lab.stripe_collegato = true;
        saveData(db);
      } else if (process.env.STRIPE_SECRET_KEY && (!db.configurazione_lab?.stripe_secret_key || !db.configurazione_lab.stripe_secret_key.startsWith("sk_"))) {
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

    // GET /app-api/prenotazioni
    if (pathname === "/app-api/prenotazioni" && method === "GET") {
      const dataFilter = url.searchParams.get("data");
      const emailFilter = url.searchParams.get("email");
      const delBks = db.prenotazioni_cancellate || [];
      let prenotazioni = (db.prenotazioni_slot || []).filter(
        (p: any) =>
          !delBks.includes(p.id) &&
          (p.stato === "confermata" || !p.stato || p.stato === "attiva") &&
          !p.stato?.startsWith("cancellata")
      );
      if (dataFilter) {
        prenotazioni = prenotazioni.filter((p: any) => p.data === dataFilter);
      }
      if (emailFilter) {
        prenotazioni = prenotazioni.filter((p: any) => p.email_cliente === emailFilter);
      }
      return res.end(JSON.stringify(prenotazioni));
    }

    // POST /app-api/prenotazioni/batch (Prenotazione Multipla Rapida a blocchi)
    if (pathname === "/app-api/prenotazioni/batch" && method === "POST") {
      const atletaId = parsedBody.atleta_id || parsedBody.email_cliente || currentUser.id;
      const atleta =
        (db.profili_utenti || []).find(
          (p: any) =>
            p.id === atletaId ||
            p.email?.toLowerCase() === atletaId?.toLowerCase() ||
            p.email?.toLowerCase() === parsedBody.email_cliente?.toLowerCase()
        ) || currentUser;
      const requestedSlots: Array<{ data: string; orario: string; note?: string }> =
        parsedBody.slots || [];

      if (!Array.isArray(requestedSlots) || requestedSlots.length === 0) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Nessuno slot specificato per la prenotazione multipla." }));
      }

      const isManager = currentUser.ruolo === "manager";
      const totalCost = requestedSlots.length;
      const walletOwner = getWalletOwner(atleta, db);
      const isShared = walletOwner && walletOwner.id !== atleta.id;

      if (!isManager) {
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
      walletOwner.crediti = (walletOwner.crediti ?? 0) - totalCost;
      atleta.data_ultimo_accesso = new Date().toISOString();
      if (isShared) walletOwner.data_ultimo_accesso = new Date().toISOString();

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
      const atletaId = parsedBody.atleta_id || parsedBody.email_cliente || currentUser.id;
      const atleta =
        (db.profili_utenti || []).find(
          (p: any) =>
            p.id === atletaId ||
            p.email?.toLowerCase() === atletaId?.toLowerCase() ||
            p.email?.toLowerCase() === parsedBody.email_cliente?.toLowerCase()
        ) || currentUser;
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
        (p: any) => p.data === dataSlot && p.orario === orarioSlot && p.stato === "confermata"
      );
      if (slotGiaOccupato) {
        res.statusCode = 409;
        return res.end(
          JSON.stringify({
            error: `Lo slot del ${dataSlot} alle ${orarioSlot} è già stato prenotato da un altro atleta. Capienza massima raggiunta per questa postazione.`,
          })
        );
      }

      // 2. Controllo Crediti e Scadenza
      const isManager = currentUser.ruolo === "manager";
      const walletOwner = getWalletOwner(atleta, db);
      const isShared = walletOwner && walletOwner.id !== atleta.id;

      if (!isManager) {
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
      walletOwner.crediti = (walletOwner.crediti ?? 0) - 1;
      atleta.data_ultimo_accesso = new Date().toISOString();
      if (isShared) walletOwner.data_ultimo_accesso = new Date().toISOString();

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
        note: parsedBody.note || "",
        created_at: new Date().toISOString(),
      };

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

      saveData(db);

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

      const isManager = currentUser.ruolo === "manager";
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

      const prorogaRequested =
        url.searchParams.get("proroga") === "true" ||
        url.searchParams.get("proroga") === "7" ||
        parsedBody?.proroga === true ||
        parsedBody?.proroga === "true";

      if (orePreavviso >= oreLimite || isManager) {
        rimborsato = true;
        statoFinale = "cancellata_in_tempo";
        if (bk.credito_scalato && atleta && walletOwner) {
          walletOwner.crediti = (walletOwner.crediti ?? 0) + 1;

          let prorogaMsg = "";
          if (isManager && prorogaRequested && walletOwner.data_scadenza_crediti) {
            const scadenzaDate = new Date(walletOwner.data_scadenza_crediti + "T00:00:00");
            scadenzaDate.setDate(scadenzaDate.getDate() + 7);
            const y = scadenzaDate.getFullYear();
            const m = String(scadenzaDate.getMonth() + 1).padStart(2, "0");
            const d = String(scadenzaDate.getDate()).padStart(2, "0");
            walletOwner.data_scadenza_crediti = `${y}-${m}-${d}`;
            prorogaMsg = ` (Scadenza carnet prorogata al ${new Date(
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
              ? (prorogaRequested
                  ? `Rimborso slot ${bk.data} ${bk.orario} per ${atleta.nome} ${atleta.cognome}${isShared ? " [Borsellino Condiviso]" : ""} [Con proroga scadenza carnet +7gg]`
                  : `Ripristino credito per cancellazione/spostamento slot ${bk.data} ${bk.orario} per ${atleta.nome} ${atleta.cognome}${isShared ? " [Borsellino Condiviso]" : ""}`)
              : `Rimborso per cancellazione in tempo slot del ${bk.data} ${bk.orario}${isShared ? " [Borsellino Condiviso]" : ""}`,
            operatore: isManager ? "coach" : "atleta",
          });

          messaggio = isManager
            ? (prorogaRequested
                ? `Sessione annullata dal Coach. 1 credito riaccreditato e scadenza prorogata di 7 giorni.`
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
            motivazione: `Cancellazione tardiva slot del ${bk.data} ${bk.orario} (preavviso < ${oreLimite}h: credito trattenuto)`,
            operatore: "sistema",
          });
        }
        messaggio = `Prenotazione annullata oltre il termine di tolleranza di ${oreLimite} ore (preavviso di sole ${Math.max(
          0,
          Math.round(orePreavviso)
        )}h). In accordo con il regolamento di Area46 Lab, il credito della seduta viene trattenuto.`;
      }

      // Traccia ID cancellato ed elimina fisicamente lo slot attivo
      db.prenotazioni_cancellate = db.prenotazioni_cancellate || [];
      if (!db.prenotazioni_cancellate.includes(bkId)) {
        db.prenotazioni_cancellate.push(bkId);
      }
      db.prenotazioni_slot = (db.prenotazioni_slot || []).filter((p: any) => p.id !== bkId);

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
      const atletaId = parsedBody.atleta_id || currentUser.id;
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
      if (secretKey && secretKey.startsWith("sk_")) {
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

      // MODALITÀ DEMO / SIMULATA SE IL COACH NON HA ANCORA INSERITO LE CHIAVI STRIPE
      const currentCrediti = Number(atleta.crediti) || 0;
      const packCrediti = Number(pacchetto.crediti) || 0;
      let debitiDecurtati = 0;
      let creditiEffettivi = packCrediti;
      if (currentCrediti < 0) {
        debitiDecurtati = Math.abs(currentCrediti);
        creditiEffettivi = packCrediti - debitiDecurtati;
      }

      const txCode = `TX-DEMO-${Date.now().toString().slice(-6)}`;
      const nuovaTransazione = {
        codice_transazione: txCode,
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
        codice_fiscale: parsedBody.codice_fiscale || atleta.codice_fiscale || "",
        indirizzo: parsedBody.indirizzo || atleta.indirizzo || "",
        id_pacchetto: pacchetto.id,
        nome_pacchetto: pacchetto.nome,
        importo_euro: pacchetto.prezzo_euro,
        metodo: "carta",
        crediti_acquistati: packCrediti,
        debiti_decurtati: debitiDecurtati,
        crediti_effettivi_aggiunti: creditiEffettivi,
        causale_bonifico: null,
        stato: "completato",
        stato_fattura: "da_emettere",
        is_demo: true,
        created_at: new Date().toISOString(),
      };

      if (currentCrediti < 0) {
        atleta.crediti = creditiEffettivi;
      } else {
        atleta.crediti = currentCrediti + packCrediti;
      }
      const nuovaScadenza = new Date(Date.now() + (pacchetto.giorni_validita || 60) * 86400000)
        .toISOString()
        .slice(0, 10);
      if (!atleta.data_scadenza_crediti || nuovaScadenza > atleta.data_scadenza_crediti) {
        atleta.data_scadenza_crediti = nuovaScadenza;
      }
      atleta.data_ultimo_accesso = new Date().toISOString();

      addMovimentoCrediti(db, {
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: nuovaTransazione.nome_cliente,
        tipo: "acquisto_carnet",
        delta_crediti: creditiEffettivi,
        saldo_risultante: atleta.crediti,
        motivazione: `Acquisto ${pacchetto.nome}${
          debitiDecurtati > 0 ? ` (sanati ${debitiDecurtati} crediti di debito)` : ""
        }`,
        operatore: "atleta",
      });

      db.transazioni_pagamenti = db.transazioni_pagamenti || [];
      db.transazioni_pagamenti.unshift(nuovaTransazione);
      saveData(db);

      res.statusCode = 201;
      return res.end(
        JSON.stringify({
          ok: true,
          demo_mode: true,
          transazione: nuovaTransazione,
          messaggio:
            "Pacchetto Lab acquistato in modalità demo. Per incassare realmente sul tuo conto bancario inserisci le chiavi Stripe nel pannello Fisco.",
          crediti_attuali: atleta.crediti,
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

      if (secretKey && secretKey.startsWith("sk_") && !db.configurazione_lab?.stripe_secret_key) {
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

        const currentCrediti = Number(atleta.crediti) || 0;
        const packCrediti = Number(pacchetto.crediti) || 0;
        let debitiDecurtati = 0;
        let creditiEffettivi = packCrediti;
        if (currentCrediti < 0) {
          debitiDecurtati = Math.abs(currentCrediti);
          creditiEffettivi = packCrediti - debitiDecurtati;
        }

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
          crediti_effettivi_aggiunti: creditiEffettivi,
          causale_bonifico: null,
          stato: "completato",
          stato_fattura: "da_emettere",
          created_at: new Date().toISOString(),
        };

        if (currentCrediti < 0) {
          atleta.crediti = creditiEffettivi;
        } else {
          atleta.crediti = currentCrediti + packCrediti;
        }
        const nuovaScadenza = new Date(Date.now() + (pacchetto.giorni_validita || 60) * 86400000)
          .toISOString()
          .slice(0, 10);
        if (!atleta.data_scadenza_crediti || nuovaScadenza > atleta.data_scadenza_crediti) {
          atleta.data_scadenza_crediti = nuovaScadenza;
        }
        atleta.data_ultimo_accesso = new Date().toISOString();

        addMovimentoCrediti(db, {
          atleta_id: atleta.id,
          email_cliente: atleta.email,
          nome_cliente: nuovaTransazione.nome_cliente,
          tipo: "acquisto_carnet",
          delta_crediti: creditiEffettivi,
          saldo_risultante: atleta.crediti,
          motivazione: `Acquisto Stripe ${pacchetto.nome}${
            debitiDecurtati > 0 ? ` (sanati ${debitiDecurtati} crediti di debito)` : ""
          }`,
          operatore: "stripe",
        });

        db.transazioni_pagamenti = db.transazioni_pagamenti || [];
        db.transazioni_pagamenti.unshift(nuovaTransazione);
        saveData(db);

        return res.end(
          JSON.stringify({
            ok: true,
            verified: true,
            transazione: nuovaTransazione,
            crediti_attuali: atleta.crediti,
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

            const currentCrediti = Number(atleta.crediti) || 0;
            const packCrediti = Number(pacchetto.crediti) || 0;
            let debitiDecurtati = 0;
            let creditiEffettivi = packCrediti;
            if (currentCrediti < 0) {
              debitiDecurtati = Math.abs(currentCrediti);
              creditiEffettivi = packCrediti - debitiDecurtati;
            }

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
              crediti_effettivi_aggiunti: creditiEffettivi,
              causale_bonifico: null,
              stato: "completato",
              stato_fattura: "da_emettere",
              created_at: new Date().toISOString(),
            };

            if (currentCrediti < 0) {
              atleta.crediti = creditiEffettivi;
            } else {
              atleta.crediti = currentCrediti + packCrediti;
            }
            const nuovaScadenza = new Date(Date.now() + (pacchetto.giorni_validita || 60) * 86400000)
              .toISOString()
              .slice(0, 10);
            if (!atleta.data_scadenza_crediti || nuovaScadenza > atleta.data_scadenza_crediti) {
              atleta.data_scadenza_crediti = nuovaScadenza;
            }
            atleta.data_ultimo_accesso = new Date().toISOString();

            addMovimentoCrediti(db, {
              atleta_id: atleta.id,
              email_cliente: atleta.email,
              nome_cliente: nuovaTransazione.nome_cliente,
              tipo: "acquisto_carnet",
              delta_crediti: creditiEffettivi,
              saldo_risultante: atleta.crediti,
              motivazione: `Webhook Stripe ${pacchetto.nome}${
                debitiDecurtati > 0 ? ` (sanati ${debitiDecurtati} crediti di debito)` : ""
              }`,
              operatore: "stripe_webhook",
            });

            db.transazioni_pagamenti = db.transazioni_pagamenti || [];
            db.transazioni_pagamenti.unshift(nuovaTransazione);
            saveData(db);
          }
        }
      }

      return res.end(JSON.stringify({ received: true }));
    }

    // POST /app-api/transazioni/checkout (Checkout Manuale / Bonifico)
    if (pathname === "/app-api/transazioni/checkout" && method === "POST") {
      const atletaId = parsedBody.atleta_id || currentUser.id;
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
      const currentCrediti = Number(atleta.crediti) || 0;
      const packCrediti = Number(pacchetto.crediti) || 0;

      // FORMULA DETRAZIONE DEBITI
      let debitiDecurtati = 0;
      let creditiEffettivi = packCrediti;
      if (currentCrediti < 0) {
        debitiDecurtati = Math.abs(currentCrediti);
        creditiEffettivi = packCrediti - debitiDecurtati;
      }

      const isBonifico = metodo === "bonifico";
      const txCode = `TX-46-${Date.now().toString().slice(-6)}`;
      const causaleBonifico = `AREA46-${(atleta.cognome || "ATLETA").toUpperCase()}-${pacchetto.id.toUpperCase()}-${txCode.slice(-4)}`;

      const nuovaTransazione = {
        codice_transazione: txCode,
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente:
          `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
        codice_fiscale: parsedBody.codice_fiscale || atleta.codice_fiscale || "",
        indirizzo: parsedBody.indirizzo || atleta.indirizzo || "",
        id_pacchetto: pacchetto.id,
        nome_pacchetto: pacchetto.nome,
        importo_euro: pacchetto.prezzo_euro,
        metodo,
        crediti_acquistati: packCrediti,
        debiti_decurtati: debitiDecurtati,
        crediti_effettivi_aggiunti: creditiEffettivi,
        causale_bonifico: isBonifico ? causaleBonifico : null,
        stato: isBonifico ? "in_attesa_bonifico" : "completato",
        stato_fattura: "da_emettere",
        created_at: new Date().toISOString(),
      };

      if (!isBonifico) {
        if (currentCrediti < 0) {
          atleta.crediti = creditiEffettivi;
        } else {
          atleta.crediti = currentCrediti + packCrediti;
        }
        const nuovaScadenza = new Date(Date.now() + pacchetto.giorni_validita * 86400000)
          .toISOString()
          .slice(0, 10);
        if (!atleta.data_scadenza_crediti || nuovaScadenza > atleta.data_scadenza_crediti) {
          atleta.data_scadenza_crediti = nuovaScadenza;
        }
        atleta.data_ultimo_accesso = new Date().toISOString();

        addMovimentoCrediti(db, {
          atleta_id: atleta.id,
          email_cliente: atleta.email,
          nome_cliente: nuovaTransazione.nome_cliente,
          tipo: "acquisto_carnet",
          delta_crediti: creditiEffettivi,
          saldo_risultante: atleta.crediti,
          motivazione: `Acquisto ${pacchetto.nome}${
            debitiDecurtati > 0 ? ` (sanati ${debitiDecurtati} crediti di debito)` : ""
          }`,
          operatore: "atleta",
        });
      }

      db.transazioni_pagamenti = db.transazioni_pagamenti || [];
      db.transazioni_pagamenti.unshift(nuovaTransazione);
      saveData(db);

      res.statusCode = 201;
      return res.end(
        JSON.stringify({
          ok: true,
          transazione: nuovaTransazione,
          crediti_attuali: atleta.crediti,
          data_scadenza_crediti: atleta.data_scadenza_crediti,
          debiti_estinti: debitiDecurtati,
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
        const currentCrediti = Number(atleta.crediti) || 0;
        if (currentCrediti < 0) {
          atleta.crediti = tx.crediti_effettivi_aggiunti;
        } else {
          atleta.crediti = currentCrediti + tx.crediti_acquistati;
        }
        const pack = (db.tariffario_pacchetti || []).find((p: any) => p.id === tx.id_pacchetto);
        const giorni = pack?.giorni_validita || 60;
        const nuovaScadenza = new Date(Date.now() + giorni * 86400000).toISOString().slice(0, 10);
        if (!atleta.data_scadenza_crediti || nuovaScadenza > atleta.data_scadenza_crediti) {
          atleta.data_scadenza_crediti = nuovaScadenza;
        }
        atleta.data_ultimo_accesso = new Date().toISOString();

        addMovimentoCrediti(db, {
          atleta_id: atleta.id,
          email_cliente: atleta.email,
          nome_cliente: `${atleta.nome} ${atleta.cognome}`,
          tipo: "acquisto_carnet",
          delta_crediti: tx.crediti_effettivi_aggiunti,
          saldo_risultante: atleta.crediti,
          motivazione: `Bonifico confermato per ${tx.nome_pacchetto}`,
          operatore: "coach",
        });
      }

      tx.stato = "completato";
      tx.approvato_il = new Date().toISOString();
      saveData(db);

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
      saveData(db);
      syncDataToGoogleDrive(db).catch(() => {});
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
        }))
        .sort((a: any, b: any) => (a.data_pubblicazione > b.data_pubblicazione ? -1 : 1));
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
          };
        })
        .sort((a: any, b: any) => (a.sequenza ?? "").localeCompare(b.sequenza ?? ""));

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
      for (const ex of db.database_esercizi) {
        if (ex.attrezzatura) {
          for (const item of ex.attrezzatura.split(",")) {
            const trimmed = item.trim();
            if (trimmed) attrezzi.add(trimmed);
          }
        }
      }
      return res.end(JSON.stringify(Array.from(attrezzi).sort()));
    }

    // 7. Libreria Esercizi: GET /app-api/libreria
    if (pathname === "/app-api/libreria" && method === "GET") {
      const search = url.searchParams.get("search")?.toLowerCase() || "";
      const target = url.searchParams.get("target") || "";
      const attrezzo = url.searchParams.get("attrezzo") || "";
      const livello = url.searchParams.get("livello") || "";

      let filtered = db.database_esercizi.filter((ex: any) => {
        if (search && !ex.nome_esercizio?.toLowerCase().includes(search)) return false;
        if (target && ex.target !== target) return false;
        if (attrezzo && !ex.attrezzatura?.toLowerCase().includes(attrezzo.toLowerCase()))
          return false;
        if (livello && ex.livello !== livello) return false;
        return true;
      });

      filtered.sort((a: any, b: any) =>
        (a.nome_esercizio ?? "").localeCompare(b.nome_esercizio ?? "")
      );
      return res.end(JSON.stringify(filtered));
    }

    // 8. Stati Allenamenti: GET /app-api/stati
    if (pathname === "/app-api/stati" && method === "GET") {
      const rows = db.stato_allenamenti.filter((s: any) => s.email_cliente === currentUser.email);
      return res.end(JSON.stringify(rows));
    }

    // 9. Conteggio Diario per Giorno: GET /app-api/diario/conteggio/:livello/:giorno
    const diarioCountMatch = pathname.match(/^\/app-api\/diario\/conteggio\/([^/]+)\/([^/]+)$/);
    if (diarioCountMatch && method === "GET") {
      const livello = decodeURIComponent(diarioCountMatch[1]);
      const giornoInt = parseInt(diarioCountMatch[2], 10);

      const eserciziGiorno = db.allenamenti
        .filter((a: any) => {
          if (a.livello !== livello) return false;
          const m = String(a.giorno).match(/[0-9]+/);
          return m && parseInt(m[0], 10) === giornoInt;
        })
        .map((a: any) => a.id_esercizio);

      const count = db.diario_utente.filter(
        (d: any) => d.email_cliente === currentUser.email && eserciziGiorno.includes(d.id_esercizio)
      ).length;

      return res.end(JSON.stringify({ count }));
    }

    // 10. Reset: POST /app-api/stati/reset
    if (pathname === "/app-api/stati/reset" && method === "POST") {
      const { livello, giorno } = parsedBody;
      const giornoInt = parseInt(String(giorno), 10);

      const eserciziGiorno = db.allenamenti
        .filter((a: any) => {
          if (a.livello !== livello) return false;
          const m = String(a.giorno).match(/[0-9]+/);
          return m && parseInt(m[0], 10) === giornoInt;
        })
        .map((a: any) => a.id_esercizio);

      const initialCount = db.diario_utente.length;
      db.diario_utente = db.diario_utente.filter(
        (d: any) =>
          !(d.email_cliente === currentUser.email && eserciziGiorno.includes(d.id_esercizio))
      );
      const eliminati = initialCount - db.diario_utente.length;

      const existing = db.stato_allenamenti.find(
        (s: any) =>
          s.email_cliente === currentUser.email && s.livello === livello && s.giorno === giornoInt
      );
      if (existing) {
        existing.stato = "non_iniziato";
        existing.updated_at = new Date().toISOString();
      } else {
        db.stato_allenamenti.push({
          email_cliente: currentUser.email,
          livello,
          giorno: giornoInt,
          stato: "non_iniziato",
          updated_at: new Date().toISOString(),
        });
      }
      saveData(db);
      return res.end(JSON.stringify({ ok: true, eliminati }));
    }

    // 11. Salva Stato: POST /app-api/stati
    if (pathname === "/app-api/stati" && method === "POST") {
      const { livello, giorno, stato } = parsedBody;
      const existing = db.stato_allenamenti.find(
        (s: any) =>
          s.email_cliente === currentUser.email &&
          s.livello === livello &&
          s.giorno === Number(giorno)
      );
      if (existing) {
        existing.stato = stato;
        existing.updated_at = new Date().toISOString();
      } else {
        db.stato_allenamenti.push({
          email_cliente: currentUser.email,
          livello,
          giorno: Number(giorno),
          stato,
          updated_at: new Date().toISOString(),
        });
      }
      saveData(db);
      return res.end(JSON.stringify({ ok: true }));
    }

    // 12. Diario: GET /app-api/diario
    if (pathname === "/app-api/diario" && method === "GET") {
      const targetEmail = url.searchParams.get("email");
      const filterEmail =
        targetEmail || (currentUser.ruolo === "manager" ? null : currentUser.email);

      const rows = [...db.diario_utente]
        .filter((d: any) => !filterEmail || d.email_cliente === filterEmail)
        .sort((a, b) => new Date(b.data_ora).getTime() - new Date(a.data_ora).getTime());
      return res.end(JSON.stringify(rows));
    }

    // 13. Diario Esercizio: GET /app-api/diario/esercizio/:idEsercizio
    const diarioExMatch = pathname.match(/^\/app-api\/diario\/esercizio\/([^/]+)$/);
    if (diarioExMatch && method === "GET") {
      const idEsercizio = decodeURIComponent(diarioExMatch[1]);
      const targetEmail = url.searchParams.get("email");
      const filterEmail =
        targetEmail || (currentUser.ruolo === "manager" ? null : currentUser.email);

      const rows = [...db.diario_utente]
        .filter(
          (d: any) =>
            (!filterEmail || d.email_cliente === filterEmail) && d.id_esercizio === idEsercizio
        )
        .sort((a, b) => new Date(b.data_ora).getTime() - new Date(a.data_ora).getTime());
      return res.end(JSON.stringify(rows));
    }

    // 14. Diario Salva: POST /app-api/diario
    if (pathname === "/app-api/diario" && method === "POST") {
      const newEntry = {
        id: Date.now(),
        email_cliente: currentUser.email,
        id_esercizio: parsedBody.id_esercizio,
        nome_esercizio: parsedBody.nome_esercizio,
        carico_kg: parsedBody.sets_json ? null : (parsedBody.carico_kg ?? null),
        feedback: parsedBody.feedback ?? null,
        ripetizioni: parsedBody.sets_json ? null : (parsedBody.ripetizioni ?? null),
        serie: parsedBody.sets_json ? null : (parsedBody.serie ?? null),
        sets_json: parsedBody.sets_json ?? null,
        rpe_json: parsedBody.rpe_json ?? null,
        data_ora: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      db.diario_utente.push(newEntry);
      saveData(db);
      res.statusCode = 201;
      return res.end(JSON.stringify(newEntry));
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
      const pref = db.preferenze_utente.find((p: any) => p.email_cliente === currentUser.email);
      return res.end(JSON.stringify({ memoria_livello: pref?.memoria_livello ?? null }));
    }

    // 18. Preferenze Salva: POST /app-api/preferenze/livello
    if (pathname === "/app-api/preferenze/livello" && method === "POST") {
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

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Endpoint demo non trovato" }));
}
