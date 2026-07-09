#!/usr/bin/env bash
# Descarga OSM de Michoacán (Geofabrik) y reconstruye tiles Valhalla en ~/valhalla-run
set -euo pipefail
cd "$(dirname "$0")/.."

source "$HOME/.venv-gis-wsl/bin/activate"
mkdir -p data/osm

PBF="data/osm/morelia-region.osm.pbf"
OSM_XML="data/osm/morelia-region.osm"

# Bbox ampliado cubriendo todas las rutas rutastransporte (+padding)
BBOX="-101.75,19.30,-100.40,20.10"

if [ -f "$PBF" ] && [ "$(stat -c%s "$PBF" 2>/dev/null || echo 0)" -gt 1000000 ]; then
  echo "Ya existe $PBF ($(du -h "$PBF" | cut -f1))"
else
  rm -f "$PBF" data/osm/michoacan.osm.pbf 2>/dev/null || true
  echo "Descargando OSM Overpass bbox=$BBOX ..."
  wget -O "$OSM_XML" "https://overpass-api.de/api/map?bbox=${BBOX}" \
    || curl -L -o "$OSM_XML" "https://overpass-api.de/api/map?bbox=${BBOX}"
  echo "Convirtiendo a PBF con osmium..."
  osmium cat "$OSM_XML" -o "$PBF"
  rm -f "$OSM_XML"
fi

ln -sf "$(pwd)/$PBF" data/osm/morelia.osm.pbf

RUN_DIR="$HOME/valhalla-run"
mkdir -p "$RUN_DIR/tiles"

echo "Regenerando valhalla.json..."
valhalla_build_config \
  --mjolnir-tile-dir "$RUN_DIR/tiles" \
  --mjolnir-tile-extract "$RUN_DIR/tiles.tar" \
  --mjolnir-timezone "$RUN_DIR/timezone.sqlite" \
  --mjolnir-admin "$RUN_DIR/admin.sqlite" \
  > "$RUN_DIR/valhalla.json"

echo "Construyendo tiles Valhalla (Michoacán completo, puede tardar varios minutos)..."
rm -f "$RUN_DIR/tiles.tar"
valhalla_build_tiles -c "$RUN_DIR/valhalla.json" "$(pwd)/$PBF"
valhalla_build_extract -c "$RUN_DIR/valhalla.json"
valhalla_build_admins -c "$RUN_DIR/valhalla.json" "$(pwd)/$PBF" || true

echo "OSM Michoacán listo. Reinicia Valhalla: bash scripts/start_valhalla_wsl.sh"