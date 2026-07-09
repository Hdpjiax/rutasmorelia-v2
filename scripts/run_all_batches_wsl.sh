#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
TOTAL_BATCHES="${1:-11}"
BATCH_SIZE="${2:-10}"
for i in $(seq 0 $((TOTAL_BATCHES - 1))); do
  echo "======== BATCH $i / $((TOTAL_BATCHES - 1)) ========"
  bash scripts/run_batch_pipeline_wsl.sh "$i" "$BATCH_SIZE" || echo "[warn] batch $i con errores"
done
echo "Todos los lotes finalizados."