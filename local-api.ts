import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const DATA_FILE = path.resolve(__dirname, "demo-data.json");

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
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

function saveData(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Errore salvataggio demo-data:", err);
  }
}

let db = loadData();

export function getCurrentUser(database: any) {
  const activeId = database.active_user_id || "usr-atleta-01";
  const user = (database.profili_utenti || []).find((u: any) => u.id === activeId);
  if (user) {
    return {
      ...user,
      name: `${user.nome} ${user.cognome}`.trim(),
    };
  }
  return {
    id: "usr-coach-01",
    email: "coach@area46.it",
    nome: "Coach",
    cognome: "Area46",
    name: "Coach Area46",
    ruolo: "manager",
    crediti: 999,
  };
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

export function handleLocalApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  db = loadData();
  const url = new URL(req.url ?? "/", "http://localhost:5173");
  const pathname = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  if (!pathname.startsWith("/app-api")) {
    return next();
  }

  res.setHeader("Content-Type", "application/json");

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    let parsedBody: any = {};
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = {};
      }
    }

    const currentUser = getCurrentUser(db);

    // ─────────────────────────────────────────────────────────────────────────
    // AUTH & PROFILI UTENTI
    // ─────────────────────────────────────────────────────────────────────────

    // GET /app-api/auth/current-user
    if (pathname === "/app-api/auth/current-user" && method === "GET") {
      return res.end(JSON.stringify(currentUser));
    }

    // POST /app-api/auth/switch-user (Per switch Coach / Atleta)
    if (pathname === "/app-api/auth/switch-user" && method === "POST") {
      const targetId = parsedBody.userId;
      const found = (db.profili_utenti || []).find(
        (u: any) => u.id === targetId || u.email === targetId
      );
      if (found) {
        db.active_user_id = found.id;
        found.data_ultimo_accesso = new Date().toISOString();
        saveData(db);
        return res.end(JSON.stringify(getCurrentUser(db)));
      }
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Utente non trovato" }));
    }

    // GET /app-api/profili (Lista atleti & coach con policy personale)
    if (pathname === "/app-api/profili" && method === "GET") {
      const now = new Date();
      const profili = (db.profili_utenti || []).map((p: any) => {
        let avviso_scadenza = false;
        let giorni_a_scadenza = null;
        if (p.data_scadenza_crediti) {
          const diffDays = Math.ceil(
            (new Date(p.data_scadenza_crediti).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
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
          tempo_cancellazione_ore: p.tempo_cancellazione_ore || 24,
          giorni_a_scadenza,
          avviso_scadenza,
          mesi_inattivita,
          avviso_inattivita,
        };
      });
      return res.end(JSON.stringify(profili));
    }

    // POST /app-api/profili (Nuovo atleta con policy cancellazione personalizzata)
    if (pathname === "/app-api/profili" && method === "POST") {
      const creditiIniziali = Number(parsedBody.crediti ?? 0);
      const nuovo = {
        id: `usr-atleta-${Date.now()}`,
        nome: parsedBody.nome || "Nuovo",
        cognome: parsedBody.cognome || "Atleta",
        email: parsedBody.email || `atleta${Date.now()}@example.com`,
        telefono: parsedBody.telefono || "",
        codice_fiscale: parsedBody.codice_fiscale || "",
        indirizzo: parsedBody.indirizzo || "",
        ruolo: "atleta",
        crediti: creditiIniziali,
        tempo_cancellazione_ore: Number(parsedBody.tempo_cancellazione_ore || 24),
        data_scadenza_crediti:
          parsedBody.data_scadenza_crediti ||
          new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
        data_ultimo_accesso: new Date().toISOString(),
        note_coach: parsedBody.note_coach || "",
        created_at: new Date().toISOString(),
      };
      db.profili_utenti = db.profili_utenti || [];
      db.profili_utenti.push(nuovo);

      if (creditiIniziali !== 0) {
        addMovimentoCrediti(db, {
          atleta_id: nuovo.id,
          email_cliente: nuovo.email,
          nome_cliente: `${nuovo.nome} ${nuovo.cognome}`,
          tipo: creditiIniziali > 0 ? "bonus_regalo" : "penalty",
          delta_crediti: creditiIniziali,
          saldo_risultante: creditiIniziali,
          motivazione: "Crediti iniziali configurati in anagrafica",
          operatore: "coach",
        });
      }

      saveData(db);
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
      if (parsedBody.data_scadenza_crediti !== undefined) {
        profilo.data_scadenza_crediti = parsedBody.data_scadenza_crediti;
      }
      if (parsedBody.note_coach !== undefined) profilo.note_coach = parsedBody.note_coach;
      profilo.updated_at = new Date().toISOString();
      saveData(db);
      return res.end(JSON.stringify(profilo));
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
      return res.end(JSON.stringify(db.configurazione_lab || {}));
    }

    if (pathname === "/app-api/lab-config" && method === "PUT") {
      db.configurazione_lab = {
        ...(db.configurazione_lab || {}),
        ...parsedBody,
      };
      saveData(db);
      return res.end(JSON.stringify(db.configurazione_lab));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRENOTAZIONI SLOT 1:1
    // ─────────────────────────────────────────────────────────────────────────

    // GET /app-api/prenotazioni
    if (pathname === "/app-api/prenotazioni" && method === "GET") {
      const dataFilter = url.searchParams.get("data");
      const emailFilter = url.searchParams.get("email");
      let prenotazioni = db.prenotazioni_slot || [];
      if (dataFilter) {
        prenotazioni = prenotazioni.filter((p: any) => p.data === dataFilter);
      }
      if (emailFilter) {
        prenotazioni = prenotazioni.filter((p: any) => p.email_cliente === emailFilter);
      }
      return res.end(JSON.stringify(prenotazioni));
    }

    // POST /app-api/prenotazioni
    if (pathname === "/app-api/prenotazioni" && method === "POST") {
      const atletaId = parsedBody.atleta_id || currentUser.id;
      const atleta =
        (db.profili_utenti || []).find((p: any) => p.id === atletaId || p.email === atletaId) ||
        currentUser;
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
            error: `Lo slot del ${dataSlot} alle ${orarioSlot} è già stato prenotato da un altro atleta. Capienza massima 1:1 raggiunta.`,
          })
        );
      }

      // 2. Controllo Crediti e Scadenza
      const isManager = currentUser.ruolo === "manager";
      if (!isManager) {
        if ((atleta.crediti ?? 0) <= 0) {
          res.statusCode = 403;
          return res.end(
            JSON.stringify({
              error:
                "Crediti esauriti o saldo a debito. Acquista un nuovo carnet per procedere con la prenotazione.",
              motivo: "crediti_insufficienti",
              crediti: atleta.crediti,
            })
          );
        }

        if (atleta.data_scadenza_crediti) {
          const scadenza = new Date(atleta.data_scadenza_crediti);
          const dataPrenotazione = new Date(dataSlot);
          if (dataPrenotazione > scadenza) {
            res.statusCode = 403;
            return res.end(
              JSON.stringify({
                error: `Il tuo carnet crediti è scaduto il ${atleta.data_scadenza_crediti}. Rinnova il pacchetto per prenotare questa data.`,
                motivo: "crediti_scaduti",
                scadenza: atleta.data_scadenza_crediti,
              })
            );
          }
        }
      }

      // 3. Scalamento del credito (1 credito = 1 sessione)
      atleta.crediti = (atleta.crediti ?? 0) - 1;
      atleta.data_ultimo_accesso = new Date().toISOString();

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
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: nuovaPrenotazione.nome_cliente,
        tipo: "prenotazione_slot",
        delta_crediti: -1,
        saldo_risultante: atleta.crediti,
        motivazione: `Prenotazione slot del ${dataSlot} ore ${orarioSlot}`,
        operatore: isManager ? "coach" : "atleta",
      });

      saveData(db);

      res.statusCode = 201;
      return res.end(
        JSON.stringify({
          ok: true,
          prenotazione: nuovaPrenotazione,
          crediti_rimanenti: atleta.crediti,
          messaggio: `Slot confermato per il ${dataSlot} alle ${orarioSlot}. Ti aspettiamo al Lab!`,
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

      // Policy personalizzata dell'atleta (o fallback configurazione lab)
      const oreLimite =
        atleta?.tempo_cancellazione_ore || db.configurazione_lab?.tempo_cancellazione_ore || 24;

      const slotTimestamp = new Date(`${bk.data}T${bk.orario}:00`).getTime();
      const nowTimestamp = Date.now();
      const orePreavviso = (slotTimestamp - nowTimestamp) / (1000 * 60 * 60);

      let rimborsato = false;
      let statoFinale = "cancellata_tardiva";
      let messaggio = "";

      if (orePreavviso >= oreLimite || isManager) {
        rimborsato = true;
        statoFinale = "cancellata_in_tempo";
        if (bk.credito_scalato && atleta) {
          atleta.crediti = (atleta.crediti ?? 0) + 1;

          addMovimentoCrediti(db, {
            atleta_id: atleta.id,
            email_cliente: atleta.email,
            nome_cliente: `${atleta.nome} ${atleta.cognome}`,
            tipo: "rimborso_cancellazione",
            delta_crediti: 1,
            saldo_risultante: atleta.crediti,
            motivazione: `Rimborso per cancellazione in tempo slot del ${bk.data} ${bk.orario}`,
            operatore: isManager ? "coach" : "atleta",
          });
        }
        messaggio = `Prenotazione annullata con successo. Preavviso rispettato (${Math.max(
          0,
          Math.round(orePreavviso)
        )}h rimaste su ${oreLimite}h richieste). 1 credito è stato rimborsato al tuo wallet.`;
      } else {
        rimborsato = false;
        statoFinale = "cancellata_tardiva";
        if (atleta) {
          addMovimentoCrediti(db, {
            atleta_id: atleta.id,
            email_cliente: atleta.email,
            nome_cliente: `${atleta.nome} ${atleta.cognome}`,
            tipo: "penalty",
            delta_crediti: 0,
            saldo_risultante: atleta.crediti,
            motivazione: `Cancellazione tardiva slot del ${bk.data} ${bk.orario} (preavviso < ${oreLimite}h: credito trattenuto)`,
            operatore: "sistema",
          });
        }
        messaggio = `Prenotazione annullata oltre il termine di tolleranza di ${oreLimite} ore (preavviso di sole ${Math.max(
          0,
          Math.round(orePreavviso)
        )}h). In accordo con il regolamento di Area46 Lab, il credito della seduta viene trattenuto.`;
      }

      bk.stato = statoFinale;
      bk.cancellato_il = new Date().toISOString();
      saveData(db);

      return res.end(
        JSON.stringify({
          ok: true,
          rimborsato,
          stato: statoFinale,
          ore_preavviso: Math.round(orePreavviso * 10) / 10,
          ore_limite: oreLimite,
          crediti_attuali: atleta?.crediti,
          messaggio,
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
      return res.end(JSON.stringify(db.transazioni_pagamenti || []));
    }

    // POST /app-api/transazioni/checkout
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
  });
}
