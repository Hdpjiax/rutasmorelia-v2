#!/usr/bin/env bash
set -euo pipefail
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential cmake ninja-build git curl wget unzip pkg-config \
  gdal-bin libgdal-dev osmium-tool jq python3 python3-pip python3-venv \
  osrm-backend

python3 -m venv .venv-gis
source .venv-gis/bin/activate
pip install --upgrade pip
pip install geopandas shapely pyproj fiona rasterio opencv-python scikit-image python-dotenv requests rich pandas numpy networkx rtree

echo "Listo. Para Valhalla, clona y compila según VALHALLA_LOCAL.md del proyecto."
