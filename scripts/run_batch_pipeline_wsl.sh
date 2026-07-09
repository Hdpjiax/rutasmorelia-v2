#!/usr/bin/env bash
# Procesa rutas en lotes: import + map-match + QA
# Uso: bash scripts/run_batch_pipeline_wsl.sh <batch_index> [batch_size]
# Ejemplo lote 0 (rutas 1-10): bash scripts/run_batch_pipeline_wsl.sh 0 10
set -euo pipefail

cd "$(dirname "$0")/.."

BATCH_INDEX="${1:-0}"
BATCH_SIZE="${2:-10}"
MAP_FILE="data/rutastransporte-route-map.json"
LOG_DIR="data/qa-reports/batches"
mkdir -p "$LOG_DIR"

if [ ! -f "$MAP_FILE" ]; then
  echo "Generando mapa de rutas..."
  python scripts/build_rutastransporte_route_map.py
fi

source "$HOME/.venv-gis-wsl/bin/activate"

ROUTE_IDS=$(BATCH_INDEX="$BATCH_INDEX" BATCH_SIZE="$BATCH_SIZE" python - <<'PY'
import json, os
from pathlib import Path
batch_index = int(os.environ["BATCH_INDEX"])
batch_size = int(os.environ["BATCH_SIZE"])
entries = json.loads(Path("data/rutastransporte-route-map.json").read_text(encoding="utf-8"))
start = batch_index * batch_size
chunk = entries[start:start + batch_size]
print(" ".join(e["routeId"] for e in chunk))
PY
)

if [ -z "$ROUTE_IDS" ]; then
  echo "Lote $BATCH_INDEX vacío (sin rutas)."
  exit 0
fi

echo "=== Lote $BATCH_INDEX (size=$BATCH_SIZE) ==="
echo "Rutas: $ROUTE_IDS"

bash scripts/start_valhalla_wsl.sh

LOG_FILE="$LOG_DIR/batch-${BATCH_INDEX}.log"
{
  echo "[batch $BATCH_INDEX] $(date -Iseconds)"
  FAILED=0
  for rid in $ROUTE_IDS; do
    echo "--- import $rid ---"
    if ! python scripts/import_rutastransporte_routes.py "$rid"; then
      echo "[fail] import $rid"
      FAILED=$((FAILED + 1))
      continue
    fi
    echo "--- match $rid ---"
    ONLY_ROUTES="$rid" python scripts/strict_map_match_valhalla_osrm.py
    echo "--- qa $rid ---"
    ONLY_ROUTES="$rid" python scripts/qa_validate_routes.py
  done
  echo "[batch $BATCH_INDEX] fallos import=$FAILED"
} 2>&1 | tee "$LOG_FILE"

python scripts/qa_validate_routes.py

pkill -x valhalla_service 2>/dev/null || true
echo "Lote $BATCH_INDEX completado. Log: $LOG_FILE"