#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source "$HOME/.venv-gis-wsl/bin/activate"
bash scripts/start_valhalla_wsl.sh
for r in ruta-charo ruta-chucandiro ruta-arco-san-pedro ruta-coral-1; do
  echo "=== $r ==="
  ONLY_ROUTES="$r" python scripts/strict_map_match_valhalla_osrm.py
  ONLY_ROUTES="$r" python scripts/qa_validate_routes.py
done