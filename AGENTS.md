# AREA46 TRAINING LAB - REGOLE DI SISTEMA E METODOLOGIA (LIVELLO PRO)

Queste regole sono vincolanti per qualsiasi agente AI che operi nel workspace `Area46_App` e debba generare o modificare programmi per il livello **PRO**.

---

## 1. VISIONE E MISSIONE DEL LIVELLO PRO
* **Target di atleti**: Amatori avanzati che hanno già completato *Entry Level, Level 1, Level 2 e Advanced*. Hanno competenza motoria e stabilità articolare per gestire carichi submassimali e massimali al Landmine.
* **Database Esclusivo PRO**: Per il Livello PRO la fonte di estrazione degli esercizi è **UNICAMENTE ED ESCLUSIVAMENTE** il documento `PRO database esercizi` (attraverso le sue 6 schede di categoria: *forza e struttura, potenza e balistica, skill e combo, engine e benchmark, pliometria e agility, warm up e mobilità*, ignorando la scheda *elenco completo*). **MAI** attingere ad altri elenchi o al database generale Lab per la selezione degli esercizi PRO.
* **Obiettivo del Livello PRO**: Condurre gli atleti a sperimentare, apprendere e stabilizzare tutti i **163 esercizi** del catalogo PRO, sviluppando tutte le capacità condizionali e coordinative prima dell'accesso ai livelli *Master*.
* **Punto di Partenza del nuovo sistema**: Il **Ciclo 3** rappresenta l'avvio ufficiale della nuova periodizzazione. I Cicli 1 e 2 restano invariati sul foglio come storico di transizione.

---

## 2. STRUTTURA DEI CICLI E MESOCICLI
* **Mesociclo**: Dura **18 sedute complessive**, suddivise in **3 Cicli** (Ciclo 1, Ciclo 2, Ciclo 3).
* **Ciclo (6 sedute fisse)**: Alternanza rigorosa A-B-A-B-A-B:
  `1 allenamento A`, `2 allenamento B`, `3 allenamento A`, `4 allenamento B`, `5 allenamento A`, `6 allenamento B`.
* **Frequenza di fruizione sull'App**:
  - Atleta 3x/settimana $\rightarrow$ chiude il Ciclo in 2 settimane (Mesociclo in 6 settimane).
  - Atleta 2x/settimana $\rightarrow$ chiude il Ciclo in 3 settimane (Mesociclo in 9 settimane).
  - La sequenza numerica e la logica sul foglio sono identiche per tutti.

---

## 3. PRINCIPI METODOLOGICI E SCIENZA DELL'ALLENAMENTO
1. **Regola dei 60 Minuti Massimi**: La durata della seduta non deve MAI superare i 60 minuti.
   - Per sedute di pura forza con carichi pesanti: 4-5 esercizi.
   - Per sedute dinamiche/agilità/circuiti: fino a 8-10 esercizi.
   - Nessun defaticamento o mobilità passiva a fine scheda: l'allenamento è 100% attivo.
2. **Priorità alla Soddisfazione Percepita**: Divertimento, sensazione di allenamento intenso e flow della seduta hanno la priorità rispetto alla rigidità accademica da laboratorio.
3. **Progressione a Onda dell'RPE**:
   - *Fondamentali*: Onda crescente da RPE 7-8 (7-9 ripetizioni) fino a picco RPE 8.5-10 (1-3 ripetizioni) al diminuire del volume.
   - *Complementari*: Onda in controtendenza (volume più alto, 8-15 ripetizioni con RPE 6-8).
   - L'onda è flessibile (può durare 1 o 2 cicli per fase a seconda dell'obiettivo del mesociclo).
4. **Scarico Selettivo (Default: Modalità B)**:
   - Quando un pattern fondamentale tocca il picco dell'onda, entra in scarico nel ciclo successivo.
   - **Modalità B (Regola di default)**: Il movimento pesante esce per un ciclo ed è sostituito da lavoro qualitativo, destrezza, mobilità o propedeutica tecnica.
5. **Rapporto 55 : 35 : 10 (Fondamentali : Complementari : Accessori)**:
   - Calcolato come peso di volume (serie allenanti) sull'intero Mesociclo o Macrociclo con elasticità algoritmica.
   - Consultare sempre i ruoli e i collegamenti incrociati nelle schede (`ID complementare`, `ID propedeutica`, `ID alternativa scalata`, `ID Target`).
6. **Equilibrio Distrettuale ed Estetico**:
   - MAI saturare eccessivamente la catena posteriore e la cerniera d'anca.
   - Garantire SEMPRE stimoli specifici per le braccia (bicipiti/tricipiti) e le spalle.
7. **Guardrails di Notazione**:
   - Esercizi asimmetrici/unilaterali: parametri sempre con notazione `+` (es. `8+8`, `15"+15"`).
   - MAI scalette di velocità (speed ladder) all'interno di circuiti ad alta intensità o AMRAP.

---

## 4. REGISTRI DI STATO E WORKFLOW DI GENERAZIONE
* Prima di generare un nuovo ciclo, consultare:
  1. `LINEE_GUIDA_AREA46_PRO.md`
  2. `registro_periodizzazione_pro.json` (per verificare quali esercizi sono stati usati e quali mancano all'appello dei 160).
  3. Scheda Google Fogli `REGISTRO E LINEE GUIDA PRO`.
* Presentare sempre una proposta di controllo al coach in chat prima di scrivere sul foglio.
* Applicare sempre l'alternanza colori (A grigio chiaro `#F2F2F2`, B bianco `#FFFFFF`) e il bordo inferiore marcato sull'ultima riga del ciclo.

---

## 5. SINCRONIZZAZIONE AUTOMATICA GLIDE (ATTIVA AD OGNI APERTURA FINO A DISMISSIONE DEFINITIVA)
* **Regola Tassativa**: Ad ogni avvio o apertura della conversazione, l'agente DEVE eseguire la sincronizzazione da Glide (`npm run sync-glide` o `node scripts/sync_glide.mjs`).
* **Perimetro di sincronizzazione**: Sincronizzare **esclusivamente i dati anagrafici** (nuovi atleti o aggiornamenti di contatto) e il **diario di allenamento** (nuovi carichi, serie, rep e feedback).
* **Integrità Dati**: MAI toccare, azzerare o sovrascrivere crediti, scadenze carnet, prenotazioni calendario e registrazioni contabili/fisco già governate dal nuovo gestionale Area46.
* **Segnalazione Problematiche**: Se sorgono problematiche di connessione o assenza dati sorgente da Glide, informare tempestivamente il coach con istruzioni chiare per risolverle.
* Questa regola resta vincolante e attiva fino a quando Glide non verrà dismessa definitivamente da Stefano Tronconi.

---

## 6. STRUTTURA BLINDATA, CAMERE STAGNE E INTEGRITÀ DATI ASSOLUTA
* **Backup Obbligatorio Preventivo**: Prima di qualsiasi modifica strutturale o rigenerazione dati, eseguire sempre `npm run backup`.
* **Guardrail di Integrità Dati**: MAI azzerare, sovrascrivere in blocco o corrompere le collezioni `profili_utenti`, `prenotazioni_slot`, `transazioni_pagamenti`, `movimenti_crediti` e `diario_utente`.
* **Camere Stagne (Vault)**: I dati del progetto risiedono compartimentati in `data/vault/` in 6 moduli separati:
  1. `1_gestionale_utenti_crediti.json` (Anagrafiche, crediti e fisco)
  2. `2_gestionale_calendario.json` (Prenotazioni slot e presenze)
  3. `3_atleti_diario_progressi.json` (Pesi sollevati, serie, rep e note)
  4. `4_metodologia_esercizi.json` (163 Esercizi PRO, link video YouTube e correlazioni)
  5. `5_metodologia_allenamenti_cicli.json` (Periodizzazione e schede dei cicli A/B)
  6. `6_configurazione_lab.json` (Palinsesto e impostazioni)
* **Verifica Automatica**: Al termine di qualsiasi sessione di lavoro o script, eseguire sempre `npm run verify` per accertarsi che la soglia minima di atleti, crediti e prenotazioni sia integra al 100%.

---

## 7. DATABASE REGOLE ESECUTIVE E GUARDIANO METODOLOGICO (LIVELLO PRO)
* **Database di Memoria Vincolante**: Il file `data/vault/regole_esercizi_metodologia.json` costituisce la fonte di verità assoluta per i vincoli esecutivi e le modalità di prescrizione di tutti i **163 esercizi PRO**:
  1. *Esercizi alternati continui* (es. `Coiled Cobra`, `skierg pagaia alternato`, `Endless rope alternating pull`): **DIVIETO ASSOLUTO** di prescrizione a ripetizioni fisse o notazione con `+`. Devono essere prescritti solo a tempo continuo (es. `30"-40"`).
  2. *Esercizi asimmetrici / monolaterali*: Obbligo della notazione con `+` (es. `4x8+8`, `3x60"+60"`) e specificazione di `RBS` (Rest Between Sides) ove pertinente.
  3. *Attrezzi rotazionali pesanti (Clave / Bat / Clubbell)*: Obbligo di avviso tecnico nelle note (`utilizzare una clava leggera per le prime volte, per abituare i polsi al movimento senza stressarli troppo`).
  4. *Pliometria e destrezza neurale*: Divieto assoluto di RPE massimale a cedimento (> 8.5).
  5. *Divieto Speed Ladder*: Nessuna scaletta di velocità o footwork dentro blocchi AMRAP o circuiti ad alta densità.
* **Agente Guardiano Metodologico (`npm run guardian`)**:
  - Script guardiano CLI `scripts/guardian_methodology_pro.mjs` invocabile con `npm run guardian` (oppure `npm run guardian -- --all` o `--ciclo=X`).
  - L'Agente `pro_methodology_guardian` verifica automaticamente ogni riga di programmazione, le stime di durata rispetto al tetto dei 60 minuti e la corretta rotazione di scarico in Modalità B.
  - **Regola Tassativa**: Nessun nuovo ciclo PRO può essere validato o pubblicato senza prima aver eseguito con successo `npm run guardian` con zero errori critici.

---

## 8. FILOSOFIA DIDATTICA SUL CAMPO DEL COACH (LOGICHE DI PRESCRIZIONE E MEMORIA)
* **Introduzione di un Nuovo Esercizio (Progressione a 3 Fasi nel Ciclo)**:
  1. *1ª Seduta (Costruzione)*: Parametri `costruzione motoria` / `studio`. Note obbligatorie: `"costruzione dell’esercizio: dedica il tempo necessario all’apprendimento motorio. Chiedi al coach una progressione adeguata al tuo livello"`. Nessun vincolo rigido di tempo o serie x rep.
  2. *2ª Seduta (Controllo Lento)*: Volume controllato e cadenza lenta a rep fisse (es. `4x10` o `4x8+8`). Note obbligatorie: `"lavora con calma e lentezza, dai la precedenza alla tecnica anziché sull’intensità"`.
  3. *3ª Seduta (Espressione Dinamica)*: Target a tempo o esplosività (es. `3x20"+20"`). Note obbligatorie: `"cerca la massima esplosività adeguata al tuo livello"`.
* **RPE e Sensazioni Cinestesiche**:
  - Esercizi isometrici o di tenuta rotazionale/anti-rotazionale (es. `Transverse hold`): **DIVIETO DI RPE NUMERICO**. Sostituire con indicazioni cinestesiche concrete: `"creare contro-rotazione del bacino su torace (chiedi all’istruttore)"`.
  - Movimenti asimmetrici o dinamici incerti (es. `Single Dumbbell Pendulum lunge`): Inserire sempre clausola tecnica di salvaguardia per l'amatore: `"(se il movimento è incerto non tenere conto dell’RPE indicato, concentrati sugli aspetti tecnici)"`.
* **Progressione AMRAP nei Cicli**:
  - L'AMRAP progredisce all'interno delle 3 sedute del ciclo sia in durata (minuti) sia in ripetizioni degli accessori:
    - 1ª seduta B: 10' AMRAP (volume base, es. Skierg wood chopper `x 15+15`).
    - 2ª seduta B: 11' AMRAP (+1 min, volume intermedio `x 20+20`).
    - 3ª seduta B: 13' AMRAP (+2 min, picco di volume `x 25+25`).
* **Integrità Video Link Dimostrativi**:
  - Divieto assoluto di riutilizzare o copiare per convenienza link video tra esercizi differenti. Ogni ID catalogo ha un solo video corrispondente registrato per quel pattern.


