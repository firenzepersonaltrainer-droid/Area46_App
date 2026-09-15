```sql

-- ─────────────────────────────────────────

-- SEQUENCES

-- ─────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS allenamenti_id_seq;

CREATE SEQUENCE IF NOT EXISTS allenamenti_staging_id_seq;

CREATE SEQUENCE IF NOT EXISTS database_esercizi_id_seq;

CREATE SEQUENCE IF NOT EXISTS diario_utente_id_seq;

CREATE SEQUENCE IF NOT EXISTS ordine_livelli_id_seq;

CREATE SEQUENCE IF NOT EXISTS preferenze_utente_id_seq;

CREATE SEQUENCE IF NOT EXISTS stato_allenamenti_id_seq;



-- ─────────────────────────────────────────

-- allenamenti

-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS allenamenti (

  id                bigint DEFAULT nextval('allenamenti_id_seq') NOT NULL PRIMARY KEY,

  livello           text,

  giorno            text,

  settimana         text,

  sequenza          text,

  id_esercizio      text,

  nome_esercizio    text,

  parametri         text,

  recupero          text,

  minutaggio_blocco text,

  note_tecniche     text,

  link_video        text,

  data_pubblicazione date,

  created_at        timestamptz DEFAULT now()

);

COMMENT ON TABLE allenamenti IS 'Schede degli allenamenti sequenziali di Area46 Landmine Lab. Ogni riga rappresenta un esercizio in un giorno specifico, con sequenza, parametri e note tecniche.';



-- ─────────────────────────────────────────

-- allenamenti_staging

-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS allenamenti_staging (

  livello           text,

  giorno_raw        text,

  sequenza          text,

  id_esercizio      text,

  nome_esercizio    text,

  parametri         text,

  recupero          text,

  minutaggio_blocco text,

  note_tecniche     text,

  link_video        text

);



-- ─────────────────────────────────────────

-- database_esercizi

-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS database_esercizi (

  id               bigint DEFAULT nextval('database_esercizi_id_seq') NOT NULL PRIMARY KEY,

  id_esercizio     text NOT NULL,

  nome_reale       text NOT NULL,

  attrezzo         text,

  tag_biomeccanici text,

  link_video       text,

  created_at       timestamptz DEFAULT now()

);

COMMENT ON TABLE database_esercizi IS 'Anagrafica completa degli esercizi di Area46. Contiene attrezzo, tag biomeccanici e link video per ogni esercizio.';



-- ─────────────────────────────────────────

-- diario_utente

-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS diario_utente (

  id             bigint DEFAULT nextval('diario_utente_id_seq') NOT NULL PRIMARY KEY,

  email_cliente  text NOT NULL,

  id_esercizio   text NOT NULL,

  nome_esercizio text,

  carico_kg      numeric,

  ripetizioni    integer,

  serie          integer,

  sets_json      jsonb,

  rpe_json       jsonb,

  feedback       text,

  data_ora       timestamptz DEFAULT now(),

  created_at     timestamptz DEFAULT now()

);

COMMENT ON TABLE diario_utente IS 'Registro dei progressi degli atleti. Ogni riga è una sessione di carico registrata da un cliente, con carico_kg, ripetizioni e serie per il calcolo del tonnellaggio. Filtrata per email per garantire la privacy.';



-- ─────────────────────────────────────────

-- ordine_livelli

-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ordine_livelli (

  id             bigint DEFAULT nextval('ordine_livelli_id_seq') NOT NULL PRIMARY KEY,

  nome_livello   text NOT NULL,

  numero_ordine  integer NOT NULL,

  created_at     timestamptz DEFAULT now()

);

COMMENT ON TABLE ordine_livelli IS 'Ordine personalizzato di visualizzazione dei livelli nel menu a tendina. Numero_ordine crescente = posizione più alta nel menu.';



-- ─────────────────────────────────────────

-- preferenze_utente

-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS preferenze_utente (

  id             bigint DEFAULT nextval('preferenze_utente_id_seq') NOT NULL PRIMARY KEY,

  email_cliente  text NOT NULL UNIQUE,

  memoria_livello text,

  updated_at     timestamptz DEFAULT now()

);

COMMENT ON TABLE preferenze_utente IS 'Memorizza le preferenze per utente: memoria_livello conserva il livello selezionato nella pagina Allenamenti.';



-- ─────────────────────────────────────────

-- stato_allenamenti

-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stato_allenamenti (

  id             bigint DEFAULT nextval('stato_allenamenti_id_seq') NOT NULL PRIMARY KEY,

  email_cliente  text NOT NULL,

  livello        text NOT NULL,

  giorno         integer NOT NULL,

  stato          text NOT NULL DEFAULT 'non_iniziato',

  updated_at     timestamptz DEFAULT now(),

  created_at     timestamptz DEFAULT now(),

  UNIQUE (email_cliente, livello, giorno)

);

COMMENT ON TABLE stato_allenamenti IS 'Tracciamento dello stato degli allenamenti per atleta. Uno stato per combinazione email+livello+giorno. Valori: non_iniziato, in_corso, completato.';

```



---

