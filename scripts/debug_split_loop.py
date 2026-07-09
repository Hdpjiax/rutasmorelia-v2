import json
from pathlib import Path
from shapely.geometry import Point
import pyproj
from shapely.ops import transform

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform
coords = json.loads(Path("data/processed/geojson/ruta-amarilla-centro.geojson").read_text())["features"][1]["geometry"]["coordinates"]
start = coords[0]
for i, c in enumerate(coords[1:], 1):
    d = transform(to_m, Point(start)).distance(transform(to_m, Point(c)))
    if d < 5:
        print(f"returns to start at index {i} dist={d:.1f}m coord={c}")
print(f"total pts={len(coords)} end={coords[-1]}")