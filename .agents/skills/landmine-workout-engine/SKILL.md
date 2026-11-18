---
name: landmine-workout-engine
description: >-
  Motore deterministico condiviso di allenamento per il Comitato Tecnico di Stefano Tronconi
  (Area46 App & Landmine Lab). Utilizzato da Atlas, Socrates, Chronos, Einstein e Aura per estrarre
  dal catalogo dei 163 esercizi Landmine Lab, verificare la ripartizione volumi 55:35:10, tutelare L5-S1
  (Joint Shielding), applicare la Didattica a 3 Fasi, risolvere la Modalita B e certificare le schede entro i 60 minuti.
---

# Landmine Workout Engine - Guida Operativa del Comitato Tecnico

Questa skill fornisce l'infrastruttura software deterministica e le API Python/CLI per il **Comitato Tecnico di Allenamento** di Stefano Tronconi per **Area46 App** e **Landmine Lab**.

---

## 1. Principi e Vincoli Costituzionali Inviolabili

1. **Regola Zero (Verità Operativa e Verifica Reale):**  
   Divieto assoluto di simulazioni teoriche o mock autoreferenziali. Il motore interroga direttamente il database master SQLite `area46_v2.sqlite` e la vista blindata `v_landmine_lab_exercises`.
2. **Vincolo Lessicale Permanente:**  
   È vietato nel codice, nei commenti, nei log e nei testi l'uso della parola *"biomeccanica"*. Usare esclusivamente *"pattern motorio"* (oppure *schemi motori funzionali* / *cinematica del movimento*).
3. **Metodo Senza Dogmi (Tutto è Contesto):**  
   In allenamento nulla è "obbligatorio": ogni parametro (RBS - *Rest Between Sides*, carichi, serie, ripetizioni, recuperi) è valutato liberamente in base agli obiettivi specifici, densità e caratteristiche individuali.
4. **Tetto dei 60 Minuti:**  
   In studio presso il Landmine Lab, nessuna seduta deve superare i 60 minuti.

---

## 2. La Squadra dei 5 Agenti e le Loro Funzioni

### 1. ATLAS (Catalogo & Schemi Motori Funzionali)
- **Compito:** Estrarre esercizi esclusivamente dalla vista blindata `v_landmine_lab_exercises` (esattamente 163 esercizi).
- **Filtri Operativi:** Categoria (`Fondamentale`, `Complementare`, `Accessorio`, `Metodo Specialistico`), `pattern_motorio`, `linea_miofasciale`, `setup_attrezzatura` (es. *"Lato Lungo"* vs *"Lato Corto"*).
- **Utilizzo Python:**
  ```python
  from workout_engine import AtlasCatalog

  # Estrazione per categoria e setup
  esercizi = AtlasCatalog.get_exercises(category="Fondamentale", setup="Lato Lungo")

  # Ricerca esercizio specifico per ID o nome
  ex = AtlasCatalog.get_exercise_by_id("LM-056")
  ```

---

### 2. CHRONOS (Tempo & Periodizzazione)
- **Compito:** Verificare la ripartizione dei volumi (**55% Fondamentali : 35% Complementari : 10% Accessori**) e calcolare la durata della seduta sommando TUT, recuperi e RBS contestuale.
- **Utilizzo Python:**
  ```python
  from workout_engine import ChronosPeriodization

  # Verifica volumi della seduta o del ciclo
  vol_stats = ChronosPeriodization.calculate_volume_distribution(session_exercises)
  print(vol_stats["summary"])

  # Stima durata della seduta (tetto 60 minuti)
  durata = ChronosPeriodization.estimate_session_duration(session_exercises, default_rbs_override=30)
  if not durata["is_under_60_min"]:
      print(f"Allarme: seduta supera i 60 min ({durata['duration_minutes']} min)")
  ```

---

### 3. SOCRATES (Metodologia, Clinica & Veto)
- **Compito:** 
  1. **Joint Shielding:** Verificare che non vi sia sovraccarico assiale contiguo su L5-S1 tra Seduta A e Seduta B.
  2. **Didattica a 3 Fasi:** Prescrivere nuovi esercizi rispettando la progressione (*Fase 1 Costruzione -> Fase 2 Controllo Lento -> Fase 3 Espressione Dinamica*).
  3. **Modalità B:** Risolvere lo scarico a staffetta quando un fondamentale raggiunge il picco di forza, proponendo propedeutiche di destrezza/mobilità dal catalogo.
- **Utilizzo Python:**
  ```python
  from workout_engine import SocratesClinical

  # Controllo Joint Shielding tra sedute contigue
  shielding = SocratesClinical.check_joint_shielding(session_a, session_b)
  if not shielding["joint_shielding_respected"]:
      print(shielding["recommendations"])

  # Risoluzione Modalità B
  alternative_b = SocratesClinical.resolve_modalita_b("LM-056")  # Landmine Deadlift

  # Prescrizione didattica guidata
  didattica = SocratesClinical.apply_three_phase_didactics("Coiled Punch", phase=1)
  ```

---

### 4. EINSTEIN (Supervisione & Certificazione Costituzionale)
- **Compito:** Validare la bozza dell'intero ciclo (6 sedute A/B/A/B/A/B), bloccare ogni esercizio non presente nei 163 ufficiali (Zero Allucinazioni), verificare i tempi e il Joint Shielding prima della pubblicazione.
- **Utilizzo Python:**
  ```python
  from workout_engine import EinsteinSupervisor

  validation_report = EinsteinSupervisor.validate_cycle_draft(cycle_payload)
  if not validation_report["valid"]:
      raise ValueError(f"Veto di Einstein: {validation_report['errors']}")
  ```

---

### 5. AURA (Readiness Biologico) & Bridge Area46 App
- **Compito:** Sincronizzare automaticamente il nuovo ciclo validato nel database SQLite master/mirror e nei file JSON utilizzati dall'app degli atleti (`demo-data.json`, `registro_periodizzazione_pro.json`, `data/vault/5_metodologia_allenamenti_cicli.json`).
- **Utilizzo Python:**
  ```python
  from workout_engine import Area46Bridge

  sync_result = Area46Bridge.sync_cycle_to_area46_app(cycle_payload)
  print("Sincronizzazione completata:", sync_result)
  ```

---

## 3. Comandi Rapidi da Terminale (CLI)

```bash
# Verifica catalogo blindato (deve restituire 163)
python3 .agents/skills/landmine-workout-engine/scripts/workout_engine.py --count

# Esecuzione della Suite Completa di Verifica nella Realtà (Regola Zero)
python3 .agents/skills/landmine-workout-engine/scripts/workout_engine.py --full-test

# Ricerca esercizi con filtri
python3 .agents/skills/landmine-workout-engine/scripts/workout_engine.py --search "deadlift" --category "Fondamentale"

# Ricerca esercizi per setup 'Lato Lungo'
python3 .agents/skills/landmine-workout-engine/scripts/workout_engine.py --setup "Lato Lungo"

# Risoluzione Modalità B per un esercizio specifico
python3 .agents/skills/landmine-workout-engine/scripts/workout_engine.py --modalita-b "LM-056"
```
