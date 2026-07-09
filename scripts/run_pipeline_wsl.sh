#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

bash scripts/start_valhalla_wsl.sh

source "$HOME/.venv-gis-wsl/bin/activate"
python scripts/strict_map_match_valhalla_osrm.py
python scripts/qa_validate_routes.py

pkill -x valhalla_service 2>/dev/null || true
