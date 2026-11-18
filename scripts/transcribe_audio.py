#!/usr/bin/env python3
import sys
import json
import os

def transcribe(audio_path):
    if not os.path.exists(audio_path):
        return {"error": "File not found", "text": ""}
    
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("tiny", device="cpu", compute_type="int8")
        segments, info = model.transcribe(audio_path, language="it")
        text = " ".join([seg.text.strip() for seg in segments if seg.text]).strip()
        return {
            "ok": True,
            "text": text,
            "language": info.language,
            "probability": info.language_probability
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "text": ""}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided", "text": ""}))
        sys.exit(1)
    
    res = transcribe(sys.argv[1])
    print(json.dumps(res, ensure_ascii=False))
