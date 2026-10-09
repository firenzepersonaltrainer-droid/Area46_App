# AREA46 TRAINING LAB — MANUALE DELLA STRUTTURA BLINDATA & SICUREZZA DATI

Questo documento descrive la nuova architettura di sicurezza implementata per proteggere i dati reali del centro (atleti, crediti, prenotazioni, pagamenti e storico allenamenti) e permettere di sviluppare l'app in totale serenità senza rischiare mai di compromettere il patrimonio operativo.

---

## 1. I 3 LIVELLI DI BLINDATURA ATTIVI

### 🛡️ Livello 1: Il Blocco di Sicurezza in Tempo Reale (Safety Lock)
Nel cuore del sistema (`local-api.ts`), è stato inserito un **guardrail di blocco attivo**:
* Prima di qualsiasi salvataggio su disco o su cloud, il sistema verifica che i dati vitali siano presenti e corretti (es. almeno tutti gli atleti attivi, catalogo esercizi integro, crediti validi).
* Se per errore uno script o una modifica tentasse di salvare un database vuoto o corrotto, **il sistema rifiuta la scrittura distruttiva**, protegge i file reali e lancia un allarme immediato nei registri.
* Inoltre, ogni 4 ore di operatività viene salvata in automatico una copia di sicurezza a rotazione.

### 🏛️ Livello 2: Le Camere Stagne (Cartella `data/vault/`)
I dati non sono più confinati in un unico calderone indistinto. Il patrimonio è stato suddiviso in **6 moduli indipendenti**:

1. `1_gestionale_utenti_crediti.json`: Anagrafiche atleti, crediti residui, formule abbonamento, registro pagamenti fiscali.
2. `2_gestionale_calendario.json`: Prenotazioni degli slot orari, presenze, eccezioni e chiusure straordinarie.
3. `3_atleti_diario_progressi.json`: Storico carichi sollevati, serie, ripetizioni e feedback dei singoli atleti.
4. `4_metodologia_esercizi.json`: Il catalogo dei 163 esercizi PRO esclusivi, video YouTube e collegamenti tecnici.
5. `5_metodologia_allenamenti_cicli.json`: Le schede di allenamento divise in cicli A/B (Ciclo 1, 2, 3, ecc.).
6. `6_configurazione_lab.json`: Regole di capienza, orari e notifiche email.

> **Vantaggio**: Quando si lavora sulle schede o sugli esercizi, si tocca solo la camera della metodologia, lasciando chiuse a chiave le camere degli atleti e del denaro.

### 💾 Livello 3: La Macchina del Tempo (Cartella `backups/`)
Ogni backup è salvato con data e ora esatta (`backup_ANNO-MESE-GIORNO_ORE-MINUTI-SECONDI.json`).
* Se si desidera fare una prova ardita, basta un comando per congelare lo stato.
* Se qualcosa non piace, si torna indietro al minuto esatto precedente.
* Prima di ogni operazione di ripristino, il sistema scatta in automatico uno snapshot di salvataggio preventivo.

---

## 2. I COMANDI SEMPLICI A TUA DISPOSIZIONE

Tutti i comandi sono integrati ed eseguibili direttamente da terminale:

| Comando | Cosa fa in parole semplici |
| :--- | :--- |
| `npm run verify` | **Controllo Medico del Database**: Conta atleti, crediti totali, prenotazioni ed esercizi e ti dice subito se è tutto integro al 100%. |
| `npm run backup` | **Fotografia Istantanea**: Crea un backup marcato con data e ora nella cartella `backups/`. |
| `npm run restore` | **Ripristino Veloce**: Ripristina l'ultimo backup valido conosciuto in caso di emergenza. |
| `npm run vault:split` | **Aggiorna le Camere Stagne**: Esporta lo stato attuale nei 6 file separati in `data/vault/`. |
| `npm run vault:merge` | **Riunisce i Moduli**: Ricompone il database principale unendo le camere stagne con verifica di integrità preventiva. |

---

## 3. GUIDA OPERATIVA: COME GESTIRE LE CONVERSAZIONI CON L'AI

Per evitare confusione mentale dell'AI e garantire la massima sicurezza, si consiglia di **aprire chat/conversazioni separate** in base all'argomento:

### 🏋️ Chat 1: Metodologia, Schede ed Esercizi
* **Cosa chiedere qui**: Creazione di nuovi Cicli di allenamento, aggiunta di esercizi, controllo dell'RPE, link ai video YouTube, periodizzazione.
* **Cosa non toccare qui**: Non chiedere mai qui modifiche ai crediti o al calendario prenotazioni.

### 💼 Chat 2: Amministrazione e Gestionale
* **Cosa chiedere qui**: Gestione pacchetti, ricarica o correzione crediti atleta, reportistica incassi, calendario e orari.
* **Cosa non toccare qui**: Non chiedere modifiche alla grafica o alla logica delle schede di allenamento.

### 📱 Chat 3: Grafica e Funzionalità App
* **Cosa chiedere qui**: Spostare un bottone, cambiare colori, migliorare il timer, aggiungere un grafico, risolvere bug visivi.
* **Regola di sicurezza**: Chiedere sempre all'AI di lavorare con un profilo demo fittizio (es. *Mario Rossi*) per non rischiare di alterare i dati degli atleti veri.

---

## 4. REGISTRO STATO ATTUALE (DATI CONGELATI E PROTETTI)

Al momento dell'attivazione della blindatura, i dati certificati e protetti sono:
* **Atleti Registrati**: 13 (di cui 10 con crediti attivi, per un monte crediti totale di **1148 crediti**)
* **Prenotazioni Slot a Calendario**: 87 prenotazioni
* **Voci Diario e Carichi Registrati**: 258 registrazioni
* **Catalogo Esercizi**: 241 esercizi totali (comprensivi dei 163 PRO)
* **Allenamenti e Schede**: 802 sedute registrate
* **Snapshot Master di Riferimento**: `backups/snapshot_gold_master_2026-10-09T14-56-11-145Z.json`
