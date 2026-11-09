# AREA46 TRAINING LAB - REGOLE DI SISTEMA E METODOLOGIA (LIVELLO PRO)

Vedi dettagli completi in [AGENTS.md](file:///Users/stefy/Desktop/Area46_App/AGENTS.md) e [LINEE_GUIDA_AREA46_PRO.md](file:///Users/stefy/Desktop/Area46_App/LINEE_GUIDA_AREA46_PRO.md).

Regole Tassative:
1. Livello PRO: Mesocicli da 18 sedute (3 Cicli da 6 sedute A-B-A-B-A-B).
2. Tetto 60 minuti max a seduta. Soddisfazione amatore > laboratorio.
3. Scarico di default: Modalità B (sostituzione con destrezza/mobilità/qualità).
4. Rotazione lenta per fondamentali di forza (onde RPE), veloce per accessori/metcon/skill (copertura 160 esercizi).
5. Mai sovraccarico anca; garantire stimolo per braccia/spalle.
6. Notazione asimmetrica obbligatoria con `+` (es. `8+8`). Nessuna speed ladder nei circuiti/AMRAP.
7. Sincronizzazione Glide: Ad ogni apertura della conversazione eseguire `npm run sync-glide` per sincronizzare SOLO anagrafica e diario atleti da Glide fino a sua dismissione. Preservare crediti, scadenze e fisco.
8. Struttura Blindata: Eseguire `npm run verify` e `npm run backup` prima di modifiche strutturali. Dati atleti, crediti, prenotazioni e storico carichi non possono mai essere sovrascritti o cancellati. Rispetto rigoroso dei moduli in data/vault/.
9. Agente Guardiano e Regole Esecutive: Il database `data/vault/regole_esercizi_metodologia.json` governa i vincoli di tutti i 163 esercizi PRO (es. Coiled Cobra solo a tempo continuo alternato senza '+', notazione '+' obbligatoria per unilaterali, avvisi sicurezza clave, no speed ladder in AMRAP). Eseguire obbligatoriamente `npm run guardian` prima di convalidare o pubblicare nuovi cicli.
10. Filosofia Didattica del Coach: Nuovi esercizi a progressione a 3 fasi nel ciclo (1ª seduta costruzione con coach senza fretta, 2ª seduta 4x10 lento e tecnico, 3ª seduta a tempo ed esplosivo). Divieto RPE su tenute isometriche/core (es. Traverse hold: indicare 'creare contro-rotazione del bacino su torace'). RPE con clausola di salvaguardia tecnica se il movimento è incerto (es. Pendulum lunge). Progressioni AMRAP crescenti (10' -> 11' -> 13'). Video link sempre specifici e mai riciclati per copia-incolla.
11. Regole Specifiche Vincolanti:
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


