#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source "$HOME/.venv-gis-wsl/bin/activate"
bash scripts/start_valhalla_wsl.sh
for r in ruta-naranja-2-santa-fe ruta-coral-1 ruta-arco-san-pedro ruta-atecuaro; do
  python scripts/test_route_match.py "$r"
done