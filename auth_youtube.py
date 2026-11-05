import os
import json
from google_auth_oauthlib.flow import InstalledAppFlow

CLIENT_SECRETS_FILE = '/Users/stefy/Desktop/client_secret_927217227663-o8tqho0r7ou9kscvcbp28olsqc7jmlj0.apps.googleusercontent.com.json'
TOKEN_FILE = '/Users/stefy/Desktop/Area46_App/youtube_token.json'

SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
]

def main():
    print("Avvio del flusso di autorizzazione YouTube per il canale...")
    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
    
    # run_local_server aprirà automaticamente il browser su Mac
    print("Apertura della finestra del browser per l'accesso...")
    creds = flow.run_local_server(port=8090, prompt='consent')
    
    # Salva il token definitivo
    with open(TOKEN_FILE, 'w') as f:
        f.write(creds.to_json())
    
    print("SUCCESS: Token salvato con successo in:", TOKEN_FILE)

if __name__ == '__main__':
    main()
