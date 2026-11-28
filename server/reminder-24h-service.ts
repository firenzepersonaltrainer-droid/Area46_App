import fs from "node:fs";
import path from "node:path";

export interface BookingSlot {
  id: string;
  data: string; // YYYY-MM-DD
  orario: string; // HH:MM
  email_cliente?: string;
  nome_cliente?: string;
  telefono_cliente?: string;
  atleta_id?: string;
  stato?: string;
  credito_scalato?: boolean;
  reminder_24h_sent?: boolean;
  reminder_24h_sent_at?: string;
  reminder_24h_deadline?: string;
  reminder_24h_whatsapp_url?: string;
  reminder_24h_message?: string;
  reminder_24h_channel?: string;
  [key: string]: any;
}

export interface UserProfile {
  id: string;
  email: string;
  nome?: string;
  cognome?: string;
  name?: string;
  telefono?: string;
  tempo_cancellazione_ore?: number;
  [key: string]: any;
}

export interface ReminderProcessResult {
  bookingId: string;
  nome: string;
  email: string;
  telefono: string;
  data: string;
  orario: string;
  oraLimite: string;
  deadlineIso: string;
  messaggio: string;
  whatsappUrl: string;
  emailInviata: boolean;
  canale: string;
  timestamp: string;
}

export interface ScanRemindersReport {
  timestamp: string;
  totalePrenotazioni: number;
  esaminate: number;
  candidatiTrovati: number;
  inviatiConSuccesso: number;
  saltatiGiaInviati: number;
  saltatiScadutiOTardivi: number;
  dettagli: ReminderProcessResult[];
}

/**
 * Converte data e ora slot in Date object (fuso locale del sistema)
 */
export function getSlotDate(dataStr: string, orarioStr: string): Date {
  const [year, month, day] = dataStr.split("-").map((v) => parseInt(v, 10));
  const [hours, minutes] = orarioStr.split(":").map((v) => parseInt(v, 10));
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/**
 * Formatta un numero in stringa a 2 cifre
 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Estrae il nome di battesimo pulito
 */
export function getFirstName(atleta?: UserProfile | null, rawNome?: string): string {
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

/**
 * Normalizza il recapito telefonico per WhatsApp
 */
export function cleanPhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return "";
  let p = rawPhone.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) {
    p = "+" + p.slice(2);
  } else if (!p.startsWith("+") && p.length === 10 && (p.startsWith("3") || p.startsWith("0"))) {
    // Default prefisso Italia +39 per cellulari italiani di 10 cifre
    p = "+39" + p;
  }
  return p;
}

/**
 * Costruisce il messaggio di promemoria e l'URL WhatsApp
 */
export function buildReminderMessage(params: {
  nome: string;
  orario: string;
  oraLimite: string;
  testoLimiteData?: string;
  telefono?: string;
}): { messaggio: string; whatsappUrl: string } {
  const { nome, orario, oraLimite, testoLimiteData = "di oggi", telefono } = params;

  // Testo richiesto:
  // "Ciao [Nome]! Ti ricordiamo che domani alle [Ora] hai un allenamento prenotato in Area46. Non mancare, ti aspettiamo!
  // Promemoria utile: se hai un imprevisto, hai tempo fino alle ore [Ora Limite] di oggi per modificare o disdire la tua prenotazione in autonomia dall'app."
  const messaggio = `Ciao ${nome}! Ti ricordiamo che domani alle ${orario} hai un allenamento prenotato in Area46. Non mancare, ti aspettiamo!\nPromemoria utile: se hai un imprevisto, hai tempo fino alle ore ${oraLimite} ${testoLimiteData} per modificare o disdire la tua prenotazione in autonomia dall'app.`.trim();

  const phoneClean = cleanPhoneNumber(telefono);
  const whatsappUrl = phoneClean
    ? `https://api.whatsapp.com/send?phone=${phoneClean.replace(/^\+/, "")}&text=${encodeURIComponent(messaggio)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(messaggio)}`;

  return { messaggio, whatsappUrl };
}

/**
 * Calcola se una prenotazione è idonea per il promemoria delle 24h
 */
export function isBookingEligibleFor24hReminder(
  booking: BookingSlot,
  atleta: UserProfile | null,
  configLab: any,
  now: Date = new Date(),
  cancelledList?: any[]
): {
  eligible: boolean;
  reason?: string;
  slotDate?: Date;
  deadlineDate?: Date;
  oreLimite?: number;
  oraLimiteStr?: string;
  testoLimiteData?: string;
} {
  // 1. Controllo cancellazione o stato non valido
  const rawId = String(booking.id || "").trim();
  const cleanId = rawId.startsWith("lab_") ? rawId.slice(4) : rawId;
  const labId = rawId.startsWith("lab_") ? rawId : `lab_${rawId}`;
  if (
    cancelledList &&
    (cancelledList.includes(rawId) || cancelledList.includes(cleanId) || cancelledList.includes(labId))
  ) {
    return { eligible: false, reason: "prenotazione_cancellata_in_elenco" };
  }

  const stato = (booking.stato || "").toLowerCase();
  if (stato === "cancellata" || stato === "cancellata_tardiva" || stato === "cancellata_in_tempo") {
    return { eligible: false, reason: "prenotazione_gia_cancellata" };
  }

  // 2. Controllo idempotenza: già inviato
  if (booking.reminder_24h_sent) {
    return { eligible: false, reason: "reminder_gia_inviato" };
  }

  // 3. Calcolo date e orari
  if (!booking.data || !booking.orario) {
    return { eligible: false, reason: "data_o_orario_mancante" };
  }

  const slotDate = getSlotDate(booking.data, booking.orario);
  if (isNaN(slotDate.getTime())) {
    return { eligible: false, reason: "data_slot_non_valida" };
  }

  // Policy di cancellazione (default 24h)
  const oreLimite = Number(
    atleta?.tempo_cancellazione_ore || configLab?.tempo_cancellazione_ore || 24
  );
  const deadlineDate = new Date(slotDate.getTime() - oreLimite * 60 * 60 * 1000);

  const nowMs = now.getTime();
  const slotMs = slotDate.getTime();
  const deadlineMs = deadlineDate.getTime();

  // 4. Se la data/ora dello slot è già passata
  if (slotMs <= nowMs) {
    return { eligible: false, reason: "slot_nel_passato" };
  }

  // 5. Se la deadline delle 24h è già scaduta (siamo nelle ultime 24 ore)
  if (nowMs >= deadlineMs) {
    return { eligible: false, reason: "deadline_24h_gia_scaduta" };
  }

  // 6. Verifica finestra temporale utile:
  // - Calcola data di domani rispetto a `now`
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${pad2(tomorrow.getMonth() + 1)}-${pad2(tomorrow.getDate())}`;

  const oreAllaSeduta = (slotMs - nowMs) / (1000 * 60 * 60);

  // È per domani oppure entro 36 ore dallo slot
  const isForTomorrow = booking.data === tomorrowStr;
  const isWithin36Hours = oreAllaSeduta <= 36 && oreAllaSeduta >= oreLimite;

  if (!isForTomorrow && !isWithin36Hours) {
    return { eligible: false, reason: "troppo_anticipo_rispetto_a_24h" };
  }

  // Calcolo formattazione ora limite
  const oraLimiteH = pad2(deadlineDate.getHours());
  const oraLimiteM = pad2(deadlineDate.getMinutes());
  const oraLimiteStr = `${oraLimiteH}:${oraLimiteM}`;

  // Se la deadline cade nella stessa data di `now`
  const nowDateStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const deadlineDateStr = `${deadlineDate.getFullYear()}-${pad2(deadlineDate.getMonth() + 1)}-${pad2(deadlineDate.getDate())}`;
  const testoLimiteData = deadlineDateStr === nowDateStr ? "di oggi" : `del ${pad2(deadlineDate.getDate())}/${pad2(deadlineDate.getMonth() + 1)}`;

  return {
    eligible: true,
    slotDate,
    deadlineDate,
    oreLimite,
    oraLimiteStr,
    testoLimiteData,
  };
}

/**
 * Motore principale di scansione ed invio dei promemoria 24h
 */
export async function process24hReminders(
  db: any,
  options: {
    dryRun?: boolean;
    now?: Date;
    sendEmailFn?: (params: any) => Promise<any>;
    logShadowEventFn?: (type: string, athlete: string, payload?: any) => void;
    saveDataFn?: (db: any) => Promise<void> | void;
  } = {}
): Promise<ScanRemindersReport> {
  const {
    dryRun = false,
    now = new Date(),
    sendEmailFn,
    logShadowEventFn,
    saveDataFn,
  } = options;

  const bookings: BookingSlot[] = db?.prenotazioni_slot || [];
  const users: UserProfile[] = db?.profili_utenti || [];
  const configLab = db?.configurazione_lab || {};
  const cancelledList = db?.prenotazioni_cancellate || [];

  const report: ScanRemindersReport = {
    timestamp: now.toISOString(),
    totalePrenotazioni: bookings.length,
    esaminate: 0,
    candidatiTrovati: 0,
    inviatiConSuccesso: 0,
    saltatiGiaInviati: 0,
    saltatiScadutiOTardivi: 0,
    dettagli: [],
  };

  let mutazioniEffettuate = false;

  for (const bk of bookings) {
    report.esaminate++;

    if (bk.reminder_24h_sent) {
      report.saltatiGiaInviati++;
      continue;
    }

    // Ricerca profilo atleta
    const atleta =
      users.find(
        (u) =>
          (bk.atleta_id && u.id === bk.atleta_id) ||
          (bk.email_cliente && u.email?.toLowerCase() === bk.email_cliente.toLowerCase())
      ) || null;

    const check = isBookingEligibleFor24hReminder(bk, atleta, configLab, now, cancelledList);

    if (!check.eligible) {
      if (check.reason === "deadline_24h_gia_scaduta" || check.reason === "prenotazione_gia_cancellata") {
        report.saltatiScadutiOTardivi++;
      }
      continue;
    }

    report.candidatiTrovati++;

    const nome = getFirstName(atleta, bk.nome_cliente);
    const telefono = atleta?.telefono || bk.telefono_cliente || "";
    const emailDest = bk.email_cliente || atleta?.email || "";
    const oraLimite = check.oraLimiteStr || bk.orario;
    const testoLimiteData = check.testoLimiteData || "di oggi";

    const { messaggio, whatsappUrl } = buildReminderMessage({
      nome,
      orario: bk.orario,
      oraLimite,
      testoLimiteData,
      telefono,
    });

    let emailSentOk = false;
    if (!dryRun && sendEmailFn && emailDest) {
      try {
        await sendEmailFn({
          to: emailDest,
          subject: `📅 Promemoria Allenamento Domani alle ${bk.orario} - Area46 Landmine Lab`,
          body: messaggio,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background-color: #0b0f17; color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
              <div style="background: linear-gradient(135deg, #161e2e 0%, #0b0f17 100%); padding: 24px; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: center;">
                <h1 style="color: #ff6b00; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 1px;">AREA46 LANDMINE LAB</h1>
                <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px; letter-spacing: 0.5px;">PROMEMORIA ALLENAMENTO</p>
              </div>
              <div style="padding: 28px 24px; line-height: 1.6;">
                <p style="font-size: 16px; margin-top: 0; color: #f1f5f9;">Ciao <strong style="color: #ffffff;">${nome}</strong>!</p>
                <div style="background-color: rgba(255, 107, 0, 0.08); border-left: 4px solid #ff6b00; padding: 14px 18px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 15px; color: #ffffff;">
                    Ti ricordiamo che <strong>domani alle ore ${bk.orario}</strong> hai un allenamento prenotato in Area46.<br>
                    <span style="color: #ff9944;">Non mancare, ti aspettiamo carichi in sala!</span>
                  </p>
                </div>
                <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 14px 18px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                    ℹ️ <strong>Promemoria utile:</strong> se hai un imprevisto, hai tempo fino alle ore <strong style="color: #ffffff;">${oraLimite} ${testoLimiteData}</strong> per modificare o disdire la tua prenotazione in autonomia dall'app senza perdere il credito.
                  </p>
                </div>
                <p style="margin: 24px 0 0; font-size: 13px; color: #64748b; text-align: center;">
                  Area46 Training Lab • Via del Landmine 46, Firenze
                </p>
              </div>
            </div>
          `,
          tipo: "promemoria_24h",
        });
        emailSentOk = true;
      } catch (err: any) {
        console.warn(`[REMINDER 24H EMAIL WARN] Invio email fallito per ${emailDest}:`, err?.message || err);
      }
    }

    const detail: ReminderProcessResult = {
      bookingId: bk.id,
      nome,
      email: emailDest,
      telefono,
      data: bk.data,
      orario: bk.orario,
      oraLimite,
      deadlineIso: check.deadlineDate ? check.deadlineDate.toISOString() : "",
      messaggio,
      whatsappUrl,
      emailInviata: emailSentOk,
      canale: emailSentOk ? "email+whatsapp_ready" : "whatsapp_ready",
      timestamp: now.toISOString(),
    };

    report.dettagli.push(detail);

    // Se non è dryRun, applichiamo l'idempotenza e aggiorniamo il record
    if (!dryRun) {
      bk.reminder_24h_sent = true;
      bk.reminder_24h_sent_at = now.toISOString();
      bk.reminder_24h_deadline = `${oraLimite} ${testoLimiteData}`;
      bk.reminder_24h_whatsapp_url = whatsappUrl;
      bk.reminder_24h_message = messaggio;
      bk.reminder_24h_channel = detail.canale;

      // Storico notifiche promemoria
      db.notifiche_promemoria = db.notifiche_promemoria || [];
      db.notifiche_promemoria.unshift({
        id: `rem-24h-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        booking_id: bk.id,
        atleta_id: bk.atleta_id || atleta?.id || "",
        email_cliente: emailDest,
        nome_cliente: bk.nome_cliente || nome,
        data_allenamento: bk.data,
        orario_allenamento: bk.orario,
        ora_limite_cancellazione: oraLimite,
        messaggio,
        whatsapp_url: whatsappUrl,
        inviato_il: now.toISOString(),
      });

      if (logShadowEventFn) {
        logShadowEventFn("REMINDER_24H_SENT", emailDest || bk.id, {
          bookingId: bk.id,
          data: bk.data,
          orario: bk.orario,
          oraLimite,
          canale: detail.canale,
        });
      }

      mutazioniEffettuate = true;
      report.inviatiConSuccesso++;
    } else {
      // In dry-run contiamo i candidati come simulati
      report.inviatiConSuccesso++;
    }
  }

  // Salvataggio atomico se ci sono state modifiche
  if (!dryRun && mutazioniEffettuate && saveDataFn) {
    await saveDataFn(db);
  }

  return report;
}
