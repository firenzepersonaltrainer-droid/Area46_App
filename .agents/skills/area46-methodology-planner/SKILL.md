---
name: area46-methodology-planner
description: >-
  Protocollo di Pre-Flight Reasoning e simulatore in memoria (Dry-Run Sandbox) per la programmazione
  di allenamento di Livello PRO per il Coach Stefano Tronconi (Area46 App & Landmine Lab).
  Filtra e certifica a monte ogni singolo esercizio, parametro e nota prima della scrittura su disco.
---

# Area46 Methodology Planner — Pre-Flight Reasoning & Dry-Run Sandbox

Questa skill definisce il protocollo obbligatorio di **Pre-Flight Reasoning** per qualsiasi agente AI incaricato di ideare, strutturare o revisionare schede di allenamento (Livello PRO) per il Coach Stefano Tronconi (**Area46 App** e **Landmine Lab**).

---

## 1. Contesto e Principio Architetturale a Monte

Fino ad oggi, i vincoli pedagogici venivano controllati quasi esclusivamente a valle tramite il guardiano metodologico (`npm run guardian`). Questo consentiva a monte errori cognitivi tipici dei modelli linguistici:
- Prescrivere ripetizioni su allungamenti statici (es. `8+8`);
- Inserire la notazione con `+` su esercizi ciclici alternati continui;
- Introdurre termini banditi (es. *"cerniera d'anca"*) o tecnicismi ingegneristici (*"biomeccanica"*);
- Inquinare le note degli atleti con diciture di periodizzazione destinate al coach;
- Forzare attrezzi coordinativi complessi (Flow Rope, Dragon Roll) all'interno di AMRAP fin dal primo giorno senza apprendimento motorio dedicato;
- Sforare il tetto inderogabile dei 60 minuti.

**Regola Inviolabile:** Nessuna riga di esercizio, JSON nel Vault (`data/vault/5_metodologia_allenamenti_cicli.json`) o `demo-data.json` può essere scritta o proposta senza aver superato preventivamente al 100% la **Matrice di Ragionamento a 5 Filtri** in memoria.

---

## 2. La Matrice di Ragionamento a 5 Filtri (Pre-Generazione)

Prima di generare ogni esercizio, l'agente deve applicare mentalmente e programmaticamente questi 5 filtri:

### 🧘 Filtro 1: Natura del Gesto (Statico vs Dinamico)
- **Domanda:** L'esercizio è un allungamento statico, una tenuta o una posa isometrica decomprensiva (es. *Wall Stretch* ID 030, posizioni a terra, decompressione)?
- **Regola Tassativa:** **DIVIETO ASSOLUTO DI RIPETIZIONI** (vietato `8+8`, `3x10` o simili).
- **Prescrizione Consentita:** Esclusivamente a **tempo** (es. `30/60"` o `3 X 45"`) oppure a **cicli respiratori controllati** (es. *"tenere la posizione per circa 6/8 cicli respiratori profondi e controllati"*).

### 🔄 Filtro 2: Cinematica Continua (Alternato vs Monolaterale a Blocchi)
- **Domanda:** Il movimento si svolge alternando in modo fluido e continuo una ripetizione a destra e una a sinistra (es. *Bat around the head* ID 158, *Wall driver* ID 047, *Step Up esplosivo alternato* ID 201, *Skierg pagaia alternato* ID 004, *Coiled Cobra* ID 033)?
- **Regola Tassativa:** **DIVIETO ASSOLUTO DELLA NOTAZIONE CON `+`** (vietato `30"+30"` o `8+8`).
- **Prescrizione Consentita:** Prescrivere sempre a **tempo complessivo continuo** (es. `3 X 45"` o `3x30"-40"`) o a **ripetizioni complessive alternate continue** (es. `3x10` o `X 10`).

### 🚫 Filtro 3: Filtro Lessicale (Bando di "Cerniera d'Anca" e Gergo Accademico)
- **Domanda:** Nel nome, nei tag o nelle note compare l'espressione *"cerniera d'anca"* o terminologia accademico-ingegneristica (*"biomeccanica"*, *"fulcro cinetico"*, *"catena cinetica"*, *"cinematica"*)*?
- **Regola Tassativa:** **DIVIETO CATEGORICO E PERMANENTE.**
- **Sostituzione Obbligatoria:** Usare esclusivamente un linguaggio naturale vicino al corpo, alla facilità motoria e alle sensazioni reali:
  - Al posto di "cerniera d'anca" $\rightarrow$ *stabilità del bacino*, *caricamento elastico*, *spinta dai piedi*, *flessione naturale e controllata*.
  - Al posto di "biomeccanica/cinematica" $\rightarrow$ *schema motorio*, *dinamica fluida*, *geometria di movimento*, *facilità ed efficienza*.

### 📋 Filtro 4: Destinatario della Nota (Atleta vs Coach/Programmatore)
- **Domanda:** La nota rivolta all'atleta contiene concetti di periodizzazione o etichette di programmazione (es. *"consolidamento mesociclo"*, *"fondamentale mesociclo"*, *"scarico mesociclo"*, *"fase di accumulo"*)*?
- **Regola Tassativa:** **SEPARAZIONE RIGOROSA.** Tali nozioni appartengono unicamente al diario interno e alle decisioni strategiche del coach.
- **Contenuto Consentito all'Atleta:** Solo ed esclusivamente istruzioni operative, esecutive, tecniche, RPE e recuperi (es. *"RPE 8 | inizia dal lato debole e alterna il lato di partenza ad ogni seduta"*).

### ⚡ Filtro 5: Padronanza del Mezzo & Flow (AMRAP vs Pratica Dedicata)
- **Domanda:** L'esercizio impiega attrezzi coordinativi complessi (Flow Rope, Dragon Roll ID 106, clave pesanti) all'interno di un AMRAP o circuito ad alta densità? L'allievo ha già stabilizzato il flow motorio?
- **Regola Tassativa:**
  - Nel **1° Allenamento** del ciclo: estrarre l'esercizio complesso dall'AMRAP e collocarlo come stazione dedicata singola da **5 minuti continui** per apprendimento motorio senza fretta; nell'AMRAP inserire un'alternativa fluida e accessibile a tutti (es. *jumping rope* a 50 rep o *jumping jacks*).
  - Dal **2° Allenamento** in poi: reinserire l'esercizio originario nell'AMRAP con volume calibrato (es. *Dragon Roll* a 50 rep al giro).

---

## 3. Ulteriori Invarianti Didattiche e Tetto dei 60 Minuti

1. **Tetto Inderogabile dei 60 Minuti:**  
   Ogni seduta deve essere cronometrata con `estimateRowDurationSeconds`. Se la somma supera i 60 minuti, scatta il VETO e la scheda deve essere snellita.
2. **Esercizi Eliminati Definitivamente:**  
   ID 239 (*Gymnasty ABS*) è bandito: nessuna prescrizione consentita.
3. **Divieti a Freddo nel Blocco 1:**  
   ID 099 (*Landmine quick hops*) è pliometria reattiva ad alto impatto neurale: mai nel blocco 1 (warm-up).
4. **Esclusioni Livello PRO:**  
   ID 042 (*Push the wall squat*) è riservato all'home training: non idoneo al livello PRO.
5. **Unione Matador Transitions:**  
   Dal livello PRO in poi è obbligatorio l'uso dell'esercizio unificato ID 242 (*Underhand/Overhand Matador Transitions*), vietati 104 e 105 separati.
6. **Speed Ladder Mai in AMRAP:**  
   La scaletta di agilità richiede massima freschezza neurale e precisione, mai affanno da circuito.
7. **Pliometria Senza Cedimento:**  
   RPE massimo 8.5 (preferibilmente senza RPE fuorvianti su pliometria reattiva pura).

---

## 4. Simulatore in Memoria (Dry-Run Sandbox CLI)

Per verificare programmaticamente qualsiasi bozza prima di salvarla, utilizzare lo script `dry_run_planner.mjs`:

### Esecuzione della Suite di Simulazione (Self-Test):
```bash
npm run plan:test
# oppure:
npm run planner:test
# oppure:
node .agents/skills/area46-methodology-planner/scripts/dry_run_planner.mjs
```

### Validazione di un File Bozza JSON:
```bash
node .agents/skills/area46-methodology-planner/scripts/dry_run_planner.mjs --file=percorso/alla/bozza.json
```

### Validazione Inline da Stringa JSON:
```bash
node .agents/skills/area46-methodology-planner/scripts/dry_run_planner.mjs --input='[{"id_esercizio":"030","nome_esercizio":"Wall Stretch","parametri":"3 X 45\"","note_tecniche":"6/8 respiri profondi"}]'
```

### Utilizzo Programmatico in Moduli ES:
```javascript
import { validatePreFlightPlan, printPlannerReport } from "./.agents/skills/area46-methodology-planner/scripts/dry_run_planner.mjs";

const result = validatePreFlightPlan(myNewWorkoutDraft, { isFirstWorkoutOfCycle: true });
if (!result.ok) {
  printPlannerReport(result);
  throw new Error("Veto metodologico: la bozza viola i vincoli didattici!");
}
// Procedere con la scrittura su disco solo se result.ok === true
```
