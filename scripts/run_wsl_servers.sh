#!/usr/bin/env bash
# Script para iniciar los servidores locales de ruteo en WSL
# Debe ejecutarse dentro de WSL: bash scripts/run_wsl_servers.sh

set -euo pipefail

cd "$(dirname "$0")/.."

OSRM_DATA="data/osm/morelia.osrm"

echo "=== 1. Iniciando Valhalla ==="
bash scripts/start_valhalla_wsl.sh

OSRM_INSTALLED=false
if command -v osrm-routed &> /dev/null && [ -f "$OSRM_DATA" ]; then
  OSRM_INSTALLED=true
  echo "=== 2. Iniciando OSRM en puerto 5000 ==="
  pkill -x osrm-routed 2>/dev/null || true
  osrm-routed --algorithm mld "$OSRM_DATA" > log-osrm.log 2>&1 &
  echo "OSRM iniciado con PID: $!"
else
  echo "=== 2. OSRM no disponible. Solo Valhalla. ==="
fi

echo ""
echo "Valhalla: http://127.0.0.1:8002"
echo "Logs: tail -f log-valhalla.log"
echo "Detener: pkill -x valhalla_service"
