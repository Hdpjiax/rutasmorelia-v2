#!/usr/bin/env bash
# Reintenta import + match + QA para rutas que fallaron en el barrido inicial.
set -euo pipefail
cd "$(dirname "$0")/.."
source "$HOME/.venv-gis-wsl/bin/activate"

RETRY_IDS=(
  ruta-isste-soledad
  ruta-jesus-del-monte
  ruta-naranja-1-issste
  ruta-naranja-1-la-soledad
  ruta-naranja-2-3-de-agosto
  ruta-naranja-2-santa-fe
  ruta-naranja-3-centro-puerta-del-sol
  ruta-naranja-3-santa-maria-erandeni
  ruta-naranja-3-santa-maria-ita
  ruta-naranja-3-trico-metropolis
  ruta-ruta-2
  ruta-el-pedregal
  ruta-gris-4
  ruta-morada-2a
  ruta-paloma-azul-arquito
  ruta-roja-4-tinijaro
  ruta-coral-1
  ruta-gris-1-circuito
)

bash scripts/start_valhalla_wsl.sh

for rid in "${RETRY_IDS[@]}"; do
  echo "=== retry $rid ==="
  if python scripts/import_rutastransporte_routes.py "$rid"; then
    ONLY_ROUTES="$rid" python scripts/strict_map_match_valhalla_osrm.py
    ONLY_ROUTES="$rid" python scripts/qa_validate_routes.py
  fi
done

python scripts/qa_validate_routes.py
pkill -x valhalla_service 2>/dev/null || true
echo "Reintentos completados."