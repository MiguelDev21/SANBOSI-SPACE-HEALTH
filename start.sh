#!/usr/bin/env bash
# SANBOSI – arranque de la demo completa (macOS / Linux)
#
#   ./start.sh            estación + 4 relojes simulados, DTN embebido (lo más rápido)
#   ./start.sh --full     además levanta el framework DTN completo (globo 3D, SGP4 con TLE real) y lo usa como enlace
#   ./start.sh --offline  no sale a internet (NASA_MODE=sim)
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
FULL=0
for a in "$@"; do
  case $a in
    --full) FULL=1 ;;
    --offline) export NASA_MODE=sim ;;
  esac
done

PY=${PYTHON:-python3}
if [ ! -d .venv ]; then
  echo "🐍 Creando entorno virtual (.venv)…"
  $PY -m venv .venv
fi
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Si quedó una estación vieja corriendo (por ejemplo de un arranque anterior), se cierra para usar el código nuevo
PORT_=${SANBOSI_PORT:-8700}
OLD=$(lsof -ti tcp:$PORT_ 2>/dev/null || true)
if [ -n "$OLD" ]; then echo "♻️  Cerrando la estación anterior (puerto $PORT_)…"; kill $OLD 2>/dev/null || true; sleep 1; fi
pkill -f "watch/simulator.py" 2>/dev/null || true

PIDS=()
cleanup() { echo; echo "🛑 Apagando…"; for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

if [ "$FULL" = "1" ]; then
  echo "🛰️  Iniciando framework DTN (kritgrover/iss-simulator) en :8000 y su interfaz en :8080…"
  pip install -q -r dtn-framework/backend/requirements-relaxed.txt
  (cd dtn-framework/backend && python main.py > "$ROOT/dtn-backend.log" 2>&1) & PIDS+=($!)
  if command -v npm >/dev/null; then
    [ -d dtn-framework/node_modules ] || (cd dtn-framework && npm install --silent)
    (cd dtn-framework && npm run dev > "$ROOT/dtn-frontend.log" 2>&1) & PIDS+=($!)
  else
    echo "   (npm no encontrado: se omite la interfaz 3D del framework; el backend sí corre)"
  fi
  export DTN_MODE=external
  sleep 4
fi

echo "🩺 Iniciando estación SANBOSI en http://localhost:${SANBOSI_PORT:-8700} …"
python -m station.app & PIDS+=($!)
sleep 3
echo "⌚ Iniciando relojes simulados…"
python watch/simulator.py --station "http://localhost:${SANBOSI_PORT:-8700}" & PIDS+=($!)

cat <<EOF

  ✅ Todo arriba
     Estación (panel IA)   http://localhost:${SANBOSI_PORT:-8700}
     Reloj del astronauta  http://localhost:${SANBOSI_PORT:-8700}/watch
     Consola de Tierra     http://localhost:${SANBOSI_PORT:-8700}/earth
$( [ "$FULL" = "1" ] && echo "     Framework DTN (3D)    http://localhost:8080" )
     IA generativa: instala Ollama y ejecuta 'ollama pull llama3.2:3b' (opcional)
     Ctrl+C para apagar.
EOF
wait
