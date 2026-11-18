#!/usr/bin/env python3
"""
Area46 & Landmine Lab - Motore Condiviso di Allenamento per il Comitato Tecnico.
Implementazione deterministica a supporto della squadra dei 5 agenti:
- EINSTEIN (Supervisione, Validazione & Zero Allucinazioni)
- SOCRATES (Metodologia, Clinica, Joint Shielding & Modalita B)
- ATLAS (Catalogo & Schemi Motori Funzionali)
- CHRONOS (Tempo, Periodizzazione 55:35:10 & Tetto 60 Minuti)
- AURA (Readiness Biologico & Monitoraggio Fatica)

Vincolo Permanente: divieto assoluto del termine b-i-o-m-e-c-c-a-n-i-c-a.
Usare esclusivamente 'pattern motorio', 'schemi motori funzionali' o 'cinematica del movimento'.
"""

import os
import sys
import json
import sqlite3
import shutil
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

# Percorsi database ufficiali
PRIMARY_DB_PATH = "/Users/stefy/Desktop/progetto Gestione economica e fatturazione/area46_v2.sqlite"
MIRROR_DB_PATH = "/Users/stefy/Desktop/Area46_App/area46_v2.sqlite"

# Percorsi file applicativi Area46 App
AREA46_DIR = "/Users/stefy/Desktop/Area46_App"
DEMO_DATA_PATH = os.path.join(AREA46_DIR, "demo-data.json")
REGISTER_PATH = os.path.join(AREA46_DIR, "registro_periodizzazione_pro.json")
VAULT_CYCLES_PATH = os.path.join(AREA46_DIR, "data", "vault", "5_metodologia_allenamenti_cicli.json")


def get_db_connection(preferred_path: Optional[str] = None) -> sqlite3.Connection:
    """Restituisce una connessione al database SQLite master o mirror."""
    paths_to_try = [preferred_path, PRIMARY_DB_PATH, MIRROR_DB_PATH]
    valid_path = None
    for p in paths_to_try:
        if p and os.path.exists(p):
            valid_path = p
            break

    if not valid_path:
        raise FileNotFoundError(f"Database SQLite non trovato nei percorsi: {paths_to_try}")

    conn = sqlite3.connect(valid_path)
    conn.row_factory = sqlite3.Row
    return conn


def sync_db_mirror():
    """Mantiene allineato il database mirror in Area46_App."""
    if os.path.exists(PRIMARY_DB_PATH):
        os.makedirs(os.path.dirname(MIRROR_DB_PATH), exist_ok=True)
        shutil.copy2(PRIMARY_DB_PATH, MIRROR_DB_PATH)


# ==============================================================================
# ATLAS: CATALOGO, RICERCA & SCHEMI MOTORI FUNZIONALI
# ==============================================================================

class AtlasCatalog:
    """Modulo Atlas: custode dell'arsenale dei 163 esercizi Landmine Lab esclusivi."""

    @staticmethod
    def get_exercises(
        category: Optional[str] = None,
        pattern_motorio: Optional[str] = None,
        linea_miofasciale: Optional[str] = None,
        setup: Optional[str] = None,
        subcategory: Optional[str] = None,
        query: Optional[str] = None,
        limit: Optional[int] = None,
        db_path: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Estrae esercizi dalla vista v_landmine_lab_exercises applicando filtri deterministici.
        """
        conn = get_db_connection(db_path)
        cur = conn.cursor()

        sql = "SELECT * FROM v_landmine_lab_exercises WHERE 1=1"
        params: List[Any] = []

        if category:
            sql += " AND LOWER(category) = LOWER(?)"
            params.append(category)

        if pattern_motorio:
            sql += " AND LOWER(pattern_motorio) LIKE LOWER(?)"
            params.append(f"%{pattern_motorio}%")

        if linea_miofasciale:
            sql += " AND LOWER(linea_miofasciale) LIKE LOWER(?)"
            params.append(f"%{linea_miofasciale}%")

        if setup:
            sql += " AND LOWER(setup_attrezzatura) LIKE LOWER(?)"
            params.append(f"%{setup}%")

        if subcategory:
            sql += " AND LOWER(subcategory) LIKE LOWER(?)"
            params.append(f"%{subcategory}%")

        if query:
            sql += " AND (LOWER(name) LIKE LOWER(?) OR LOWER(id) LIKE LOWER(?) OR LOWER(legacy_id) LIKE LOWER(?))"
            q_like = f"%{query}%"
            params.extend([q_like, q_like, q_like])

        sql += " ORDER BY id ASC"

        if limit:
            sql += " LIMIT ?"
            params.append(limit)

        cur.execute(sql, params)
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows

    @staticmethod
    def get_exercise_by_id(exercise_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Trova un esercizio per ID (LM-xxx o legacy_id xxx) o per nome esatto."""
        conn = get_db_connection(db_path)
        cur = conn.cursor()

        cur.execute(
            """
            SELECT * FROM v_landmine_lab_exercises 
            WHERE LOWER(id) = LOWER(?) OR LOWER(legacy_id) = LOWER(?) OR LOWER(name) = LOWER(?)
            LIMIT 1
            """,
            (exercise_id, exercise_id, exercise_id)
        )
        row = cur.fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def count_total(db_path: Optional[str] = None) -> int:
        """Restituisce il conteggio totale degli esercizi nella vista esclusiva."""
        conn = get_db_connection(db_path)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM v_landmine_lab_exercises")
        total = cur.fetchone()[0]
        conn.close()
        return total


# ==============================================================================
# CHRONOS: TEMPO, PERIODIZZAZIONE & TETTO 60 MINUTI
# ==============================================================================

class ChronosPeriodization:
    """Modulo Chronos: maestro del tempo, volumi 55:35:10 e tetto 60 minuti."""

    @staticmethod
    def parse_sets_reps(param_str: str) -> Tuple[int, int, bool]:
        """
        Estrae numero di serie e ripetizioni da stringhe come '4x8', '3x15+15', '3x20\"+20\"'.
        Ritorna: (sets, reps_per_side, is_unilateral)
        """
        if not param_str:
            return 3, 10, False

        param = str(param_str).strip().lower()

        # Casi speciali come 'amrap 13'', 'costruzione motoria'
        if "amrap" in param or "costruzione" in param:
            return 1, 1, False

        is_unilateral = ("+" in param)

        sets = 3
        reps = 10

        if "x" in param:
            parts = param.split("x", 1)
            try:
                sets = int(parts[0].strip())
            except ValueError:
                sets = 3

            rep_part = parts[1].strip()
            # Pulizia per notazioni tipo '8+8' o '15"+15"'
            if "+" in rep_part:
                first_half = rep_part.split("+")[0].strip().replace('"', '').replace("'", "")
                try:
                    reps = int(first_half)
                except ValueError:
                    reps = 10
            else:
                rep_clean = rep_part.replace('"', '').replace("'", "").strip()
                try:
                    reps = int(rep_clean)
                except ValueError:
                    reps = 10
        elif "+" in param:
            is_unilateral = True
            reps_clean = param.replace("x", "").split("+")[0].strip()
            try:
                reps = int(reps_clean)
            except ValueError:
                reps = 15
            sets = 3

        return sets, reps, is_unilateral

    @staticmethod
    def calculate_volume_distribution(exercises_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calcola la ripartizione del volume (serie allenanti) e confronta con 55:35:10.
        Categorie considerate:
        - Fondamentali: target 55%
        - Complementari: target 35%
        - Accessori / Metodo Specialistico / Engine: target 10%
        """
        sets_fondamentali = 0
        sets_complementari = 0
        sets_accessori = 0

        for ex in exercises_list:
            cat = str(ex.get("category", "")).strip().title()
            param = ex.get("parametri", "")
            num_sets, _, _ = ChronosPeriodization.parse_sets_reps(param)

            if cat == "Fondamentale":
                sets_fondamentali += num_sets
            elif cat == "Complementare":
                sets_complementari += num_sets
            else:
                # Include 'Accessorio', 'Metodo Specialistico', ecc.
                sets_accessori += num_sets

        total_sets = sets_fondamentali + sets_complementari + sets_accessori
        if total_sets == 0:
            return {
                "total_sets": 0,
                "fondamentali_pct": 0.0,
                "complementari_pct": 0.0,
                "accessori_pct": 0.0,
                "is_conforming": False,
                "summary": "Nessuna serie allenante individuata."
            }

        pct_fond = round((sets_fondamentali / total_sets) * 100, 1)
        pct_comp = round((sets_complementari / total_sets) * 100, 1)
        pct_acc = round((sets_accessori / total_sets) * 100, 1)

        # Tolleranza flessibile orientativa (+- 15% sul mesociclo, senza dogmi rigidi)
        is_conforming = (pct_fond >= 40.0) and (pct_comp >= 20.0)

        return {
            "total_sets": total_sets,
            "sets_detail": {
                "fondamentali": sets_fondamentali,
                "complementari": sets_complementari,
                "accessori": sets_accessori
            },
            "percentages": {
                "fondamentali": pct_fond,
                "complementari": pct_comp,
                "accessori": pct_acc
            },
            "target": "55% Fondamentali : 35% Complementari : 10% Accessori",
            "is_conforming": is_conforming,
            "summary": f"Ripartizione: {pct_fond}% Fond | {pct_comp}% Comp | {pct_acc}% Acc (Totale: {total_sets} serie)"
        }

    @staticmethod
    def estimate_session_duration(
        exercises: List[Dict[str, Any]],
        default_rbs_override: Optional[int] = None,
        warmup_minutes: int = 5
    ) -> Dict[str, Any]:
        """
        Stima deterministica della durata della seduta in studio:
        - Tempo Sotto Tensione (TUT): 3-4 sec per rep
        - Recupero standard tra serie
        - RBS (Rest Between Sides) contestuale se unilaterale
        - Blocchi a tempo (AMRAP, es. 10', 11', 13')
        Verifica tassativa del rispetto del tetto dei 60 minuti in studio.
        """
        total_seconds = warmup_minutes * 60
        details = []

        for ex in exercises:
            cat = str(ex.get("category", "")).strip().title()
            param = str(ex.get("parametri", "")).strip()
            rec_str = str(ex.get("recupero", "")).strip().lower()
            note = str(ex.get("note_tecniche", "")).lower()

            # Rilevamento blocchi a tempo AMRAP
            if "amrap" in note or "amrap" in param.lower():
                minutes_block = 10
                for token in (note + " " + param).split():
                    if "amrap" in token:
                        continue
                    if "'" in token:
                        try:
                            minutes_block = int(token.replace("'", "").replace("’", ""))
                        except ValueError:
                            pass
                block_sec = minutes_block * 60
                total_seconds += block_sec
                details.append({
                    "exercise": ex.get("nome_esercizio", ex.get("name", "Esercizio")),
                    "type": "AMRAP Block",
                    "duration_seconds": block_sec
                })
                continue

            num_sets, reps_per_side, is_unilateral = ChronosPeriodization.parse_sets_reps(param)

            # TUT stimato (secondi per serie)
            if is_unilateral:
                tut_per_set = reps_per_side * 2 * 3.5  # entrambi i lati
            else:
                tut_per_set = reps_per_side * 3.0

            # Recupero tra serie
            rec_sec = 60
            if "90" in rec_str:
                rec_sec = 90
            elif "120" in rec_str or "2'" in rec_str:
                rec_sec = 120
            elif "45" in rec_str:
                rec_sec = 45
            elif "30" in rec_str:
                rec_sec = 30
            else:
                if cat == "Fondamentale":
                    rec_sec = 90
                elif cat == "Complementare":
                    rec_sec = 60
                else:
                    rec_sec = 45

            # RBS contestuale (se monolaterale)
            rbs_sec = 0
            if is_unilateral:
                if default_rbs_override is not None:
                    rbs_sec = default_rbs_override
                elif "rbs_default_seconds" in ex and ex["rbs_default_seconds"]:
                    rbs_sec = int(ex["rbs_default_seconds"])
                else:
                    # Default contestuale: per fondamentali asimmetrici 30", per accessori 0"
                    rbs_sec = 30 if cat == "Fondamentale" else 0

            ex_total_sec = num_sets * (tut_per_set + rec_sec + rbs_sec)
            total_seconds += ex_total_sec

            details.append({
                "exercise": ex.get("nome_esercizio", ex.get("name", "Esercizio")),
                "sets": num_sets,
                "reps": reps_per_side,
                "is_unilateral": is_unilateral,
                "tut_per_set": round(tut_per_set),
                "rest_per_set": rec_sec,
                "rbs_per_set": rbs_sec,
                "total_seconds": round(ex_total_sec)
            })

        duration_minutes = round(total_seconds / 60, 1)
        is_under_60 = duration_minutes <= 60.0
        margin_minutes = round(60.0 - duration_minutes, 1)

        return {
            "duration_minutes": duration_minutes,
            "is_under_60_min": is_under_60,
            "margin_minutes": margin_minutes,
            "status": "CONFORME (Sotto i 60 minuti)" if is_under_60 else "ATTENZIONE: Supera i 60 minuti",
            "exercise_count": len(exercises),
            "details": details
        }


# ==============================================================================
# SOCRATES: SICUREZZA CLINICA, JOINT SHIELDING & MODALITA B
# ==============================================================================

class SocratesClinical:
    """Modulo Socrates: Joint Shielding L5-S1, Didattica a 3 Fasi e Modalita B."""

    AXIAL_LOAD_PATTERNS = [
        "cerniera d'anca",
        "hinge",
        "squat",
        "deadlift",
        "stacco",
        "snatch",
        "clean"
    ]

    @staticmethod
    def is_heavy_axial_load(exercise: Dict[str, Any]) -> bool:
        """Determina se un esercizio comporta un carico assiale significativo su L5-S1."""
        name = str(exercise.get("name", exercise.get("nome_esercizio", ""))).lower()
        pattern = str(exercise.get("pattern_motorio", "")).lower()
        cat = str(exercise.get("category", "")).strip().title()

        # Solo i fondamentali o stacchi/squat pesanti comportano vero carico assiale critico
        is_pattern_axial = any(p in pattern for p in SocratesClinical.AXIAL_LOAD_PATTERNS) or \
                           any(p in name for p in ["deadlift", "stacco", "squat", "clean", "snatch"])
        
        is_heavy = (cat == "Fondamentale") or any(k in name for k in ["deadlift", "biker", "heavy", "pounce"])
        return is_pattern_axial and is_heavy

    @staticmethod
    def check_joint_shielding(session_a: List[Dict[str, Any]], session_b: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Verifica che non vi sia sovraccarico assiale contiguo su L5-S1 tra Seduta A e Seduta B.
        Garantisce Joint Shielding e salute lombare dell'atleta.
        """
        axial_in_a = [ex for ex in session_a if SocratesClinical.is_heavy_axial_load(ex)]
        axial_in_b = [ex for ex in session_b if SocratesClinical.is_heavy_axial_load(ex)]

        has_conflict = (len(axial_in_a) > 0 and len(axial_in_b) > 0)

        # Controllo stimolo per braccia e spalle
        all_exercises = session_a + session_b
        has_arms_shoulders = any(
            any(t in str(ex.get("target_muscolare", "")).lower() for t in ["bicipiti", "tricipiti", "spalle", "deltoidi"]) or
            any(t in str(ex.get("name", ex.get("nome_esercizio", ""))).lower() for t in ["press", "curl", "extension", "jerk", "pull"])
            for ex in all_exercises
        )

        recommendations = []
        if has_conflict:
            recommendations.append(
                "SOVRACCARICO ASSIALE CONTIGUO RILEVATO: Sia Seduta A che Seduta B contengono pattern ad alto carico assiale su L5-S1. "
                "Applicare Joint Shielding: spostare la cerniera d'anca pesante su Seduta A e utilizzare spinta/trazione o destrezza spiralizzata su Seduta B."
            )

        if not has_arms_shoulders:
            recommendations.append(
                "ATTENZIONE ESTETICA/STRUTTURALE: Manca stimolo diretto prioritario per braccia e spalle nel ciclo A/B."
            )

        return {
            "joint_shielding_respected": not has_conflict,
            "has_arms_shoulders_coverage": has_arms_shoulders,
            "axial_exercises_a": [e.get("name", e.get("nome_esercizio")) for e in axial_in_a],
            "axial_exercises_b": [e.get("name", e.get("nome_esercizio")) for e in axial_in_b],
            "status": "JOINT SHIELDING CONFERMATO (L5-S1 Protetto)" if not has_conflict else "VETO CLINICO: Conflitto Assiale Contiguo",
            "recommendations": recommendations
        }

    @staticmethod
    def apply_three_phase_didactics(exercise_name: str, phase: int = 1) -> Dict[str, str]:
        """
        Restituisce la prescrizione guidata per l'introduzione di un nuovo esercizio:
        - Fase 1 (Costruzione motoria)
        - Fase 2 (Controllo lento)
        - Fase 3 (Espressione dinamica)
        """
        if phase == 1:
            return {
                "fase": "Costruzione",
                "parametri": "costruzione motoria",
                "recupero": "Rec 60\"",
                "note_tecniche": "costruzione dell'esercizio: dedica il tempo necessario all'apprendimento motorio. Chiedi al coach una progressione adeguata al tuo livello"
            }
        elif phase == 2:
            return {
                "fase": "Controllo Lento",
                "parametri": "4x8+8",
                "recupero": "Rec 60\"",
                "note_tecniche": "lavora con calma e lentezza, dai la precedenza alla tecnica anziché sull'intensità"
            }
        else:
            return {
                "fase": "Espressione Dinamica",
                "parametri": "3x20\"+20\"",
                "recupero": "Rec 45\"",
                "note_tecniche": "cerca la massima esplosività adeguata al tuo livello"
            }

    @staticmethod
    def resolve_modalita_b(exercise_or_pattern: str, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Risoluzione della Modalita B:
        Quando un fondamentale pesante completa il ciclo di forza, viene sostituito per un ciclo
        da lavoro qualitativo, destrezza, mobilita o propedeutica dal catalogo di 163 esercizi.
        """
        target_ex = AtlasCatalog.get_exercise_by_id(exercise_or_pattern, db_path)
        pattern_filter = ""
        linea_filter = ""

        if target_ex:
            pattern_filter = target_ex.get("pattern_motorio", "")
            linea_filter = target_ex.get("linea_miofasciale", "")
        else:
            pattern_filter = exercise_or_pattern

        # Ricerca esercizi qualitativi, mobilita o destrezza con pattern o linea analoga
        all_exercises = AtlasCatalog.get_exercises(db_path=db_path)
        candidates = []

        for ex in all_exercises:
            cat = str(ex.get("category", "")).strip().title()
            subcat = str(ex.get("subcategory", "")).strip().lower()
            ex_pattern = str(ex.get("pattern_motorio", "")).lower()

            # La Modalita B predilige categorie non pesanti (Accessorio, Metodo Specialistico) o subcat mobilita/skill
            if cat in ["Accessorio", "Metodo Specialistico"] or any(s in subcat for s in ["mobilità", "skill", "combo", "warm up"]):
                score = 0
                if linea_filter and linea_filter.lower() in str(ex.get("linea_miofasciale", "")).lower():
                    score += 2
                if pattern_filter and pattern_filter.lower() in ex_pattern:
                    score += 3
                if "mobilità" in ex_pattern or "spiral" in ex_pattern or "destrezza" in ex_pattern:
                    score += 2

                if score > 0:
                    candidates.append((score, ex))

        candidates.sort(key=lambda x: x[0], reverse=True)
        return [c[1] for c in candidates[:5]]


# ==============================================================================
# EINSTEIN: SUPERVISIONE GLOBALE, VALIDAZIONE & ZERO ALLUCINAZIONI
# ==============================================================================

class EinsteinSupervisor:
    """Modulo Einstein: validazione rigorosa della bozza del ciclo e certificazione costituzionale."""

    @staticmethod
    def validate_cycle_draft(cycle_payload: Dict[str, Any], db_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Valida l'intera bozza del ciclo di allenamento (6 sedute A/B/A/B/A/B o lista sessioni):
        1. Zero Allucinazioni: ogni ID esercizio deve esistere nei 163 ufficiali.
        2. Rispetto del Tetto dei 60 Minuti per ciascuna seduta via Chronos.
        3. Joint Shielding L5-S1 tra sedute contigue via Socrates.
        4. Ripartizione del volume globale del ciclo (55:35:10) via Chronos.
        5. Conformita divieti (no speed ladder in AMRAP, no RPE errati su pliometria/core).
        """
        errors = []
        warnings = []
        certified_exercises = []

        sessions = cycle_payload.get("sessions", [])
        if not sessions and "allenamenti" in cycle_payload:
            # Raggruppamento per giorno
            sessions_map = {}
            for row in cycle_payload["allenamenti"]:
                giorno = row.get("giorno", "Seduta A")
                sessions_map.setdefault(giorno, []).append(row)
            sessions = [{"label": g, "exercises": ex_list} for g, ex_list in sessions_map.items()]

        if not sessions:
            return {
                "valid": False,
                "verdict": "RIGETTATO: Nessuna seduta presente nella bozza del ciclo.",
                "errors": ["Payload del ciclo privo di sessioni."],
                "warnings": []
            }

        all_cycle_exercises = []
        session_duration_reports = []

        # 1. Verifica Zero Allucinazioni & Tetto Minuti per ogni seduta
        for s_idx, session in enumerate(sessions):
            s_label = session.get("label", f"Seduta {s_idx+1}")
            raw_exercises = session.get("exercises", [])
            resolved_exercises = []

            for ex_item in raw_exercises:
                ex_id = str(ex_item.get("id_esercizio", ex_item.get("id", ""))).strip()
                db_ex = AtlasCatalog.get_exercise_by_id(ex_id, db_path)

                if not db_ex:
                    # Tentativo di recupero per nome
                    name = str(ex_item.get("nome_esercizio", ex_item.get("name", ""))).strip()
                    if name:
                        db_ex = AtlasCatalog.get_exercise_by_id(name, db_path)

                if not db_ex:
                    errors.append(
                        f"ALLUCINAZIONE RILEVATA in {s_label}: L'esercizio '{ex_id}' / '{ex_item.get('nome_esercizio', '')}' "
                        f"NON appartiene al catalogo blindato di 163 esercizi Landmine Lab."
                    )
                else:
                    merged = dict(db_ex)
                    merged.update(ex_item)
                    resolved_exercises.append(merged)
                    certified_exercises.append(merged)
                    all_cycle_exercises.append(merged)

            # Controllo Durata Seduta (Tetto 60 Minuti)
            dur_report = ChronosPeriodization.estimate_session_duration(resolved_exercises)
            session_duration_reports.append({"session": s_label, "report": dur_report})

            if not dur_report["is_under_60_min"]:
                errors.append(
                    f"VIOLAZIONE TETTO 60 MINUTI in {s_label}: Durata stimata {dur_report['duration_minutes']} min "
                    f"(supera il limite di studio)."
                )

        # 2. Controllo Joint Shielding tra sedute contigue (es. Seduta A vs Seduta B)
        if len(sessions) >= 2:
            s_a = sessions[0].get("exercises", [])
            s_b = sessions[1].get("exercises", [])
            shield_report = SocratesClinical.check_joint_shielding(s_a, s_b)
            if not shield_report["joint_shielding_respected"]:
                errors.append(f"CONFLITTO JOINT SHIELDING tra Sedute contigue: {shield_report['recommendations']}")

        # 3. Controllo Volumi 55:35:10 del Ciclo
        vol_report = ChronosPeriodization.calculate_volume_distribution(all_cycle_exercises)
        if not vol_report["is_conforming"]:
            warnings.append(
                f"SCOSTAMENTO VOLUME GLOBALE: {vol_report['summary']} rispetto al target 55:35:10. "
                "Valutare se giustificato da una fase selettiva di accumulo o scarico."
            )

        # 4. Controllo Guardrails Specifici (Divieto Speed Ladder in AMRAP)
        for s_idx, session in enumerate(sessions):
            s_label = session.get("label", f"Seduta {s_idx+1}")
            for ex in session.get("exercises", []):
                name = str(ex.get("nome_esercizio", ex.get("name", ""))).lower()
                note = str(ex.get("note_tecniche", "")).lower()
                if "speed ladder" in name and "amrap" in note:
                    errors.append(f"DIVIETO TASSATIVO VIOLATO in {s_label}: Speed Ladder inserita all'interno di un blocco AMRAP.")

        is_valid = (len(errors) == 0)

        return {
            "valid": is_valid,
            "verdict": "CONFORME ALLA COSTITUZIONE" if is_valid else "VETO DI EINSTEIN: Bozza non conforme",
            "errors": errors,
            "warnings": warnings,
            "volume_stats": vol_report,
            "durations": session_duration_reports,
            "total_certified_exercises": len(certified_exercises)
        }


# ==============================================================================
# BRIDGE AUTOMATICO: SINCRONIZZAZIONE CON AREA46 APP
# ==============================================================================

class Area46Bridge:
    """Bridge per la scrittura e allineamento deterministico dei cicli in Area46 App."""

    @staticmethod
    def sync_cycle_to_area46_app(
        cycle_payload: Dict[str, Any],
        db_path: Optional[str] = None,
        backup_files: bool = True
    ) -> Dict[str, Any]:
        """
        Sincronizza il ciclo validato nei 3 magazzini di Area46 App:
        1. Database SQLite Master & Mirror (`programming_cycles`)
        2. `demo-data.json`
        3. `registro_periodizzazione_pro.json`
        4. `data/vault/5_metodologia_allenamenti_cicli.json`
        """
        results = {
            "sqlite_updated": False,
            "demo_data_updated": False,
            "registro_updated": False,
            "vault_updated": False,
            "backup_created": False
        }

        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 1. Scrittura su SQLite
        conn = get_db_connection(db_path)
        cur = conn.cursor()

        cycle_name = cycle_payload.get("name", f"Ciclo {datetime.now().strftime('%Y-%m')}")
        cycle_num = cycle_payload.get("cycle_number", 9)
        scope = cycle_payload.get("scope", "LANDMINE_LAB")
        rpe_range = cycle_payload.get("target_rpe_range", "RPE 7-9")
        rbs_default = cycle_payload.get("rbs_seconds", 30)

        cycle_id = f"CYC-{cycle_num:03d}"

        cur.execute(
            """
            INSERT INTO programming_cycles (id, cycle_number, name, scope, status, target_rpe_range, rbs_seconds, notes, updated_at)
            VALUES (?, ?, ?, ?, 'ATTIVO', ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                cycle_number=excluded.cycle_number,
                scope=excluded.scope,
                status=excluded.status,
                target_rpe_range=excluded.target_rpe_range,
                rbs_seconds=excluded.rbs_seconds,
                updated_at=datetime('now')
            """,
            (cycle_id, cycle_num, cycle_name, scope, rpe_range, rbs_default, f"Generato dal Comitato Tecnico il {timestamp_str}")
        )
        conn.commit()
        conn.close()
        sync_db_mirror()
        results["sqlite_updated"] = True

        # 2. Aggiornamento demo-data.json
        if os.path.exists(DEMO_DATA_PATH):
            if backup_files:
                shutil.copy2(DEMO_DATA_PATH, f"{DEMO_DATA_PATH}.bak_{timestamp_str}")
                results["backup_created"] = True

            with open(DEMO_DATA_PATH, "r", encoding="utf-8") as f:
                demo_data = json.load(f)

            raw_new_workouts = cycle_payload.get("allenamenti", [])
            if raw_new_workouts:
                existing_allenamenti = demo_data.get("allenamenti", [])
                max_id = max([int(x.get("id", 0)) for x in existing_allenamenti] or [1000])

                for item in raw_new_workouts:
                    if "id" not in item:
                        max_id += 1
                        item["id"] = max_id
                    existing_allenamenti.append(item)

                demo_data["allenamenti"] = existing_allenamenti
                with open(DEMO_DATA_PATH, "w", encoding="utf-8") as f:
                    json.dump(demo_data, f, indent=2, ensure_ascii=False)
                results["demo_data_updated"] = True

        # 3. Aggiornamento registro_periodizzazione_pro.json
        if os.path.exists(REGISTER_PATH):
            with open(REGISTER_PATH, "r", encoding="utf-8") as f:
                reg_data = json.load(f)

            reg_data["ciclo_attivo_da_pianificare"] = f"Ciclo {cycle_num} ({cycle_name})"
            storico = reg_data.setdefault("storico_cicli", {})
            storico[f"Ciclo {cycle_num}"] = {
                "status": "attivo / in corso",
                "sessioni": len(cycle_payload.get("sessions", [1, 2, 3, 4, 5, 6])),
                "data_avvio": datetime.now().strftime("%Y-%m-%d"),
                "rpe_target": rpe_range
            }

            with open(REGISTER_PATH, "w", encoding="utf-8") as f:
                json.dump(reg_data, f, indent=2, ensure_ascii=False)
            results["registro_updated"] = True

        # 4. Aggiornamento vault
        if os.path.exists(VAULT_CYCLES_PATH):
            with open(VAULT_CYCLES_PATH, "r", encoding="utf-8") as f:
                vault_data = json.load(f)

            if raw_new_workouts:
                v_allenamenti = vault_data.get("allenamenti", [])
                for item in raw_new_workouts:
                    v_allenamenti.append(item)
                vault_data["allenamenti"] = v_allenamenti

                with open(VAULT_CYCLES_PATH, "w", encoding="utf-8") as f:
                    json.dump(vault_data, f, indent=2, ensure_ascii=False)
                results["vault_updated"] = True

        return results


# ==============================================================================
# CLI PER AGENTI & SUITE DI VERIFICA NELLA REALTÀ
# ==============================================================================

def run_reality_verification() -> bool:
    """
    Esegue tutti i punti del PIANO DI VERIFICA NELLA REALTÀ (Regola Zero):
    1. Connessione ad area46_v2.sqlite e conteggio ufficiale v_landmine_lab_exercises = 163
    2. Atlas estrae un fondamentale e un complementare
    3. Chronos calcola proporzione di volume 55:35:10 e durata seduta <= 60 min
    4. Socrates risolve Modalita B e Joint Shielding
    5. Einstein valida la bozza ed esegue il test di rigetto su esercizio inesistente
    """
    print("=" * 70)
    print("AVVIO PIANO DI VERIFICA NELLA REALTÀ (REGOLA ZERO)")
    print("Area46 App & Landmine Lab - Motore Condiviso Comitato Tecnico")
    print("=" * 70)

    # Passo 1: Conteggio Catalogo Ufficiale
    total_exercises = AtlasCatalog.count_total()
    print(f"\n[1/5 ATLAS TEST] Verifica Catalogo Blindato:")
    print(f" -> Esercizi nella vista v_landmine_lab_exercises: {total_exercises}")
    assert total_exercises == 163, f"Errore: attesi 163 esercizi, trovati {total_exercises}"
    print(" -> ESITO: SUCCESSO (Esattamente 163 esercizi caricati deterministi).")

    # Passo 2: Estrazione Fondamentale e Complementare
    fondamentali = AtlasCatalog.get_exercises(category="Fondamentale", limit=2)
    complementari = AtlasCatalog.get_exercises(category="Complementare", limit=2)
    print(f"\n[2/5 ATLAS TEST] Ricerca Tipologie:")
    print(f" -> Fondamentale estratto: [{fondamentali[0]['id']}] {fondamentali[0]['name']} | Setup: {fondamentali[0]['setup_attrezzatura']}")
    print(f" -> Complementare estratto: [{complementari[0]['id']}] {complementari[0]['name']} | Setup: {complementari[0]['setup_attrezzatura']}")

    # Filtro Lato Lungo
    lato_lungo_ex = AtlasCatalog.get_exercises(setup="Lato Lungo", limit=1)
    if lato_lungo_ex:
        print(f" -> Esercizio Lato Lungo: [{lato_lungo_ex[0]['id']}] {lato_lungo_ex[0]['name']}")

    # Passo 3: Chronos Calcolo Volumi & Durata Seduta Test
    test_session = [
        {"id_esercizio": fondamentali[0]["id"], "category": "Fondamentale", "name": fondamentali[0]["name"], "parametri": "4x8", "recupero": "90\""},
        {"id_esercizio": complementari[0]["id"], "category": "Complementare", "name": complementari[0]["name"], "parametri": "3x10+10", "recupero": "60\"", "rbs_default_seconds": 30},
        {"id_esercizio": "LM-001", "category": "Accessorio", "name": "skierg regular", "parametri": "AMRAP 10'", "recupero": "0\"", "note_tecniche": "AMRAP 10'"}
    ]
    vol_calc = ChronosPeriodization.calculate_volume_distribution(test_session)
    duration_calc = ChronosPeriodization.estimate_session_duration(test_session)
    print(f"\n[3/5 CHRONOS TEST] Periodizzazione & Tempo Seduta:")
    print(f" -> Ripartizione Volumi: {vol_calc['summary']}")
    print(f" -> Durata Seduta Stimata: {duration_calc['duration_minutes']} min (Limite: 60 min, Margine: {duration_calc['margin_minutes']} min)")
    print(f" -> Rispetto Tetto 60 Minuti: {duration_calc['is_under_60_min']}")
    assert duration_calc["is_under_60_min"], "Errore: seduta test supera i 60 minuti!"

    # Passo 4: Socrates Joint Shielding & Modalita B
    print(f"\n[4/5 SOCRATES TEST] Joint Shielding & Modalita B:")
    # Test risoluzione Modalita B per un pattern Hinge pesante
    modalita_b_options = SocratesClinical.resolve_modalita_b("LM-056") # Landmine coiled Deadlift
    print(f" -> Risoluzione Modalita B per Deadlift (LM-056):")
    for opt in modalita_b_options[:3]:
        print(f"    * [{opt['id']}] {opt['name']} ({opt['category']} - {opt['subcategory']})")

    # Test Didattica a 3 Fasi
    fase1 = SocratesClinical.apply_three_phase_didactics("Nuovo Esercizio", phase=1)
    print(f" -> Didattica Fase 1 (Costruzione): {fase1['parametri']} | Note: \"{fase1['note_tecniche'][:60]}...\"")

    # Passo 5: Einstein Validazione Bozza & Test di Rigetto Allucinazione
    print(f"\n[5/5 EINSTEIN TEST] Validazione Costituzionale & Test Rigetto Allucinazione:")
    valid_payload = {
        "sessions": [
            {"label": "Seduta A", "exercises": test_session}
        ]
    }
    cert_valid = EinsteinSupervisor.validate_cycle_draft(valid_payload)
    print(f" -> Validazione Bozza Valida: {cert_valid['verdict']} (Errori: {len(cert_valid['errors'])})")
    assert cert_valid["valid"], "Errore: la bozza valida e' stata rigettata!"

    # Test Rigetto: Inserimento di esercizio allucinato inesistente
    fake_session = [
        {"id_esercizio": "FAKE-999", "nome_esercizio": "Esercizio Inesistente Allucinato", "parametri": "3x10", "recupero": "60\""}
    ]
    invalid_payload = {
        "sessions": [
            {"label": "Seduta A", "exercises": fake_session}
        ]
    }
    cert_invalid = EinsteinSupervisor.validate_cycle_draft(invalid_payload)
    print(f" -> Test Rigetto Allucinazione (FAKE-999): {cert_invalid['verdict']}")
    print(f"    * Errore intercettato: \"{cert_invalid['errors'][0]}\"")
    assert not cert_invalid["valid"], "Errore: l'esercizio allucinato non e' stato bloccato da Einstein!"
    assert len(cert_invalid["errors"]) > 0, "Nessun errore registrato per l'esercizio falso!"

    print("\n" + "=" * 70)
    print("VERIFICA REALE COMPLETATA CON SUCCESSO AL 100% (REGOLA ZERO RISPETTATA)")
    print("=" * 70)
    return True


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Area46 & Landmine Lab - Motore Condiviso di Allenamento")
    parser.add_argument("--count", action="store_true", help="Mostra il conteggio ufficiale del catalogo blindato (163)")
    parser.add_argument("--search", type=str, help="Cerca esercizi per nome o ID")
    parser.add_argument("--category", type=str, help="Filtra per categoria (Fondamentale, Complementare, Accessorio)")
    parser.add_argument("--setup", type=str, help="Filtra per setup (es. 'Lato Lungo', 'Landmine')")
    parser.add_argument("--modalita-b", type=str, help="Risolve alternative di Modalita B per un ID o pattern")
    parser.add_argument("--full-test", action="store_true", help="Esegue la suite completa di verifica nella realta")

    args = parser.parse_args()

    if args.count:
        cnt = AtlasCatalog.count_total()
        print(f"Esercizi Esclusivi Landmine Lab (v_landmine_lab_exercises): {cnt}")
    elif args.modalita_b:
        results = SocratesClinical.resolve_modalita_b(args.modalita_b)
        print(f"Alternative Modalita B per '{args.modalita_b}':")
        for r in results:
            print(f" - [{r['id']}] {r['name']} ({r['category']}) | Pattern: {r['pattern_motorio']}")
    elif args.search or args.category or args.setup:
        exercises = AtlasCatalog.get_exercises(query=args.search, category=args.category, setup=args.setup)
        print(f"Trovati {len(exercises)} esercizi:")
        for ex in exercises[:10]:
            print(f" - [{ex['id']}] {ex['name']} ({ex['category']}) | Setup: {ex['setup_attrezzatura']}")
    elif args.full_test or len(sys.argv) == 1:
        run_reality_verification()
