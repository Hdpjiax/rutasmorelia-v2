#!/usr/bin/env bash
# Reprocesa las 27 rutas rechazadas / needs_review
set -euo pipefail
cd "$(dirname "$0")/.."
source "$HOME/.venv-gis-wsl/bin/activate"

PENDING=(
  ruta-arco-san-pedro
  ruta-arroyo-colorado
  ruta-atecuaro
  ruta-campestre-mision-del-valle
  ruta-campestre-posta-trebol-monarca
  ruta-canteras-bachilleres
  ruta-capula
  ruta-charo-san-antonio-corrales
  ruta-charo
  ruta-chihuerio
  ruta-chucandiro
  ruta-ciudad-de-hidalgo
  ruta-coeneo
  ruta-cointzio
  ruta-coral-1
  ruta-el-pedregal
  ruta-gris-1-circuito
  ruta-gris-4
  ruta-morada-2a
  ruta-naranja-2-santa-fe
  ruta-naranja-3-centro-puerta-del-sol
  ruta-naranja-3-santa-maria-erandeni
  ruta-naranja-3-santa-maria-ita
  ruta-naranja-3-trico-metropolis
  ruta-paloma-azul-arquito
  ruta-por-torreon-nuevo
  ruta-roja-4-tinijaro
)

if [ ! -f data/osm/morelia-region.osm.pbf ]; then
  bash scripts/expand_osm_michoacan_wsl.sh
fi
bash scripts/start_valhalla_wsl.sh

for rid in "${PENDING[@]}"; do
  echo "======== $rid ========"
  python scripts/import_rutastransporte_routes.py "$rid" || true
  ONLY_ROUTES="$rid" python scripts/strict_map_match_valhalla_osrm.py
  ONLY_ROUTES="$rid" python scripts/qa_validate_routes.py
done

python scripts/qa_validate_routes.py
pkill -x valhalla_service 2>/dev/null || true

python scripts/analyze_failed_routes.py | head -80
echo "Fix pending completado."