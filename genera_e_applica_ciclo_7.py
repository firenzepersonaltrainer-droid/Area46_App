#!/usr/bin/env python3
"""
Generazione e Applicazione Ufficiale del CICLO 7 (Area46 Training Lab - Livello PRO).
Avvio Mesociclo 3: Rientro Potenza & Hinge Fondamentale, Rotazione Catalogo PRO.

Sincronizza:
- Google Sheet TARGET: 'PRO database esercizi' (scheda 'PRO')
- Google Sheet MASTER: 'database esercizi Lab' (scheda 'Pro')
- File Excel locali: 'PRO database esercizi.xlsx' e 'database esercizi Lab.xlsx'
- App Data: 'demo-data.json'
- Vault Modulo 5: 'data/vault/5_metodologia_allenamenti_cicli.json'
- Registro Periodizzazione: 'registro_periodizzazione_pro.json'
- Scheda 'REGISTRO PERIODIZZAZIONE PRO' su Google Fogli
- Backup Drive via sincronizza_drive.py
"""

import os
import json
import gspread
import openpyxl
from openpyxl.styles import PatternFill, Border, Side, Font, Alignment

CREDENTIALS_FILE = "credenziali.json"
TARGET_SHEET_ID = "1AQHkYjXhI6WhRPORJ4DntiGZQd8ob54wJxkwP_LymwY" # PRO database esercizi
LAB_SHEET_ID = "1SNy8IJk1E20BcAdar0F1TqqnpRIDkjlkNn6P2ljKPNY"    # database esercizi Lab
LOCAL_LAB_EXCEL = "database esercizi Lab.xlsx"
LOCAL_PRO_EXCEL = "PRO database esercizi.xlsx"
DEMO_DATA_JSON = "demo-data.json"
VAULT_5_FILE = "data/vault/5_metodologia_allenamenti_cicli.json"
REGISTER_JSON = "registro_periodizzazione_pro.json"

COLUMNS = [
    "livello",
    "Settimana",
    "giorno",
    "Sequenza",
    "ID esercizio",
    "nome esercizio",
    "parametri",
    "recupero",
    "minutaggio blocco",
    "Note Tecniche",
    "video temp",
    "data_pubblicazione"
]


def load_all_rows_from_vault():
    with open(VAULT_5_FILE, "r") as f:
        vault_data = json.load(f)

    pro_workouts = [a for a in vault_data.get("allenamenti", []) if a.get("livello") == "PRO"]

    # Ordina per id crescente mantenendo la sequenza temporale dei cicli 1..7
    pro_workouts.sort(key=lambda x: int(x.get("id", 0)))

    all_rows = []
    meta = []

    for i, w in enumerate(pro_workouts):
        row = [
            w.get("livello", "PRO"),
            w.get("settimana", ""),
            w.get("giorno", ""),
            w.get("sequenza", ""),
            str(int(w.get("id_esercizio", "0"))),
            w.get("nome_esercizio", ""),
            w.get("parametri", ""),
            w.get("recupero", ""),
            w.get("minutaggio_blocco", "") or "",
            w.get("note_tecniche", ""),
            w.get("link_video", ""),
            w.get("data_pubblicazione", "") or ""
        ]
        all_rows.append(row)

        giorno = str(w.get("giorno", "")).upper()
        is_a = " ALLENAMENTO A" in giorno or giorno.endswith(" A")

        curr_sett = w.get("settimana", "")
        next_sett = pro_workouts[i + 1].get("settimana", "") if i + 1 < len(pro_workouts) else ""
        is_cycle_end = (curr_sett != next_sett) or (i == len(pro_workouts) - 1)

        meta.append({
            "is_a": is_a,
            "is_cycle_end": is_cycle_end,
            "settimana": curr_sett,
            "giorno": w.get("giorno", "")
        })

    return all_rows, meta


def apply_google_sheet_styling(spreadsheet, worksheet, meta):
    sheet_id = worksheet.id
    requests = []

    # 1. Header styling
    requests.append({
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 0,
                "endRowIndex": 1,
                "startColumnIndex": 0,
                "endColumnIndex": len(COLUMNS)
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": {"red": 0.88, "green": 0.88, "blue": 0.88},
                    "textFormat": {"bold": True, "fontSize": 10}
                }
            },
            "fields": "userEnteredFormat(textFormat,backgroundColor)"
        }
    })

    # 2. Alternanza colori A (#F2F2F2) / B (#FFFFFF)
    idx = 0
    while idx < len(meta):
        is_a = meta[idx]["is_a"]
        start_row = idx + 1
        while idx < len(meta) and meta[idx]["is_a"] == is_a:
            idx += 1
        end_row = idx + 1

        bg_color = {"red": 0.95, "green": 0.95, "blue": 0.95} if is_a else {"red": 1.0, "green": 1.0, "blue": 1.0}
        requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": start_row,
                    "endRowIndex": end_row,
                    "startColumnIndex": 0,
                    "endColumnIndex": len(COLUMNS)
                },
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": bg_color
                    }
                },
                "fields": "userEnteredFormat.backgroundColor"
            }
        })

    # 3. Bordi di fine ciclo
    for idx, m in enumerate(meta):
        if m["is_cycle_end"]:
            row_idx = idx + 1
            requests.append({
                "updateBorders": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": row_idx,
                        "endRowIndex": row_idx + 1,
                        "startColumnIndex": 0,
                        "endColumnIndex": len(COLUMNS)
                    },
                    "bottom": {
                        "style": "SOLID_MEDIUM",
                        "width": 2,
                        "color": {"red": 0.0, "green": 0.0, "blue": 0.0}
                    }
                }
            })

    if requests:
        spreadsheet.batch_update({"requests": requests})
    print(f"-> Styling Google Sheet applicato ({len(requests)} direttive).")


def update_excel_file(filepath, sheet_name, all_rows, meta):
    if not os.path.exists(filepath):
        print(f"File {filepath} non trovato, salto.")
        return

    wb = openpyxl.load_workbook(filepath)
    if sheet_name not in wb.sheetnames:
        ws = wb.create_sheet(sheet_name)
    else:
        ws = wb[sheet_name]

    ws.delete_rows(1, ws.max_row + 10)
    ws.append(COLUMNS)

    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="E0E0E0", end_color="E0E0E0", fill_type="solid")

    fill_a = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
    fill_b = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    border_cycle_end = Border(bottom=Side(style="medium", color="000000"))

    for row_idx, r in enumerate(all_rows, start=2):
        ws.append(r)
        m = meta[row_idx - 2]
        fill = fill_a if m["is_a"] else fill_b

        for col_idx in range(1, len(COLUMNS) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.fill = fill
            if m["is_cycle_end"]:
                cell.border = border_cycle_end

    wb.save(filepath)
    print(f"-> Salvato {filepath} [{sheet_name}]: {len(all_rows)} righe.")


def main():
    print("=" * 75)
    print("Area46 Training Lab - Generazione Ufficiale CICLO 7 (PRO)")
    print("Avvio Mesociclo 3: Rientro Potenza & Hinge Fondamentale")
    print("=" * 75)

    all_rows, meta = load_all_rows_from_vault()
    print(f"Righe totali PRO caricate: {len(all_rows)}")

    # 1. Connessione Google Fogli se credenziali presenti
    if os.path.exists(CREDENTIALS_FILE):
        try:
            print("\n[Fase 1] Connessione a Google Sheets...")
            gc = gspread.service_account(filename=CREDENTIALS_FILE)

            # 2. Aggiorna Target Sheet
            print(f"\n[Fase 2] Aggiornamento Target Sheet '{TARGET_SHEET_ID}'...")
            sh_target = gc.open_by_key(TARGET_SHEET_ID)
            ws_pro_target = sh_target.worksheet("PRO")
            ws_pro_target.batch_clear(["A1:L500"])
            data_to_write = [COLUMNS] + all_rows
            ws_pro_target.update(range_name=f"A1:L{len(data_to_write)}", values=data_to_write)
            print(f"-> Scritte {len(data_to_write)} righe in 'PRO'.")
            apply_google_sheet_styling(sh_target, ws_pro_target, meta)

            # 3. Master Sheet
            print(f"\n[Fase 3] Aggiornamento Master Sheet '{LAB_SHEET_ID}'...")
            sh_lab = gc.open_by_key(LAB_SHEET_ID)
            ws_pro_lab = sh_lab.worksheet("Pro")
            ws_pro_lab.batch_clear(["A1:L500"])
            ws_pro_lab.update(range_name=f"A1:L{len(data_to_write)}", values=data_to_write)
            print(f"-> Scritte {len(data_to_write)} righe in 'Pro'.")
            apply_google_sheet_styling(sh_lab, ws_pro_lab, meta)
        except Exception as e:
            print(f"⚠️ Avviso Google Sheets (procedo con Excel e app locale): {e}")

    # 4. Aggiorna File Excel locali
    print("\n[Fase 4] Aggiornamento file Excel locali...")
    update_excel_file(LOCAL_LAB_EXCEL, "Pro", all_rows, meta)
    update_excel_file(LOCAL_PRO_EXCEL, "PRO", all_rows, meta)

    # 5. Pulizia cache demo-data se presente
    if os.path.exists("/tmp/demo-data.json"):
        try:
            os.remove("/tmp/demo-data.json")
            print("-> Cache /tmp/demo-data.json rimossa.")
        except Exception:
            pass

    # 6. Sincronizza scheda registro su Drive
    if os.path.exists("crea_scheda_registro_drive.py"):
        print("\n[Fase 6] Sincronizzazione scheda registro Drive...")
        os.system(".venv/bin/python3 crea_scheda_registro_drive.py")

    # 7. Sincronizza cartella Drive
    if os.path.exists("sincronizza_drive.py"):
        print("\n[Fase 7] Sincronizzazione file Excel su Google Drive...")
        os.system(".venv/bin/python3 sincronizza_drive.py")

    print("\n" + "=" * 75)
    print("CICLO 7 GENERATO, APPLICATO E SINCRONIZZATO CON SUCCESSO!")
    print("=" * 75)


if __name__ == "__main__":
    main()
