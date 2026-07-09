import json, subprocess, tempfile
from shapely.geometry import shape
import pyproj
from shapely.ops import transform

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform
src = "rutastransporte/01_RUTAS_DE_COMBI/3_COMBI_AMARILLA_1_CENTRO/KML/Amarilla_1_centro.kml"
with tempfile.TemporaryDirectory() as tmp:
    out = f"{tmp}/raw.geojson"
    subprocess.run(["ogr2ogr", "-f", "GeoJSON", out, src, "-t_srs", "EPSG:4326", "-dim", "2"], check=True)
    raw = json.load(open(out))

g = raw["features"][1]["geometry"]
for j, part in enumerate(g["coordinates"]):
    print(f"part{j} start={part[0]} end={part[-1]}")
    ls = shape({"type": "LineString", "coordinates": part})
    print(f"  len={transform(to_m, ls).length:.0f}m")