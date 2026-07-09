#!/usr/bin/env bash
# Script de configuración GIS para WSL Ubuntu
# Debe ejecutarse dentro de WSL: bash scripts/setup_gis_wsl.sh

set -euo pipefail

echo "=== 1. Actualizando paquetes del sistema ==="
sudo apt-get update

echo "=== 2. Instalando dependencias del sistema y de compilación ==="
sudo apt-get install -y \
  build-essential \
  cmake \
  ninja-build \
  git \
  curl \
  wget \
  unzip \
  pkg-config \
  gdal-bin \
  libgdal-dev \
  osmium-tool \
  jq \
  sqlite3 \
  libsqlite3-dev \
  libspatialite-dev \
  libgeos-dev \
  libprotobuf-dev \
  protobuf-compiler \
  libboost-all-dev \
  libcurl4-openssl-dev \
  liblz4-dev \
  zlib1g-dev \
  python3-venv \
  python3-dev \
  libbz2-dev \
  libxml2-dev \
  libzip-dev \
  lua5.2 \
  liblua5.2-dev \
  libluabind-dev \
  libtbb-dev \
  libosmpbf-dev

# OSRM backend se omite por incompatibilidades del compilador con GCC 14/15 y Boost 1.90 en Ubuntu 26.04.
# Se utiliza Valhalla local como motor principal de ruteo y map-matching.

echo "=== 3. Creando entorno virtual Python 3 ==="
# Eliminar entorno anterior si existe para evitar conflictos
if [ -d "$HOME/.venv-gis-wsl" ]; then
  echo "Eliminando entorno ~/.venv-gis-wsl existente..."
  rm -rf "$HOME/.venv-gis-wsl"
fi

python3 -m venv "$HOME/.venv-gis-wsl"

echo "=== 4. Instalando dependencias de Python y PyValhalla ==="
source "$HOME/.venv-gis-wsl/bin/activate"
pip install --upgrade pip
pip install \
  python-dotenv \
  requests \
  rich \
  pandas \
  numpy \
  networkx \
  rtree \
  shapely \
  pyproj \
  fiona \
  rasterio \
  geopandas \
  opencv-python \
  scikit-image \
  pyvalhalla

echo "=== 5. Creando directorios de datos ==="
mkdir -p data/osm
mkdir -p data/valhalla/tiles
mkdir -p data/valhalla/build
mkdir -p data/osrm

echo "========================================="
echo "Configuración inicial de WSL completada con éxito!"
echo "Siguiente paso: Ejecutar scripts/build_wsl_graphs.sh para generar los mapas y grafos."
echo "========================================="
