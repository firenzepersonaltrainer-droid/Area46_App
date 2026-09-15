#!/bin/bash
# ==============================================================================
# Area46 Landmine Lab — Avvio Demo Locale Sicura ed Isolata
# ==============================================================================
# Questo script avvia il server demo locale sul tuo Mac senza toccare
# in alcun modo l'ambiente e il database di produzione.
# ==============================================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Assicura che Node.js locale sia nel PATH
export PATH="$DIR/.tools/node/bin:$PATH"

echo "======================================================="
echo "🏋️  Area46 — Landmine Lab (Demo Locale)"
echo "🔒  Ambiente isolato: nessun dato viene inviato a Neon"
echo "🌐  Apertura in corso su: http://localhost:5173"
echo "======================================================="

# Apre automaticamente il browser
(sleep 2 && open "http://localhost:5173") &

# Avvia il server Vite con API mock
./node_modules/.bin/vite --port 5173
