# AREA46 TRAINING LAB - REGOLE DI SISTEMA E METODOLOGIA (LIVELLO PRO)

Vedi dettagli completi in [AGENTS.md](file:///Users/stefy/Desktop/Area46_App/AGENTS.md) e [LINEE_GUIDA_AREA46_PRO.md](file:///Users/stefy/Desktop/Area46_App/LINEE_GUIDA_AREA46_PRO.md).

Regole Tassative:
1. Livello PRO: Mesocicli da 18 sedute (3 Cicli da 6 sedute A-B-A-B-A-B).
2. Tetto 60 minuti max a seduta. Soddisfazione amatore > laboratorio.
3. Scarico di default: Modalità B (sostituzione con destrezza/mobilità/qualità).
4. Rotazione lenta per fondamentali di forza (onde RPE), veloce per accessori/metcon/skill (copertura 160 esercizi).
5. Mai sovraccarico anca; garantire stimolo per braccia/spalle.
6. Notazione asimmetrica obbligatoria con `+` (es. `8+8`). Nessuna speed ladder nei circuiti/AMRAP.
7. Dismissione Definitiva Glide: Glide Apps e il relativo account sono stati definitivamente dismessi e chiusi da Stefano Tronconi. Nessun atleta vi accede più: la sincronizzazione non è più necessaria.
8. Struttura Blindata: Eseguire `npm run verify` e `npm run backup` prima di modifiche strutturali. Dati atleti, crediti, prenotazioni e storico carichi non possono mai essere sovrascritti o cancellati. Rispetto rigoroso dei moduli in data/vault/.
9. Agente Guardiano e Regole Esecutive: Il database `data/vault/regole_esercizi_metodologia.json` governa i vincoli di tutti i 163 esercizi PRO (es. Coiled Cobra solo a tempo continuo alternato senza '+', notazione '+' obbligatoria per unilaterali, avvisi sicurezza clave, no speed ladder in AMRAP). Eseguire obbligatoriamente `npm run guardian` prima di convalidare o pubblicare nuovi cicli.
10. Filosofia Didattica del Coach: Nuovi esercizi a progressione a 3 fasi nel ciclo (1ª seduta costruzione con coach senza fretta, 2ª seduta 4x10 lento e tecnico, 3ª seduta a tempo ed esplosivo). Divieto RPE su tenute isometriche/core (es. Traverse hold: indicare 'creare contro-rotazione del bacino su torace'). RPE con clausola di salvaguardia tecnica se il movimento è incerto (es. Pendulum lunge). Progressioni AMRAP crescenti (10' -> 11' -> 13'). Video link sempre specifici e mai riciclati per copia-incolla.
11. Regole Specifiche Vincolanti:
    - COMBO Landmine Split snatch High hand switch T/GO (ID 128): esercizio ad alto RPE con scambio aereo continuo alternando dx e sx Touch & Go. Prescrivere a volume ridotto cumulativo alternato continuo (4 X 8 in C7, 4 X 6 in C8) con recupero a fine serie, MAI notazione con '+' (mai 4x6+6 o 4x5+5).
    - Mai separare Matador Underhand/Overhand in PRO: usare sempre ID 242 (Underhand/Overhand Matador Transitions).
    - Mai pliometria/potenza a freddo (es. Landmine quick Hops ID 099 vietato in blocco 1).
    - Esercizi home training (es. Push the wall squat ID 042) vietati nel condizionamento PRO.
    - Esercizi consolidati dai livelli precedenti (es. High Pull ID 065) NON necessitano di progressione a 3 fasi in PRO.
    - Distinzione netta video dinamico vs isometrico (High Pull dinamico Fsi34_9SXTU vs ISO A2eyrizhMVM) e zero collisioni (Gymnasty ABS ID 239 separato da Knee drives ID 240).
    - Wall driver ID 047 è alternato continuo: prescrivere a tempo (es. 3 X 45"), mai con notazione '+'.
    - Split Jumps sagittale (ID 134) è la propedeutica obbligatoria di Aerial Jerk (ID 120): non invertire mai la gerarchia.
    - Flow Rope e Jumping Rope (es. Dragon Roll ID 106): solo parametri a tempo (es. 30"+30"), mai a ripetizioni (ammesse solo per élite e da 50 rep in su).
    - Landmine Coiled Deadlift (ID 056): alternanza con senso (X 6 continuo alternato per aumentare il carico; 6+6 per accumulo volume). Nelle serie pesanti X 6 nota obbligatoria: 'svolgi adeguate serie di avvicinamento prima delle serie allenanti che dovranno arrivare ad RPE 8'.
    - Skierg lunges (ID 227): nota obbligatoria 'NB: svolgere la tirata con tecnica “pagaia”, sul lato della gamba fissa (anteriore)'.
    - Linguaggio semplice per l'amatore: mai gergo accademico o astratto; divieto assoluto del termine 'biomeccanica' nelle note rivolte agli atleti (usare 'geometria di movimento', 'pattern motorio' o 'economia del gesto').
12. PRINCIPIO METODOLOGICO PERMANENTE (ZERO ASSOLUTISMI / TUTTO È CONTESTO):
    In allenamento il termine "obbligatorio" NON ESISTE: l'allenamento non ha dogmi assoluti, è sempre soggettivo, contestualizzato e multifattoriale. Qualsiasi parametro (RBS - Rest Between Sides, carichi, serie, ripetizioni, recuperi, selezione esercizi) viene valutato liberamente in base a:
    1. Obiettivi specifici di esercizio, seduta, ciclo e macrociclo;
    2. Durata dell'esercizio e tempo totale a disposizione: **il tetto dei 60 minuti vale solo ed esclusivamente per chi si allena presso lo studio con Landmine Lab**. Nella futura **AI PT Assistant App**, il sistema DEVE **chiedere al coach** se è necessario rispettare la regola dei 60 minuti oppure no prima di decidere come programmare le sessioni;
    3. BPM e risposta cardiorespiratoria / densità metabolica;
    4. Intensità di carico e lunghezza della serie;
    5. Principio di Varietà (alternare ciclicamente le modalità per creare nuovi stimoli ed evitare l'adattamento);
    6. Caratteristiche intrinseche, individuali, posturali, caratteriali, attitudinali e transitorie del soggetto.
    Questo assunto è vincolante come fondamento metodologico per TUTTI gli agenti (presenti e futuri) che si occupano di programmazione di allenamento ed esercizio.
13. ERGONOMIA TEMPORALE DEI CONTROLLI & SIMMETRIA GRAFICA (L'ARTISTA - 18/11/2026):
    - *Header Compatto Monoriga:* Titoli di seduta ed etichette (livello, ciclo, badge completato) devono risiedere su una singola linea orizzontale compatta (~40-44px), per azzerare lo spreco di spazio verticale e mostrare immediatamente gli esercizi.
    - *Ergonomia Temporale di Chiusura:* I controlli di completamento ("Segna come completato", selettori stato "Da svolgere"/"In corso" e "Feedback & RPE") appartengono categoricamente al fondo della schermata, DOPO i blocchi esercizi. L'atleta apre la schermata per allenarsi, non per chiudere in anticipo una seduta da compiere.
    - *Simmetria Orizzontale & Divieto Asimmetrie Pigre:* Vietato ammassare elementi a sinistra lasciando il lato destro dello schermo sprecato e vuoto. Tutti i box devono sfruttare la larghezza in modo armonioso con `justify-between`, centratura simmetrica o distribuzione bilanciata su 1 o al massimo 2 linee compatte.
14. PRESCRIZIONE ESERCIZI MONOLATERALI & STEP UP ESPLOSIVO ALTERNATO (ID 201) (18/11/2026):
    - *Regola Generale Prescrizione Monolaterali:* D'ora in avanti, nella prescrizione di qualsiasi esercizio monolaterale, il sistema/agente **DEVE chiedere preventivamente conferma a Stefano** se prescriverlo `x+x` (per lato con RBS o continuo) oppure `x totale` (alternato/totale).
    - *Step Up esplosivo alternato (ID 201):* È un esercizio che si svolge alternando gamba destra e sinistra. Parametro tassativo a ripetizioni totali alternate (es. `3x10` o `X 10`). È fatto **DIVIETO ASSOLUTO** della notazione `+` (mai `8+8` o simili). Questa logica è vincolante per tutti gli allenamenti A del ciclo e per tutte le prescrizioni future dello Step Up esplosivo.
15. FEEDBACK POST-WORKOUT & CONSIGLI DEL COACH (18/11/2026):
    - *Priorità Assoluta alla Nota Vocale:* L'AI deve comprendere, trascrivere e sintetizzare la nota vocale nel report coach.
    - *Destinazione Seduta Successiva:* I consigli del coach o modulazioni carichi/scarico NON devono MAI comparire nella seduta appena conclusa, bensì sempre nella **seduta successiva** (es. Seduta 43 $\rightarrow$ consiglio per Seduta 44).
    - *Spettro Bipolare (Scarico vs Spinta):* Prevedere sia scarico se duro, sia l'indicazione di **spingere maggiormente** (+carico / +intensità) se l'allenamento è risultato agevole.
    - *Sovranità Esclusiva del Coach & Ricevuta Atleta:* Il consiglio compare all'atleta **solo previa approvazione esplicita del Coach Stefano**; all'invio del form l'atleta riceve solo la conferma di avvenuto recapito.
    - *Risposta Vocale del Coach per la Seduta Futura:* Il Coach Stefano può registrare una propria nota vocale di risposta per la seduta successiva (es. Seduta 44 per feedback della 43): l'atleta la troverà ed ascolterà aprendo la seduta del giorno.
16. VAULT SINGLE SOURCE OF TRUTH & ZERO-REGRESSION CALENDARIO (REGOLA 19/11/2026):
    - Il modulo `data/vault/2_gestionale_calendario.json` è la Single Source of Truth assoluta per prenotazioni ed eccezioni/chiusure di calendario.
    - All'avvio del server (`loadData()`), i dati del Vault hanno precedenza gerarchica assoluta rispetto a file statici o temporanei.
    - Nessun aggiornamento di contenuti o commit Git può cancellare o far regredire lo stato del calendario; qualsiasi merge cloud/locale adotta una union map additiva conservativa.
    - Lo script `scripts/state_integrity_guard.mjs` integrato in `npm run verify` impedisce la perdita di blocchi e chiusure (inclusi i blocchi festività natalizie 25-12 -> 06-01).



