"""Localiza tramos donde A se aleja de B (>umbral) en corredor compartido."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point, box
from shapely.ops import transform, unary_union

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform

ROUTE_A = sys.argv[1] if len(sys.argv) > 1 else "ruta-alberca-metropolis"
ROUTE_B = sys.argv[2] if len(sys.argv) > 2 else "ruta-alberca-gertrudis"
DIRECTION = sys.argv[3] if len(sys.argv) > 3 else "ida"
THRESH_M = float(sys.argv[4] if len(sys.argv) > 4 else "35")


def load_line(route_id: str, direction: str) -> LineString:
    data = json.loads(Path(f"public/routes/{route_id}.geojson").read_text(encoding="utf-8"))
    f = next(x for x in data["features"] if x["properties"]["direction"] == direction)
    return LineString([(c[0], c[1]) for c in f["geometry"]["coordinates"]])


def zone_label(lon: float, lat: float, peri_m) -> str:
    centro = box(-101.205, 19.688, -101.175, 19.715)
    p = Point(lon, lat)
    if peri_m.contains(transform(to_m, p)):
        return "periferico"
    if centro.contains(p):
        return "centro"
    return "otro"


def main() -> None:
    la = load_line(ROUTE_A, DIRECTION)
    lb = load_line(ROUTE_B, DIRECTION)
    lb_m = transform(to_m, lb)
    peri = json.loads(Path("public/data/periferico-republica.geojson").read_text(encoding="utf-8"))
    peri_lines = [LineString(f["geometry"]["coordinates"]) for f in peri["features"]]
    peri_m = transform(to_m, unary_union(peri_lines)).buffer(55)

    coords = list(la.coords)
    blocks: list[tuple[int, int, float, str]] = []
    start = None
    max_d = 0.0
    zone = "otro"
    for i, c in enumerate(coords):
        d = transform(to_m, Point(c)).distance(lb_m)
        if d > THRESH_M:
            if start is None:
                start = i
                max_d = d
                zone = zone_label(c[0], c[1], peri_m)
            else:
                max_d = max(max_d, d)
        elif start is not None:
            blocks.append((start, i - 1, max_d, zone))
            start = None
            max_d = 0.0
    if start is not None:
        blocks.append((start, len(coords) - 1, max_d, zone))

    print(f"{ROUTE_A} {DIRECTION} vs {ROUTE_B}: desvíos >{THRESH_M}m")
    if not blocks:
        print("  (ninguno)")
        return
    for s, e, md, z in blocks[:12]:
        sub = LineString(coords[s : e + 1])
        ln = transform(to_m, sub).length
        print(f"  idx {s}-{e} zone={z} len={ln:.0f}m max_dist={md:.1f}m mid={coords[(s+e)//2]}")


if __name__ == "__main__":
    main()