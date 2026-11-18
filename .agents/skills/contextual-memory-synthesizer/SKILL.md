---
name: contextual-memory-synthesizer
description: >-
  Motore deterministico di memoria contestuale e anti-dogmatismo per Prometheo, Socrates ed Einstein.
  Registra, contestualizza, audita e propaga ogni correzione o preferenza di Stefano Tronconi
  attraverso tutti i repository dell'ecosistema, risolvendo i conflitti cognitivi, garantendo
  che non si applichino mai regole assolute fuori contesto e impedendo all'utente di doversi ripetere.
---

# Contextual Memory Synthesizer - Guida Operativa

Questa skill implementa il **Cervello di Apprendimento Dinamico Multi-Contesto** per l'ecosistema di Stefano Tronconi.

---

## 1. Il Principio Cardine: ZERO DOGMI O ASSOLUTISMI (TUTTO È CONTESTO)

In ossequio alla filosofia metodologica di Stefano:
- **Non esistono parole o regole bannate a priori in modo cieco.**
- Ogni direttiva espressa dall'utente viene codificata non come divieto piatto, ma come **Tripla Contestuale**:
  1. `[REQUISITO / PREFERENZA]`
  2. `[CONTESTO DI VALIDITÀ]` (Audience, Ambiente operativo, Obiettivo)
  3. `[ECCEZIONI ESPLICITE]` (Casi in cui la regola non deve essere imposta o in cui il termine è appropriato)

---

## 2. Architettura & Persistenza Reale (Regola Zero)

La memoria risiede in modo atomico su:
1. **Database Relazionale SQLite Master:**  
   Tabella `contextual_rules_memory` nel database unificato `area46_v2.sqlite`.
2. **Cache JSON ultra-rapida:**  
   `data/contextual_rules.json` per letture a zero latenza.
3. **Cross-Project Synchronization:**  
   Funzione di propagazione automatica verso tutti i repository attivi su Desktop:
   - `/Users/stefy/Desktop/progetto Gestione economica e fatturazione`
   - `/Users/stefy/Desktop/Area46_App`
   - `/Users/stefy/Desktop/AI PT assistant APP`
   - `/Users/stefy/Desktop/Marketing Strategy`

---

## 3. Utilizzo CLI da Terminale

Il motore è eseguibile direttamente da riga di comando:

```bash
# 1. Elenco di tutte le regole attive e della loro filosofia
python3 scripts/contextual_memory_engine.py list

# 2. Interrogazione contestuale: cosa applicare per i clienti?
python3 scripts/contextual_memory_engine.py query --audience clienti

# 3. Interrogazione contestuale: cosa applicare per i tecnici?
python3 scripts/contextual_memory_engine.py query --audience tecnici

# 4. Audit conformità testo per target clienti (solleva allerta se trova tecnicismi ingegneristici)
python3 scripts/contextual_memory_engine.py audit "Spieghiamo la biomeccanica del movimento" --audience clienti

# 5. Audit conformità testo per target tecnici (autorizza il termine come eccezione legittima)
python3 scripts/contextual_memory_engine.py audit "Spieghiamo la biomeccanica del movimento" --audience tecnici

# 6. Sincronizzazione immediata della memoria su tutti i 4 progetti
python3 scripts/contextual_memory_engine.py sync
```

---

## 4. Utilizzo Programmatico in Python per gli Agenti

```python
from contextual_memory_engine import ContextualMemoryEngine

engine = ContextualMemoryEngine()

# Query dinamica prima di generare un testo o una scheda
context = engine.query_context(audience="clienti", environment="social")

# Verifica conformità
report = engine.audit_text_compliance("Testo del post", audience="clienti")
if not report["compliant"]:
    print(f"Blocco preventivo: {report['violations']}")

# Aggiunta nuova correzione appresa da Stefano
engine.add_or_update_rule({
    "id": "RULE_008_NEW_PREFERENCE",
    "domain": "lexicon",
    "title": "Nuova preferenza",
    "rule_summary": "Sintesi della preferenza...",
    "context_applicability": {"audiences_active": ["clienti"]},
    "context_exceptions": {"audiences_allowed": ["tecnici"]},
    "core_philosophy": "Tutto è contesto."
})

# Sincronizza tra tutti i repository
engine.sync_to_all_repositories()
```
