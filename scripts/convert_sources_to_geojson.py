"""
Convierte fuentes KML/KMZ/GPKG/SHP/GeoJSON/PDF/PNG desde RAW_INPUT_DIR a GeoJSON normalizado.
PDF/PNG no georreferenciados NO se convierten automáticamente a coordenadas confiables: primero requieren GCPs en QGIS o archivo .points/.wld.
"""
from __future__ import annotations
import os, subprocess, sys, json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(".env-valhalla")

# Translate Windows paths to WSL paths if running under WSL/Linux
if os.name != 'nt':
    for key, val in list(os.environ.items()):
        if val.startswith("d:/") or val.startswith("D:/"):
            os.environ[key] = val.replace("d:/", "/mnt/d/").replace("D:/", "/mnt/d/")

RAW = Path(os.getenv("RAW_INPUT_DIR", "data/raw-routes"))
OUT = Path(os.getenv("PROCESSED_DIR", "data/processed")) / "geojson"
TARGET_CRS = os.getenv("TARGET_CRS", "EPSG:4326")
OUT.mkdir(parents=True, exist_ok=True)
VECTOR_EXT = {".kml", ".kmz", ".gpkg", ".shp", ".geojson", ".json"}
RASTER_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".pdf"}

def run(cmd: list[str]) -> None:
    print("$", " ".join(cmd))
    subprocess.run(cmd, check=True)

def convert_vector(path: Path) -> None:
    out = OUT / f"{path.stem}.geojson"
    run(["ogr2ogr", "-f", "GeoJSON", str(out), str(path), "-t_srs", TARGET_CRS, "-nlt", "PROMOTE_TO_MULTI"])

def mark_raster_for_georef(path: Path) -> None:
    report = OUT / f"{path.stem}.needs_georef.json"
    report.write_text(json.dumps({
        "source": str(path),
        "status": "needs_georeferencing",
        "reason": "Raster/PDF sin garantía de georreferencia. Abrir en QGIS Georeferencer, asignar GCPs y exportar GeoTIFF/GeoPackage antes de vectorizar.",
        "required_output": f"{path.stem}.georef.tif o {path.stem}.digitized.gpkg"
    }, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[needs_georef] {path} -> {report}")

if __name__ == "__main__":
    if not RAW.exists():
        print(f"No existe RAW_INPUT_DIR: {RAW}", file=sys.stderr)
        sys.exit(1)
    for p in RAW.rglob("*"):
        if not p.is_file():
            continue
        ext = p.suffix.lower()
        if ext in VECTOR_EXT:
            convert_vector(p)
        elif ext in RASTER_EXT:
            mark_raster_for_georef(p)
