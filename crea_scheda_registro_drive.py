#!/usr/bin/env python3
"""
Crea e formatta la scheda 'REGISTRO PERIODIZZAZIONE PRO' sui Google Fogli di Area46.
"""

import gspread
import json

CREDENTIALS_FILE = "credenziali.json"
TARGET_SHEET_ID = "1AQHkYjXhI6WhRPORJ4DntiGZQd8ob54wJxkwP_LymwY" # PRO database esercizi
LAB_SHEET_ID = "1SNy8IJk1E20BcAdar0F1TqqnpRIDkjlkNn6P2ljKPNY"    # database esercizi Lab
REGISTER_JSON = "registro_periodizzazione_pro.json"

SHEET_TITLE = "REGISTRO PERIODIZZAZIONE PRO"

def build_sheet_data():
    with open(REGISTER_JSON, "r") as f:
        reg = json.load(f)

    rows = []
    
    # BANNER TITOLO
    rows.append(["AREA46 TRAINING LAB - REGISTRO PERIODIZZAZIONE E LINEE GUIDA (LIVELLO PRO)", "", "", "", "", ""])
    rows.append(["", "", "", "", "", ""])

    # SEZIONE 1: STATO ATTUALE
    rows.append(["=== SEZIONE 1: STATO ATTUALE DELLA PERIODIZZAZIONE ===", "", "", "", "", ""])
    rows.append(["Programma", reg.get("programma", "Landmine Lab - Livello PRO"), "", "", "", ""])
    rows.append(["Macrociclo Attivo", reg.get("macrociclo_attuale"), "", "", "", ""])
    rows.append(["Mesociclo Attivo", reg.get("mesociclo_attuale"), "(18 sedute complessive = 3 Cicli da 6 sedute)", "", "", ""])
    rows.append(["Prossimo Ciclo da Pianificare", reg.get("ciclo_attivo_da_pianificare"), "<- AVVIO UFFICIALE NUOVA METODOLOGIA", "", "", ""])
    rows.append(["Cicli Storici (Transizione)", "Ciclo 1 (6 sedute) e Ciclo 2 (6 sedute) - Mantenuti per gli allievi attivi", "", "", "", ""])
    rows.append(["Target Atleti", "Amatori Evoluti (hanno completato Entry Level, L1, L2, Advanced)", "", "", "", ""])
    rows.append(["Frequenza di Fruizione", "3x/settimana = 2 settimane per ciclo (6 sett. mesociclo) | 2x/settimana = 3 settimane per ciclo (9 sett. mesociclo)", "", "", "", ""])
    rows.append(["", "", "", "", "", ""])

    # SEZIONE 2: REGOLE METODOLOGICHE INVIOLABILI
    rows.append(["=== SEZIONE 2: GUARDRAILS E REGOLE METODOLOGICHE INVIOLABILI ===", "", "", "", "", ""])
    rules = [
        ("1. Tetto dei 60 Minuti", "Nessun allenamento deve superare i 60 minuti reali. 4-5 esercizi per forza pesante; 8-10 per agilità/metcon. Zero defaticamento passivo."),
        ("2. Soddisfazione Percepita", "La percezione di allenamento, divertimento, sudore e gratificazione dell'amatore ha la priorità sulla teoria rigida da laboratorio."),
        ("3. Progressione a Onda RPE", "Sui Fondamentali: onda da RPE 7-8 (7-9 reps) a RPE 8.5-10 (1-3 reps). Complementari in controtendenza (volume più alto, RPE 6-7.5)."),
        ("4. Scarico di Default (Modalità B)", "Quando un fondamentale tocca il picco, entra in scarico: il gesto pesante esce per 1 ciclo e viene sostituito da destrezza/mobilità/qualità."),
        ("5. Ratio 55 : 35 : 10", "55% Fondamentali, 35% Complementari, 10% Accessori calcolato sulle serie allenanti del Mesociclo con elasticità algoritmica."),
        ("6. Equilibrio Muscolare ed Estetica", "MAI sovraccaricare la cerniera d'anca/bassa schiena. Inserire SEMPRE stimoli diretti per braccia (bicipiti/tricipiti) e spalle."),
        ("7. Notazione e Sicurezza", "Parametri asimmetrici sempre con notazione '+' (es. 8+8). MAI scalette di velocità (speed ladder) all'interno di circuiti o AMRAP.")
    ]
    for r_title, r_desc in rules:
        rows.append([r_title, r_desc, "", "", "", ""])
    rows.append(["", "", "", "", "", ""])

    # SEZIONE 3: STATO DEI PATTERN MOTORI (STAFFETTA)
    rows.append(["=== SEZIONE 3: STATO DEI PATTERN MOTORI (STAFFETTA DEL CARICO) ===", "", "", "", "", ""])
    rows.append(["Pattern Motore", "Stato Attuale al Ciclo 2", "Direttiva per il Ciclo 3", "", "", ""])
    rows.append(["Spinta Orizzontale", "Intensificazione (Bench press inserita)", "Mantenere progressione / consolidamento carico", "", "", ""])
    rows.append(["Trazione Orizzontale / Verticale", "Consolidamento (Meadow row, Push the wall row)", "Alternare angolazione / variante", "", "", ""])
    rows.append(["Accosciata / Squat", "Consolidamento (Biker's squat)", "Mantenere stimolo di forza", "", "", ""])
    rows.append(["Cerniera d'Anca (Hinge)", "Sovraccarico accumulato nei Cicli 1 e 2", "SCARICO SELETTIVO (Modalità B) nel Ciclo 3", "", "", ""])
    rows.append(["Braccia e Spalle", "Carenti nei Cicli 1 e 2", "INSERIMENTO PRIORITARIO nel Ciclo 3", "", "", ""])
    rows.append(["", "", "", "", "", ""])

    # SEZIONE 4: CONTATORE UTILIZZO ESERCIZI (CATALOGO)
    rows.append(["=== SEZIONE 4: CONTATORE DI UTILIZZO DEL CATALOGO ESERCIZI ===", "", "", "", "", ""])
    rows.append([f"Esercizi Totali a Catalogo: {reg.get('totale_esercizi_catalogo')}", f"Esercizi Già Sperimentati: {reg.get('esercizi_utilizzati')}", f"Esercizi Ancora da Sperimentare: {reg.get('totale_esercizi_catalogo') - reg.get('esercizi_utilizzati')}", "", "", ""])
    rows.append(["", "", "", "", "", ""])
    
    # Tabella catalogo
    rows.append(["ID", "NOME ESERCIZIO", "ATTREZZO", "ULTIMO CICLO USATO", "PRESENZE TOTALI", "STATO"])
    for ex in reg.get("esercizi", []):
        stato = "USATO" if ex["usage_count"] > 0 else "DA SPERIMENTARE"
        rows.append([
            ex["id"],
            ex["nome"],
            ex["attrezzo"],
            ex["last_cycle_used"] or "-",
            ex["usage_count"],
            stato
        ])

    return rows


def style_worksheet(sh, ws):
    """Applica formattazione visiva professionale alla scheda di registro."""
    sheet_id = ws.id
    requests = []

    # Larghezza colonne
    col_widths = [180, 420, 180, 160, 140, 150]
    for col_idx, width in enumerate(col_widths):
        requests.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": col_idx,
                    "endIndex": col_idx + 1
                },
                "properties": {"pixelSize": width},
                "fields": "pixelSize"
            }
        })

    # Banner principale riga 1
    requests.append({
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 0,
                "endRowIndex": 1,
                "startColumnIndex": 0,
                "endColumnIndex": 6
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": {"red": 0.12, "green": 0.12, "blue": 0.12},
                    "textFormat": {"bold": True, "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}, "fontSize": 12}
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat)"
        }
    })

    # Esegui formattazione
    sh.batch_update({"requests": requests})


def main():
    print("=" * 70)
    print("Area46 Training Lab - Creazione Scheda Registro Periodizzazione PRO")
    print("=" * 70)

    rows = build_sheet_data()
    print(f"Generate {len(rows)} righe per il Registro.")

    gc = gspread.service_account(filename=CREDENTIALS_FILE)

    for sheet_id, name in [(TARGET_SHEET_ID, "PRO database esercizi"), (LAB_SHEET_ID, "database esercizi Lab")]:
        print(f"\nAggiornamento su Google Sheet: '{name}' ({sheet_id})...")
        sh = gc.open_by_key(sheet_id)
        
        try:
            ws = sh.worksheet(SHEET_TITLE)
            print(f"Scheda '{SHEET_TITLE}' trovata. Pulizia in corso...")
            ws.batch_clear(["A1:F400"])
        except gspread.WorksheetNotFound:
            print(f"Creazione nuova scheda '{SHEET_TITLE}'...")
            ws = sh.add_worksheet(title=SHEET_TITLE, rows=len(rows) + 20, cols=8)

        # Scrittura dati
        ws.update(range_name=f"A1:F{len(rows)}", values=rows)
        print(f"-> Scritte {len(rows)} righe nella scheda.")

        # Stili
        try:
            style_worksheet(sh, ws)
            print(f"-> Stili applicati con successo.")
        except Exception as e:
            print(f"Nota sugli stili: {e}")

    print("\n" + "=" * 70)
    print("REGISTRO PERIODIZZAZIONE SALVATO SU GOOGLE DRIVE CON SUCCESSO!")
    print("=" * 70)


if __name__ == "__main__":
    main()
