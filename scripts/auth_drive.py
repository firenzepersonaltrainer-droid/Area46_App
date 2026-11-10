#!/usr/bin/env python3
"""
Autenticazione OAuth2 utente per Google Drive (firenzepersonaltrainer@gmail.com).
Usa il client_secret presente sul Desktop per ottenere il token utente con quota completa,
salvandolo in 'drive_user_token.json'.
"""

import os
from google_auth_oauthlib.flow import InstalledAppFlow

CLIENT_SECRETS_FILE = '/Users/stefy/Desktop/client_secret_927217227663-o8tqho0r7ou9kscvcbp28olsqc7jmlj0.apps.googleusercontent.com.json'
TOKEN_FILE = '/Users/stefy/Desktop/Area46_App/drive_user_token.json'

SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file'
]

def main():
    print("=" * 70)
    print("AUTORIZZAZIONE GOOGLE DRIVE PER FIRENZEPERSONALTRAINER@GMAIL.COM")
    print("=" * 70)
    print("Apertura finestra browser per concedere l'accesso a Drive...")
    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
    creds = flow.run_local_server(port=8091, prompt='consent')
    
    with open(TOKEN_FILE, 'w', encoding='utf-8') as f:
        f.write(creds.to_json())
        
    print(f"\n[SUCCESSO] Token utente salvato in: {TOKEN_FILE}")
    print("Ora il sistema può creare ed editare qualsiasi file su Drive con quota utente illimitata!")

if __name__ == '__main__':
    main()
