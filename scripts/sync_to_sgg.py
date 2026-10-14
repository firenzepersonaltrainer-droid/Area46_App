#!/usr/bin/env python3
"""
Area46 Landmine Lab -> SGG Client Sync Engine
Sincronizza in modo sicuro, idempotente e non distruttivo i dati anagrafici e fiscali
degli atleti registrati in Area46 Lab (demo-data.json) verso la tabella 'clients' di SGG (sgg_database.sqlite).
"""

import os
import sys
import json
import uuid
import sqlite3
from datetime import datetime

AREA46_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO_DATA_FILE = os.path.join(AREA46_DIR, "demo-data.json")
SGG_DIR = "/Users/stefy/Desktop/progetto Gestione economica e fatturazione"
SGG_DB_FILE = os.path.join(SGG_DIR, "sgg_database.sqlite")

def is_test_athlete(name: str, email: str = "") -> bool:
    name_l = (name or "").strip().lower()
    email_l = (email or "").strip().lower()
    if any(k in name_l for k in ["test", "fittiz", "simula", "mock", "dummy", "atleta lab", "atleta webhook"]):
        return True
    if any(k in email_l for k in ["@test.it", "@example.com", "fake"]):
        return True
    return False

def sync_athletes():
    print("=" * 60)
    print("🔄 AVVIO SINCRONIZZAZIONE ANAGRAFICA: AREA46 LAB ➡️ SGG")
    print("=" * 60)

    if not os.path.exists(DEMO_DATA_FILE):
        print(f"❌ Errore: File dati Area46 non trovato: {DEMO_DATA_FILE}")
        sys.exit(1)

    if not os.path.exists(SGG_DB_FILE):
        print(f"⚠️ Avviso: Database SGG non presente al percorso {SGG_DB_FILE}. Sincronizzazione saltata.")
        sys.exit(0)

    with open(DEMO_DATA_FILE, "r", encoding="utf-8") as f:
        area46_data = json.load(f)

    atleti = area46_data.get("profili_utenti", [])
    print(f"📊 Atleti caricati da Area46: {len(atleti)}")

    conn = sqlite3.connect(SGG_DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("PRAGMA integrity_check")
    integrity = cursor.fetchone()
    if not integrity or integrity[0] != "ok":
        print(f"❌ Integrità database SGG fallita: {integrity}")
        conn.close()
        sys.exit(1)

    now_iso = datetime.now().isoformat()
    inserted_count = 0
    updated_count = 0

    for a in atleti:
        atleta_id = (a.get("id") or "").strip()
        nome = (a.get("nome") or "").strip()
        cognome = (a.get("cognome") or "").strip()
        full_name = f"{nome} {cognome}".strip() or (a.get("name") or "Atleta Landmine").strip()
        email = (a.get("email") or "").strip().lower()
        telefono = (a.get("telefono") or "").strip()
        cf = (a.get("codice_fiscale") or "").strip().upper()
        piva = (a.get("partita_iva") or "").strip()
        pec = (a.get("pec") or "").strip().lower()
        via = (a.get("indirizzo_via") or "").strip()
        civico = (a.get("civico") or "").strip()
        cap = (a.get("cap") or "").strip()
        citta = (a.get("citta") or "").strip()
        prov = (a.get("provincia") or "").strip().upper()
        full_address = (a.get("indirizzo") or "").strip()
        note = (a.get("note_coach") or "").strip()
        scadenza = a.get("data_scadenza_crediti")
        tipo_abb = a.get("tipo_abbonamento") or "standard"

        if not full_name:
            continue

        if is_test_athlete(full_name, email):
            print(f"🛡️ Saltato profilo di test/simulazione: '{full_name}' ({email})")
            continue

        client = None
        if atleta_id:
            cursor.execute("SELECT * FROM clients WHERE external_athlete_id = ? AND deleted_at IS NULL", (atleta_id,))
            client = cursor.fetchone()

        if not client and cf:
            cursor.execute("SELECT * FROM clients WHERE UPPER(fiscal_code) = ? AND deleted_at IS NULL", (cf,))
            client = cursor.fetchone()

        if not client and email:
            cursor.execute("SELECT * FROM clients WHERE LOWER(email) = ? AND deleted_at IS NULL", (email,))
            client = cursor.fetchone()

        if not client and full_name:
            cursor.execute("SELECT * FROM clients WHERE LOWER(name) = ? AND deleted_at IS NULL", (full_name.lower(),))
            client = cursor.fetchone()

        if client:
            client_id = client["id"]
            updates = []
            params = []

            def should_update(field_name, new_val):
                old_val = (client[field_name] or "").strip() if client[field_name] else ""
                return bool(new_val and new_val != old_val)

            if should_update("name", full_name):
                updates.append("name = ?")
                params.append(full_name)
            if should_update("email", email):
                updates.append("email = ?")
                params.append(email)
            if should_update("phone", telefono):
                updates.append("phone = ?")
                params.append(telefono)
            if should_update("fiscal_code", cf):
                updates.append("fiscal_code = ?")
                params.append(cf)
            if should_update("vat_number", piva):
                updates.append("vat_number = ?")
                params.append(piva)
            if should_update("pec", pec):
                updates.append("pec = ?")
                params.append(pec)
            if should_update("address_street", via):
                updates.append("address_street = ?")
                params.append(via)
            if should_update("address_civic", civico):
                updates.append("address_civic = ?")
                params.append(civico)
            if should_update("address_cap", cap):
                updates.append("address_cap = ?")
                params.append(cap)
            if should_update("address_city", citta):
                updates.append("address_city = ?")
                params.append(citta)
            if should_update("address_province", prov):
                updates.append("address_province = ?")
                params.append(prov)
            if should_update("address", full_address):
                updates.append("address = ?")
                params.append(full_address)
            if should_update("external_athlete_id", atleta_id):
                updates.append("external_athlete_id = ?")
                params.append(atleta_id)
            if scadenza and should_update("package_expiry_date", scadenza):
                updates.append("package_expiry_date = ?")
                params.append(scadenza)

            if updates:
                updates.append("updated_at = ?")
                params.append(now_iso)
                params.append(client_id)
                query = f"UPDATE clients SET {', '.join(updates)} WHERE id = ?"
                cursor.execute(query, tuple(params))
                updated_count += 1
        else:
            new_id = str(uuid.uuid4())
            pkg_name = f"Abbonamento Lab ({tipo_abb})" if tipo_abb != "standard" else "Pacchetto Landmine Lab"
            cursor.execute("""
                INSERT INTO clients (
                    id, name, track, fiscal_code, vat_number, email, phone,
                    address, notes, package_name, package_expiry_date, package_status,
                    pec, address_street, address_civic, address_cap, address_city, address_province,
                    source_origin, external_athlete_id, created_at, updated_at
                ) VALUES (
                    ?, ?, 'Landmine Lab', ?, ?, ?, ?,
                    ?, ?, ?, ?, 'ATTIVO',
                    ?, ?, ?, ?, ?, ?,
                    'LANDMINE_LAB', ?, ?, ?
                )
            """, (
                new_id, full_name, cf, piva, email, telefono,
                full_address, note, pkg_name, scadenza,
                pec, via, civico, cap, citta, prov,
                atleta_id, now_iso, now_iso
            ))
            inserted_count += 1

    conn.commit()

    cursor.execute("PRAGMA integrity_check")
    integrity_post = cursor.fetchone()
    conn.close()

    if integrity_post and integrity_post[0] == "ok":
        print("✅ Integrità database SGG confermata al 100%.")
    else:
        print(f"⚠️ Avviso post-integrità: {integrity_post}")

    print("------------------------------------------------------------")
    print(f"🎯 RISULTATO SINCRONIZZAZIONE:")
    print(f"   • Nuovi atleti inseriti in SGG: {inserted_count}")
    print(f"   • Atleti aggiornati con nuovi dati/PEC/residenza: {updated_count}")
    print("============================================================")

if __name__ == "__main__":
    sync_athletes()
