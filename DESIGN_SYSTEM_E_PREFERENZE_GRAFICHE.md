# DESIGN SYSTEM & REGISTRO UNIFICATO DELLO STILE (SGG & AREA46)
## Supervisionato da: "L'Artista" (Gestionale SGG) in sinergia con "Art Director Area46" (Marketing Strategy)

**Data Attivazione:** 12 Novembre 2026  
**Ruolo:** Registro vincolante di stile, gusti, ergonomia d'uso e decisioni grafiche per l'ecosistema di Stefano Tronconi.  
**Ponte di Sincronizzazione:** Collegato a `/Users/stefy/Desktop/Marketing Strategy/REGISTRO_APPRENDIMENTO_MEMORIA.md`.

---

### 1. LA LINEA COMUNE GLOBALE (FILOSOFIA UNIFICATA)
Ogni prodotto, interfaccia, piattaforma, documento, video o post dell'ecosistema di Stefano Tronconi risponde alla stessa matrice identitaria:
1. **Stile Athletic-Luxury Contemporaneo:** Neri profondi, contrasti elevati, metallo, essenzialità, pulizia clinica. Zero template generici, zero estetica commerciale datata.
2. **De-cluttering & Respiro (Minimalismo Funzionale):** Eliminare ogni elemento decorativo superfluo. Spaziature ariose, margini di sicurezza generosi, gerarchia visiva immediata.
3. **Prima Persona Singolare Assoluta:** Mai il plurale ("noi", "il nostro studio"). Sempre la guida diretta, autorevole e su misura di Stefano.
4. **Tutela Assoluta del Soggetto e del Contenuto:** Mai coprire anatomia, sguardi, traiettorie di movimento o numeri chiave con fasce pesanti o banner invasivi. I testi vivono nello spazio negativo.
5. **Safe Zone 1:1 Centrale (Permanente su tutti i media):** In qualsiasi card, anteprima o post verticale, gli elementi vitali (titoli, badge, KPI, logo) devono rimanere perfettamente integri, leggibili e centrati nel quadrato centrale 1:1 con abbondante margine interno.
6. **Brand Colors Intoccabili & Aspetto Dark (App Utenti):** L'interfaccia delle app per gli utenti adotta un aspetto "scuro" (dark theme materico ed elegante). I colori ufficiali del brand di Stefano sono già decisi e blindati: **Giallo (#F9DE47)** e **Blu Elettrico/Royal (#1900F2)**. Qualsiasi declinazione visiva o nuovo brand elaborato deve tassativamente rimandare a tali colori o includerli come accenti e riferimenti identitari imprescindibili.

---

### 2. SINERGIA BIUNIVOCA: "L'ARTISTA" ⇄ "ART DIRECTOR AREA46"

| Ambito | Art Director Area46 (Marketing & Canali Esterni) | L'Artista (SGG, Gestionale & Canali Interni) |
| :--- | :--- | :--- |
| **Dominio Principale** | Social (Instagram, Reels, Caroselli), Google Maps / GBP, Sito Web `personaltrainer.firenze.it`, Campagne. | Gestionale SGG (Desktop `index.html` e Mobile `m.html`), PDF contabili, Dashboard manageriale, App atleti. |
| **Scopo Primario** | Impatto emotivo, autorevolezza, posizionamento premium, conversione clienti. | Massima efficienza del manager, leggibilità istantanea dei KPI, zero attrito, bellezza sobria. |
| **Condivisione Regole** | Ogni nuova regola o gusto registrato in `Marketing Strategy` viene ereditato e rispettato da SGG. | Ogni pattern o decisione ergonomica validata in SGG viene notificata all'Art Director per mantenere continuità visiva. |
| **Piattaforma Comune** | Font geometrici moderni, accenti colore calibrati (nero profondo, bianco nitido, giallo/oro, tocchi blu navy). | Stessa palette, stessi caratteri, stessa purezza visiva adattata all'ergonomia software. |

---

### 3. CRITERI DI DESIGN PER IL GESTIONALE SGG (CURATI DA "L'ARTISTA")

#### A. Ergonomia del Manager (Stefano al Comando)
- **Regola dell'Istante (1 Secondo):** Incassi del mese, atleti con sedute a debito, alert fatture e scadenze fiscali devono essere colti con una singola occhiata.
- **Azioni Rapide:** Le funzioni ad altissima frequenza (es. "Segna seduta", "Nuovo incasso", "Emetti fattura") devono richiedere il minimo percorso di click/tap.
- **Gerarchia a Doppio Livello:** I comandi primari devono risaltare; i comandi distruttivi (elimina, storno) devono essere protetti e discreti.

#### B. Ergonomia Duale Reale: Desktop vs Mobile Sala Operativa
- **Desktop (`index.html` / `styles.css`):**
  - Progettato per il lavoro da scrivania con mouse e tastiera.
  - Sfruttamento intelligente della larghezza dello schermo: cruscotto a più colonne, tabelle dense ma con spaziatura rilassante, filtri rapidi sempre visibili.
- **Mobile (`m.html` / `mobile.css`):**
  - Progettato per l'uso con una sola mano tra un cliente e l'altro in sala operativa.
  - Bottoni grandi e "thumb-friendly" posizionati nelle zone raggiungibili dal pollice.
  - Zero tabelle orizzontali larghe: conversione automatica in card verticali sintetiche.
  - Zero zoom o scorrimenti orizzontali accidentali.

#### C. Semantica Cromatica Funzionale (Color Encoding)
I colori non hanno scopo decorativo, ma hanno un significato operativo rigoroso:
- 🟢 **Verde Smeraldo / Foresta:** Incassi confermati, pagamenti saldati, sedute regolarmente fruite, bilancio in attivo.
- 🔴 **Rosso / Cremisi:** Fatture insolute, atleti a debito sedute, uscite/costi vivi, alert fiscali urgenti.
- 🟡 / 🟠 **Ambra / Arancio:** Preventivi/proforma in attesa, rinnovi abbonamento vicini alla scadenza (ultimi 7 giorni).
- 🔵 **Indaco / Blu Notte:** Elementi interattivi neutri, tab di navigazione attive, stato anagrafica.
- ⚫ / ⚪ **Sfondi e Superfici:** Contrasto elevato, gerarchia pulita tra sfondo scuro/chiaro, card in rilievo e finestre modali.

---

### 4. I TABÙ E GLI ANTI-PATTERN VIETATI
- ❌ **Sovraffollamento & Rumore:** Nessuna schermata stipata di scritte minuscole o icone non intuitive.
- ❌ **Effetto "Arlecchino":** Vietato usare più di due colori d'accento nella stessa vista o associare colori operativi (verde/rosso) a elementi neutri.
- ❌ **Tabelle orizzontali su Smartphone:** Bandite categoricamente nella versione mobile.
- ❌ **Testi o pulsanti a filo bordo:** Rispettare sempre il padding interno di respiro (almeno 16-24px su desktop, 12-16px su mobile).
- ❌ **Parole vietate dal vocabolario aziendale:** *MAI usare "biomeccanica"* (utilizzare "pattern motorio", "schemi motori funzionali" o "cinematica del movimento").

---

### 5. REGISTRO APPRENDIMENTI & DECISIONI GRAFICHE DI STEFANO
*Questo registro viene costantemente arricchito da L'Artista ogni volta che Stefano esprime una preferenza, approvazione o correzione in chat.*

- **12/11/2026:** Nascita ufficiale dell'agente **L'Artista**. Stabilita la sinergia permanente con l'**Art Director Area46** del progetto Marketing Strategy per creare un'unica identità visiva trasversale tra prodotti esterni (social, maps, web) e gestionali interni (SGG).
- **13/11/2026 - Aspetto Dark & Vincolo Colori del Brand (Blu-Giallo):** Approvato l'aspetto/tema "scuro" per le app destinate agli utenti. Vincolo perentorio e permanente: i colori del brand Area46 / Stefano Tronconi sono già decisi e blindati (Giallo `#F9DE47` e Blu Elettrico/Royal `#1900F2`). Qualsiasi declinazione visiva o nuovo brand/sub-brand elaborato DEVE tassativamente rimandare a tali colori o includerli come accenti, luci o elementi identitari fondamentali.
- **17/11/2026 - Mandato di Fotoritocco Anatomico Autonomo (Zero Consenso Preventivo):** L'Artista e l'Art Director Area46 hanno il mandato esplicito e permanente di valutare autonomamente le proporzioni e le silhouette dei protagonisti in ogni foto o ripresa visiva. Se le misure (pienezza/rotondità dei glutei, proporzioni del giro vita, tonicità atletica) non sono propriamente da standard fitness/atletico elevato, l'agente interviene con fotoritocco/ritocco grafico in totale autonomia, senza necessità di chiedere preventivamente l'approvazione a Stefano. Il risultato deve essere sempre armonioso, pulito e con sfondo naturale integro.
- **17/11/2026 - Attivazione Skill "morphological-photo-retouching" per L'Artista:** Integrata la competenza tecnica chirurgica di rimodellamento anatomico (`morphological-photo-retouching`). **Regola Tecnica Assoluta:** Mai affidarsi a rigenerazioni con prompt AI generici (che allucinano lo sfondo, piegano i montanti/rack e cancellano la grana fotografica). Il ritocco morfologico viene eseguito mediante deformazione elastica/spline a raggio controllato (Lanczos4/Bicubic) con decadimento a zero prima dello sfondo, verifica contrasto su canali LAB/CLAHE e convalida visiva tramite Heatmap di spostamento reale dei pixel (Regola Zero).
- **18/11/2026 - Ergonomia Temporale dei Controlli, Compattezza Header & Simmetria Grafica Orizzontale (UI Allenamenti):**
  1. *Recupero Spazio Verticale & Header Monoriga:* L'header delle schede/pagine deve risiedere su una **singola linea orizzontale** (titolo allenamento giustificato a sinistra, badge livello e ciclo a destra con micro-badge di stato completato), con altezza massima compattata a filo (~40-44px). Vietati header espansi su 2-3 righe che divorano lo spazio utile.
  2. *Ergonomia Temporale di Chiusura:* I controlli di completamento seduta e feedback appartengono fisiologicamente a **fine schermata** (dopo la sequenza degli esercizi), mai in cima.
  3. *Top Bar Compatta & De-cluttering Breadcrumb:* Vietato occupare righe con breadcrumb testuali prolissi ("Allenamenti > Ciclo X..."). Sostituirli con una **freccia verso sinistra compatta** ("< Torna al Ciclo") e allineare sul lato opposto (destro) il comando di **Stampa Scheda A4** su una sola linea orizzontale.
  4. *Stampa Scheda Formato Sheet / Tabella A4 da Sala:* Il tasto stampa NON deve mai stampare la schermata web dell'app. Deve renderizzare un **vero foglio cartaceo da sala pesi (Sheet A4)** con tabella ad alto contrasto, colonne Seq, Esercizio, Target, Rec/RBS, 4 caselle vuote per annotare i carichi effettivi a penna (Set 1, Set 2, Set 3, Set 4) e box per RPE/note scritte, permettendo all'atleta di allenarsi senza smartphone. L'UI interattiva web viene nascosta al 100% in stampa.
  5. *Separazione Gerarchica Feedback vs Spunte di Stato:*
     - Il pulsante **Feedback & RPE** vive **fuori e sopra** al box delle spunte, allargato a tutto schermo (`w-full`), con spessore snello e compatto (~40px).
     - Sotto di esso, un **box unico** racchiude **le 3 spunte di stato** (*Da svolgere*, *In corso*, *Completato*) disposte in **un'unica linea orizzontale**, con **stessa identica forma e dimensione** (1/3 di larghezza ciascuna) e **colori differenti** (rosso, arancio, verde).


