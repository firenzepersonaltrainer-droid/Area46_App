import { Hono } from "hono";
import { neon, types } from "@neondatabase/serverless";
import crypto from "node:crypto";
import { auth } from "./auth";

types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));

type Env = { DATABASE_URL: string };

const app = new Hono<{ Bindings: Env }>();

// ─── Allenamenti ────────────────────────────────────────────────────────────

// Lista livelli disponibili — ordinati per ordine personalizzato
app.get("/app-api/livelli", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const rows = await sql`
    SELECT livelli.livello
    FROM (
      SELECT DISTINCT livello FROM allenamenti
    ) AS livelli
    LEFT JOIN ordine_livelli ol ON ol.nome_livello = livelli.livello
    ORDER BY
      COALESCE(ol.numero_ordine, 999) ASC,
      livelli.livello ASC
  `;
  return c.json(rows.map((r) => r.livello));
});

// Lista giorni unici per livello.
// Restituisce: giorno (testo originale), settimana, giorno_num (intero).
app.get("/app-api/allenamenti", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const livello = c.req.query("livello");

  const rows = livello
    ? await sql`
        SELECT
          MIN(giorno) AS giorno,
          COALESCE(NULLIF(settimana, ''), 'Ciclo unico') AS settimana,
          (regexp_match(MIN(giorno), '[0-9]+'))[1]::integer AS giorno_num
        FROM allenamenti
        WHERE livello = ${livello}
          AND giorno IS NOT NULL
          AND (regexp_match(giorno, '[0-9]+'))[1] IS NOT NULL
        GROUP BY
          COALESCE(NULLIF(settimana, ''), 'Ciclo unico'),
          (regexp_match(giorno, '[0-9]+'))[1]::integer
        ORDER BY
          COALESCE(NULLIF(settimana, ''), 'Ciclo unico') ASC,
          (regexp_match(giorno, '[0-9]+'))[1]::integer ASC
      `
    : await sql`
        SELECT
          livello,
          MIN(giorno) AS giorno,
          COALESCE(NULLIF(settimana, ''), 'Ciclo unico') AS settimana,
          (regexp_match(giorno, '[0-9]+'))[1]::integer AS giorno_num
        FROM allenamenti
        WHERE giorno IS NOT NULL
          AND (regexp_match(giorno, '[0-9]+'))[1] IS NOT NULL
        GROUP BY
          livello,
          COALESCE(NULLIF(settimana, ''), 'Ciclo unico'),
          (regexp_match(giorno, '[0-9]+'))[1]::integer
        ORDER BY
          livello ASC,
          COALESCE(NULLIF(settimana, ''), 'Ciclo unico') ASC,
          (regexp_match(giorno, '[0-9]+'))[1]::integer ASC
      `;
  return c.json(rows);
});

// Approfondimenti ed extra: lista video (giorno = NULL) con data_pubblicazione
app.get("/app-api/approfondimenti", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const rows = await sql`
    SELECT nome_esercizio, note_tecniche, link_video, data_pubblicazione
    FROM allenamenti
    WHERE livello = 'Approfondimenti ed extra'
    ORDER BY
      data_pubblicazione DESC NULLS LAST,
      id ASC
  `;
  return c.json(rows);
});

// Dettaglio giorno: lista esercizi in sequenza
app.get("/app-api/allenamenti/:livello/:giorno", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const { livello, giorno } = c.req.param();
  const giornoInt = parseInt(giorno, 10);
  if (isNaN(giornoInt)) return c.json([]);
  const rows = await sql`
    SELECT
      a.id,
      a.livello,
      a.giorno,
      a.settimana,
      a.sequenza,
      a.id_esercizio,
      a.nome_esercizio,
      a.parametri,
      a.recupero,
      a.minutaggio_blocco,
      a.note_tecniche,
      COALESCE(NULLIF(a.link_video, ''), de.link_video) AS link_video
    FROM allenamenti a
    LEFT JOIN database_esercizi de
      ON LPAD(a.id_esercizio, 3, '0') = de.id_esercizio
    WHERE a.livello = ${livello}
      AND (regexp_match(a.giorno, '[0-9]+'))[1]::integer = ${giornoInt}
    ORDER BY
      NULLIF(regexp_replace(a.sequenza, '[^0-9]', '', 'g'), '')::integer NULLS LAST,
      lower(a.sequenza)
  `;
  return c.json(rows);
});

// ─── Dettaglio Esercizio ─────────────────────────────────────────────────────

app.get("/app-api/esercizi/:idEsercizio", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const { idEsercizio } = c.req.param();
  const rows =
    await sql`SELECT * FROM database_esercizi WHERE id_esercizio = LPAD(${idEsercizio}, 3, '0')`;
  return c.json(rows[0] ?? null);
});

// ─── Libreria Esercizi ───────────────────────────────────────────────────────

app.get("/app-api/libreria", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const attrezzo = c.req.query("attrezzo");
  const q = c.req.query("q");

  const rows =
    attrezzo && q
      ? await sql`SELECT * FROM database_esercizi WHERE attrezzo = ${attrezzo} AND nome_reale ILIKE ${"%" + q + "%"} ORDER BY nome_reale`
      : attrezzo
        ? await sql`SELECT * FROM database_esercizi WHERE attrezzo = ${attrezzo} ORDER BY nome_reale`
        : q
          ? await sql`SELECT * FROM database_esercizi WHERE nome_reale ILIKE ${"%" + q + "%"} ORDER BY nome_reale`
          : await sql`SELECT * FROM database_esercizi ORDER BY nome_reale`;

  return c.json(rows);
});

app.get("/app-api/libreria/attrezzi", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const rows =
    await sql`SELECT DISTINCT attrezzo FROM database_esercizi WHERE attrezzo IS NOT NULL ORDER BY attrezzo`;
  return c.json(rows.map((r) => r.attrezzo));
});

// ─── Stato Allenamenti ──────────────────────────────────────────────────────

app.get("/app-api/stati", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json([]);
  const rows = await sql`
    SELECT livello, giorno, stato, updated_at
    FROM stato_allenamenti
    WHERE email_cliente = ${user.email}
    ORDER BY livello, giorno
  `;
  return c.json(rows);
});

app.post("/app-api/stati/reset", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { livello, giorno } = await c.req.json();
  const giornoInt = parseInt(String(giorno), 10);

  const esercizi = await sql`
    SELECT DISTINCT id_esercizio
    FROM allenamenti
    WHERE livello = ${livello} AND giorno = ${giornoInt}
  `;
  const idEsercizi = esercizi.map((r) => r.id_esercizio as string);

  let eliminati = 0;
  if (idEsercizi.length > 0) {
    const result = await sql`
      DELETE FROM diario_utente
      WHERE email_cliente = ${user.email}
        AND id_esercizio = ANY(${idEsercizi})
      RETURNING id
    `;
    eliminati = result.length;
  }

  await sql`
    INSERT INTO stato_allenamenti (email_cliente, livello, giorno, stato, updated_at)
    VALUES (${user.email}, ${livello}, ${giorno}, 'non_iniziato', NOW())
    ON CONFLICT (email_cliente, livello, giorno)
    DO UPDATE SET stato = 'non_iniziato', updated_at = NOW()
  `;

  return c.json({ ok: true, eliminati });
});

app.get("/app-api/stati/reset-preview", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json({ count: 0 });
  const livello = c.req.query("livello") ?? "";
  const giornoInt = parseInt(c.req.query("giorno") ?? "0", 10);

  const esercizi = await sql`
    SELECT DISTINCT id_esercizio
    FROM allenamenti
    WHERE livello = ${livello} AND giorno = ${giornoInt}
  `;
  const idEsercizi = esercizi.map((r) => r.id_esercizio as string);

  if (idEsercizi.length === 0) return c.json({ count: 0 });

  const [row] = await sql`
    SELECT COUNT(*) AS count
    FROM diario_utente
    WHERE email_cliente = ${user.email}
      AND id_esercizio = ANY(${idEsercizi})
  `;
  return c.json({ count: Number(row.count) });
});

app.post("/app-api/stati", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { livello, giorno, stato } = await c.req.json();
  if (!["non_iniziato", "in_corso", "completato"].includes(stato))
    return c.json({ error: "Stato non valido" }, 400);
  const [row] = await sql`
    INSERT INTO stato_allenamenti (email_cliente, livello, giorno, stato, updated_at)
    VALUES (${user.email}, ${livello}, ${giorno}, ${stato}, NOW())
    ON CONFLICT (email_cliente, livello, giorno)
    DO UPDATE SET stato = EXCLUDED.stato, updated_at = NOW()
    RETURNING *
  `;
  return c.json(row, 200);
});

app.post("/app-api/stati/batch", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { updates, email_cliente } = await c.req.json();
  const targetEmail = (user.ruolo === "manager" && email_cliente) ? email_cliente : user.email;

  if (Array.isArray(updates) && updates.length > 0) {
    for (const item of updates) {
      if (!["non_iniziato", "in_corso", "completato"].includes(item.stato)) continue;
      await sql`
        INSERT INTO stato_allenamenti (email_cliente, livello, giorno, stato, updated_at)
        VALUES (${targetEmail}, ${item.livello}, ${item.giorno}, ${item.stato}, NOW())
        ON CONFLICT (email_cliente, livello, giorno)
        DO UPDATE SET stato = EXCLUDED.stato, updated_at = NOW()
      `;
    }
  }
  return c.json({ ok: true, count: updates?.length || 0 }, 200);
});

// ─── Diario Utente ───────────────────────────────────────────────────────────

app.get("/app-api/diario", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json([]);
  const rows = await sql`
    SELECT * FROM diario_utente
    WHERE email_cliente = ${user.email}
    ORDER BY data_ora DESC
  `;
  return c.json(rows);
});

app.get("/app-api/diario/esercizio/:idEsercizio", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json([]);
  const { idEsercizio } = c.req.param();
  const rows = await sql`
    SELECT * FROM diario_utente
    WHERE email_cliente = ${user.email}
      AND id_esercizio = ${idEsercizio}
    ORDER BY data_ora DESC
  `;
  return c.json(rows);
});

app.post("/app-api/diario", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  const {
    id_esercizio,
    nome_esercizio,
    carico_kg,
    feedback,
    ripetizioni,
    serie,
    sets_json,
    rpe_json,
  } = await c.req.json();

  const email = user?.email ?? null;
  const setsValue = sets_json ? JSON.stringify(sets_json) : null;
  const rpeValue = rpe_json ? JSON.stringify(rpe_json) : null;

  const [row] = await sql`
    INSERT INTO diario_utente
      (email_cliente, id_esercizio, nome_esercizio, carico_kg, feedback, ripetizioni, serie, sets_json, rpe_json)
    VALUES
      (${email}, ${id_esercizio}, ${nome_esercizio},
       ${setsValue ? null : (carico_kg ?? null)},
       ${feedback ?? null},
       ${setsValue ? null : (ripetizioni ?? null)},
       ${setsValue ? null : (serie ?? null)},
       ${setsValue},
       ${rpeValue})
    RETURNING *
  `;
  return c.json(row, 201);
});

app.patch("/app-api/diario/:id", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"), 10);
  const { sets_json, feedback } = await c.req.json();
  const setsValue = sets_json ? JSON.stringify(sets_json) : null;
  const rpeArr = sets_json ? sets_json.map((s: any) => s.rpe ?? null) : null;
  const rpeValue =
    rpeArr && rpeArr.some((r: any) => r != null)
      ? JSON.stringify(rpeArr)
      : null;

  const rows = await sql`
    UPDATE diario_utente
    SET
      sets_json = ${setsValue},
      rpe_json  = ${rpeValue},
      feedback  = ${feedback ?? null}
    WHERE id = ${id}
      AND email_cliente = ${user.email}
    RETURNING *
  `;
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json(rows[0]);
});

app.delete("/app-api/diario/:id", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  const id = c.req.param("id");
  await sql`
    DELETE FROM diario_utente
    WHERE id = ${parseInt(id)} AND email_cliente IS NOT DISTINCT FROM ${user?.email ?? null}
  `;
  return c.json({ ok: true });
});

// ─── Preferenze Utente ─────────────────────────────────────────────────────

app.get("/app-api/preferenze", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json({ memoria_livello: null });
  const rows = await sql`
    SELECT memoria_livello FROM preferenze_utente
    WHERE email_cliente = ${user.email}
    LIMIT 1
  `;
  return c.json({ memoria_livello: rows[0]?.memoria_livello ?? null });
});

app.post("/app-api/preferenze/livello", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { livello } = await c.req.json();
  await sql`
    INSERT INTO preferenze_utente (email_cliente, memoria_livello, updated_at)
    VALUES (${user.email}, ${livello ?? null}, NOW())
    ON CONFLICT (email_cliente)
    DO UPDATE SET memoria_livello = EXCLUDED.memoria_livello, updated_at = NOW()
  `;
  return c.json({ ok: true });
});

// ─── Tonnellaggio ────────────────────────────────────────────────────────────

app.get("/app-api/tonnellaggio", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) return c.json([]);

  const rows = await sql`
    SELECT
      id,
      data_ora,
      nome_esercizio,
      carico_kg,
      ripetizioni,
      serie,
      sets_json,
      CASE
        WHEN sets_json IS NOT NULL
        THEN (
          SELECT COALESCE(SUM((s->>'carico_kg')::numeric * (s->>'ripetizioni')::numeric), 0)
          FROM jsonb_array_elements(sets_json) AS s
          WHERE s->>'carico_kg' IS NOT NULL AND s->>'ripetizioni' IS NOT NULL
        )
        WHEN carico_kg IS NOT NULL AND ripetizioni IS NOT NULL AND serie IS NOT NULL
        THEN carico_kg * ripetizioni * serie
        ELSE 0
      END AS tonnellaggio_voce
    FROM diario_utente
    WHERE email_cliente = ${user.email}
    ORDER BY data_ora ASC
  `;
  return c.json(rows);
});

// ─── Profili & Auth ─────────────────────────────────────────────────────────

app.get("/app-api/auth/current-user", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const user = auth(c).user();
  if (!user) {
    return c.json(null);
  }
  const rows = await sql`SELECT * FROM profili_utenti WHERE email = ${user.email} LIMIT 1`;
  if (rows.length > 0) {
    const p = rows[0];
    let crediti = p.crediti;
    let data_scadenza_crediti = p.data_scadenza_crediti;
    let is_shared_wallet = false;
    let shared_master_nome: string | undefined = undefined;

    if (p.shared_wallet_with) {
      const masterRows = await sql`
        SELECT * FROM profili_utenti 
        WHERE id = ${p.shared_wallet_with} OR LOWER(email) = LOWER(${p.shared_wallet_with}) 
        LIMIT 1
      `;
      if (masterRows.length > 0) {
        const master = masterRows[0];
        crediti = master.crediti;
        data_scadenza_crediti = master.data_scadenza_crediti;
        is_shared_wallet = true;
        shared_master_nome = `${master.nome} ${master.cognome}`.trim();
      }
    }

    const partnerRows = await sql`
      SELECT nome, cognome FROM profili_utenti 
      WHERE shared_wallet_with = ${p.id} OR LOWER(shared_wallet_with) = LOWER(${p.email})
    `;

    return c.json({
      ...p,
      name: `${p.nome} ${p.cognome}`.trim(),
      crediti,
      data_scadenza_crediti,
      is_shared_wallet,
      shared_master_nome,
      is_wallet_master: partnerRows.length > 0,
      shared_partners_count: partnerRows.length,
      shared_partner_names: partnerRows.map((r: any) => `${r.nome} ${r.cognome}`.trim()),
    });
  }
  return c.json(user);
});

app.post("/app-api/auth/logout", async (c) => {
  c.header("Set-Cookie", "area46_user_id=; Path=/; Max-Age=0; SameSite=Lax");
  return c.json({ ok: true, messaggio: "Disconnessione effettuata." });
});

app.post("/app-api/auth/login-email", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json<{ email: string; code?: string; requestOtpOnly?: boolean }>();
  const email = (body.email || "").trim().toLowerCase();
  const requestOtpOnly = !!body.requestOtpOnly;

  if (!email || !email.includes("@")) {
    return c.json({ error: "Inserisci un indirizzo email valido." }, 400);
  }

  if (requestOtpOnly) {
    return c.json({
      ok: true,
      messaggio: `Codice OTP generato per ${email}`,
      demoOtp: "464646",
    });
  }

  const rows = await sql`SELECT * FROM profili_utenti WHERE LOWER(email) = ${email} LIMIT 1`;
  if (rows.length > 0) {
    const user = rows[0];
    await sql`UPDATE profili_utenti SET data_ultimo_accesso = NOW() WHERE id = ${user.id}`;
    c.header("Set-Cookie", `area46_user_id=${encodeURIComponent(user.id)}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return c.json({ ok: true, user: { ...user, name: `${user.nome} ${user.cognome}`.trim() } });
  }

  const id = `usr-${Date.now()}`;
  const nome = email.split("@")[0];
  const ruolo = email === "firenzepersonaltrainer@gmail.com" ? "manager" : "atleta";
  const inserted = await sql`
    INSERT INTO profili_utenti (
      id, email, nome, cognome, ruolo, crediti, tempo_cancellazione_ore, tipo_abbonamento, data_ultimo_accesso
    ) VALUES (
      ${id}, ${email}, ${nome}, '', ${ruolo}, 0, 24, 'standard', NOW()
    )
    RETURNING *
  `;
  const newUser = inserted[0];
  c.header("Set-Cookie", `area46_user_id=${encodeURIComponent(newUser.id)}; Path=/; Max-Age=31536000; SameSite=Lax`);
  return c.json({ ok: true, user: { ...newUser, name: newUser.nome }, isNew: true });
});

app.post("/app-api/auth/oauth-login", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json<{ provider: string; email: string; name?: string }>();
  const provider = body.provider || "google";
  const email = (body.email || "").trim().toLowerCase();
  const name = body.name || "";

  if (!email || !email.includes("@")) {
    return c.json({ error: "Email account social non valida." }, 400);
  }

  const rows = await sql`SELECT * FROM profili_utenti WHERE LOWER(email) = ${email} LIMIT 1`;
  if (rows.length > 0) {
    const user = rows[0];
    await sql`UPDATE profili_utenti SET data_ultimo_accesso = NOW() WHERE id = ${user.id}`;
    c.header("Set-Cookie", `area46_user_id=${encodeURIComponent(user.id)}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return c.json({ ok: true, user: { ...user, name: `${user.nome} ${user.cognome}`.trim() } });
  }

  const id = `usr-${provider}-${Date.now()}`;
  const parts = name.trim().split(" ");
  const nome = parts[0] || email.split("@")[0];
  const cognome = parts.slice(1).join(" ") || "";
  const ruolo = email === "firenzepersonaltrainer@gmail.com" ? "manager" : "atleta";
  const inserted = await sql`
    INSERT INTO profili_utenti (
      id, email, nome, cognome, ruolo, crediti, tempo_cancellazione_ore, tipo_abbonamento, data_ultimo_accesso
    ) VALUES (
      ${id}, ${email}, ${nome}, ${cognome}, ${ruolo}, 0, 24, 'standard', NOW()
    )
    RETURNING *
  `;
  const newUser = inserted[0];
  c.header("Set-Cookie", `area46_user_id=${encodeURIComponent(newUser.id)}; Path=/; Max-Age=31536000; SameSite=Lax`);
  return c.json({ ok: true, user: { ...newUser, name: `${newUser.nome} ${newUser.cognome}`.trim() }, isNew: true });
});

app.post("/app-api/auth/switch-user", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json<{ userId: string }>();
  const rows = await sql`
    SELECT * FROM profili_utenti 
    WHERE id = ${body.userId} OR email = ${body.userId}
    LIMIT 1
  `;
  if (rows.length === 0) return c.json({ error: "Utente non trovato" }, 404);
  const p = rows[0];
  c.header("Set-Cookie", `area46_user_id=${encodeURIComponent(p.id)}; Path=/; Max-Age=31536000; SameSite=Lax`);
  return c.json({ ...p, name: `${p.nome} ${p.cognome}`.trim() });
});

app.get("/app-api/profili", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const rows = await sql`
    SELECT 
      *,
      CASE 
        WHEN data_scadenza_crediti IS NOT NULL 
        THEN (data_scadenza_crediti - CURRENT_DATE)
        ELSE NULL
      END AS giorni_a_scadenza,
      CASE 
        WHEN data_scadenza_crediti IS NOT NULL AND (data_scadenza_crediti - CURRENT_DATE) <= 7 
        THEN true 
        ELSE false 
      END AS avviso_scadenza
    FROM profili_utenti
    ORDER BY ruolo DESC, nome ASC
  `;

  const mapped = rows.map((p: any) => {
    let walletOwner = p;
    if (p.shared_wallet_with) {
      const master = rows.find(
        (m: any) =>
          m.id === p.shared_wallet_with ||
          m.email?.toLowerCase() === p.shared_wallet_with?.toLowerCase()
      );
      if (master) walletOwner = master;
    }
    const isShared = walletOwner.id !== p.id;
    const partners = rows.filter(
      (o: any) =>
        o.id !== p.id &&
        (o.shared_wallet_with === p.id ||
          o.shared_wallet_with?.toLowerCase() === p.email?.toLowerCase())
    );

    return {
      ...p,
      crediti: isShared ? walletOwner.crediti : p.crediti,
      data_scadenza_crediti: isShared ? walletOwner.data_scadenza_crediti : p.data_scadenza_crediti,
      shared_wallet_with: p.shared_wallet_with || null,
      is_shared_wallet: isShared,
      shared_master_nome: isShared ? `${walletOwner.nome} ${walletOwner.cognome}`.trim() : undefined,
      is_wallet_master: partners.length > 0,
      shared_partners_count: partners.length,
      shared_partner_names: partners.map((x: any) => `${x.nome} ${x.cognome}`.trim()),
    };
  });

  return c.json(mapped);
});

app.post("/app-api/profili", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json();
  const id = body.id || `usr-atleta-${Date.now()}`;
  const rows = await sql`
    INSERT INTO profili_utenti (
      id, email, nome, cognome, telefono, codice_fiscale, indirizzo, ruolo, crediti, tempo_cancellazione_ore, data_scadenza_crediti, note_coach, shared_wallet_with, tipo_abbonamento, stato_iscrizione
    ) VALUES (
      ${id}, ${body.email}, ${body.nome}, ${body.cognome}, ${body.telefono || null}, ${body.codice_fiscale || null},
      ${body.indirizzo || null}, 'atleta', ${Number(body.crediti || 0)}, ${Number(body.tempo_cancellazione_ore || 24)}, ${body.data_scadenza_crediti || null}, ${body.note_coach || null}, ${body.shared_wallet_with || null},
      ${body.tipo_abbonamento || 'standard'}, ${body.stato_iscrizione || 'attivo'}
    )
    ON CONFLICT (email) DO UPDATE SET
      nome = EXCLUDED.nome,
      cognome = EXCLUDED.cognome,
      telefono = COALESCE(EXCLUDED.telefono, profili_utenti.telefono),
      codice_fiscale = COALESCE(EXCLUDED.codice_fiscale, profili_utenti.codice_fiscale),
      indirizzo = COALESCE(EXCLUDED.indirizzo, profili_utenti.indirizzo),
      crediti = EXCLUDED.crediti,
      tempo_cancellazione_ore = EXCLUDED.tempo_cancellazione_ore,
      data_scadenza_crediti = COALESCE(EXCLUDED.data_scadenza_crediti, profili_utenti.data_scadenza_crediti),
      note_coach = COALESCE(EXCLUDED.note_coach, profili_utenti.note_coach),
      shared_wallet_with = EXCLUDED.shared_wallet_with,
      tipo_abbonamento = COALESCE(EXCLUDED.tipo_abbonamento, profili_utenti.tipo_abbonamento),
      stato_iscrizione = COALESCE(EXCLUDED.stato_iscrizione, profili_utenti.stato_iscrizione),
      updated_at = NOW()
    RETURNING *
  `;
  return c.json(rows[0], 201);
});

app.put("/app-api/profili/:id", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const id = c.req.param("id");
  const body = await c.req.json();
  const rows = await sql`
    UPDATE profili_utenti
    SET
      nome = COALESCE(${body.nome}, nome),
      cognome = COALESCE(${body.cognome}, cognome),
      email = COALESCE(${body.email}, email),
      telefono = COALESCE(${body.telefono}, telefono),
      codice_fiscale = COALESCE(${body.codice_fiscale}, codice_fiscale),
      indirizzo = COALESCE(${body.indirizzo}, indirizzo),
      crediti = COALESCE(${body.crediti !== undefined ? Number(body.crediti) : null}, crediti),
      tempo_cancellazione_ore = COALESCE(${body.tempo_cancellazione_ore !== undefined ? Number(body.tempo_cancellazione_ore) : null}, tempo_cancellazione_ore),
      data_scadenza_crediti = COALESCE(${body.data_scadenza_crediti}, data_scadenza_crediti),
      note_coach = COALESCE(${body.note_coach}, note_coach),
      shared_wallet_with = CASE WHEN ${body.shared_wallet_with !== undefined} THEN ${body.shared_wallet_with || null} ELSE shared_wallet_with END,
      tipo_abbonamento = COALESCE(${body.tipo_abbonamento}, tipo_abbonamento),
      stato_iscrizione = COALESCE(${body.stato_iscrizione}, stato_iscrizione),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  if (rows.length === 0) return c.json({ error: "Profilo non trovato" }, 404);
  return c.json(rows[0]);
});

app.delete("/app-api/atleti/:id", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const id = c.req.param("id");
  try {
    const prof = await sql`SELECT email FROM profili_utenti WHERE id = ${id}`;
    const email = prof[0]?.email || "";
    // NOTA: transazioni_pagamenti NON viene toccato per preservare il registro fiscale contabile
    await sql`DELETE FROM prenotazioni_slot WHERE atleta_id = ${id} OR email_cliente = ${email}`;
    await sql`DELETE FROM movimenti_crediti WHERE atleta_id = ${id} OR email_cliente = ${email}`;
    await sql`DELETE FROM diario_utente WHERE email_cliente = ${email}`;
    await sql`DELETE FROM stato_allenamenti WHERE email_cliente = ${email}`;
    await sql`DELETE FROM preferenze_utente WHERE email = ${email}`;
    await sql`DELETE FROM profili_utenti WHERE id = ${id} OR email = ${email}`;
    return c.json({ success: true, message: "Atleta eliminato dall'anagrafica. Dati fiscali preservati." });
  } catch (err: any) {
    return c.json({ error: err.message || "Errore durante eliminazione" }, 500);
  }
});

app.delete("/app-api/profili/:id", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const id = c.req.param("id");
  try {
    const prof = await sql`SELECT email FROM profili_utenti WHERE id = ${id}`;
    const email = prof[0]?.email || "";
    // NOTA: transazioni_pagamenti NON viene toccato per preservare il registro fiscale contabile
    await sql`DELETE FROM prenotazioni_slot WHERE atleta_id = ${id} OR email_cliente = ${email}`;
    await sql`DELETE FROM movimenti_crediti WHERE atleta_id = ${id} OR email_cliente = ${email}`;
    await sql`DELETE FROM diario_utente WHERE email_cliente = ${email}`;
    await sql`DELETE FROM stato_allenamenti WHERE email_cliente = ${email}`;
    await sql`DELETE FROM preferenze_utente WHERE email = ${email}`;
    await sql`DELETE FROM profili_utenti WHERE id = ${id} OR email = ${email}`;
    return c.json({ success: true, message: "Profilo eliminato dall'anagrafica. Dati fiscali preservati." });
  } catch (err: any) {
    return c.json({ error: err.message || "Errore durante eliminazione" }, 500);
  }
});

app.delete("/app-api/transazioni/:id", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const id = c.req.param("id");
  try {
    await sql`DELETE FROM transazioni_pagamenti WHERE id = ${id} OR codice_transazione = ${id}`;
    return c.json({ success: true, message: "Movimento fiscale eliminato con successo. Registro incassi ricalcolato." });
  } catch (err: any) {
    return c.json({ error: err.message || "Errore durante eliminazione movimento fiscale" }, 500);
  }
});

app.post("/app-api/profili/:id/modifica-crediti", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const id = c.req.param("id");
  const body = await c.req.json<{ crediti?: number; delta?: number; data_scadenza_crediti?: string }>();

  let rows;
  if (body.crediti !== undefined) {
    rows = await sql`
      UPDATE profili_utenti 
      SET crediti = ${Number(body.crediti)}, 
          data_scadenza_crediti = COALESCE(${body.data_scadenza_crediti || null}, data_scadenza_crediti),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
  } else if (body.delta !== undefined) {
    rows = await sql`
      UPDATE profili_utenti 
      SET crediti = crediti + ${Number(body.delta)}, 
          data_scadenza_crediti = COALESCE(${body.data_scadenza_crediti || null}, data_scadenza_crediti),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
  }
  if (!rows || rows.length === 0) return c.json({ error: "Profilo non trovato" }, 404);
  return c.json(rows[0]);
});

app.get("/app-api/atleti/:id/anteprima-dismissione", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const atletaId = c.req.param("id");
  const atleti = await sql`SELECT * FROM profili_utenti WHERE id = ${atletaId} LIMIT 1`;
  if (atleti.length === 0) return c.json({ error: "Atleta non trovato" }, 404);
  const atleta = atleti[0];

  const tipoAbb = atleta.tipo_abbonamento || "standard";
  const isContinuativo = tipoAbb.startsWith("lab_continuativo");
  const tariffaPiena = tipoAbb === "lab_continuativo_2x" ? 35.0 : 33.25;

  const seduteSvolte = await sql`
    SELECT COUNT(*)::int as count FROM prenotazioni_slot 
    WHERE (atleta_id = ${atleta.id} OR email_cliente = ${atleta.email})
      AND stato = 'confermata'
      AND (data < CURRENT_DATE OR (data = CURRENT_DATE AND orario <= TO_CHAR(NOW(), 'HH24:MI')))
  `;
  const seduteSvolteCount = Number(seduteSvolte[0]?.count || 0);

  const prenotazioniFuture = await sql`
    SELECT * FROM prenotazioni_slot 
    WHERE (atleta_id = ${atleta.id} OR email_cliente = ${atleta.email})
      AND stato = 'confermata'
      AND (data > CURRENT_DATE OR (data = CURRENT_DATE AND orario > TO_CHAR(NOW(), 'HH24:MI')))
    ORDER BY data ASC, orario ASC
  `;

  const txRows = await sql`
    SELECT * FROM transazioni_pagamenti 
    WHERE (atleta_id = ${atleta.id} OR email_cliente = ${atleta.email})
      AND stato = 'completato'
    ORDER BY created_at DESC LIMIT 1
  `;
  const totaleGiaVersato = txRows.length > 0 ? Number(txRows[0].importo_euro) : (isContinuativo ? (tipoAbb === "lab_continuativo_2x" ? 250 : 359) : 0);
  const penaleStandard = isContinuativo ? 50.0 : 0.0;
  const valoreSedutePieno = isContinuativo ? Math.round(seduteSvolteCount * tariffaPiena * 100) / 100 : 0;
  const totaleDovuto = isContinuativo ? Math.round((valoreSedutePieno + penaleStandard) * 100) / 100 : 0;
  const totaleDaAddebitare = Math.max(0, Math.round((totaleDovuto - totaleGiaVersato) * 100) / 100);

  const cfgRows = await sql`SELECT notifica_email FROM configurazione_lab WHERE id = 1 LIMIT 1`;
  const emailCoach = cfgRows[0]?.notifica_email || "firenzepersonaltrainer@gmail.com";

  return c.json({
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
  });
});

app.post("/app-api/atleti/:id/dismissione-anticipata", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const atletaId = c.req.param("id");
  const body = await c.req.json();
  const atleti = await sql`SELECT * FROM profili_utenti WHERE id = ${atletaId} LIMIT 1`;
  if (atleti.length === 0) return c.json({ error: "Atleta non trovato" }, 404);
  const atleta = atleti[0];

  const cancelledRows = await sql`
    UPDATE prenotazioni_slot
    SET stato = 'cancellata_dismissione', cancellato_il = NOW(), note = 'Cancellata per dismissione anticipata atleta'
    WHERE (atleta_id = ${atleta.id} OR email_cliente = ${atleta.email})
      AND stato = 'confermata'
      AND (data > CURRENT_DATE OR (data = CURRENT_DATE AND orario >= TO_CHAR(NOW(), 'HH24:MI')))
    RETURNING id, data, orario
  `;

  const tipoAbb = atleta.tipo_abbonamento || "standard";
  const isContinuativo = tipoAbb.startsWith("lab_continuativo");
  const defaultTariffa = tipoAbb === "lab_continuativo_2x" ? 35.0 : 33.25;
  const tariffa = Number(body.tariffa_seduta ?? (isContinuativo ? defaultTariffa : 0));
  const svolte = Number(body.sedute_svolte ?? 0);
  const penale = Number(body.penale_euro ?? (isContinuativo ? 50.0 : 0.0));
  const versato = Number(body.totale_versato ?? (isContinuativo ? (tipoAbb === "lab_continuativo_2x" ? 250 : 359) : 0));

  const valoreSedute = Math.round(svolte * tariffa * 100) / 100;
  const totaleDovuto = Math.round((valoreSedute + penale) * 100) / 100;
  const totaleDaAddebitare = Math.max(0, Math.round((totaleDovuto - versato) * 100) / 100);
  const txCode = `TX-DISM-${Date.now().toString().slice(-6)}`;

  await sql`
    INSERT INTO transazioni_pagamenti (
      codice_transazione, atleta_id, email_cliente, nome_cliente, codice_fiscale, indirizzo,
      id_pacchetto, nome_pacchetto, importo_euro, metodo, crediti_acquistati, debiti_decurtati,
      crediti_effettivi_aggiunti, stato, stato_fattura, created_at
    ) VALUES (
      ${txCode}, ${atleta.id}, ${atleta.email}, ${`${atleta.nome} ${atleta.cognome}`.trim()},
      ${atleta.codice_fiscale || null}, ${atleta.indirizzo || null}, 'dismissione-anticipata',
      ${'Penale e conguaglio recesso anticipato (' + svolte + ' sedute x ' + tariffa + '€ + penale ' + penale + '€)'},
      ${totaleDaAddebitare}, 'carta', 0, 0, 0, 'completato', 'da_emettere', NOW()
    )
  `;

  await sql`
    UPDATE profili_utenti
    SET crediti = 0, stato_iscrizione = 'dismesso', tipo_abbonamento = 'nessuno', updated_at = NOW()
    WHERE id = ${atleta.id}
  `;

  return c.json({
    ok: true,
    messaggio: `Dismissione completata con successo! Revocate ${cancelledRows.length} prenotazioni future. Addebitato saldo di € ${totaleDaAddebitare.toFixed(2)}.`,
    dettagli: {
      atleta_id: atleta.id,
      nome_cliente: `${atleta.nome} ${atleta.cognome}`,
      codice_transazione: txCode,
      totale_addebitato: totaleDaAddebitare,
      penale_applicata: penale,
      sedute_svolte: svolte,
      tariffa_seduta: tariffa,
      prenotazioni_cancellate: cancelledRows,
    },
  });
});

app.get("/app-api/lab-config", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM configurazione_lab WHERE id = 1 LIMIT 1`;
  if (rows.length === 0) {
    return c.json({
      tempo_cancellazione_ore: 24,
      iban: "IT46X0306909606100000046460",
      intestatario_iban: "Area46 Training Lab SSD a r.l.",
      banca: "Banca Sella",
      notifica_email: "firenzepersonaltrainer@gmail.com",
      notifica_whatsapp: "+39 340 0000000",
      orari_disponibili: ["07:30", "08:30", "09:30", "10:30", "11:30", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"],
      giorni_aperti: [1, 2, 3, 4, 5, 6],
      inattivita_mesi_reset: 6,
    });
  }
  return c.json(rows[0]);
});

app.put("/app-api/lab-config", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json();
  try {
    const rows = await sql`
      INSERT INTO configurazione_lab (
        id, tempo_cancellazione_ore, tempo_anticipo_prenotazione_ore, iban, intestatario_iban, banca, notifica_email, notifica_whatsapp,
        stripe_mode, stripe_publishable_key, stripe_secret_key, stripe_webhook_secret, stripe_collegato, updated_at
      ) VALUES (
        1, ${body.tempo_cancellazione_ore || 24}, ${body.tempo_anticipo_prenotazione_ore ?? 12}, ${body.iban || null}, ${body.intestatario_iban || null},
        ${body.banca || null}, ${body.notifica_email || null}, ${body.notifica_whatsapp || null},
        ${body.stripe_mode || "test"}, ${body.stripe_publishable_key || null}, ${body.stripe_secret_key || null},
        ${body.stripe_webhook_secret || null}, ${body.stripe_collegato || false}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        tempo_cancellazione_ore = EXCLUDED.tempo_cancellazione_ore,
        tempo_anticipo_prenotazione_ore = COALESCE(EXCLUDED.tempo_anticipo_prenotazione_ore, configurazione_lab.tempo_anticipo_prenotazione_ore),
        iban = COALESCE(EXCLUDED.iban, configurazione_lab.iban),
        intestatario_iban = COALESCE(EXCLUDED.intestatario_iban, configurazione_lab.intestatario_iban),
        banca = COALESCE(EXCLUDED.banca, configurazione_lab.banca),
        notifica_email = COALESCE(EXCLUDED.notifica_email, configurazione_lab.notifica_email),
        notifica_whatsapp = COALESCE(EXCLUDED.notifica_whatsapp, configurazione_lab.notifica_whatsapp),
        stripe_mode = COALESCE(EXCLUDED.stripe_mode, configurazione_lab.stripe_mode),
        stripe_publishable_key = COALESCE(EXCLUDED.stripe_publishable_key, configurazione_lab.stripe_publishable_key),
        stripe_secret_key = COALESCE(EXCLUDED.stripe_secret_key, configurazione_lab.stripe_secret_key),
        stripe_webhook_secret = COALESCE(EXCLUDED.stripe_webhook_secret, configurazione_lab.stripe_webhook_secret),
        stripe_collegato = COALESCE(EXCLUDED.stripe_collegato, configurazione_lab.stripe_collegato),
        updated_at = NOW()
      RETURNING *
    `;
    return c.json(rows[0]);
  } catch {
    const rows = await sql`
      INSERT INTO configurazione_lab (
        id, tempo_cancellazione_ore, iban, intestatario_iban, banca, notifica_email, notifica_whatsapp, updated_at
      ) VALUES (
        1, ${body.tempo_cancellazione_ore || 24}, ${body.iban || null}, ${body.intestatario_iban || null},
        ${body.banca || null}, ${body.notifica_email || null}, ${body.notifica_whatsapp || null}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        tempo_cancellazione_ore = EXCLUDED.tempo_cancellazione_ore,
        iban = COALESCE(EXCLUDED.iban, configurazione_lab.iban),
        intestatario_iban = COALESCE(EXCLUDED.intestatario_iban, configurazione_lab.intestatario_iban),
        banca = COALESCE(EXCLUDED.banca, configurazione_lab.banca),
        notifica_email = COALESCE(EXCLUDED.notifica_email, configurazione_lab.notifica_email),
        notifica_whatsapp = COALESCE(EXCLUDED.notifica_whatsapp, configurazione_lab.notifica_whatsapp),
        updated_at = NOW()
      RETURNING *
    `;
    return c.json({ ...rows[0], ...body });
  }
});

app.get("/app-api/prenotazioni", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const dataParam = c.req.query("data");
  const emailParam = c.req.query("email");

  const rows = await sql`
    SELECT * FROM prenotazioni_slot
    WHERE (${dataParam}::text IS NULL OR data::text = ${dataParam})
      AND (${emailParam}::text IS NULL OR email_cliente = ${emailParam})
      AND (stato = 'confermata' OR stato = 'attiva' OR stato IS NULL)
    ORDER BY data ASC, orario ASC
  `;
  return c.json(rows);
});

app.post("/app-api/prenotazioni/batch", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json();
  const user = auth(c).user();
  const requestedSlots: Array<{ data: string; orario: string; note?: string }> = body.slots || [];

  if (!Array.isArray(requestedSlots) || requestedSlots.length === 0) {
    return c.json({ error: "Nessuno slot specificato" }, 400);
  }

  const atletaEmail = body.email_cliente || user?.email;
  const atletaRows = await sql`SELECT * FROM profili_utenti WHERE email = ${atletaEmail} LIMIT 1`;
  const atleta = atletaRows[0];
  const isManager = atleta?.ruolo === "manager";
  const totalCost = requestedSlots.length;

  let walletOwner = atleta;
  if (atleta?.shared_wallet_with) {
    const masterRows = await sql`
      SELECT * FROM profili_utenti 
      WHERE id = ${atleta.shared_wallet_with} OR LOWER(email) = LOWER(${atleta.shared_wallet_with}) 
      LIMIT 1
    `;
    if (masterRows.length > 0) {
      walletOwner = masterRows[0];
    }
  }

  // Controllo anticipo prenotazione
  const configRows = await sql`SELECT tempo_anticipo_prenotazione_ore FROM configurazione_lab WHERE id = 1 LIMIT 1`;
  const anticipoOre = Number(configRows[0]?.tempo_anticipo_prenotazione_ore || 0);
  if (anticipoOre > 0 && !isManager) {
    for (const s of requestedSlots) {
      const slotTs = new Date(`${s.data}T${s.orario}:00`).getTime();
      const oreDiff = (slotTs - Date.now()) / (1000 * 60 * 60);
      if (oreDiff < anticipoOre) {
        return c.json({ error: `Uno o più slot selezionati (${s.data} ${s.orario}) non possono essere prenotati: termine di prenotazione inferiore alle ${anticipoOre} ore di anticipo previste.` }, 400);
      }
    }
  }

  if (!isManager && walletOwner) {
    if ((walletOwner.crediti ?? 0) < totalCost) {
      return c.json({ error: `Crediti insufficienti. Disponibili: ${walletOwner.crediti}, richiesti: ${totalCost}` }, 403);
    }
    await sql`UPDATE profili_utenti SET crediti = crediti - ${totalCost} WHERE id = ${walletOwner.id}`;
    if (atleta && atleta.id !== walletOwner.id) {
      await sql`UPDATE profili_utenti SET data_ultimo_accesso = NOW() WHERE id = ${atleta.id}`;
    }

    const isShared = walletOwner.id !== atleta?.id;
    const movId = `mov-${Date.now()}`;
    const motivazione = isShared
      ? `Prenotazione ${requestedSlots.length} sessioni per ${atleta?.nome} ${atleta?.cognome} [Borsellino Condiviso]`
      : `Prenotazione Multipla (${requestedSlots.length} slot)`;
    await sql`
      INSERT INTO movimenti_crediti (
        id, atleta_id, email_cliente, nome_cliente, data_ora, tipo, delta_crediti, saldo_risultante, motivazione, operatore
      ) VALUES (
        ${movId}, ${walletOwner.id}, ${walletOwner.email}, ${`${walletOwner.nome} ${walletOwner.cognome}`.trim()},
        NOW(), 'prenotazione_slot', ${-totalCost}, ${walletOwner.crediti - totalCost}, ${motivazione}, 'atleta'
      )
    `;
  }

  const created = [];
  const now = Date.now();
  for (let i = 0; i < requestedSlots.length; i++) {
    const s = requestedSlots[i];
    const id = `bk-${now}-${i}`;
    const rows = await sql`
      INSERT INTO prenotazioni_slot (
        id, data, orario, atleta_id, email_cliente, nome_cliente, telefono_cliente, stato, credito_scalato, note
      ) VALUES (
        ${id}, ${s.data}::date, ${s.orario}, ${atleta?.id || null}, ${atletaEmail},
        ${atleta ? `${atleta.nome} ${atleta.cognome}` : (user?.name || "Atleta")},
        ${atleta?.telefono || null}, 'confermata', true, ${s.note || "Prenotazione Multipla"}
      )
      RETURNING *
    `;
    created.push(rows[0]);
  }

  return c.json({ ok: true, count: created.length, prenotazioni: created, messaggio: `${created.length} sessioni prenotate con successo!` }, 201);
});

app.post("/app-api/prenotazioni", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json();
  const user = auth(c).user();

  // Controllo 1:1 rigoroso
  const existing = await sql`
    SELECT id FROM prenotazioni_slot 
    WHERE data = ${body.data}::date AND orario = ${body.orario} AND stato = 'confermata'
    LIMIT 1
  `;
  if (existing.length > 0) {
    return c.json({ error: "Slot già occupato da un altro atleta. Capienza massima raggiunta per questa postazione." }, 409);
  }

  // Deduci credito
  const atletaEmail = body.email_cliente || user?.email;
  const atletaRows = await sql`SELECT * FROM profili_utenti WHERE email = ${atletaEmail} LIMIT 1`;
  const atleta = atletaRows[0];
  const isManager = atleta?.ruolo === "manager";

  let walletOwner = atleta;
  if (atleta?.shared_wallet_with) {
    const masterRows = await sql`
      SELECT * FROM profili_utenti 
      WHERE id = ${atleta.shared_wallet_with} OR LOWER(email) = LOWER(${atleta.shared_wallet_with}) 
      LIMIT 1
    `;
    if (masterRows.length > 0) {
      walletOwner = masterRows[0];
    }
  }

  // Controllo anticipo prenotazione
  const configRows = await sql`SELECT tempo_anticipo_prenotazione_ore FROM configurazione_lab WHERE id = 1 LIMIT 1`;
  const anticipoOre = Number(configRows[0]?.tempo_anticipo_prenotazione_ore || 0);
  if (anticipoOre > 0 && !isManager) {
    const slotTs = new Date(`${body.data}T${body.orario}:00`).getTime();
    const oreDiff = (slotTs - Date.now()) / (1000 * 60 * 60);
    if (oreDiff < anticipoOre) {
      return c.json({ error: `Termine di prenotazione scaduto. Le sessioni devono essere prenotate con almeno ${anticipoOre} ore di anticipo.` }, 400);
    }
  }

  if (walletOwner && !isManager) {
    if (walletOwner.crediti <= 0) {
      return c.json({ error: "Crediti esauriti. Ricarica per prenotare." }, 403);
    }
    await sql`UPDATE profili_utenti SET crediti = crediti - 1 WHERE id = ${walletOwner.id}`;
    if (atleta && atleta.id !== walletOwner.id) {
      await sql`UPDATE profili_utenti SET data_ultimo_accesso = NOW() WHERE id = ${atleta.id}`;
    }

    const isShared = walletOwner.id !== atleta?.id;
    const movId = `mov-${Date.now()}`;
    const motivazione = isShared
      ? `Prenotazione slot ${body.data} ${body.orario} per ${atleta?.nome} ${atleta?.cognome} [Borsellino Condiviso]`
      : `Prenotazione slot ${body.data} ${body.orario}`;
    await sql`
      INSERT INTO movimenti_crediti (
        id, atleta_id, email_cliente, nome_cliente, data_ora, tipo, delta_crediti, saldo_risultante, motivazione, operatore
      ) VALUES (
        ${movId}, ${walletOwner.id}, ${walletOwner.email}, ${`${walletOwner.nome} ${walletOwner.cognome}`.trim()},
        NOW(), 'prenotazione_slot', -1, ${walletOwner.crediti - 1}, ${motivazione}, 'atleta'
      )
    `;
  }

  const id = `bk-${Date.now()}`;
  const rows = await sql`
    INSERT INTO prenotazioni_slot (
      id, data, orario, atleta_id, email_cliente, nome_cliente, telefono_cliente, stato, credito_scalato, note
    ) VALUES (
      ${id}, ${body.data}::date, ${body.orario}, ${atleta?.id || null}, ${atletaEmail},
      ${atleta ? `${atleta.nome} ${atleta.cognome}` : (user?.name || "Atleta")},
      ${atleta?.telefono || null}, 'confermata', true, ${body.note || null}
    )
    RETURNING *
  `;
  return c.json({ ok: true, prenotazione: rows[0], messaggio: "Prenotazione confermata!" }, 201);
});

app.delete("/app-api/prenotazioni/:id", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const id = c.req.param("id");
  const prorogaParam = c.req.query("proroga");
  const prorogaRequested = prorogaParam === "true" || prorogaParam === "7";

  const rows = await sql`SELECT * FROM prenotazioni_slot WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) return c.json({ error: "Prenotazione non trovata" }, 404);
  const bk = rows[0];

  const atletaRows = await sql`SELECT * FROM profili_utenti WHERE email = ${bk.email_cliente} LIMIT 1`;
  const atleta = atletaRows[0];
  let walletOwner = atleta;
  if (atleta?.shared_wallet_with) {
    const masterRows = await sql`
      SELECT * FROM profili_utenti 
      WHERE id = ${atleta.shared_wallet_with} OR LOWER(email) = LOWER(${atleta.shared_wallet_with}) 
      LIMIT 1
    `;
    if (masterRows.length > 0) walletOwner = masterRows[0];
  }
  const isShared = walletOwner && atleta && walletOwner.id !== atleta.id;

  const configRows = await sql`SELECT tempo_cancellazione_ore FROM configurazione_lab WHERE id = 1 LIMIT 1`;
  const policyOre = Number(atleta?.tempo_cancellazione_ore || configRows[0]?.tempo_cancellazione_ore || 24);

  const slotTs = new Date(`${bk.data.toISOString().slice(0, 10)}T${bk.orario}:00`).getTime();
  const oreDiff = (slotTs - Date.now()) / (1000 * 60 * 60);

  const user = auth(c).user();
  const isManager = user?.ruolo === "manager";

  let rimborsato = false;
  let statoFinale = "cancellata_tardiva";
  let messaggio = "";

  if (oreDiff >= policyOre || isManager) {
    rimborsato = true;
    statoFinale = "cancellata_in_tempo";
    if (bk.credito_scalato && walletOwner) {
      if (isManager) {
        const currentExp = walletOwner.data_scadenza_crediti;
        const tipoAbb = walletOwner.tipo_abbonamento || "";
        const isContinuativo = tipoAbb.startsWith("lab_continuativo") || tipoAbb === "abbonamento";

        if (isContinuativo) {
          await sql`UPDATE profili_utenti SET crediti = crediti + 1 WHERE id = ${walletOwner.id}`;
          messaggio = "Sessione annullata dal Coach. 1 credito rimborsato al wallet (abbonamento continuativo: scadenza fissa invariata).";
        } else {
          if (prorogaRequested && currentExp) {
            // Proroga esplicita di +7 giorni richiesta dal Coach
            await sql`
              UPDATE profili_utenti 
              SET crediti = crediti + 1,
                  data_scadenza_crediti = data_scadenza_crediti + INTERVAL '7 days'
              WHERE id = ${walletOwner.id}
            `;
            messaggio = "Sessione annullata dal Coach. 1 credito rimborsato e scadenza prorogata di 7 giorni su tua scelta esplicita.";
          } else {
            // Default: NESSUNA proroga (spostamento/cambio turno senza alterare la scadenza del pacchetto)
            await sql`UPDATE profili_utenti SET crediti = crediti + 1 WHERE id = ${walletOwner.id}`;
            messaggio = "Sessione annullata dal Coach. 1 credito rimborsato al wallet (scadenza carnet invariata: nessuna proroga).";
          }
        }
      } else {
        await sql`UPDATE profili_utenti SET crediti = crediti + 1 WHERE id = ${walletOwner.id}`;
        messaggio = `Cancellazione effettuata in tempo. 1 credito riaccreditato.`;
      }

      // Registra rimborso nel ledger del walletOwner
      const movId = `mov-${Date.now()}`;
      const bkDateStr = typeof bk.data === "string" ? bk.data : bk.data.toISOString().slice(0, 10);
      const motivazione = isManager
        ? (prorogaRequested
            ? `Rimborso slot ${bkDateStr} ${bk.orario} per ${atleta?.nome} ${atleta?.cognome}${isShared ? " [Borsellino Condiviso]" : ""} [Con proroga scadenza carnet +7gg]`
            : `Ripristino credito per cancellazione/spostamento slot ${bkDateStr} ${bk.orario} per ${atleta?.nome} ${atleta?.cognome}${isShared ? " [Borsellino Condiviso]" : ""}`)
        : `Rimborso per cancellazione in tempo slot del ${bkDateStr} ${bk.orario}${isShared ? " [Borsellino Condiviso]" : ""}`;

      await sql`
        INSERT INTO movimenti_crediti (
          id, atleta_id, email_cliente, nome_cliente, data_ora, tipo, delta_crediti, saldo_risultante, motivazione, operatore
        ) VALUES (
          ${movId}, ${walletOwner.id}, ${walletOwner.email}, ${`${walletOwner.nome} ${walletOwner.cognome}`.trim()},
          NOW(), 'rimborso_cancellazione', 1, ${walletOwner.crediti + 1}, ${motivazione}, ${isManager ? "coach" : "atleta"}
        )
      `;
    }
  } else {
    messaggio = `Cancellazione tardiva (meno di ${policyOre}h). Credito trattenuto come da tua policy.`;
  }

  await sql`
    UPDATE prenotazioni_slot 
    SET stato = ${statoFinale}, cancellato_il = NOW() 
    WHERE id = ${id}
  `;

  return c.json({
    ok: true,
    rimborsato,
    stato: statoFinale,
    messaggio,
  });
});

app.get("/app-api/tariffario", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM tariffario_pacchetti WHERE attivo = true ORDER BY prezzo_euro ASC`;
  if (rows.length === 0) {
    return c.json([
      { id: "pack-8", nome: "Pacchetto Lab 8", descrizione: "8 allenamenti Landmine Lab • Scadenza 4 settimane", crediti: 8, giorni_validita: 28, prezzo_euro: 280, tipo: "consumo", attivo: true, badge: "2x / settimana" },
      { id: "pack-12", nome: "Pacchetto Lab 12", descrizione: "12 allenamenti Landmine Lab • Scadenza 4 settimane", crediti: 12, giorni_validita: 28, prezzo_euro: 399, tipo: "consumo", attivo: true, badge: "3x / settimana" },
      { id: "pack-24", nome: "Pacchetto Lab 24", descrizione: "24 allenamenti Landmine Lab • Scadenza 12 settimane", crediti: 24, giorni_validita: 84, prezzo_euro: 690, tipo: "consumo", attivo: true, badge: "Trimestrale 2x" },
      { id: "pack-36", nome: "Pacchetto Lab 36", descrizione: "36 allenamenti Landmine Lab • Scadenza 12 settimane", crediti: 36, giorni_validita: 84, prezzo_euro: 890, tipo: "consumo", attivo: true, badge: "Miglior Risparmio (3x)" },
      { id: "pack-continuativo-2x-semestrale", nome: "Abbonamento Lab Continuativo 2X (Semestrale)", descrizione: "48 allenamenti prenotabili subito (24 sett x 2/sett) • Quota €250/mese • Risparmio 30€/mese • Assistente AI Booking", crediti: 48, giorni_validita: 180, prezzo_euro: 250, tipo: "abbonamento", attivo: true, badge: "Semestrale 2x (48 slot)" },
      { id: "pack-continuativo-3x-semestrale", nome: "Abbonamento Lab Continuativo 3X (Semestrale)", descrizione: "72 allenamenti prenotabili subito (24 sett x 3/sett) • Quota €359/mese • Risparmio 40€/mese • Assistente AI Booking", crediti: 72, giorni_validita: 180, prezzo_euro: 359, tipo: "abbonamento", attivo: true, badge: "Semestrale 3x (72 slot)" },
      { id: "pack-continuativo-2x-annuale", nome: "Abbonamento Lab Continuativo 2X (Annuale)", descrizione: "104 allenamenti prenotabili subito (52 sett x 2/sett) • Quota €230/mese • Risparmio 50€/m (600€/anno!) • AI Concierge Incluso", crediti: 104, giorni_validita: 365, prezzo_euro: 230, tipo: "abbonamento", attivo: true, badge: "👑 PREMIO 12 MESI (104 slot)" },
      { id: "pack-continuativo-3x-annuale", nome: "Abbonamento Lab Continuativo 3X (Annuale)", descrizione: "156 allenamenti prenotabili subito (52 sett x 3/sett) • Quota €329/mese • Risparmio 70€/m (840€/anno!) • AI Concierge Incluso", crediti: 156, giorni_validita: 365, prezzo_euro: 329, tipo: "abbonamento", attivo: true, badge: "👑 PREMIO 12 MESI (156 slot)" },
    ]);
  }
  return c.json(rows);
});

app.get("/app-api/transazioni", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM transazioni_pagamenti ORDER BY created_at DESC`;
  return c.json(rows);
});

app.post("/app-api/transazioni/checkout", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json();
  const user = auth(c).user();

  const packRows = await sql`SELECT * FROM tariffario_pacchetti WHERE id = ${body.id_pacchetto} LIMIT 1`;
  const pack = packRows[0] || { id: body.id_pacchetto, nome: "Pacchetto Lab", crediti: 10, prezzo_euro: 380, giorni_validita: 60 };

  const atletaEmail = body.email || user?.email;
  const atletaRows = await sql`SELECT * FROM profili_utenti WHERE email = ${atletaEmail} LIMIT 1`;
  const atleta = atletaRows[0];

  const currentCrediti = Number(atleta?.crediti || 0);
  const packCrediti = Number(pack.crediti);

  let debitiDecurtati = 0;
  let creditiEffettivi = packCrediti;
  if (currentCrediti < 0) {
    debitiDecurtati = Math.abs(currentCrediti);
    creditiEffettivi = packCrediti - debitiDecurtati;
  }

  const isBonifico = body.metodo === "bonifico";
  const txCode = `TX-46-${Date.now().toString().slice(-6)}`;
  const causale = `AREA46-${(atleta?.cognome || "ATLETA").toUpperCase()}-${pack.id.toUpperCase()}-${txCode.slice(-4)}`;

  if (!isBonifico && atleta) {
    const finalCrediti = currentCrediti < 0 ? creditiEffettivi : currentCrediti + packCrediti;
    await sql`
      UPDATE profili_utenti 
      SET crediti = ${finalCrediti}, 
          data_scadenza_crediti = (CURRENT_DATE + (${pack.giorni_validita} || ' days')::interval)::date,
          data_ultimo_accesso = NOW()
      WHERE email = ${atletaEmail}
    `;
  }

  const rows = await sql`
    INSERT INTO transazioni_pagamenti (
      codice_transazione, atleta_id, email_cliente, nome_cliente, codice_fiscale, indirizzo,
      id_pacchetto, nome_pacchetto, importo_euro, metodo, crediti_acquistati, debiti_decurtati,
      crediti_effettivi_aggiunti, causale_bonifico, stato, stato_fattura
    ) VALUES (
      ${txCode}, ${atleta?.id || null}, ${atletaEmail}, ${atleta ? `${atleta.nome} ${atleta.cognome}` : (user?.name || "Atleta")},
      ${body.codice_fiscale || atleta?.codice_fiscale || null}, ${body.indirizzo || atleta?.indirizzo || null},
      ${pack.id}, ${pack.nome}, ${pack.prezzo_euro}, ${body.metodo || 'carta'}, ${packCrediti},
      ${debitiDecurtati}, ${creditiEffettivi}, ${isBonifico ? causale : null},
      ${isBonifico ? 'in_attesa_bonifico' : 'completato'}, 'da_emettere'
    )
    RETURNING *
  `;

  return c.json({
    ok: true,
    transazione: rows[0],
    crediti_attuali: atleta ? (currentCrediti < 0 ? creditiEffettivi : currentCrediti + packCrediti) : creditiEffettivi,
    ricevuta: {
      titolo: "RICEVUTA DI PAGAMENTO — AREA46 TRAINING LAB",
      codice: txCode,
      cliente: atleta ? `${atleta.nome} ${atleta.cognome}` : user?.name,
      importo: `${pack.prezzo_euro} €`,
      descrizione: pack.nome,
    }
  }, 201);
});

app.post("/app-api/transazioni/:codice/approva-bonifico", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const codice = c.req.param("codice");

  const txRows = await sql`SELECT * FROM transazioni_pagamenti WHERE codice_transazione = ${codice} LIMIT 1`;
  if (txRows.length === 0) return c.json({ error: "Transazione non trovata" }, 404);
  const tx = txRows[0];

  if (tx.stato === "completato") return c.json({ ok: true, messaggio: "Già approvato." });

  const atletaRows = await sql`SELECT * FROM profili_utenti WHERE email = ${tx.email_cliente} LIMIT 1`;
  if (atletaRows.length > 0) {
    const atleta = atletaRows[0];
    const currentCrediti = Number(atleta.crediti || 0);
    const finalCrediti = currentCrediti < 0 ? tx.crediti_effettivi_aggiunti : currentCrediti + tx.crediti_acquistati;
    await sql`
      UPDATE profili_utenti 
      SET crediti = ${finalCrediti}, 
          data_scadenza_crediti = (CURRENT_DATE + interval '60 days')::date,
          data_ultimo_accesso = NOW()
      WHERE email = ${tx.email_cliente}
    `;
  }

  const updated = await sql`
    UPDATE transazioni_pagamenti 
    SET stato = 'completato', approvato_il = NOW() 
    WHERE codice_transazione = ${codice} 
    RETURNING *
  `;
  return c.json({ ok: true, tx: updated[0] });
});

// ─── Stripe Connect & Pagamenti Digitali ─────────────────────────────────────
app.post("/app-api/config/stripe/test-connection", async (c) => {
  try {
    const body = await c.req.json();
    let secretKey = body.stripe_secret_key;
    if (!secretKey) {
      try {
        const sql = neon(c.env.DATABASE_URL);
        const rows = await sql`SELECT stripe_secret_key FROM configurazione_lab WHERE id = 1 LIMIT 1`;
        if (rows.length > 0) secretKey = rows[0].stripe_secret_key;
      } catch {}
    }
    if (!secretKey && typeof process !== "undefined" && process.env) {
      secretKey = process.env.STRIPE_SECRET_KEY;
    }

    if (!secretKey) {
      return c.json({ ok: false, error: "Nessuna Stripe Secret Key fornita per il test." }, 400);
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${secretKey.trim()}` },
    });
    const stripeData = (await stripeRes.json()) as any;

    if (!stripeRes.ok) {
      return c.json(
        {
          ok: false,
          error: stripeData.error?.message || "Chiave segreta Stripe non valida o non autorizzata.",
        },
        400
      );
    }

    try {
      const sql = neon(c.env.DATABASE_URL);
      await sql`
        UPDATE configurazione_lab
        SET stripe_collegato = true,
            stripe_secret_key = COALESCE(${body.stripe_secret_key?.trim() || null}, stripe_secret_key),
            stripe_publishable_key = COALESCE(${body.stripe_publishable_key?.trim() || null}, stripe_publishable_key),
            stripe_mode = COALESCE(${body.stripe_mode || null}, stripe_mode),
            updated_at = NOW()
        WHERE id = 1
      `;
    } catch {}

    return c.json({
      ok: true,
      livemode: stripeData.livemode,
      message: `Connessione a Stripe riuscita! Modalità: ${
        stripeData.livemode ? "LIVE (Incassi Reali attivi)" : "TEST (Sandbox di prova)"
      }`,
    });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message || "Impossibile contattare i server di Stripe." }, 500);
  }
});

app.post("/app-api/pagamenti/stripe-checkout", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const body = await c.req.json();
    const user = auth(c).user();

    const atletaId = body.atleta_id || user?.id;
    let atleta: any = null;
    if (atletaId) {
      const atletaRows = await sql`SELECT * FROM profili_utenti WHERE id = ${atletaId} OR email = ${atletaId} LIMIT 1`;
      atleta = atletaRows[0];
    }
    if (!atleta && user?.email) {
      const atletaRows = await sql`SELECT * FROM profili_utenti WHERE email = ${user.email} LIMIT 1`;
      atleta = atletaRows[0];
    }

    const packRows = await sql`SELECT * FROM tariffario_pacchetti WHERE id = ${body.id_pacchetto} LIMIT 1`;
    const pacchetto = packRows[0] || {
      id: body.id_pacchetto,
      nome: "Pacchetto Sedute",
      crediti: 10,
      prezzo_euro: 380,
      giorni_validita: 60,
    };

    let secretKey = "";
    try {
      const confRows = await sql`SELECT stripe_secret_key FROM configurazione_lab WHERE id = 1 LIMIT 1`;
      if (confRows.length > 0) secretKey = confRows[0].stripe_secret_key;
    } catch {}
    if (!secretKey && typeof process !== "undefined" && process.env) {
      secretKey = process.env.STRIPE_SECRET_KEY || "";
    }
    const headerSecretKey = c.req.header("x-stripe-secret-key");
    if (headerSecretKey) secretKey = headerSecretKey;
    if (body.stripe_secret_key) secretKey = body.stripe_secret_key;

    const origin = c.req.header("origin") || "http://localhost:5173";
    const returnPath = body.return_url || "/account";

    if (secretKey && (secretKey.startsWith("sk_") || secretKey.startsWith("rk_"))) {
      try {
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
          p.append("customer_email", atleta?.email || user?.email || "");
          p.append("client_reference_id", atleta?.id || user?.id || "");
          p.append("metadata[pack_id]", pacchetto.id);
          p.append("metadata[pack_nome]", pacchetto.nome);
          p.append("metadata[pack_crediti]", String(pacchetto.crediti));
          p.append("metadata[giorni_validita]", String(pacchetto.giorni_validita || 60));
          p.append("metadata[atleta_id]", atleta?.id || user?.id || "");
          p.append("metadata[atleta_email]", atleta?.email || user?.email || "");
          p.append("metadata[codice_fiscale]", body.codice_fiscale || atleta?.codice_fiscale || "");
          p.append("metadata[indirizzo]", body.indirizzo || atleta?.indirizzo || "");
          p.append("success_url", `${origin}${returnPath}?session_id={CHECKOUT_SESSION_ID}&success=true`);
          p.append("cancel_url", `${origin}${returnPath}?canceled=true`);
          return p;
        };

        const wantsPayPal = body.metodo === "paypal";
        let params = buildParams(wantsPayPal);

        let stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey.trim()}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });
        let session = (await stripeRes.json()) as any;

        // Se PayPal non è abilitato nella dashboard del coach, riprova subito con card/Apple Pay
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
          session = (await stripeRes.json()) as any;
        }

        if (!stripeRes.ok) {
          throw new Error(session.error?.message || "Errore nella creazione della sessione di pagamento Stripe");
        }
        return c.json({
          ok: true,
          checkout_url: session.url,
          session_id: session.id,
        });
      } catch (err: any) {
        return c.json({ error: err.message || "Errore di connessione a Stripe" }, 502);
      }
    }

    // SE LE CHIAVI STRIPE NON SONO DISPONIBILI SUL SERVER: BLOCCO DI SICUREZZA
    return c.json(
      {
        error:
          "Il gateway di pagamento con carta non è al momento collegato o configurato. Seleziona Bonifico Bancario oppure contatta il Coach/Lab.",
      },
      400
    );
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/app-api/pagamenti/stripe-verify", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const body = await c.req.json();
    const sessionId = body.session_id;

    if (!sessionId) {
      return c.json({ error: "Session ID mancante" }, 400);
    }

    const existingTx = await sql`
      SELECT * FROM transazioni_pagamenti 
      WHERE codice_transazione = ${sessionId} 
         OR stripe_session_id = ${sessionId} 
      LIMIT 1
    `;
    if (existingTx.length > 0) {
      return c.json({
        ok: true,
        already_processed: true,
        transazione: existingTx[0],
        messaggio: "Pagamento già registrato con successo.",
      });
    }

    let secretKey = "";
    try {
      const confRows = await sql`SELECT stripe_secret_key FROM configurazione_lab WHERE id = 1 LIMIT 1`;
      if (confRows.length > 0) secretKey = confRows[0].stripe_secret_key;
    } catch {}
    if (!secretKey && typeof process !== "undefined" && process.env) {
      secretKey = process.env.STRIPE_SECRET_KEY || "";
    }
    const headerSecretKey = c.req.header("x-stripe-secret-key");
    if (headerSecretKey) secretKey = headerSecretKey;
    if (body.stripe_secret_key) secretKey = body.stripe_secret_key;

    if (!secretKey) {
      return c.json({ error: "Stripe non configurato" }, 400);
    }

    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${secretKey.trim()}` },
    });
    const session = (await stripeRes.json()) as any;

    if (!stripeRes.ok) {
      return c.json({ error: session.error?.message || "Sessione Stripe non valida" }, 400);
    }

    if (session.payment_status !== "paid") {
      return c.json({ error: `Stato pagamento non completato: ${session.payment_status}` }, 400);
    }

    const meta = session.metadata || {};
    const packId = meta.pack_id;
    const atletaEmail = meta.atleta_email || session.customer_email;

    const packRows = await sql`SELECT * FROM tariffario_pacchetti WHERE id = ${packId} LIMIT 1`;
    const pacchetto = packRows[0] || {
      id: packId,
      nome: meta.pack_nome || "Pacchetto Lab",
      crediti: Number(meta.pack_crediti) || 10,
      prezzo_euro: (session.amount_total || 0) / 100,
      giorni_validita: Number(meta.giorni_validita) || 60,
    };

    const atletaRows = await sql`SELECT * FROM profili_utenti WHERE email = ${atletaEmail} OR id = ${meta.atleta_id} LIMIT 1`;
    const atleta = atletaRows[0];

    const currentCrediti = Number(atleta?.crediti || 0);
    const packCrediti = Number(pacchetto.crediti || 0);
    let debitiDecurtati = 0;
    let creditiEffettivi = packCrediti;
    if (currentCrediti < 0) {
      debitiDecurtati = Math.abs(currentCrediti);
      creditiEffettivi = packCrediti - debitiDecurtati;
    }
    const finalCrediti = currentCrediti < 0 ? creditiEffettivi : currentCrediti + packCrediti;

    if (atleta) {
      await sql`
        UPDATE profili_utenti
        SET crediti = ${finalCrediti},
            data_scadenza_crediti = (CURRENT_DATE + (${pacchetto.giorni_validita || 60} || ' days')::interval)::date,
            data_ultimo_accesso = NOW()
        WHERE id = ${atleta.id}
      `;
    }

    const txCode = `TX-ST-${Date.now().toString().slice(-6)}`;
    const txRows = await sql`
      INSERT INTO transazioni_pagamenti (
        codice_transazione, stripe_session_id, stripe_payment_intent, atleta_id, email_cliente, nome_cliente,
        codice_fiscale, indirizzo, id_pacchetto, nome_pacchetto, importo_euro, metodo,
        crediti_acquistati, debiti_decurtati, crediti_effettivi_aggiunti, causale_bonifico, stato, stato_fattura
      ) VALUES (
        ${txCode}, ${session.id}, ${session.payment_intent || null}, ${atleta?.id || null}, ${atleta?.email || atletaEmail},
        ${atleta ? `${atleta.nome} ${atleta.cognome}` : "Atleta"}, ${meta.codice_fiscale || atleta?.codice_fiscale || null},
        ${meta.indirizzo || atleta?.indirizzo || null}, ${pacchetto.id}, ${pacchetto.nome}, ${(session.amount_total || 0) / 100},
        'stripe_card', ${packCrediti}, ${debitiDecurtati}, ${creditiEffettivi}, null, 'completato', 'da_emettere'
      )
      RETURNING *
    `;

    return c.json(
      {
        ok: true,
        transazione: txRows[0],
        crediti_attuali: finalCrediti,
        messaggio: "Pagamento Stripe verificato e accreditato con successo!",
      },
      200
    );
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Webhook Stripe per ricezione asincrona eventi (es. checkout.session.completed)
app.post("/app-api/pagamenti/stripe-webhook", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const rawBody = await c.req.text();
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Verifica della firma se il webhook secret è salvato
  const confRows = await sql`SELECT stripe_webhook_secret FROM configurazione_lab WHERE id = 1 LIMIT 1`;
  const webhookSecret = confRows[0]?.stripe_webhook_secret;
  const sigHeader = c.req.header("stripe-signature");

  if (webhookSecret && sigHeader) {
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
          console.warn("[Stripe Webhook] Firma HMAC non valida");
          return c.json({ error: "Firma webhook non valida" }, 400);
        }
      }
    } catch (e) {
      console.error("[Stripe Webhook] Errore verifica firma", e);
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    if (session && session.id && session.payment_status === "paid") {
      const existing = await sql`SELECT id FROM transazioni_pagamenti WHERE stripe_session_id = ${session.id} LIMIT 1`;
      if (existing.length === 0) {
        const meta = session.metadata || {};
        const packId = meta.pack_id;
        const atletaEmail = meta.atleta_email || session.customer_email;

        const packRows = await sql`SELECT * FROM tariffario_pacchetti WHERE id = ${packId} LIMIT 1`;
        const pacchetto = packRows[0] || {
          id: packId,
          nome: meta.pack_nome || "Pacchetto Lab",
          crediti: Number(meta.pack_crediti) || 10,
          prezzo_euro: (session.amount_total || 0) / 100,
          giorni_validita: Number(meta.giorni_validita) || 60,
        };

        const atletaRows = await sql`SELECT * FROM profili_utenti WHERE email = ${atletaEmail} OR id = ${meta.atleta_id} LIMIT 1`;
        const atleta = atletaRows[0];

        const currentCrediti = Number(atleta?.crediti || 0);
        const packCrediti = Number(pacchetto.crediti || 0);
        let debitiDecurtati = 0;
        let creditiEffettivi = packCrediti;
        if (currentCrediti < 0) {
          debitiDecurtati = Math.abs(currentCrediti);
          creditiEffettivi = packCrediti - debitiDecurtati;
        }
        const finalCrediti = currentCrediti < 0 ? creditiEffettivi : currentCrediti + packCrediti;

        if (atleta) {
          await sql`
            UPDATE profili_utenti
            SET crediti = ${finalCrediti},
                data_scadenza_crediti = (CURRENT_DATE + (${pacchetto.giorni_validita || 60} || ' days')::interval)::date,
                data_ultimo_accesso = NOW()
            WHERE id = ${atleta.id}
          `;
        }

        const txCode = `TX-ST-${Date.now().toString().slice(-6)}`;
        await sql`
          INSERT INTO transazioni_pagamenti (
            codice_transazione, stripe_session_id, stripe_payment_intent, atleta_id, email_cliente, nome_cliente,
            codice_fiscale, indirizzo, id_pacchetto, nome_pacchetto, importo_euro, metodo,
            crediti_acquistati, debiti_decurtati, crediti_effettivi_aggiunti, causale_bonifico, stato, stato_fattura
          ) VALUES (
            ${txCode}, ${session.id}, ${session.payment_intent || null}, ${atleta?.id || null}, ${atleta?.email || atletaEmail},
            ${atleta ? `${atleta.nome} ${atleta.cognome}` : "Atleta"}, ${meta.codice_fiscale || atleta?.codice_fiscale || null},
            ${meta.indirizzo || atleta?.indirizzo || null}, ${pacchetto.id}, ${pacchetto.nome}, ${(session.amount_total || 0) / 100},
            'stripe_card', ${packCrediti}, ${debitiDecurtati}, ${creditiEffettivi}, null, 'completato', 'da_emettere'
          )
        `;
      }
    }
  }

  return c.json({ received: true });
});

// Alias comune
app.post("/api/stripe-webhook", async (c) => {
  return app.fetch(new Request(new URL("/app-api/pagamenti/stripe-webhook", c.req.url).toString(), c.req.raw));
});

// ─── Movimenti Crediti (Audit Ledger) ───────────────────────────────────────
app.get("/app-api/movimenti-crediti", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const atletaId = c.req.query("atleta_id");
  const email = c.req.query("email");

  const rows = await sql`
    SELECT * FROM movimenti_crediti
    WHERE (${atletaId}::text IS NULL OR atleta_id = ${atletaId})
      AND (${email}::text IS NULL OR email_cliente = ${email})
    ORDER BY data_ora DESC
  `;
  return c.json(rows);
});

app.post("/app-api/movimenti-crediti", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json();

  const atletaRows = await sql`SELECT * FROM profili_utenti WHERE id = ${body.atleta_id} LIMIT 1`;
  if (atletaRows.length === 0) return c.json({ error: "Atleta non trovato" }, 404);
  const atleta = atletaRows[0];

  const currentCrediti = Number(atleta.crediti || 0);
  const delta = Number(body.delta_crediti || 0);
  const newCrediti = currentCrediti + delta;

  await sql`
    UPDATE profili_utenti
    SET crediti = ${newCrediti}, updated_at = NOW()
    WHERE id = ${atleta.id}
  `;

  const movId = `mov-${Date.now()}`;
  const rows = await sql`
    INSERT INTO movimenti_crediti (
      id, atleta_id, email_cliente, nome_cliente, data_ora, tipo, delta_crediti, saldo_risultante, motivazione, operatore
    ) VALUES (
      ${movId}, ${atleta.id}, ${atleta.email}, ${`${atleta.nome} ${atleta.cognome}`},
      NOW(), ${body.tipo || 'modifica_manuale'}, ${delta}, ${newCrediti},
      ${body.motivazione || 'Rettifica crediti'}, 'coach'
    )
    RETURNING *
  `;
  return c.json(rows[0], 201);
});

// ─── Eccezioni Calendario (Slot straordinari / Chiusure) ────────────────────
app.get("/app-api/eccezioni-calendario", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const dataParam = c.req.query("data");

  const rows = await sql`
    SELECT * FROM eccezioni_calendario
    WHERE (${dataParam}::text IS NULL OR data::text = ${dataParam})
    ORDER BY data ASC, orario ASC NULLS FIRST
  `;
  return c.json(rows);
});

app.post("/app-api/eccezioni-calendario", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json();

  if (body.orari && Array.isArray(body.orari) && body.orari.length > 0) {
    const createdList = [];
    for (const o of body.orari) {
      const id = `ecc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const rows = await sql`
        INSERT INTO eccezioni_calendario (
          id, data, orario, tipo, motivo
        ) VALUES (
          ${id}, ${body.data}::date, ${o}, ${body.tipo || 'slot_bloccato'}, ${body.motivo || null}
        )
        RETURNING *
      `;
      createdList.push(rows[0]);
    }
    return c.json(createdList, 201);
  }

  const id = `ecc-${Date.now()}`;
  const rows = await sql`
    INSERT INTO eccezioni_calendario (
      id, data, orario, tipo, motivo
    ) VALUES (
      ${id}, ${body.data}::date, ${body.orario || null}, ${body.tipo}, ${body.motivo || null}
    )
    RETURNING *
  `;
  return c.json(rows[0], 201);
});

app.post("/app-api/eccezioni-calendario/chiusura-periodo", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const body = await c.req.json();
  const { data_inizio, data_fine, motivo, proroga_scadenze } = body;

  if (!data_inizio || !data_fine) {
    return c.json({ error: "Date di inizio e fine periodo obbligatorie" }, 400);
  }

  const start = new Date(data_inizio);
  const end = new Date(data_fine);
  const diffMs = end.getTime() - start.getTime();
  const giorniChiusura = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

  // Inserisci le eccezioni giorno per giorno
  const cur = new Date(start);
  while (cur <= end) {
    const dStr = cur.toISOString().slice(0, 10);
    const id = `ecc-close-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await sql`
      INSERT INTO eccezioni_calendario (id, data, orario, tipo, motivo)
      VALUES (${id}, ${dStr}::date, null, 'chiusura_giornata', ${motivo || 'Chiusura programmata dello studio'})
      ON CONFLICT DO NOTHING
    `;

    // Cancella e rimborsa prenotazioni già presenti
    const cancelled = await sql`
      UPDATE prenotazioni_slot
      SET stato = 'cancellata_in_tempo', cancellato_il = NOW(), note = ${'Annullata per chiusura studio: ' + (motivo || 'Chiusura programmata')}
      WHERE data = ${dStr}::date AND stato = 'confermata'
      RETURNING atleta_id, email_cliente, credito_scalato
    `;
    for (const bk of cancelled) {
      if (bk.credito_scalato) {
        await sql`UPDATE profili_utenti SET crediti = crediti + 1 WHERE email = ${bk.email_cliente}`;
      }
    }

    cur.setDate(cur.getDate() + 1);
  }

  // Slitta le scadenze se richiesto
  if (proroga_scadenze !== false) {
    await sql`
      UPDATE profili_utenti
      SET data_scadenza_crediti = data_scadenza_crediti + (${giorniChiusura} || ' days')::interval
      WHERE ruolo = 'atleta' AND stato_iscrizione != 'dismesso' AND data_scadenza_crediti >= ${data_inizio}::date
    `;
  }

  return c.json({
    ok: true,
    giorni_chiusura: giorniChiusura,
    messaggio: `Chiusura studio registrata per ${giorniChiusura} giorni (${data_inizio} ➔ ${data_fine}). Scadenze atleti prorogate automaticamente.`,
  });
});

app.delete("/app-api/eccezioni-calendario/:id", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const id = c.req.param("id");
  await sql`DELETE FROM eccezioni_calendario WHERE id = ${id}`;
  return c.json({ ok: true });
});

// ─── Attività Lab & Regole Palinsesto ────────────────────────────────────────
app.get("/app-api/attivita", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const rows = await sql`SELECT * FROM attivita_lab ORDER BY created_at ASC`;
    return c.json(rows);
  } catch {
    return c.json([
      {
        id: "act-landmine-lab",
        nome: "Landmine Lab",
        descrizione: "Allenamento guidato al Landmine Lab con programmazione progressiva",
        costo_crediti: 1,
        max_partecipanti: 1,
        durata_minuti: 60,
        colore: "#1c00ff",
        attiva: true,
      },
    ]);
  }
});

app.post("/app-api/attivita", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const body = await c.req.json();
    const id = body.id || `act-${Date.now()}`;
    const rows = await sql`
      INSERT INTO attivita_lab (id, nome, descrizione, costo_crediti, max_partecipanti, durata_minuti, colore, attiva)
      VALUES (${id}, ${body.nome}, ${body.descrizione || ""}, ${body.costo_crediti || 1}, ${body.max_partecipanti || 1}, ${body.durata_minuti || 60}, ${body.colore || "#1c00ff"}, ${body.attiva !== false})
      RETURNING *
    `;
    return c.json(rows[0], 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.put("/app-api/attivita/:id", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const id = c.req.param("id");
    const body = await c.req.json();
    const rows = await sql`
      UPDATE attivita_lab
      SET nome = COALESCE(${body.nome}, nome),
          descrizione = COALESCE(${body.descrizione}, descrizione),
          costo_crediti = COALESCE(${body.costo_crediti}, costo_crediti),
          max_partecipanti = COALESCE(${body.max_partecipanti}, max_partecipanti),
          durata_minuti = COALESCE(${body.durata_minuti}, durata_minuti),
          colore = COALESCE(${body.colore}, colore),
          attiva = COALESCE(${body.attiva}, attiva)
      WHERE id = ${id}
      RETURNING *
    `;
    return c.json(rows[0] || { ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete("/app-api/attivita/:id", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const id = c.req.param("id");
    await sql`DELETE FROM attivita_lab WHERE id = ${id}`;
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/app-api/regole-palinsesto", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const rows = await sql`SELECT * FROM regole_palinsesto ORDER BY created_at ASC`;
    return c.json(rows);
  } catch {
    return c.json([
      {
        id: "rule-landmine-2026-2027",
        nome: "Orario Ordinario Landmine Lab",
        id_attivita: "act-landmine-lab",
        data_inizio: "2026-09-01",
        data_fine: "2027-07-31",
        giorni_settimana: [1, 3, 5],
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
      },
    ]);
  }
});

app.post("/app-api/regole-palinsesto", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const body = await c.req.json();
    const id = body.id || `rule-${Date.now()}`;
    const rows = await sql`
      INSERT INTO regole_palinsesto (id, nome, id_attivita, data_inizio, data_fine, giorni_settimana, fasce_orarie, attiva)
      VALUES (${id}, ${body.nome}, ${body.id_attivita || "act-landmine-lab"}, ${body.data_inizio}, ${body.data_fine || null}, ${JSON.stringify(body.giorni_settimana)}::jsonb, ${JSON.stringify(body.fasce_orarie)}::jsonb, ${body.attiva !== false})
      RETURNING *
    `;
    return c.json(rows[0], 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.put("/app-api/regole-palinsesto/:id", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const id = c.req.param("id");
    const body = await c.req.json();
    const rows = await sql`
      UPDATE regole_palinsesto
      SET nome = COALESCE(${body.nome}, nome),
          id_attivita = COALESCE(${body.id_attivita}, id_attivita),
          data_inizio = COALESCE(${body.data_inizio}, data_inizio),
          data_fine = COALESCE(${body.data_fine}, data_fine),
          giorni_settimana = COALESCE(${body.giorni_settimana ? JSON.stringify(body.giorni_settimana) : null}::jsonb, giorni_settimana),
          fasce_orarie = COALESCE(${body.fasce_orarie ? JSON.stringify(body.fasce_orarie) : null}::jsonb, fasce_orarie),
          attiva = COALESCE(${body.attiva}, attiva)
      WHERE id = ${id}
      RETURNING *
    `;
    return c.json(rows[0] || { ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete("/app-api/regole-palinsesto/:id", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const id = c.req.param("id");
    await sql`DELETE FROM regole_palinsesto WHERE id = ${id}`;
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default { fetch: app.fetch };