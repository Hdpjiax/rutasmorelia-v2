#!/usr/bin/env bash
# Estado rápido de Valhalla en WSL (HTTP 200 real)
set -euo pipefail
code="$(curl -s -o /tmp/vh_status.json -w '%{http_code}' --max-time 2 http://127.0.0.1:8002/status 2>/dev/null || echo 000)"
if [ "$code" = "200" ]; then
  cat /tmp/vh_status.json 2>/dev/null || true
  echo
  echo "UP"
  pgrep -af 'valhalla_service .*\.json' || true
  exit 0
fi
echo "DOWN (http=$code)"
pgrep -af 'valhalla_service .*\.json' || echo "(sin proceso)"
exit 1
