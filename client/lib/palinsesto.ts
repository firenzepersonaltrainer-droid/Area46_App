// ─── AREA46 TRAINING LAB - PALINSESTO & ATTIVITÀ ENGINE ──────────────────────

export interface AttivitaLab {
  id: string;
  nome: string;
  descrizione?: string;
  costo_crediti: number;
  max_partecipanti: number;
  durata_minuti: number;
  colore: string;
  attiva: boolean;
  created_at?: string;
}

export interface FasciaOraria {
  nome?: string;
  ora_inizio: string; // "09:00"
  ultimo_accesso: string; // "11:00"
  ora_fine_finestra?: string; // "12:30"
  intervallo_minuti: number; // 15
}

export interface RegolaPalinsesto {
  id: string;
  nome: string;
  id_attivita: string;
  data_inizio: string; // YYYY-MM-DD
  data_fine?: string | null; // YYYY-MM-DD
  giorni_settimana: number[]; // 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab, 0=Dom
  fasce_orarie: FasciaOraria[];
  attiva: boolean;
  created_at?: string;
}

export interface SlotGenerato {
  orario: string; // "09:00"
  id_attivita: string;
  nome_attivita: string;
  costo_crediti: number;
  max_partecipanti: number;
  colore_attivita: string;
  is_straordinario?: boolean;
}

export interface EccezioneBase {
  id?: string;
  data: string;
  orario?: string | null;
  tipo: "slot_straordinario" | "slot_bloccato" | "chiusura_giornata";
  motivo?: string;
}

export function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export const ATTIVITA_DEFAULT_LANDMINE: AttivitaLab = {
  id: "act-landmine-lab",
  nome: "Landmine Lab",
  descrizione: "Allenamento guidato al Landmine Lab con programmazione progressiva",
  costo_crediti: 1,
  max_partecipanti: 1,
  durata_minuti: 60,
  colore: "#1c00ff",
  attiva: true,
};

export const REGOLA_DEFAULT_LANDMINE: RegolaPalinsesto = {
  id: "rule-landmine-2026-2027",
  nome: "Orario Ordinario Landmine Lab",
  id_attivita: "act-landmine-lab",
  data_inizio: "2026-09-01",
  data_fine: "2027-07-31",
  giorni_settimana: [1, 3, 5], // Lunedì, Mercoledì, Venerdì
  fasce_orarie: [
    {
      nome: "Mattina",
      ora_inizio: "09:00",
      ultimo_accesso: "11:00",
      ora_fine_finestra: "12:30",
      intervallo_minuti: 15,
    },
    {
      nome: "Pomeriggio",
      ora_inizio: "17:00",
      ultimo_accesso: "19:00",
      ora_fine_finestra: "20:30",
      intervallo_minuti: 15,
    },
  ],
  attiva: true,
};

/**
 * Calcola se una data ha sessioni di palinsesto ordinario attive.
 */
export function hasGiornoPalinsesto(
  dataStr: string,
  regole: RegolaPalinsesto[] = [REGOLA_DEFAULT_LANDMINE]
): boolean {
  if (!dataStr) return false;
  const d = new Date(dataStr + "T00:00:00");
  const dayOfWeek = d.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab

  return regole.some((r) => {
    if (!r.attiva) return false;
    if (r.data_inizio && dataStr < r.data_inizio) return false;
    if (r.data_fine && dataStr > r.data_fine) return false;
    return r.giorni_settimana.includes(dayOfWeek);
  });
}

/**
 * Calcola l'elenco esatto degli slot generati per una data,
 * applicando regole di ricorrenza, slot straordinari ed escludendo le giornate chiuse.
 */
export function calcolaSlotPerGiorno(
  dataStr: string,
  regole: RegolaPalinsesto[] = [REGOLA_DEFAULT_LANDMINE],
  eccezioni: EccezioneBase[] = [],
  attivitaList: AttivitaLab[] = [ATTIVITA_DEFAULT_LANDMINE]
): {
  slots: SlotGenerato[];
  isChiuso: boolean;
  motivoChiusura?: string;
  hasPalinsesto: boolean;
} {
  if (!dataStr) {
    return { slots: [], isChiuso: false, hasPalinsesto: false };
  }

  // Verifica chiusura giornata
  const chiusura = eccezioni.find(
    (e) => e.data === dataStr && e.tipo === "chiusura_giornata"
  );
  if (chiusura) {
    return {
      slots: [],
      isChiuso: true,
      motivoChiusura: chiusura.motivo || "Lab Chiuso per Ferie / Straordinario",
      hasPalinsesto: false,
    };
  }

  const d = new Date(dataStr + "T00:00:00");
  const dayOfWeek = d.getDay();

  // Regole attive per questa data
  const activeRules = (regole.length > 0 ? regole : [REGOLA_DEFAULT_LANDMINE]).filter((r) => {
    if (!r.attiva) return false;
    if (r.data_inizio && dataStr < r.data_inizio) return false;
    if (r.data_fine && dataStr > r.data_fine) return false;
    return r.giorni_settimana.includes(dayOfWeek);
  });

  const slotsMap = new Map<string, SlotGenerato>();

  // Genera slot da fasce orarie
  for (const rule of activeRules) {
    const act =
      (attivitaList.length > 0 ? attivitaList : [ATTIVITA_DEFAULT_LANDMINE]).find(
        (a) => a.id === rule.id_attivita
      ) || ATTIVITA_DEFAULT_LANDMINE;

    for (const fascia of rule.fasce_orarie) {
      const startMin = timeToMinutes(fascia.ora_inizio);
      const endMin = timeToMinutes(fascia.ultimo_accesso);
      const step = fascia.intervallo_minuti || 15;

      if (startMin <= endMin && step > 0) {
        for (let m = startMin; m <= endMin; m += step) {
          const time = minutesToTime(m);
          if (!slotsMap.has(time)) {
            slotsMap.set(time, {
              orario: time,
              id_attivita: act.id,
              nome_attivita: act.nome,
              costo_crediti: act.costo_crediti,
              max_partecipanti: act.max_partecipanti,
              colore_attivita: act.colore,
              is_straordinario: false,
            });
          }
        }
      }
    }
  }

  // Aggiungi eventuali slot straordinari per questa data
  const extraSlots = eccezioni.filter(
    (e) => e.data === dataStr && e.tipo === "slot_straordinario" && e.orario
  );
  for (const ex of extraSlots) {
    if (ex.orario && !slotsMap.has(ex.orario)) {
      slotsMap.set(ex.orario, {
        orario: ex.orario,
        id_attivita: ATTIVITA_DEFAULT_LANDMINE.id,
        nome_attivita: ATTIVITA_DEFAULT_LANDMINE.nome,
        costo_crediti: ATTIVITA_DEFAULT_LANDMINE.costo_crediti,
        max_partecipanti: ATTIVITA_DEFAULT_LANDMINE.max_partecipanti,
        colore_attivita: ATTIVITA_DEFAULT_LANDMINE.colore,
        is_straordinario: true,
      });
    }
  }

  const sortedSlots = Array.from(slotsMap.values()).sort(
    (a, b) => timeToMinutes(a.orario) - timeToMinutes(b.orario)
  );

  return {
    slots: sortedSlots,
    isChiuso: false,
    hasPalinsesto: activeRules.length > 0 || extraSlots.length > 0,
  };
}
