#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const VAULT_DIR = path.join(ROOT_DIR, "data", "vault");
const VAULT_MOD1 = path.join(VAULT_DIR, "1_gestionale_utenti_crediti.json");
const VAULT_MOD2 = path.join(VAULT_DIR, "2_gestionale_calendario.json");
const VAULT_MOD6 = path.join(VAULT_DIR, "6_configurazione_lab.json");
const DEMO_DATA_FILE = path.join(ROOT_DIR, "demo-data.json");

// Import dynamic o compilazione da server/reminder-24h-service
function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function getSlotDate(dataStr, orarioStr) {
  const [year, month, day] = dataStr.split("-").map((v) => parseInt(v, 10));
  const [hours, minutes] = orarioStr.split(":").map((v) => parseInt(v, 10));
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function getFirstName(atleta, rawNome) {
  if (atleta?.nome && atleta.nome.trim()) {
    const n = atleta.nome.trim();
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  if (rawNome && rawNome.trim()) {
    const firstWord = rawNome.trim().split(/\s+/)[0];
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }
  return "Atleta";
}

function cleanPhoneNumber(rawPhone) {
  if (!rawPhone) return "";
  let p = rawPhone.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) {
    p = "+" + p.slice(2);
  } else if (!p.startsWith("+") && p.length === 10 && (p.startsWith("3") || p.startsWith("0"))) {
    p = "+39" + p;
  }
  return p;
}

function buildReminderMessage({ nome, orario, oraLimite, testoLimiteData = "di oggi", telefono }) {
  const messaggio = `Ciao ${nome}! Ti ricordiamo che domani alle ${orario} hai un allenamento prenotato in Area46. Non mancare, ti aspettiamo!\nPromemoria utile: se hai un imprevisto, hai tempo fino alle ore ${oraLimite} ${testoLimiteData} per modificare o disdire la tua prenotazione in autonomia dall'app.`.trim();

  const phoneClean = cleanPhoneNumber(telefono);
  const whatsappUrl = phoneClean
    ? `https://api.whatsapp.com/send?phone=${phoneClean.replace(/^\+/, "")}&text=${encodeURIComponent(messaggio)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(messaggio)}`;

  return { messaggio, whatsappUrl };
}

export function checkAndSend24hReminders(options = {}) {
  const isDryRun = options.dryRun ?? process.argv.includes("--dry-run");
  const targetDateStr = options.targetDate || process.argv.find((arg) => arg.startsWith("--date="))?.split("=")[1];
  const now = targetDateStr ? new Date(targetDateStr) : new Date();

  console.log(`\n=======================================================`);
  console.log(`⏰ [AREA46 SCANNER PROMEMORIA 24H] Avvio scansione`);
  console.log(`📅 Data di riferimento scansione: ${now.toLocaleString("it-IT")}`);
  console.log(`🔍 Modalità: ${isDryRun ? "DRY-RUN (Simulazione senza modifiche)" : "PRODUZIONE (Salvataggio attivo)"}`);
  console.log(`=======================================================`);

  if (!fs.existsSync(VAULT_MOD2)) {
    throw new Error(`Vault Calendario mancante: ${VAULT_MOD2}`);
  }

  const mod2 = JSON.parse(fs.readFileSync(VAULT_MOD2, "utf-8"));
  const mod1 = fs.existsSync(VAULT_MOD1) ? JSON.parse(fs.readFileSync(VAULT_MOD1, "utf-8")) : {};
  const mod6 = fs.existsSync(VAULT_MOD6) ? JSON.parse(fs.readFileSync(VAULT_MOD6, "utf-8")) : {};

  const bookings = Array.isArray(mod2.prenotazioni_slot) ? mod2.prenotazioni_slot : [];
  const users = Array.isArray(mod1.profili_utenti) ? mod1.profili_utenti : [];
  const cancelledList = Array.isArray(mod2.prenotazioni_cancellate) ? mod2.prenotazioni_cancellate : [];

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${pad2(tomorrow.getMonth() + 1)}-${pad2(tomorrow.getDate())}`;

  console.log(`📊 Prenotazioni totali in archivio: ${bookings.length}`);
  console.log(`🎯 Ricerca slot per domani: ${tomorrowStr}`);

  let candidati = 0;
  let inviati = 0;
  let giaInviati = 0;
  let saltati = 0;
  const processedResults = [];

  for (const bk of bookings) {
    if (bk.reminder_24h_sent) {
      giaInviati++;
      continue;
    }

    const rawId = String(bk.id || "").trim();
    const cleanId = rawId.startsWith("lab_") ? rawId.slice(4) : rawId;
    const labId = rawId.startsWith("lab_") ? rawId : `lab_${rawId}`;
    if (cancelledList.includes(rawId) || cancelledList.includes(cleanId) || cancelledList.includes(labId)) {
      saltati++;
      continue;
    }

    const stato = (bk.stato || "").toLowerCase();
    if (stato === "cancellata" || stato === "cancellata_tardiva" || stato === "cancellata_in_tempo") {
      saltati++;
      continue;
    }

    if (!bk.data || !bk.orario) {
      saltati++;
      continue;
    }

    const slotDate = getSlotDate(bk.data, bk.orario);
    if (isNaN(slotDate.getTime())) {
      saltati++;
      continue;
    }

    const atleta = users.find(
      (u) =>
        (bk.atleta_id && u.id === bk.atleta_id) ||
        (bk.email_cliente && u.email?.toLowerCase() === bk.email_cliente.toLowerCase())
    );

    const oreLimite = Number(
      atleta?.tempo_cancellazione_ore || mod6?.configurazione_lab?.tempo_cancellazione_ore || 24
    );
    const deadlineDate = new Date(slotDate.getTime() - oreLimite * 60 * 60 * 1000);

    const nowMs = now.getTime();
    const slotMs = slotDate.getTime();
    const deadlineMs = deadlineDate.getTime();

    if (slotMs <= nowMs) {
      saltati++;
      continue;
    }

    if (nowMs >= deadlineMs) {
      saltati++;
      continue;
    }

    const oreAllaSeduta = (slotMs - nowMs) / (1000 * 60 * 60);
    const isForTomorrow = bk.data === tomorrowStr;
    const isWithin36Hours = oreAllaSeduta <= 36 && oreAllaSeduta >= oreLimite;

    if (!isForTomorrow && !isWithin36Hours) {
      continue;
    }

    candidati++;

    const nome = getFirstName(atleta, bk.nome_cliente);
    const telefono = atleta?.telefono || bk.telefono_cliente || "";
    const emailDest = bk.email_cliente || atleta?.email || "";

    const oraLimiteH = pad2(deadlineDate.getHours());
    const oraLimiteM = pad2(deadlineDate.getMinutes());
    const oraLimiteStr = `${oraLimiteH}:${oraLimiteM}`;

    const nowDateStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const deadlineDateStr = `${deadlineDate.getFullYear()}-${pad2(deadlineDate.getMonth() + 1)}-${pad2(deadlineDate.getDate())}`;
    const testoLimiteData = deadlineDateStr === nowDateStr ? "di oggi" : `del ${pad2(deadlineDate.getDate())}/${pad2(deadlineDate.getMonth() + 1)}`;

    const { messaggio, whatsappUrl } = buildReminderMessage({
      nome,
      orario: bk.orario,
      oraLimite: oraLimiteStr,
      testoLimiteData,
      telefono,
    });

    console.log(`\n-------------------------------------------------------`);
    console.log(`🔔 CANDIDATO #${candidati}: [${bk.id}] ${bk.data} ore ${bk.orario}`);
    console.log(`👤 Destinatario: ${nome} (${emailDest || "senza email"}) - Tel: ${telefono || "N/D"}`);
    console.log(`⏱️ Scadenza disdetta gratuita: ore ${oraLimiteStr} ${testoLimiteData}`);
    console.log(`💬 Messaggio generato:\n"${messaggio}"`);
    console.log(`📱 WhatsApp URL:\n${whatsappUrl}`);

    processedResults.push({
      bookingId: bk.id,
      nome,
      email: emailDest,
      telefono,
      data: bk.data,
      orario: bk.orario,
      oraLimite: oraLimiteStr,
      testoLimiteData,
      messaggio,
      whatsappUrl,
    });

    if (!isDryRun) {
      bk.reminder_24h_sent = true;
      bk.reminder_24h_sent_at = now.toISOString();
      bk.reminder_24h_deadline = `${oraLimiteStr} ${testoLimiteData}`;
      bk.reminder_24h_whatsapp_url = whatsappUrl;
      bk.reminder_24h_message = messaggio;
      bk.reminder_24h_channel = "whatsapp_ready";

      inviati++;
    }
  }

  console.log(`\n=======================================================`);
  console.log(`📊 RIEPILOGO SCANSIONE PROMEMORIA:`);
  console.log(`- Candidati idonei trovati: ${candidati}`);
  console.log(`- Già inviati in precedenza (idempotenza): ${giaInviati}`);
  console.log(`- Saltati (passati / tardivi / cancellati): ${saltati}`);
  if (!isDryRun) {
    console.log(`- Promemoria registrati e inviati con successo: ${inviati}`);
    if (inviati > 0) {
      // Scrittura sicura Vault 2
      fs.writeFileSync(VAULT_MOD2, JSON.stringify(mod2, null, 2), "utf-8");
      console.log(`💾 Vault 2 salvato con successo con i nuovi flag.`);

      // Allineamento demo-data se esiste
      if (fs.existsSync(DEMO_DATA_FILE)) {
        try {
          const dd = JSON.parse(fs.readFileSync(DEMO_DATA_FILE, "utf-8"));
          if (Array.isArray(dd.prenotazioni_slot)) {
            for (const p of processedResults) {
              const match = dd.prenotazioni_slot.find((b) => b.id === p.bookingId);
              if (match) {
                match.reminder_24h_sent = true;
                match.reminder_24h_sent_at = now.toISOString();
                match.reminder_24h_deadline = `${p.oraLimite} ${p.testoLimiteData}`;
                match.reminder_24h_whatsapp_url = p.whatsappUrl;
                match.reminder_24h_message = p.messaggio;
              }
            }
            fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(dd, null, 2), "utf-8");
            console.log(`💾 demo-data.json allineato.`);
          }
        } catch (e) {
          console.warn("Avviso allineamento demo-data:", e.message);
        }
      }
    }
  } else {
    console.log(`- Simulazione completata: nessuna modifica apportata al Vault.`);
  }
  console.log(`=======================================================\n`);

  return {
    candidati,
    inviati: isDryRun ? candidati : inviati,
    giaInviati,
    results: processedResults,
  };
}

if (process.argv[1] && process.argv[1].endsWith("check_reminders_24h.mjs")) {
  try {
    checkAndSend24hReminders();
  } catch (err) {
    console.error("❌ ERRORE SCANSIONE PROMEMORIA:", err);
    process.exit(1);
  }
}
