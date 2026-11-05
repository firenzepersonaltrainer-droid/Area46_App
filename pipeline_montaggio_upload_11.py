import os
import json
import asyncio
import requests
import av
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
import edge_tts

# 11 Clip Mute identificate nei Lotti 2 e 3
MUTE_CLIPS = [
    {
        "yt_id": "xpdmnY_MB6w",
        "nome": "High Hand Switch",
        "script": "Nel metodo Landmine Lab, l'High Hand Switch allena la coordinazione aerea e la reattività della presa. Effettua lo scambio delle mani all'apice della spinta, mantenendo il core compatto e la traiettoria del bilanciere fluida."
    },
    {
        "yt_id": "HWcYpmL1Q9o",
        "nome": "Split C&J Touch & Go",
        "script": "Nel metodo Landmine Lab, lo Split Clean and Jerk Touch and Go sviluppa potenza ciclica e resistenza anaerobica. Inverti il movimento senza pause a terra, sfruttando il ciclo allungamento-accorciamento ad ogni ripetizione."
    },
    {
        "yt_id": "qvoz4TITY7s",
        "nome": "Landmine Press Cross Step",
        "script": "Nel metodo Landmine Lab, il Press con Cross Step combina spinta monobraccio e coordinazione crociata degli arti inferiori. Sposta il piede in incrocio simultaneamente all'estensione del braccio guida."
    },
    {
        "yt_id": "K7mbQ__p5pE",
        "nome": "Split Clean and Jerk",
        "script": "Nel metodo Landmine Lab, lo Split Clean and Jerk è la massima espressione di tripla estensione e incastro. Coordina la tirata dal pavimento alla spalla con l'apertura immediata in posizione di split."
    },
    {
        "yt_id": "uLuFsjb8Ako",
        "nome": "Landmine Clean and Jerk NO DOWN",
        "script": "Nel metodo Landmine Lab, la variante Clean and Jerk No Down enfatizza la cadenza e l'accumulo di tensione continua. Mantieni il carico tra la spalla e il lockout senza riportare il bilanciere a terra."
    },
    {
        "yt_id": "Fsi34_9SXTU",
        "nome": "High Pull",
        "script": "Nel metodo Landmine Lab, l'High Pull sviluppa l'esplosività dell'anca e della catena posteriore. Spingi forte dal pavimento e accelera il bilanciere verso l'alto tenendo il gomito alto e all'esterno."
    },
    {
        "yt_id": "_Dqau_BcAls",
        "nome": "High Pull Step Press",
        "script": "Nel metodo Landmine Lab, l'High Pull Step Press collega la tirata dinamica alla spinta in avanzamento. Trasferisci l'inerzia della salita del bilanciere direttamente nel passo e nella distensione sopra la testa."
    },
    {
        "yt_id": "y-Y_KnO0tY8",
        "nome": "Landmine Press Side Step",
        "script": "Nel metodo Landmine Lab, il Press con Side Step allena la gestione del carico su piano frontale. Esegui il passo laterale assorbendo il baricentro ed estendi il braccio mantenendo il bacino stabile."
    },
    {
        "yt_id": "Y-2AeFnKQLY",
        "nome": "Kneeling Transition Over Head Press",
        "script": "Nel metodo Landmine Lab, la transizione in ginocchio con overhead press richiede massimo controllo dell'antiestensione lombare. Passa dalla posizione eretta a terra senza disperdere la spinta del core."
    },
    {
        "yt_id": "q9I2aChhPI8",
        "nome": "Avenger Blade Passing",
        "script": "Nel metodo Landmine Lab, l'Avenger Blade Passing sviluppa destrezza e ritmo nei cambi di direzione. Fai scivolare il bilanciere lungo la traiettoria di guardia senza interrompere la tensione delle gambe."
    },
    {
        "yt_id": "pjwXBZ-vwD8",
        "nome": "Landmine Quick Hops",
        "script": "Nel metodo Landmine Lab, i Quick Hops allenano la stiffness della caviglia e la reattività dei piedi. Esegui rimbalzi rapidi ed elastici mantenendo il bilanciere come guida di stabilità."
    }
]

TOKEN_FILE = '/Users/stefy/Desktop/Area46_App/youtube_token.json'
VAULT_PATH = '/Users/stefy/Desktop/Area46_App/data/vault/4_metodologia_esercizi.json'
OUT_DIR = '/Users/stefy/.gemini/antigravity/brain/5a54238d-964d-484a-98ed-1f62a7d513ed/video_rigenerati'
os.makedirs(OUT_DIR, exist_ok=True)

async def generate_voice(text, out_mp3):
    comm = edge_tts.Communicate(text, 'it-IT-DiegoNeural', pitch='-6Hz', rate='-3%')
    await comm.save(out_mp3)

def render_video_916(in_mp4, audio_mp3, title_text, out_mp4):
    target_w, target_h = 720, 1280
    fps = 30
    
    audio_c = av.open(audio_mp3)
    audio_stream = audio_c.streams.audio[0]
    audio_dur = float(audio_stream.duration * audio_stream.time_base)
    
    video_c = av.open(in_mp4)
    v_in = video_c.streams.video[0]
    in_frames = [f.to_image() for f in video_c.decode(v_in)]
    
    # Crop athlete center
    crops = [f.crop((215, 0, 425, 360)) for f in in_frames]
    new_h = 920
    new_w = int(crops[0].width * (new_h / crops[0].height))
    paste_x = (target_w - new_w) // 2
    paste_y = 150
    
    font_sm = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
    font_lg = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)
    
    out_c = av.open(out_mp4, mode='w')
    out_v = out_c.add_stream('libx264', rate=fps)
    out_v.width, out_v.height = target_w, target_h
    out_v.pix_fmt = 'yuv420p'
    out_v.options = {'crf': '22', 'preset': 'veryfast'}
    out_a = out_c.add_stream('aac', rate=audio_stream.sample_rate)
    
    total_frames = int(audio_dur * fps)
    num_in = len(crops)
    for i in range(total_frames):
        c_img = crops[i % num_in]
        f_img = in_frames[i % num_in]
        
        canvas = Image.new('RGB', (target_w, target_h), (10, 10, 14))
        bg = f_img.resize((target_w, int(target_w * 360 / 640))).filter(ImageFilter.GaussianBlur(radius=25))
        canvas.paste(bg, (0, (target_h - bg.height) // 2))
        overlay = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 175))
        canvas.paste(overlay, (0, 0), overlay)
        
        scaled = c_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        canvas.paste(scaled, (paste_x, paste_y))
        
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([paste_x-3, paste_y-3, paste_x+new_w+3, paste_y+new_h+3], outline=(227, 255, 0), width=4)
        draw.rectangle([0, 0, target_w, 130], fill=(16, 16, 22))
        draw.line([0, 130, target_w, 130], fill=(227, 255, 0), width=4)
        draw.rectangle([30, 22, 205, 52], fill=(227, 255, 0))
        draw.text((38, 26), 'LANDMINE LAB', fill=(0, 0, 0), font=font_sm)
        draw.text((30, 68), title_text.upper()[:36], fill=(255, 255, 255), font=font_lg)
        
        f_av = av.VideoFrame.from_image(canvas)
        for p in out_v.encode(f_av):
            out_c.mux(p)
            
    for p in out_v.encode():
        out_c.mux(p)
        
    for f in audio_c.decode(audio_stream):
        f.pts = None
        for p in out_a.encode(f):
            out_c.mux(p)
    for p in out_a.encode():
        out_c.mux(p)
    out_c.close()

def upload_to_youtube(video_path, title, desc):
    with open(TOKEN_FILE) as f:
        token_data = json.load(f)
    creds = Credentials.from_authorized_user_info(token_data)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, 'w') as f_tok:
            f_tok.write(creds.to_json())
            
    file_size = os.path.getsize(video_path)
    headers = {
        'Authorization': f'Bearer {creds.token}',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': str(file_size),
        'X-Upload-Content-Type': 'video/mp4'
    }
    metadata = {
        'snippet': {
            'title': f'{title} — Landmine Lab Demo',
            'description': f'{desc}\n\nDemo didattica del metodo Landmine Lab. Voce coach: Diego (AI). Riservato agli allievi.',
            'tags': ['Landmine Lab', title, 'Personal Trainer', 'Biomeccanica'],
            'categoryId': '17'
        },
        'status': {
            'privacyStatus': 'unlisted',
            'selfDeclaredMadeForKids': False
        }
    }
    res = requests.post(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        headers=headers,
        json=metadata
    )
    if res.status_code == 200:
        up_url = res.headers.get('Location')
        with open(video_path, 'rb') as f:
            v_bytes = f.read()
        up_headers = {
            'Authorization': f'Bearer {creds.token}',
            'Content-Type': 'video/mp4',
            'Content-Length': str(file_size)
        }
        up_res = requests.put(up_url, headers=up_headers, data=v_bytes)
        if up_res.status_code in (200, 201):
            return up_res.json()['id']
    print(f'Errore upload {title}:', res.status_code, res.text)
    return None

async def process_all():
    print(f'=== INIZIO PIPELINE 11 CLIP MUTE ===')
    with open(VAULT_PATH) as f:
        vault_data = json.load(f)
        
    for i, item in enumerate(MUTE_CLIPS, 1):
        orig_id = item['yt_id']
        nome = item['nome']
        print(f'\n--- [{i}/11] Elaborazione: {nome} ({orig_id}) ---')
        
        # 1. Download original video if needed
        raw_mp4 = f'/tmp/raw_{orig_id}.mp4'
        if not os.path.exists(raw_mp4):
            cmd = ['/Users/stefy/Library/Python/3.9/bin/yt-dlp', '--extractor-args', 'youtube:player_client=android,ios', '-f', '18/b', '-o', raw_mp4, f'https://youtu.be/{orig_id}']
            os.system(' '.join(cmd) + ' >/dev/null 2>&1')
            
        # 2. TTS Voice
        voice_mp3 = f'{OUT_DIR}/{orig_id}_voice.mp3'
        print('  Generazione voce Diego...')
        await generate_voice(item['script'], voice_mp3)
        
        # 3. Render 9:16 video
        out_mp4 = f'{OUT_DIR}/{orig_id}_916.mp4'
        print('  Montaggio video 9:16...')
        render_video_916(raw_mp4, voice_mp3, nome, out_mp4)
        
        # 4. Upload to YouTube Unlisted
        print('  Caricamento su YouTube (Non in Elenco)...')
        new_yt_id = upload_to_youtube(out_mp4, nome, item['script'])
        if new_yt_id:
            new_url = f'https://youtu.be/{new_yt_id}'
            print(f'  SUCCESS! Nuovo URL YouTube: {new_url}')
            
            # 5. Update Area 46 vault
            for ex in vault_data['database_esercizi']:
                if orig_id in ex.get('link_video', '') or ex.get('nome_reale', '').lower() == nome.lower():
                    ex['link_video'] = new_url
                    nome_agg = ex.get('nome_reale')
                    print(f'  Ponte Area 46 aggiornato per: {nome_agg}')
            with open(VAULT_PATH, 'w', encoding='utf-8') as f_v:
                json.dump(vault_data, f_v, ensure_ascii=False, indent=2)
        else:
            print(f'  Upload fallito per {nome}.')
            
    print('\n=== TUTTE LE 11 CLIP MUTE ELABORATE E CARICATE! ===')

asyncio.run(process_all())
