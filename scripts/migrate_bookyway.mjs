import xlsx from "xlsx";
import fs from "node:fs";
import path from "node:path";

function excelDateToJS(serial) {
  if (!serial) return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;
  return new Date(new Date(utc_value * 1000).setUTCHours(hours, minutes, seconds));
}

const DATA_FILE = path.resolve("./demo-data.json");
const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

const wbMembers = xlsx.readFile("./data/migrazione_bookyway/BookyWayMembers.xlsx");
const rawMembers = xlsx.utils.sheet_to_json(wbMembers.Sheets[wbMembers.SheetNames[0]]);

const wbCredits = xlsx.readFile("./data/migrazione_bookyway/BookyWayCredits.xlsx");
const rawCredits = xlsx.utils.sheet_to_json(wbCredits.Sheets[wbCredits.SheetNames[0]]);

const wbSubs = xlsx.readFile("./data/migrazione_bookyway/BookyWaySubscriptions.xlsx");
const rawSubs = xlsx.utils.sheet_to_json(wbSubs.Sheets[wbSubs.SheetNames[0]]);

const wbExp = xlsx.readFile("./data/migrazione_bookyway/BookyWayExpiringCredits.xlsx");
const rawExp = xlsx.utils.sheet_to_json(wbExp.Sheets[wbExp.SheetNames[0]]);

// Mappa scadenze
const expiringMap = {};
for (const e of rawExp) {
  const email = (e["E-mail"] || "").trim().toLowerCase();
  const d = excelDateToJS(e["Scadenza"]);
  if (email && d) {
    expiringMap[email] = d.toISOString().slice(0, 10);
  }
}

// 1. PROFILI UTENTI
const profili = [];

// Coach / Head Coach
profili.push({
  id: "usr-coach-01",
  email: "firenzepersonaltrainer@gmail.com",
  nome: "Coach",
  cognome: "Area46",
  telefono: "+39 340 0000000",
  codice_fiscale: "ARECST80A01D612Y",
  indirizzo: "Via del Landmine 46, Firenze",
  ruolo: "manager",
  crediti: 999,
  data_scadenza_crediti: "2099-12-31",
  data_ultimo_accesso: new Date().toISOString(),
  note_coach: "Head Coach & Amministratore Lab",
  tempo_cancellazione_ore: 12,
  name: "Coach Area46",
  tipo_abbonamento: "standard",
  stato_iscrizione: "attivo",
});

const membersById = {};
const membersByEmail = {};

for (const m of rawMembers) {
  const email = (m["E-mail"] || "").trim().toLowerCase();
  if (!email || email === "firenzepersonaltrainer@gmail.com") continue;

  // Deduplica se un utente ha 2 ID (es. Pierpaola Ciancia)
  if (email === "pantanella@gmail.com" && m.Nome === "Pierpaola") {
    // skip alias
    continue;
  }

  const id = `usr-bw-${m.Id}`;
  const crediti = parseInt(m["Crediti disponibili"], 10) || 0;

  let scadenza = expiringMap[email] || null;
  if (!scadenza && m["Scadenza Abbonamento"]) {
    const d = excelDateToJS(m["Scadenza Abbonamento"]);
    if (d) scadenza = d.toISOString().slice(0, 10);
  }

  const isCoachAlt = email === "tronconistefano@gmail.com" || email === "a46firenze@gmail.com";

  const userObj = {
    id,
    bookyway_id: m.Id,
    email,
    nome: (m.Nome || "").trim(),
    cognome: (m.Cognome || "").trim(),
    nickname: (m.Nickname || "").trim(),
    telefono: m.Telefono || "",
    codice_fiscale: m["Codice Fiscale"] || "",
    indirizzo: m.Indirizzo || "",
    ruolo: isCoachAlt ? "manager" : "atleta",
    crediti: isCoachAlt ? 999 : crediti,
    data_scadenza_crediti: isCoachAlt ? "2099-12-31" : scadenza,
    data_ultimo_accesso: m["Ultima login"] ? excelDateToJS(m["Ultima login"])?.toISOString() : null,
    data_creazione: m["Data Creazione"] ? excelDateToJS(m["Data Creazione"])?.toISOString() : null,
    tempo_cancellazione_ore: 24,
    tempo_anticipo_prenotazione_ore: 24,
    tipo_abbonamento: "standard",
    stato_iscrizione: "attivo",
    name: `${(m.Nome || "").trim()} ${(m.Cognome || "").trim()}`.trim(),
  };

  membersById[m.Id] = userObj;
  membersByEmail[email] = userObj;
  profili.push(userObj);
}

// 2. PRENOTAZIONI
const prenotazioni = [];
for (let i = 0; i < rawSubs.length; i++) {
  const s = rawSubs[i];
  const d = excelDateToJS(s["Data Inizio"]);
  if (!d) continue;

  const dateStr = d.toISOString().slice(0, 10);
  const timeStr = d.toISOString().slice(11, 16);
  const user = membersById[s.Id] || membersByEmail[s.Nome?.toLowerCase()];

  const isFutureOrToday = dateStr >= "2026-09-28";

  prenotazioni.push({
    id: `bk-bw-${s.Id}-${dateStr}-${timeStr.replace(":", "")}-${i}`,
    data: dateStr,
    orario: timeStr,
    email_cliente: user?.email || `${s.Nome?.toLowerCase()}.${s.Cognome?.toLowerCase()}@bookyway.local`,
    nome_cliente: `${s.Nome} ${s.Cognome}`.trim(),
    telefono_cliente: user?.telefono || "",
    stato: isFutureOrToday ? "confermata" : "completata",
    credito_scalato: true,
    attivita: s["Nome Attività"] || "Landmine Lab",
    created_at: s["Data/ora prenotazione"] ? excelDateToJS(s["Data/ora prenotazione"])?.toISOString() : new Date().toISOString(),
  });
}

// Ordina prenotazioni dalla più recente alla più lontana nel passato, o cronologica
prenotazioni.sort((a, b) => new Date(`${b.data}T${b.orario}`).getTime() - new Date(`${a.data}T${a.orario}`).getTime());

// 3. MOVIMENTI CREDITI
const movimenti = [];
for (let i = 0; i < rawCredits.length; i++) {
  const c = rawCredits[i];
  const d = excelDateToJS(c["Data Operazione"]);
  const email = (c["E-mail"] || "").trim().toLowerCase();
  const user = membersByEmail[email] || membersById[c.Id];

  let tipo = "modifica_manuale";
  const op = (c["Tipo Operazione"] || "").toLowerCase();
  if (op.includes("iscrizione") && !op.includes("disiscrizione")) {
    tipo = "prenotazione_slot";
  } else if (op.includes("disiscrizione")) {
    tipo = "rimborso_cancellazione";
  } else if (op.includes("ricarica") || op.includes("acquisto")) {
    tipo = "acquisto_carnet";
  }

  movimenti.push({
    id: `mov-bw-${i + 1}`,
    atleta_id: user?.id || `usr-bw-${c.Id}`,
    email_cliente: email,
    nome_cliente: `${c.Nome || ""} ${c.Cognome || ""}`.trim(),
    data_ora: d ? d.toISOString() : new Date().toISOString(),
    tipo,
    delta_crediti: parseFloat(c.Crediti) || 0,
    saldo_risultante: parseInt(c.Saldo, 10) || 0,
    motivazione: c.Motivazione || c["Tipo Operazione"] || "Operazione BookyWay",
    operatore: c.Operatore === "Utente" ? "atleta" : "coach",
  });
}

// Aggiorna DB
db.profili_utenti = profili;
db.prenotazioni_slot = prenotazioni;
db.movimenti_crediti = movimenti;
db.active_user_id = "usr-coach-01"; // Default accesso Coach

fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");

console.log("=== MIGRAZIONE COMPLETATA CON SUCCESSO ===");
console.log(`- Utenti importati: ${profili.length} (1 Coach + 14 Atleti reali)`);
console.log(`- Prenotazioni importate: ${prenotazioni.length} (di cui ${prenotazioni.filter(p => p.data >= "2026-09-28").length} attive/future)`);
console.log(`- Movimenti crediti importati: ${movimenti.length}`);
