#!/usr/bin/env bash
# Doble clic en macOS: instala lo necesario (la primera vez), arranca todo y abre el panel, el reloj y la consola de Tierra.
cd "$(dirname "$0")"
chmod +x start.sh
( sleep 9; open "http://localhost:8700/"; sleep 1; open "http://localhost:8700/watch"; open "http://localhost:8700/earth" ) &
./start.sh "$@"
