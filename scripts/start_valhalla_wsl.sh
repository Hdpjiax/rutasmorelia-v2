#!/usr/bin/env bash
# Inicia Valhalla en WSL de forma durable (sobrevive al cierre de la sesión wsl -e).
# Tiles en ~/valhalla-run (ext4), no en /mnt/d.
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"
LOG_FILE="$PROJECT_ROOT/log-valhalla.log"

if [ -f "$HOME/.venv-gis-wsl/bin/activate" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.venv-gis-wsl/bin/activate"
fi
ulimit -n 65535 2>/dev/null || true

VALHALLA_BIN=""
for candidate in \
  "$HOME/.venv-gis-wsl/lib/python3.14/site-packages/valhalla/bin/valhalla_service" \
  "$HOME/.venv-gis-wsl/lib/python3.12/site-packages/valhalla/bin/valhalla_service" \
  "$HOME/.venv-gis-wsl/lib/python3.11/site-packages/valhalla/bin/valhalla_service" \
  "$(command -v valhalla_service 2>/dev/null || true)"
do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    VALHALLA_BIN="$candidate"
    break
  fi
done

if [ -z "$VALHALLA_BIN" ]; then
  FOUND="$(find "$HOME/.venv-gis-wsl" -name valhalla_service -type f 2>/dev/null | head -1 || true)"
  if [ -n "$FOUND" ] && [ -x "$FOUND" ]; then
    VALHALLA_BIN="$FOUND"
  fi
fi

if [ -z "$VALHALLA_BIN" ] || [ ! -x "$VALHALLA_BIN" ]; then
  echo "✘ No se encontró valhalla_service. Instala el paquete valhalla en el venv WSL."
  exit 1
fi

RUN_DIR="$HOME/valhalla-run"
OSM_PBF="$PROJECT_ROOT/data/osm/morelia.osm.pbf"

if [ ! -e "$OSM_PBF" ]; then
  echo "Falta $OSM_PBF. Ejecuta: bash scripts/build_wsl_graphs.sh"
  exit 1
fi

mkdir -p "$RUN_DIR/tiles"

if [ ! -f "$RUN_DIR/valhalla.json" ]; then
  valhalla_build_config \
    --mjolnir-tile-dir "$RUN_DIR/tiles" \
    --mjolnir-tile-extract "$RUN_DIR/tiles.tar" \
    --mjolnir-timezone "$RUN_DIR/timezone.sqlite" \
    --mjolnir-admin "$RUN_DIR/admin.sqlite" \
    > "$RUN_DIR/valhalla.json"
fi

# Escuchar en todas las interfaces (Windows → localhost/IP WSL)
if grep -q '"listen"' "$RUN_DIR/valhalla.json"; then
  sed -i 's|"listen"[[:space:]]*:[[:space:]]*"[^"]*"|"listen": "tcp://*:8002"|g' "$RUN_DIR/valhalla.json" || true
fi

if [ ! -f "$RUN_DIR/tiles.tar" ]; then
  echo "Construyendo tiles Valhalla en $RUN_DIR (primera vez)..."
  valhalla_build_tiles -c "$RUN_DIR/valhalla.json" "$OSM_PBF"
  valhalla_build_extract -c "$RUN_DIR/valhalla.json"
fi

if [ ! -f "$RUN_DIR/admin.sqlite" ]; then
  valhalla_build_admins -c "$RUN_DIR/valhalla.json" "$OSM_PBF" || true
fi

# /status con HTTP 200 real (503 "shutting down" no cuenta)
is_up() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8002/status 2>/dev/null || echo 000)"
  [ "$code" = "200" ]
}

list_pids() {
  # Solo el binario de servicio, no este script
  pgrep -f 'valhalla_service .*\.json' 2>/dev/null || true
}

force_stop() {
  local pids
  pids="$(list_pids)"
  if [ -z "$pids" ]; then
    return 0
  fi
  echo "Deteniendo Valhalla (pids: $(echo "$pids" | tr '\n' ' '))..."
  # shellcheck disable=SC2086
  kill -TERM $pids 2>/dev/null || true
  sleep 2
  pids="$(list_pids)"
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill -KILL $pids 2>/dev/null || true
    sleep 1
  fi
}

if is_up; then
  echo "✔ Valhalla ya estaba arriba en http://127.0.0.1:8002 (sin reinicio)"
  list_pids || true
  exit 0
fi

# Si hay proceso zombi / shutting down / puerto ocupado → limpiar
if [ -n "$(list_pids)" ] || ss -lntp 2>/dev/null | grep -q ':8002'; then
  force_stop
fi

# Esperar puerto libre (máx ~10s)
for _ in $(seq 1 10); do
  if ! ss -lntp 2>/dev/null | grep -q ':8002'; then
    break
  fi
  sleep 1
done

echo "Iniciando Valhalla (bin=$VALHALLA_BIN, conf=$RUN_DIR/valhalla.json, concurrency=2)..."
echo "Log: $LOG_FILE"
{
  echo "===== $(date -Iseconds) start valhalla ====="
} >> "$LOG_FILE"

# setsid + nohup: no muere al cerrar `wsl -e bash ...` desde Windows/Node
setsid nohup "$VALHALLA_BIN" "$RUN_DIR/valhalla.json" 2 \
  >> "$LOG_FILE" 2>&1 < /dev/null &
VPID=$!
disown "$VPID" 2>/dev/null || true

echo "PID lanzado: $VPID"

for i in $(seq 1 90); do
  if is_up; then
    echo "✔ Valhalla listo en http://127.0.0.1:8002 (${i}s, launch_pid=$VPID)"
    list_pids || true
    exit 0
  fi

  # Si el padre salió, ver si quedó algún worker sano
  if ! kill -0 "$VPID" 2>/dev/null; then
    live="$(list_pids)"
    if [ -n "$live" ]; then
      sleep 1
      if is_up; then
        echo "✔ Valhalla listo (workers activos, ${i}s)"
        exit 0
      fi
    else
      echo "✘ Valhalla murió al arrancar. Últimas líneas del log:"
      tail -40 "$LOG_FILE" || true
      exit 1
    fi
  fi
  sleep 1
done

echo "✘ Timeout esperando Valhalla. Log:"
tail -40 "$LOG_FILE" || true
exit 1
