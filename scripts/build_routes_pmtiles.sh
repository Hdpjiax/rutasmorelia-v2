#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# SOLO LOCAL / WSL — NO se ejecuta en Vercel ni en producción.
# tippecanoe no forma parte del deploy; genera un artefacto estático opcional.
#
# Compila public/routes/*.geojson → public/tiles/routes.pmtiles
# Luego, si quieres probar la capa vectorial en local:
#   NEXT_PUBLIC_ROUTES_PMTILES_URL=/tiles/routes.pmtiles
#
# En producción sin esa env var, la app ignora PMTiles (GeoJSON + IndexedDB).
# ═══════════════════════════════════════════════════════════════════════════
#
# Uso (WSL/Linux/macOS con tippecanoe instalado en la máquina de desarrollo):
#   bash scripts/build_routes_pmtiles.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROUTES_DIR="$ROOT/public/routes"
OUT_DIR="$ROOT/public/tiles"
TMP="$ROOT/data/processed/routes-all-for-tiles.geojson"
mkdir -p "$OUT_DIR" "$(dirname "$TMP")"

echo "[pmtiles] Uniendo GeoJSON de $ROUTES_DIR …"
node "$ROOT/scripts/merge_routes_geojson_for_tiles.mjs" "$ROUTES_DIR" "$TMP"

if command -v tippecanoe >/dev/null 2>&1; then
  echo "[pmtiles] tippecanoe → routes.pmtiles"
  tippecanoe \
    -o "$OUT_DIR/routes.pmtiles" \
    -Z10 -z16 \
    --drop-densest-as-needed \
    --extend-zooms-if-still-dropping \
    --force \
    -l routes \
    -n "ViaMorelia routes" \
    "$TMP"
  echo "[pmtiles] OK → $OUT_DIR/routes.pmtiles"
  ls -lh "$OUT_DIR/routes.pmtiles"
  echo "Define NEXT_PUBLIC_ROUTES_PMTILES_URL=/tiles/routes.pmtiles"
else
  echo "[pmtiles] tippecanoe no instalado. GeoJSON unificado en:"
  echo "  $TMP"
  echo "Instala tippecanoe (https://github.com/felt/tippecanoe) y re-ejecuta."
  exit 1
fi
