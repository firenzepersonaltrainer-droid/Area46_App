#!/usr/bin/env python3
"""
Script per la generazione autonoma e il caricamento del ciclo di allenamento
"Landmine Lab - Livello PRO" (Settimana 3 e Settimana 4, Giorno 1 e Giorno 2).
Studio: Area46 Training Lab.

Include:
1. Algoritmo di Bilanciamento Biomeccanico:
   - Equilibrio Distrettuale (Upper / Lower Ratio)
   - Vincolo dei 14 Giorni (No-Drop Rule sui 5 pattern fondamentali)
2. Motore di Gestione del Carico e Periodizzazione Scientifica (RPE/MAV):
   - Modello A (Consolidamento) con Costanza dell'Adattamento (RPE 8 costante)
3. Ottimizzazione Durata e Logistica:
   - Eliminazione speed ladder (in in-out out sprawl) da 5a e 7a
   - Eliminazione blocco flow (Overhand Matadors Wheel e COMBO Side kick trough + Sprawl) da 6b e 8b
   - Inserimento Side kick through nell'AMRAP portato da 10' a 15'
4. Formattazione Rigida a 11 Colonne e Sincronizzazione Cloud/Locale
"""

import os
import sys
import json
import gspread
import pandas as pd
import openpyxl

CREDENTIALS_FILE = "credenziali.json"
TARGET_SHEET_ID = "1AQHkYjXhI6WhRPORJ4DntiGZQd8ob54wJxkwP_LymwY"
LAB_SHEET_ID = "1SNy8IJk1E20BcAdar0F1TqqnpRIDkjlkNn6P2ljKPNY"
LOCAL_EXCEL_DB = "PRO database esercizi.xlsx"
LOCAL_LAB_EXCEL = "database esercizi Lab.xlsx"
DEMO_DATA_JSON = "demo-data.json"

COLUMNS_11 = [
    "livello",
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

FUNDAMENTAL_PATTERNS = [
    "Spinta Orizzontale",
    "Spinta Verticale",
    "Trazione",
    "Accosciata",
    "Cerniera d'anca"
]


class BiomechanicalBalancingEngine:
    """
    Algoritmo di Bilanciamento Biomeccanico:
    - Analizza la distribuzione dei pattern motori e calcola il ratio Upper/Lower.
    - Applica il Vincolo dei 14 Giorni (No-Drop Rule).
    """

    @staticmethod
    def classify_exercise(pattern_str: str, name_str: str = ""):
        pat = pattern_str.lower()
        name_l = name_str.lower()

        patterns_detected = set()
        is_upper = False
        is_lower = False

        if "spinta orizzontale" in pat or "bench" in name_l or "push up" in name_l:
            patterns_detected.add("Spinta Orizzontale")
            is_upper = True

        if "spinta verticale" in pat or "overhead" in name_l or "step back press" in name_l:
            patterns_detected.add("Spinta Verticale")
            is_upper = True

        if "trazione" in pat or "tirata" in pat or "row" in name_l or "pull" in name_l:
            patterns_detected.add("Trazione")
            is_upper = True

        if "accosciata" in pat or "squat" in name_l:
            patterns_detected.add("Accosciata")
            is_lower = True

        if "cerniera" in pat or "deadlift" in name_l or "swing" in name_l:
            patterns_detected.add("Cerniera d'anca")
            is_lower = True

        if "affondo" in pat or "lunge" in name_l:
            is_lower = True

        if "spinta" in pat and not is_upper:
            is_upper = True

        return patterns_detected, is_upper, is_lower

    @classmethod
    def audit_history_and_check_no_drop(cls, history_rows, pattern_map):
        pattern_frequencies = {p: 0 for p in FUNDAMENTAL_PATTERNS}
        for r in history_rows:
            eid = int(float(str(r[3]))) if str(r[3]).replace('.', '', 1).isdigit() else None
            pinfo = pattern_map.get(eid, {"name": r[4], "pattern": ""})
            pats, _, _ = cls.classify_exercise(pinfo["pattern"], pinfo["name"])
            for p in pats:
                if p in pattern_frequencies:
                    pattern_frequencies[p] += 1

        print("\n[Audit Storico 14 Giorni - Frequenze Pattern]:")
        for p, freq in pattern_frequencies.items():
            print(f"  - {p:<20}: {freq} occorrenze")

        priority_patterns = [p for p, freq in pattern_frequencies.items() if freq == 0]
        if priority_patterns:
            print(f"  -> ATTENZIONE NO-DROP: I seguenti pattern sono stati a 0 nelle ultime 2 settimane: {priority_patterns}")
            print("  -> PRIORITA' ASSOLUTA DI INSERIMENTO ATTIVATA!")
        return priority_patterns

    @classmethod
    def analyze_microcycle_balance(cls, week_rows, pattern_map):
        upper_count = 0
        lower_count = 0
        patterns_found = {p: 0 for p in FUNDAMENTAL_PATTERNS}

        for r in week_rows:
            eid = int(r[3]) if str(r[3]).isdigit() else None
            pinfo = pattern_map.get(eid, {"name": r[4], "pattern": ""})
            pats, is_up, is_low = cls.classify_exercise(pinfo["pattern"], pinfo["name"])
            if is_up:
                upper_count += 1
            if is_low:
                lower_count += 1
            for p in pats:
                if p in patterns_found:
                    patterns_found[p] += 1

        total = upper_count + lower_count
        ratio_upper = (upper_count / total * 100) if total > 0 else 0
        ratio_lower = (lower_count / total * 100) if total > 0 else 0

        return {
            "upper_count": upper_count,
            "lower_count": lower_count,
            "ratio_upper": ratio_upper,
            "ratio_lower": ratio_lower,
            "patterns_found": patterns_found
        }


class PeriodizationEngine:
    @classmethod
    def format_notes(cls, grouping: str, rpe_str: str = "") -> str:
        if grouping and rpe_str:
            return f"{grouping} | {rpe_str}"
        return grouping or rpe_str or ""


def build_optimized_settimana(settimana_num: int):
    """
    Genera le 17 righe bilanciate e ottimizzate per Settimana 3 o Settimana 4.
    Modifiche richieste:
    - Eliminato in in-out out sprawl da Giorno 1 (5a e 7a)
    - Eliminati Overhand Matadors Wheel e COMBO Side kick trough + Sprawl da Giorno 2 (6b e 8b)
    - Inserito Side kick through nell'AMRAP portato da 10 a 15 min (4a, 4b, 4c)
    """
    sett_str = f"Sett {settimana_num}"
    rpe_str = "RPE 8"

    # --- GIORNO 1 (Allenamento A - 8 esercizi) ---
    # 1. Warm Up & Switch (Avenger Blade passing >= 20 rep + Step back press)
    g1_1a = ["PRO", f"Giorno 1 ({sett_str})", "1a", 98, "Avenger Blade passing", "3x24", "", "", "jump set", "", ""]
    g1_1b = ["PRO", f"Giorno 1 ({sett_str})", "1b", 49, "Step/Step back press", "3x8+8", '45"', "", "jump set", "", ""]
    # 2. FONDAMENTALE SPINTA ORIZZONTALE PESANTE
    g1_2  = ["PRO", f"Giorno 1 ({sett_str})", "2", 79, "Bench press", "4x8", '90"', "", rpe_str, "", ""]
    # 3. FONDAMENTALE TRAZIONE PESANTE + ACCOSCIATA LOWER (Jump Set)
    g1_3a = ["PRO", f"Giorno 1 ({sett_str})", "3a", 81, "Meadow Row", "4x8+8", '60"', "", PeriodizationEngine.format_notes("jump set", rpe_str), "", ""]
    g1_3b = ["PRO", f"Giorno 1 ({sett_str})", "3b", 82, "Landmine Biker's Squat", "4x8+8", 'RBS 60"', "", PeriodizationEngine.format_notes("jump set", rpe_str), "", ""]
    # 4. METCON / ENGINE (Circuito 4 round - sequenza continua 4a, 4b, 4c)
    g1_4a = ["PRO", f"Giorno 1 ({sett_str})", "4a", 172, "Kettlebell swing to clean", "4x8+8", "", "", "circuito (4 round)", "", ""]
    g1_4b = ["PRO", f"Giorno 1 ({sett_str})", "4b", 124, "Slamball Skater jump", "4x10", "", "", "circuito (4 round)", "", ""]
    g1_4c = ["PRO", f"Giorno 1 ({sett_str})", "4c", 1, "skierg regular", '4x40"', '60"', "", "circuito (4 round)", "", ""]

    # --- GIORNO 2 (Allenamento B - 9 esercizi) ---
    # 1. Warm Up Isometrico & Trazione (Hang Position ISO + High pull bounce)
    g2_1a = ["PRO", f"Giorno 2 ({sett_str})", "1a", 55, "Hang Position ISO", '3x20"+20"', "", "", "jump set", "", ""]
    g2_1b = ["PRO", f"Giorno 2 ({sett_str})", "1b", 116, "High pull bounce", "3x10+10", '45"', "", "jump set", "", ""]
    # 2. POTENZA OLYMPIC & TRAZIONE FONDAMENTALE (Jump Set)
    g2_2a = ["PRO", f"Giorno 2 ({sett_str})", "2a", 53, "Split C&J Touch & Go", "4x6+6", 'RBS 45"', "", PeriodizationEngine.format_notes("jump set", rpe_str), "", ""]
    g2_2b = ["PRO", f"Giorno 2 ({sett_str})", "2b", 76, "Push the wall row", "4x8+8", 'RBS 45"', "", PeriodizationEngine.format_notes("jump set", rpe_str), "", ""]
    # 3. SPINTA ORIZZONTALE & AFFONDO (Jump Set)
    g2_3a = ["PRO", f"Giorno 2 ({sett_str})", "3a", 101, "Sprinter Push up", "4x10", '45"', "", PeriodizationEngine.format_notes("jump set", rpe_str), "", ""]
    g2_3b = ["PRO", f"Giorno 2 ({sett_str})", "3b", 44, "Coiled Reverse Lunge", "4x8+8", 'RBS 45"', "", PeriodizationEngine.format_notes("jump set", rpe_str), "", ""]
    # 4. AMRAP FINISHER 15' con Side kick through (4a, 4b, 4c)
    g2_4a = ["PRO", f"Giorno 2 ({sett_str})", "4a", 73, "Lateral landmine clean", "x 6+6", "", "", "AMRAP 15'", "", ""]
    g2_4b = ["PRO", f"Giorno 2 ({sett_str})", "4b", 206, "Side kick through", "x 8+8", "", "", "AMRAP 15'", "", ""]
    g2_4c = ["PRO", f"Giorno 2 ({sett_str})", "4c", 187, "Sprawl to Broad Jump", "x 8", "", "", "AMRAP 15'", "", ""]

    return [
        g1_1a, g1_1b, g1_2, g1_3a, g1_3b, g1_4a, g1_4b, g1_4c,
        g2_1a, g2_1b, g2_2a, g2_2b, g2_3a, g2_3b, g2_4a, g2_4b, g2_4c
    ]


def load_pattern_map():
    wb_db = openpyxl.load_workbook(LOCAL_EXCEL_DB, data_only=True)
    ws_global = wb_db["vista globale"]
    pattern_map = {}
    for r in ws_global.iter_rows(values_only=True):
        if r and r[0] is not None:
            try:
                eid = int(float(str(r[0])))
                pattern_map[eid] = {
                    "name": str(r[1]).strip(),
                    "tool": str(r[2]).strip(),
                    "pattern": str(r[3]).strip() if r[3] else ""
                }
            except:
                pass
    return pattern_map


def main():
    print("=" * 70)
    print("Area46 Training Lab - Ottimizzazione Durata e Logica di Programmazione")
    print("Landmine Lab - Livello PRO (Settimane 3 & 4)")
    print("=" * 70)

    pattern_map = load_pattern_map()

    # 1. Connessione Google API
    print("\n[Fase 1] Connessione a Google Sheets...")
    gc = gspread.service_account(filename=CREDENTIALS_FILE)
    sh_target = gc.open_by_key(TARGET_SHEET_ID)
    ws_target = sh_target.worksheet("Allenamenti PRO")
    print(f"Foglio target connesso: '{sh_target.title}' -> '{ws_target.title}'")

    # 2. Generazione Settimane 3 e 4 Ottimizzate
    print("\n[Fase 2] Generazione Settimane 3 e 4 ottimizzate:")
    print("  - Rimosso 'in in-out out sprawl' da Giorno 1 (5a / 7a)")
    print("  - Rimossi 'Overhand Matadors Wheel' e 'COMBO Side kick trough + Sprawl' da Giorno 2 (6b / 8b)")
    print("  - Inserito 'Side kick through' nell'AMRAP portato a 15 min")
    
    sett3_rows = build_optimized_settimana(3)
    sett4_rows = build_optimized_settimana(4)
    all_rows = sett3_rows + sett4_rows
    print(f"Generate {len(sett3_rows)} righe per Settimana 3 e {len(sett4_rows)} righe per Settimana 4. Totale: {len(all_rows)}")

    # 3. Verifica Bilanciamento Biomeccanico
    stats_sett3 = BiomechanicalBalancingEngine.analyze_microcycle_balance(sett3_rows, pattern_map)
    print("\n[Verifica Algoritmica Settimana 3]:")
    print(f"  - Upper Count: {stats_sett3['upper_count']} ({stats_sett3['ratio_upper']:.1f}%)")
    print(f"  - Lower Count: {stats_sett3['lower_count']} ({stats_sett3['ratio_lower']:.1f}%)")
    print(f"  - Pattern Coperti: {stats_sett3['patterns_found']}")
    assert stats_sett3['patterns_found']["Spinta Orizzontale"] > 0, "Errore: Spinta Orizzontale assente!"
    assert stats_sett3['patterns_found']["Trazione"] > 0, "Errore: Trazione assente!"

    # 4. Aggiornamento su Google Fogli (Target Spreadsheet)
    print("\n[Fase 3 & 4] Pulizia e scrittura su Google Fogli 'Allenamenti PRO'...")
    # Puliamo l'intervallo da riga 40 a riga 80 per evitare righe orfane
    clear_range = "A40:K85"
    ws_target.batch_clear([clear_range])
    print(f"-> Intervallo {clear_range} svuotato.")

    # Scriviamo esattamente le 34 righe nel range A40:K73
    end_row = 39 + len(all_rows) # 73
    target_range = f"A40:K{end_row}"
    ws_target.update(range_name=target_range, values=all_rows)
    print(f"-> Range {target_range} aggiornato con successo con le {len(all_rows)} righe ottimizzate!")

    # 5. Sincronizzazione Master Google Sheet (database esercizi Lab -> Pro)
    print(f"\n[Sincronizzazione Master] Aggiornamento scheda 'Pro' in '{LAB_SHEET_ID}'...")
    try:
        sh_lab = gc.open_by_key(LAB_SHEET_ID)
        ws_pro_master = sh_lab.worksheet("Pro")
        
        master_rows = []
        for r in all_rows:
            sett_num = 3 if "Sett 3" in r[1] else 4
            is_g1 = "Giorno 1" in r[1]
            if sett_num == 3:
                g_str = "5 allenamento A" if is_g1 else "6 allenamento B"
            else:
                g_str = "7 allenamento A" if is_g1 else "8 allenamento B"

            master_row = [
                r[0],                    # livello
                f"Settimana {sett_num}", # Settimana
                g_str,                   # giorno
                r[2],                    # Sequenza
                r[3],                    # ID esercizio
                r[4],                    # nome esercizio
                r[5],                    # parametri
                r[6],                    # recupero
                "",                      # minutaggio blocco
                r[8],                    # Note Tecniche
                "",                      # video temp
                ""                       # data_pubblicazione
            ]
            master_rows.append(master_row)

        clear_range_master = "A40:L85"
        ws_pro_master.batch_clear([clear_range_master])
        end_row_master = 39 + len(master_rows)
        ws_pro_master.update(range_name=f"A40:L{end_row_master}", values=master_rows)
        print("-> Scheda 'Pro' master sincronizzata con successo.")
    except Exception as e:
        print(f"Nota su sync master: {e}")

    # 6. Sincronizzazione Locale su 'database esercizi Lab.xlsx'
    if os.path.exists(LOCAL_LAB_EXCEL):
        print(f"\n[Sincronizzazione Locale] Aggiornamento {LOCAL_LAB_EXCEL}...")
        wb = openpyxl.load_workbook(LOCAL_LAB_EXCEL)
        ws = wb["Pro"]
        # Pulizia righe 40-80
        for r_idx in range(40, 85):
            for c_idx in range(1, 15):
                ws.cell(row=r_idx, column=c_idx, value=None)
        # Scrittura nuove righe
        start_row = 40
        for idx, r in enumerate(master_rows):
            target_row_idx = start_row + idx
            for col_idx, val in enumerate(r, 1):
                ws.cell(row=target_row_idx, column=col_idx, value=val)
        wb.save(LOCAL_LAB_EXCEL)
        print(f"-> File locale '{LOCAL_LAB_EXCEL}' aggiornato con successo.")

    # 7. Sincronizzazione demo-data.json
    if os.path.exists(DEMO_DATA_JSON):
        print(f"\n[Sincronizzazione App Demo] Aggiornamento {DEMO_DATA_JSON}...")
        with open(DEMO_DATA_JSON, "r") as f:
            demo_data = json.load(f)

        demo_data["allenamenti"] = [
            a for a in demo_data["allenamenti"]
            if not (a.get("livello") == "PRO" and a.get("settimana") in ["Settimana 3", "Settimana 4"])
        ]

        existing_ids = [a.get("id", 0) for a in demo_data.get("allenamenti", [])]
        max_id = max(existing_ids) if existing_ids else 571

        for r in master_rows:
            max_id += 1
            demo_data["allenamenti"].append({
                "id": max_id,
                "livello": r[0],
                "settimana": r[1],
                "giorno": r[2],
                "sequenza": r[3],
                "id_esercizio": f"{int(r[4]):03d}",
                "nome_esercizio": r[5],
                "parametri": r[6],
                "recupero": r[7],
                "minutaggio_blocco": "",
                "note_tecniche": r[9],
                "link_video": "",
                "data_pubblicazione": None
            })
        
        with open(DEMO_DATA_JSON, "w") as f:
            json.dump(demo_data, f, indent=2)
        print(f"-> File '{DEMO_DATA_JSON}' sincronizzato.")

    print("\n" + "=" * 70)
    print("OTTIMIZZAZIONE COMPLETATA CON SUCCESSO!")
    print("=" * 70)


if __name__ == "__main__":
    main()
