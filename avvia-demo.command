#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR" || exit 1

export PATH="$DIR/.tools/node/bin:$PATH"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "192.168.1.116")

echo "======================================================="
echo "🏋️   AREA46 LANDMINE LAB — DEMO ATTIVA"
echo "======================================================="
echo "💻  Sul tuo Mac:            http://localhost:5173"
echo "📱  Da Smartphone (Wi-Fi):   http://$IP:5173"
echo "======================================================="
echo "Apertura automatica di Google Chrome in corso..."

(sleep 2 && (open -a "Google Chrome" "http://localhost:5173" || open "http://localhost:5173")) &

./node_modules/.bin/vite --port 5173 --host
