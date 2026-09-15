import { Hono } from "hono";
import { neon, types } from "@neondatabase/serverless";
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

export default { fetch: app.fetch };