#!/usr/bin/env python3
"""
Sincronizza i file dati di Area46 sulla cartella Google Drive specificata dall'utente.
Cartella: https://drive.google.com/drive/folders/1leG8ulT21aUP1wQ--qyjxRM0YJ6V0PCO
"""

import os
import sys
import json
import mimetypes
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

CREDENTIALS_FILE = "credenziali.json"
FOLDER_ID = "1leG8ulT21aUP1wQ--qyjxRM0YJ6V0PCO"

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file"
]

FILES_TO_SYNC = [
    {
        "local_path": "PRO database esercizi.xlsx",
        "description": "Catalogo esclusivo 163 esercizi Livello PRO (6 schede categorie)",
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    },
    {
        "local_path": "database esercizi Lab.xlsx",
        "description": "Database master esercizi Area46 Lab",
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    },
    {
        "local_path": "demo-data.json",
        "description": "Dataset completo 12 allenamenti attivi Ciclo 1 e Ciclo 2 (sequenze, carichi, video)",
        "mime_type": "application/json"
    },
    {
        "local_path": "registro_periodizzazione_pro.json",
        "description": "Registro periodizzazione: stato macrociclo, mesociclo e storico utilizzo catalogo 163 esercizi",
        "mime_type": "application/json"
    },
    {
        "local_path": "LINEE_GUIDA_AREA46_PRO.md",
        "description": "Manuale metodologico Area46 Livello PRO (onda RPE, scarico Modalità B, ratio 55:35:10)",
        "mime_type": "text/markdown"
    },
    {
        "local_path": "AGENTS.md",
        "description": "Regole di sistema vincolanti per gli agenti AI nel workspace Area46",
        "mime_type": "text/markdown"
    },
    {
        "local_path": "GEMINI.md",
        "description": "Linee guida sintetiche e vincoli di sistema",
        "mime_type": "text/markdown"
    }
]

def generate_index_file():
    content = """==============================================================================
AREA46 TRAINING LAB - ARCHIVIO E SINCRONIZZAZIONE DATI CLOUD DRIVE
==============================================================================
Questa cartella contiene tutti i file dati e le specifiche metodologiche 
utilizzate da Antigravity e dal team di Area46 per la gestione del Livello PRO.

DOCUMENTI E LINK MASTER (GOOGLE FOGLI ATTIVI):
------------------------------------------------------------------------------
1. PRO database esercizi (Catalogo Master 163 Esercizi):
   https://docs.google.com/spreadsheets/d/1AQHkYjXhI6WhRPORJ4DntiGZQd8ob54wJxkwP_LymwY/edit

2. database esercizi Lab (Database Generale):
   https://docs.google.com/spreadsheets/d/1SNy8IJk1E20BcAdar0F1TqqnpRIDkjlkNn6P2ljKPNY/edit

3. Scheda Registro e Linee Guida PRO (Sui Fogli Google):
   Scheda 'REGISTRO PERIODIZZAZIONE PRO' presente all'interno del file master.

FILE DATI SINCRONIZZATI IN QUESTA CARTELLA:
------------------------------------------------------------------------------
- PRO database esercizi.xlsx: File Excel locale con le 6 schede categorie e collegamenti incrociati.
- database esercizi Lab.xlsx: File Excel master Lab completo.
- demo-data.json: File dati JSON per l'applicazione con i 12 allenamenti di Ciclo 1 e Ciclo 2.
- registro_periodizzazione_pro.json: Database di stato della periodizzazione e tracciamento 163 esercizi.
- LINEE_GUIDA_AREA46_PRO.md: Documento metodologico ufficiale Area46 PRO.
- AGENTS.md / GEMINI.md: Regole di comportamento e guardrails vincolanti per gli agenti AI.

Sincronizzazione automatica gestita dall'account di servizio:
bot-allenamenti@landmine-lab-level-pro.iam.gserviceaccount.com
==============================================================================
"""
    filename = "INDICE_PROGETTO_AREA46.txt"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(content)
    return {
        "local_path": filename,
        "description": "Indice generale dei file e collegamenti cloud a Google Fogli",
        "mime_type": "text/plain"
    }

def get_drive_token():
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"ERRORE: File credenziali '{CREDENTIALS_FILE}' non trovato.")
        sys.exit(1)
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_FILE, scopes=SCOPES
    )
    creds.refresh(Request())
    return creds.token

def list_folder_files(token, folder_id):
    url = f"https://www.googleapis.com/drive/v3/files"
    params = {
        "q": f"'{folder_id}' in parents and trashed = false",
        "fields": "files(id, name, mimeType, modifiedTime, webViewLink)",
        "pageSize": 100
    }
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(url, headers=headers, params=params)
    if res.status_code != 200:
        print(f"Errore nella lettura della cartella Drive: {res.status_code} - {res.text}")
        return {}
    files_map = {}
    for f in res.json().get("files", []):
        files_map[f["name"]] = f
    return files_map

def upload_or_update_file(token, folder_id, file_info, existing_file):
    filename = os.path.basename(file_info["local_path"])
    if not os.path.exists(file_info["local_path"]):
        print(f"  [SALTA] File locale '{file_info['local_path']}' non trovato.")
        return None

    with open(file_info["local_path"], "rb") as f:
        file_bytes = f.read()

    boundary = "===AREA46_BOUNDARY_XYZ==="
    mime_type = file_info["mime_type"]

    if existing_file:
        file_id = existing_file["id"]
        url = f"https://www.googleapis.com/upload/drive/v3/files/{file_id}?uploadType=multipart&fields=id,name,webViewLink"
        metadata = {
            "name": filename,
            "description": file_info.get("description", "")
        }
        method = "PATCH"
    else:
        url = f"https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink"
        metadata = {
            "name": filename,
            "parents": [folder_id],
            "description": file_info.get("description", "")
        }
        method = "POST"

    metadata_bytes = json.dumps(metadata).encode("utf-8")
    body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
    ).encode("utf-8") + metadata_bytes + (
        f"\r\n--{boundary}\r\n"
        f"Content-Type: {mime_type}\r\n\r\n"
    ).encode("utf-8") + file_bytes + (
        f"\r\n--{boundary}--\r\n"
    ).encode("utf-8")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/related; boundary={boundary}",
        "Content-Length": str(len(body))
    }

    if method == "PATCH":
        res = requests.patch(url, headers=headers, data=body)
    else:
        res = requests.post(url, headers=headers, data=body)

    if res.status_code in (200, 201):
        data = res.json()
        action = "AGGIORNATO" if existing_file else "CARICATO"
        print(f"  [{action}] {filename} -> ID: {data.get('id')} ({data.get('webViewLink')})")
        return data
    else:
        print(f"  [ERRORE] {filename}: {res.status_code} - {res.text}")
        return None

def main():
    print(f"Avvio sincronizzazione dati Area46 su Google Drive...")
    print(f"Cartella di destinazione: {FOLDER_ID}")
    
    token = get_drive_token()
    print("Autenticazione con Google Cloud Service Account riuscita.")
    
    index_file = generate_index_file()
    all_files = [index_file] + FILES_TO_SYNC
    
    existing_files = list_folder_files(token, FOLDER_ID)
    print(f"File attualmente presenti nella cartella Drive: {len(existing_files)}")
    
    success_count = 0
    for file_info in all_files:
        filename = os.path.basename(file_info["local_path"])
        existing = existing_files.get(filename)
        result = upload_or_update_file(token, FOLDER_ID, file_info, existing)
        if result:
            success_count += 1
            
    print(f"\nSincronizzazione completata con successo: {success_count}/{len(all_files)} file.")

if __name__ == "__main__":
    main()
