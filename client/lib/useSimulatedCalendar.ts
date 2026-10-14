// ─── AREA46 TRAINING LAB - MOTORE SIMULAZIONE & LISTA D'ATTESA CALENDARIO ───
// Regole:
// 1. Quota settimanale: tra 2 e 4 slot in tutta la settimana (settimana 1 e 2).
// 2. Attenuazione: Settimana 3 (1-2 slot), Settimana 4 (0-1 slot), Settimana 5+ (0 slot, 100% libero).
// 3. Countdown: Max 5 minuti (300s).
// 4. Rotazione: 2-4 volte a settimana, fermo notturno tra 01:00 e 05:00.
// 5. Orologio condiviso deterministico.
// 6. Lista 'Avvisami se si libera' con sblocco programmato e spia notifiche / WhatsApp.

export interface SimulatedSlotInfo {
  data: string; // YYYY-MM-DD
  orario: string; // HH:mm
  stato: "occupato" | "opzionato";
  countdownSec?: number; // 0 - 300
  countdownMin?: number;
  isSimulated: boolean;
}

export interface WaitlistSubscription {
  id: string;
  userId: string;
  data: string; // YYYY-MM-DD
  orario: string; // HH:mm
  createdAt: number;
  tipo: "reale" | "simulato";
  sbloccoTimestamp?: number | null; // null se non sbloccabile
  sbloccato?: boolean;
}

export interface AppCalendarNotification {
  id: string;
  userId: string;
  data: string;
  orario: string;
  messaggio: string;
  createdAt: number;
  letto: boolean;
  tipo: "slot_liberato";
}

// ─── UTILITY STRING HASH ──────────────────────────────────────────────────────
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Orari candidati tipici per le simulazioni (fasce centrali del Lab)
const ORARI_CANDIDATI = [
  "09:15", "09:30", "10:00", "10:30",
  "17:15", "17:30", "18:00", "18:30", "19:00"
];

/**
 * Calcola il lunedì di riferimento per una data ISO YYYY-MM-DD
 */
export function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 Dom, 1 Lun...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayNum = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayNum}`;
}

/**
 * Calcola il numero di settimane di distanza dalla settimana corrente (0 = corrente, 1 = prox, ecc.)
 */
export function getWeekOffsetFromToday(targetDateStr: string, today: Date = new Date()): number {
  const nowMonday = new Date(getMondayOfWeek(formatDateISO(today)) + "T00:00:00");
  const targetMonday = new Date(getMondayOfWeek(targetDateStr) + "T00:00:00");
  const diffDays = Math.round((targetMonday.getTime() - nowMonday.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Restituisce l'orologio sincronizzato con fermo notturno 01:00-05:00.
 * Tra le 01:00 e le 05:00 le rotazioni casuali restano congelate allo stato delle 00:59.
 */
function getNormalizedRotationTimestamp(currentTimestamp: number = Date.now()): number {
  const d = new Date(currentTimestamp);
  const hour = d.getHours();
  if (hour >= 1 && hour < 5) {
    // Congela l'ora alle 00:59 dello stesso giorno
    d.setHours(0, 59, 0, 0);
    return d.getTime();
  }
  return currentTimestamp;
}

/**
 * Restituisce tutti gli slot simulati (da 2 a 4 in tutta la settimana, con decadimento a 5 settimane)
 */
export function getSimulatedSlotsForWeek(
  mondayDateStr: string,
  currentTimestamp: number = Date.now()
): Map<string, SimulatedSlotInfo> {
  const result = new Map<string, SimulatedSlotInfo>();

  const weekOffset = getWeekOffsetFromToday(mondayDateStr, new Date(currentTimestamp));

  // Dalla settimana 5 in poi (weekOffset >= 4): zero simulazione (calendario reale al 100%)
  if (weekOffset >= 4 || weekOffset < 0) {
    return result;
  }

  // Quota totale slot simulati per l'intera settimana in base all'attenuazione:
  let quotaTotale = 0;
  if (weekOffset === 0 || weekOffset === 1) {
    // Settimana 1 o 2: tra 2 e 4 slot totali in tutta la settimana
    const seedQuota = hashString(`${mondayDateStr}-quota`) % 3; // 0, 1, 2
    quotaTotale = 2 + seedQuota; // 2, 3 o 4 slot
  } else if (weekOffset === 2) {
    // Settimana 3: ridotto a 1-2 slot
    quotaTotale = 1 + (hashString(`${mondayDateStr}-w3`) % 2);
  } else if (weekOffset === 3) {
    // Settimana 4: ridotto a 0-1 slot
    quotaTotale = hashString(`${mondayDateStr}-w4`) % 2;
  }

  if (quotaTotale <= 0) {
    return result;
  }

  // Finestra di rotazione (2-4 volte a settimana: ogni ~48 ore)
  const normTime = getNormalizedRotationTimestamp(currentTimestamp);
  const normDate = new Date(normTime);
  const dayOfWeek = normDate.getDay(); // 0 Dom, 1 Lun...
  let rotationWindow = 0;
  if (dayOfWeek === 1 || dayOfWeek === 2) rotationWindow = 0;
  else if (dayOfWeek === 3 || dayOfWeek === 4) rotationWindow = 1;
  else rotationWindow = 2;

  // Seme combinato settimana + finestra di rotazione
  const rotSeed = hashString(`${mondayDateStr}-rot-${rotationWindow}`);

  // Selezioniamo esattamente i `quotaTotale` slot distribuiti tra i 3 giorni attivi del Lab (Lun=0, Mer=2, Ven=4 offset da lunedì)
  const mondayDate = new Date(mondayDateStr + "T00:00:00");
  const candidateDays = [0, 2, 4]; // Lunedì (+0), Mercoledì (+2), Venerdì (+4)

  const selectedPairs: Array<{ dateStr: string; orario: string; stato: "occupato" | "opzionato" }> = [];

  for (let i = 0; i < quotaTotale; i++) {
    const dayIndex = (rotSeed + i * 3) % candidateDays.length;
    const targetDayOffset = candidateDays[dayIndex];
    const slotDate = new Date(mondayDate);
    slotDate.setDate(slotDate.getDate() + targetDayOffset);
    const dateStr = formatDateISO(slotDate);

    const timeIndex = (rotSeed + i * 7 + 5) % ORARI_CANDIDATI.length;
    const orario = ORARI_CANDIDATI[timeIndex];

    // Alternanza realistica: metà occupati, metà opzionati con countdown
    const isOptioned = (rotSeed + i) % 2 === 0;
    const stato = isOptioned ? "opzionato" : "occupato";

    selectedPairs.push({ dateStr, orario, stato });
  }

  // Calcolo countdown per gli slot opzionati (massimo 5 minuti = 300 secondi)
  const CYCLE_SEC = 300; // 5 minuti max
  const nowSec = Math.floor(currentTimestamp / 1000);

  for (const pair of selectedPairs) {
    const key = `${pair.dateStr}|${pair.orario}`;
    if (result.has(key)) continue;

    if (pair.stato === "opzionato") {
      const slotHash = hashString(key);
      const offset = (slotHash % 180) + 30; // offset deterministico
      const remainingTotal = CYCLE_SEC - ((nowSec + offset) % CYCLE_SEC);
      const countdownMin = Math.floor(remainingTotal / 60);
      const countdownSec = remainingTotal % 60;

      result.set(key, {
        data: pair.dateStr,
        orario: pair.orario,
        stato: "opzionato",
        countdownSec: remainingTotal,
        countdownMin,
        isSimulated: true,
      });
    } else {
      result.set(key, {
        data: pair.dateStr,
        orario: pair.orario,
        stato: "occupato",
        isSimulated: true,
      });
    }
  }

  return result;
}

/**
 * Ottiene lo stato simulato per un singolo slot in un determinato giorno e orario
 */
export function getSimulatedSlotState(
  dateStr: string,
  orario: string,
  currentTimestamp: number = Date.now()
): SimulatedSlotInfo | null {
  const monday = getMondayOfWeek(dateStr);
  const weekSlots = getSimulatedSlotsForWeek(monday, currentTimestamp);
  const key = `${dateStr}|${orario}`;
  return weekSlots.get(key) || null;
}

// ─── SUONO NOTIFICA MORBIDO (WEB AUDIO API) ─────────────────────────────────
let audioCtxInstance: AudioContext | null = null;

export function playSoftNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtxInstance || audioCtxInstance.state === "closed") {
      audioCtxInstance = new AudioContextClass();
    }
    if (audioCtxInstance.state === "suspended") {
      audioCtxInstance.resume();
    }

    const ctx = audioCtxInstance;
    const now = ctx.currentTime;

    // Tono 1 morbido (520Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(520, now);
    gain1.gain.setValueAtTime(0.04, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tono 2 armonico (660Hz) dopo 120ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(660, now + 0.12);
    gain2.gain.setValueAtTime(0.05, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch {
    // Ignora silenziosamente su browser senza supporto audio
  }
}

// ─── GESTORE LISTA D'ATTESA & NOTIFICHE (STORAGE LOCALE PER UTENTE) ───────────
const WAITLIST_KEY_PREFIX = "area46_waitlist_";
const NOTIFICATIONS_KEY_PREFIX = "area46_notifications_";

export function getStoredWaitlist(userId: string): WaitlistSubscription[] {
  try {
    const raw = localStorage.getItem(`${WAITLIST_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredWaitlist(userId: string, list: WaitlistSubscription[]): void {
  try {
    localStorage.setItem(`${WAITLIST_KEY_PREFIX}${userId}`, JSON.stringify(list));
  } catch {}
}

export function subscribeToWaitlist(
  userId: string,
  data: string,
  orario: string,
  tipo: "reale" | "simulato"
): WaitlistSubscription {
  const current = getStoredWaitlist(userId);
  const existing = current.find((w) => w.data === data && w.orario === orario);
  if (existing) return existing;

  let sbloccoTimestamp: number | null = null;

  if (tipo === "simulato") {
    // Seme per decidere se questo slot è tra il 20% che NON si sblocca (per realismo)
    const seed = hashString(`${userId}-${data}-${orario}`);
    const staysLocked = seed % 5 === 0; // 20% rimane occupato

    if (!staysLocked) {
      // Sblocco programmato casuale tra 2 e 5 minuti da adesso
      const delayMs = (120 + (seed % 180)) * 1000;
      sbloccoTimestamp = Date.now() + delayMs;
    }
  }

  const newSub: WaitlistSubscription = {
    id: `waitlist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    data,
    orario,
    createdAt: Date.now(),
    tipo,
    sbloccoTimestamp,
    sbloccato: false,
  };

  const updated = [...current, newSub];
  saveStoredWaitlist(userId, updated);
  return newSub;
}

export function unsubscribeFromWaitlist(userId: string, data: string, orario: string): void {
  const current = getStoredWaitlist(userId);
  const updated = current.filter((w) => !(w.data === data && w.orario === orario));
  saveStoredWaitlist(userId, updated);
}

export function getStoredNotifications(userId: string): AppCalendarNotification[] {
  try {
    const raw = localStorage.getItem(`${NOTIFICATIONS_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredNotifications(userId: string, list: AppCalendarNotification[]): void {
  try {
    localStorage.setItem(`${NOTIFICATIONS_KEY_PREFIX}${userId}`, JSON.stringify(list));
  } catch {}
}

export function markNotificationAsRead(userId: string, notifId: string): void {
  const current = getStoredNotifications(userId);
  const updated = current.map((n) => (n.id === notifId ? { ...n, letto: true } : n));
  saveStoredNotifications(userId, updated);
}

export function clearNotifications(userId: string): void {
  saveStoredNotifications(userId, []);
}

/**
 * Verifica periodicamente se qualche slot in lista d'attesa è maturo per lo sblocco.
 * In tal caso genera la notifica, attiva la spia e suona il chime.
 */
export function checkAndProcessWaitlistUnlocks(
  userId: string,
  onUnlock?: (notif: AppCalendarNotification) => void
): AppCalendarNotification[] {
  if (!userId) return [];

  const waitlist = getStoredWaitlist(userId);
  if (!waitlist.length) return [];

  const now = Date.now();
  const readyToUnlock = waitlist.filter(
    (w) => !w.sbloccato && w.sbloccoTimestamp && w.sbloccoTimestamp <= now
  );

  if (!readyToUnlock.length) return [];

  const existingNotifs = getStoredNotifications(userId);
  const newNotifs: AppCalendarNotification[] = [];

  for (const item of readyToUnlock) {
    const notif: AppCalendarNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      data: item.data,
      orario: item.orario,
      messaggio: `Ti confermo che il turno di ${formatGiornoItaliano(item.data)} alle ore ${item.orario} al Landmine Lab è tornato disponibile ed è a tua disposizione. Accedi all'app e prenotalo subito!`,
      createdAt: now,
      letto: false,
      tipo: "slot_liberato",
    };
    newNotifs.push(notif);
    if (onUnlock) onUnlock(notif);
  }

  // Aggiorna waitlist rimuovendo quelli sbloccati
  const remainingWaitlist = waitlist.filter(
    (w) => !(w.sbloccoTimestamp && w.sbloccoTimestamp <= now)
  );
  saveStoredWaitlist(userId, remainingWaitlist);

  // Salva nuove notifiche
  const updatedNotifs = [...newNotifs, ...existingNotifs];
  saveStoredNotifications(userId, updatedNotifs);

  // Esegue chime audio soft
  playSoftNotificationChime();

  return newNotifs;
}

export function formatGiornoItaliano(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Crea il link WhatsApp diretto per confermare all'atleta lo slot liberato
 */
export function buildWhatsAppSlotLink(
  targetPhone: string = "",
  atletaNome: string = "Atleta",
  dataStr: string,
  orario: string
): string {
  const cleanPhone = (targetPhone || "").replace(/[^0-9]/g, "");
  const formattedDay = formatGiornoItaliano(dataStr);
  const nome = atletaNome || "Atleta";
  const text = `Ciao ${nome}! Ti confermo che il turno di ${formattedDay} alle ore ${orario} al Landmine Lab è tornato disponibile ed è a tua disposizione. Accedi all'app e prenotalo subito!`;
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}
