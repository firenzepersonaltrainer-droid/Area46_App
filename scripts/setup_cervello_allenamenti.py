#!/usr/bin/env python3
"""
Inizializza il progetto autonomo 'cervello allenamenti' su Google Drive e localmente.
Cartella Master Drive: 'Area46 - Dati e Backup' (ID: 1leG8ulT21aUP1wQ--qyjxRM0YJ6V0PCO)
Cartella Target: 'cervello allenamenti'
"""

import os
import sys
import json
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

CREDENTIALS_FILE = "/Users/stefy/Desktop/Area46_App/credenziali.json"
MASTER_FOLDER_ID = "1leG8ulT21aUP1wQ--qyjxRM0YJ6V0PCO"
LOCAL_BASE_DIR = "/Users/stefy/Desktop/Area46_App/cervello_allenamenti"

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file"
]

def get_drive_token():
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"ERRORE: Credenziali '{CREDENTIALS_FILE}' non trovate.")
        sys.exit(1)
    creds = service_account.Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    creds.refresh(Request())
    return creds.token

def get_or_create_folder(token, folder_name, parent_id):
    headers = {"Authorization": f"Bearer {token}"}
    q = f"name = '{folder_name}' and '{parent_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    url = f"https://www.googleapis.com/drive/v3/files?q={q}&fields=files(id,name,webViewLink)"
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        files = res.json().get("files", [])
        if files:
            print(f"  [TROVATA CARTELLA] '{folder_name}' (ID: {files[0]['id']})")
            return files[0]
    
    # Crea nuova cartella
    create_url = "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink"
    body = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id]
    }
    create_res = requests.post(create_url, headers=headers, json=body)
    if create_res.status_code in (200, 201):
        folder_data = create_res.json()
        print(f"  [CREATA CARTELLA] '{folder_name}' (ID: {folder_data['id']})")
        return folder_data
    else:
        raise Exception(f"Impossibile creare cartella {folder_name}: {create_res.status_code} {create_res.text}")

def upload_file_to_drive(token, parent_id, filename, content_bytes, mime_type, description=""):
    headers = {"Authorization": f"Bearer {token}"}
    # Check if file exists
    q = f"name = '{filename}' and '{parent_id}' in parents and trashed = false"
    url = f"https://www.googleapis.com/drive/v3/files?q={q}&fields=files(id,name,webViewLink)"
    res = requests.get(url, headers=headers)
    existing_file = None
    if res.status_code == 200:
        files = res.json().get("files", [])
        if files:
            existing_file = files[0]
            
    boundary = "===CERVELLO_BOUNDARY_XYZ==="
    if existing_file:
        file_id = existing_file["id"]
        upload_url = f"https://www.googleapis.com/upload/drive/v3/files/{file_id}?uploadType=multipart&fields=id,name,webViewLink"
        metadata = {"name": filename, "description": description}
        method = "PATCH"
    else:
        upload_url = f"https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink"
        metadata = {"name": filename, "parents": [parent_id], "description": description}
        method = "POST"
        
    metadata_bytes = json.dumps(metadata).encode("utf-8")
    body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
    ).encode("utf-8") + metadata_bytes + (
        f"\r\n--{boundary}\r\n"
        f"Content-Type: {mime_type}\r\n\r\n"
    ).encode("utf-8") + content_bytes + (
        f"\r\n--{boundary}--\r\n"
    ).encode("utf-8")
    
    headers["Content-Type"] = f"multipart/related; boundary={boundary}"
    headers["Content-Length"] = str(len(body))
    
    if method == "PATCH":
        resp = requests.patch(upload_url, headers=headers, data=body)
    else:
        resp = requests.post(upload_url, headers=headers, data=body)
        
    if resp.status_code in (200, 201):
        data = resp.json()
        action = "AGGIORNATO" if existing_file else "CREATO"
        print(f"    [{action}] {filename} -> ID: {data.get('id')} ({data.get('webViewLink')})")
        return data
    else:
        raise Exception(f"Errore upload {filename}: {resp.status_code} - {resp.text}")

print("Script template preparato.")
