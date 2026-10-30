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

