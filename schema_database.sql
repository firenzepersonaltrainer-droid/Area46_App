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

-- ─────────────────────────────────────────
-- profili_utenti
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profili_utenti (
  id                    text PRIMARY KEY,
  email                 text NOT NULL UNIQUE,
  nome                  text NOT NULL,
  cognome               text NOT NULL,
  telefono              text,
  codice_fiscale        text,
  indirizzo             text,
  ruolo                 text NOT NULL DEFAULT 'atleta', -- 'manager' | 'atleta'
  crediti               integer NOT NULL DEFAULT 0, -- supporta valori negativi per debiti
  data_scadenza_crediti date,
  data_ultimo_accesso   timestamptz DEFAULT now(),
  note_coach            text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
COMMENT ON TABLE profili_utenti IS 'Anagrafica atleti e staff coach Area46. Contiene saldo crediti (anche negativo per debiti), scadenza e monitoraggio inattività 6 mesi.';

-- ─────────────────────────────────────────
-- configurazione_lab
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS configurazione_lab (
  id                      integer PRIMARY KEY DEFAULT 1,
  tempo_cancellazione_ore integer NOT NULL DEFAULT 24, -- 12, 24, 36, 48
  iban                    text,
  intestatario_iban       text,
  banca                   text,
  notifica_email          text,
  notifica_whatsapp       text,
  orari_disponibili       jsonb,
  giorni_aperti           jsonb,
  inattivita_mesi_reset   integer NOT NULL DEFAULT 6,
  updated_at              timestamptz DEFAULT now()
);
COMMENT ON TABLE configurazione_lab IS 'Configurazione globale del Lab: policy cancellazione slot, coordinate bancarie, orari e alert.';

-- ─────────────────────────────────────────
-- prenotazioni_slot
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prenotazioni_slot (
  id                text PRIMARY KEY,
  data              date NOT NULL,
  orario            text NOT NULL,
  atleta_id         text REFERENCES profili_utenti(id),
  email_cliente     text NOT NULL,
  nome_cliente      text NOT NULL,
  telefono_cliente  text,
  stato             text NOT NULL DEFAULT 'confermata', -- 'confermata', 'cancellata_in_tempo', 'cancellata_tardiva', 'completata'
  credito_scalato   boolean NOT NULL DEFAULT true,
  note              text,
  cancellato_il     timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (data, orario, stato) -- garantisce slot 1:1 rigoroso
);
COMMENT ON TABLE prenotazioni_slot IS 'Prenotazioni individuali 1:1 degli slot Landmine Lab. Lock rigoroso a capienza 1.';

-- ─────────────────────────────────────────
-- tariffario_pacchetti
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tariffario_pacchetti (
  id              text PRIMARY KEY,
  nome            text NOT NULL,
  descrizione     text,
  crediti         integer NOT NULL,
  giorni_validita integer NOT NULL,
  prezzo_euro     numeric(10,2) NOT NULL,
  tipo            text NOT NULL DEFAULT 'consumo', -- 'consumo', 'ricorrente_4mesi'
  attivo          boolean NOT NULL DEFAULT true,
  badge           text,
  created_at      timestamptz DEFAULT now()
);
COMMENT ON TABLE tariffario_pacchetti IS 'Catalogo carnet e pacchetti di sedute 1:1 con prezzi, crediti e durata.';

-- ─────────────────────────────────────────
-- transazioni_pagamenti
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transazioni_pagamenti (
  codice_transazione         text PRIMARY KEY,
  atleta_id                  text REFERENCES profili_utenti(id),
  email_cliente              text NOT NULL,
  nome_cliente               text NOT NULL,
  codice_fiscale             text,
  indirizzo                  text,
  id_pacchetto               text REFERENCES tariffario_pacchetti(id),
  nome_pacchetto             text NOT NULL,
  importo_euro               numeric(10,2) NOT NULL,
  metodo                     text NOT NULL, -- 'carta', 'apple_pay', 'google_pay', 'paypal', 'bonifico'
  crediti_acquistati         integer NOT NULL,
  debiti_decurtati           integer NOT NULL DEFAULT 0,
  crediti_effettivi_aggiunti integer NOT NULL,
  causale_bonifico           text,
  stato                      text NOT NULL DEFAULT 'completato', -- 'completato', 'in_attesa_bonifico'
  stato_fattura              text NOT NULL DEFAULT 'da_emettere', -- 'da_emettere', 'emessa', 'sincronizzata_esterna'
  approvato_il               timestamptz,
  created_at                 timestamptz DEFAULT now()
);
COMMENT ON TABLE transazioni_pagamenti IS 'Storico pagamenti e ricariche con tracciamento detrazione debiti e predisposizione fiscale per InvoiceBuddy e futura app autonoma.';
```
