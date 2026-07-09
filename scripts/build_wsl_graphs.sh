#!/usr/bin/env bash
# Script para descargar datos OSM y construir grafos de ruteo
# Debe ejecutarse dentro de WSL: bash scripts/build_wsl_graphs.sh

set -euo pipefail

# Asegurar directorios
mkdir -p data/osm
mkdir -p data/valhalla/tiles
mkdir -p data/valhalla/build
mkdir -p data/osrm

echo "=== 1. Descargando datos OSM de Morelia ==="
# Bounding box para Morelia (-101.35,19.55,-101.05,19.85)
BBOX="-101.35,19.55,-101.05,19.85"
OSM_FILE="data/osm/morelia.osm"
OSM_PBF="data/osm/morelia.osm.pbf"

if [ -f "$OSM_PBF" ]; then
  echo "Archivo OSM PBF ya existe: $OSM_PBF. Omitiendo descarga."
else
  echo "Descargando XML de Overpass para bbox $BBOX..."
  wget -O "$OSM_FILE" "https://overpass-api.de/api/map?bbox=$BBOX" || curl -o "$OSM_FILE" "https://overpass-api.de/api/map?bbox=$BBOX"
  
  echo "Convirtiendo XML a PBF con osmium..."
  osmium cat "$OSM_FILE" -o "$OSM_PBF"
  
  echo "Limpiando archivo XML temporal..."
  rm -f "$OSM_FILE"
fi

echo "=== 2. Construyendo grafo de Valhalla ==="
# Activar el entorno virtual de WSL para usar las herramientas de pyvalhalla
source "$HOME/.venv-gis-wsl/bin/activate"

# Generar archivo de configuración
echo "Generando valhalla.json..."
valhalla_build_config \
  --mjolnir-tile-dir "$(pwd)/data/valhalla/tiles" \
  --mjolnir-tile-extract "$(pwd)/data/valhalla/tiles.tar" \
  --mjolnir-timezone "$(pwd)/data/valhalla/timezone.sqlite" \
  --mjolnir-admin "$(pwd)/data/valhalla/admin.sqlite" \
  > "$(pwd)/data/valhalla/valhalla.json"

# Construir los tiles
echo "Construyendo tiles de Valhalla a partir de $OSM_PBF..."
valhalla_build_tiles -c "$(pwd)/data/valhalla/valhalla.json" "$OSM_PBF"

echo "Empaquetando tiles de Valhalla en tiles.tar..."
valhalla_build_extract -c "$(pwd)/data/valhalla/valhalla.json"

if command -v osrm-extract &> /dev/null; then
  echo "=== 3. Construyendo grafo de OSRM ==="
  # Localizar perfil car.lua
  PROFILE_PATH="/usr/share/osrm/profiles/car.lua"
  if [ ! -f "$PROFILE_PATH" ]; then
    PROFILE_PATH="/usr/local/share/osrm/profiles/car.lua"
  fi

  # Fallback por si no se encuentra en el sistema
  if [ ! -f "$PROFILE_PATH" ]; then
    echo "car.lua no encontrado en las rutas del sistema. Descargando perfil por defecto de OSRM..."
    mkdir -p data/osrm/profiles
    wget -O data/osrm/profiles/car.lua https://raw.githubusercontent.com/Project-OSRM/osrm-backend/master/profiles/car.lua
    wget -O data/osrm/profiles/lib.lua https://raw.githubusercontent.com/Project-OSRM/osrm-backend/master/profiles/lib/lib.lua
    # Modificar car.lua para cargar lib.lua localmente
    sed -i 's|require("lib/|require("./data/osrm/profiles/|g' data/osrm/profiles/car.lua
    PROFILE_PATH="data/osrm/profiles/car.lua"
  fi

  echo "Usando perfil OSRM: $PROFILE_PATH"

  # Ejecutar pipeline de OSRM
  echo "Ejecutando osrm-extract..."
  osrm-extract -p "$PROFILE_PATH" "$OSM_PBF"

  echo "Ejecutando osrm-partition..."
  osrm-partition data/osm/morelia.osrm

  echo "Ejecutando osrm-customize..."
  osrm-customize data/osm/morelia.osrm
else
  echo "=== 3. OSRM no está instalado. Omitiendo la construcción de grafos de OSRM. ==="
fi

echo "========================================="
echo "Construcción de grafos completada!"
echo "Siguiente paso: Iniciar servidores con scripts/run_wsl_servers.sh"
echo "========================================="
