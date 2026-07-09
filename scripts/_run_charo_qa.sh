#!/usr/bin/env bash
set -euo pipefail
cd /mnt/d/rutasmorelia
source ~/.venv-gis-wsl/bin/activate
python scripts/_debug_charo_qa.py
ONLY_ROUTES=ruta-charo python scripts/qa_validate_routes.py
python - <<'PY'
import json
from pathlib import Path
qa = json.loads(Path("data/qa-reports/ruta-charo.final_qa.json").read_text(encoding="utf-8"))
print("STATUS", qa["status"])
print("ISSUES", qa["issues"])
print("PUB", (Path("public/routes/ruta-charo.geojson")).exists())
PY
