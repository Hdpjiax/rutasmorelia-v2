#!/bin/bash
set -e

# Go to the routes directory relative to the script location
cd "$(dirname "$0")/../public/routes"

echo "Compiling GeoJSON routes directly into PMTiles..."
# -zg: automatically choose maximum zoom
# -o rutas.pmtiles: output file
# --projection=EPSG:3857: standard web mercator projection
# --force: overwrite existing output file
# --drop-rate=0: preserve all features without thinning
# *.geojson: compile all geojson files in the folder
tippecanoe -zg -o rutas.pmtiles -l rutas --projection=EPSG:3857 --force --drop-rate=0 *.geojson

echo "PMTiles built successfully at public/routes/rutas.pmtiles"
