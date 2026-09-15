# Area46 Training Lab — App Livello PRO

Web Application mobile-first per la gestione, consultazione ed esecuzione della periodizzazione atletica **Landmine Lab (Livello PRO)** di **Area46**.

---

## 🎯 Obiettivi e Metodologia
- **Target Atleti**: Amatori avanzati che hanno completato *Entry Level, Level 1, Level 2 e Advanced*.
- **Catalogo Master**: 163 esercizi esclusivi per il Livello PRO suddivisi in 6 categorie:
  * *Forza e Struttura*
  * *Potenza e Balistica*
  * *Skill e Combo*
  * *Engine e Benchmark*
  * *Pliometria e Agility*
  * *Warm Up e Mobilità*
- **Struttura Mesocicli**: 18 sedute complessive suddivise in **3 Cicli da 6 sedute fisse** con alternanza rigorosa `A-B-A-B-A-B`.
- **Tetto dei 60 Minuti**: Nessuna seduta supera i 60 minuti reali; allenamento 100% attivo senza defaticamento passivo.
- **Progressione a Onda RPE & Scarico Modalità B**: Sostituzione dei fondamentali al picco dell'onda con lavoro tecnico e destrezza per un ciclo.

---

## 📱 Funzionalità Principali dell'App
1. **Visualizzazione Smartphone Nativa**: Layout vincolato in formato mobile (viewport 393×852) con scocca realistica, notch/dynamic island e navbar a pillola.
2. **Timer Lab Flottante e Integrato**:
   - Modalità *Countdown* con auto-reset automatico all'inizio del conteggio.
   - Modalità *Interval* (lavoro/riposo) con sintetizzatore audio di fischietto da coach (*Fox 40*) e **triplice fischio lungo** al termine del ciclo.
   - Finestra trascinabile vincolata rigorosamente all'interno dello schermo dello smartphone.
3. **Schermata Registra Carico**: Modal fullscreen semi-trasparente che mantiene il timer sempre in sovraimpressione.
4. **Diario di Bordo & Tonnellaggio**: Calcolo live del volume totale (kg sollevati) e storico dei carichi per esercizio.
5. **Database Esercizi con Video YouTube**: Schede tecniche dettagliate, propedeutiche, alternative scalate e link ai video dimostrativi.

---

## 🚀 Avvio Rapido

### Prerequisiti
- Node.js (v18+)
- Python 3.9+ (per gli script di sincronizzazione Google Sheets / Drive)

### Installazione e Avvio
```bash
# 1. Installa le dipendenze
npm install

# 2. Avvia l'app in locale
npm run dev
# L'app sarà attiva su http://localhost:5173/
```

### Struttura del Progetto
```text
├── client/                     # Applicazione Frontend React (Vite, Tailwind v4)
│   ├── app.tsx                 # Layout principale con cornice mobile e timer
│   ├── components/             # Nav, FloatingTimer, Dialog, Select, Toast
│   └── pages/                  # Allenamenti, GiornoDetail, EsercizioDetail, Diario, Libreria
├── local-api.ts                # Server API locale e gestione stati
├── demo-data.json              # Dataset allenamenti attivi Ciclo 1 e Ciclo 2
├── registro_periodizzazione_pro.json # Tracciamento periodizzazione e uso esercizi
├── PRO database esercizi.xlsx  # File Excel catalogo 163 esercizi
├── database esercizi Lab.xlsx  # File Excel master Lab
├── LINEE_GUIDA_AREA46_PRO.md   # Specifiche metodologiche dettagliate
├── AGENTS.md / GEMINI.md       # Regole di sistema per gli agenti AI
└── sincronizza_drive.py        # Script sincronizzazione dati su Google Drive
```
