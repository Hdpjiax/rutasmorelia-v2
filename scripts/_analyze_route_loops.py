"""Detecta lazos, retrocesos y tramos sobre periférico en una ruta."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point
from shapely.ops import transform, unary_union

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform

ROUTE_ID = sys.argv[1]
DIRECTION = sys.argv[2] if len(sys.argv) > 2 else "vuelta"
KIND = sys.argv[3] if len(sys.argv) > 3 else "geojson"


def load_line() -> LineString:
    p = Path(f"data/processed/{KIND}/{ROUTE_ID}.geojson")
    data = json.loads(p.read_text(encoding="utf-8"))
    f = next(x for x in data["features"] if x["properties"]["direction"] == DIRECTION)
    return LineString([(c[0], c[1]) for c in f["geometry"]["coordinates"]])


def bearing(a, b) -> float:
    ax, ay = a
    bx, by = b
    return math.degrees(math.atan2(bx - ax, by - ay)) % 360


def angle_diff(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


def main() -> None:
    line = load_line()
    coords = list(line.coords)
    lm = transform(to_m, line)
    peri = json.loads(Path("public/data/periferico-republica.geojson").read_text(encoding="utf-8"))
    peri_m = transform(to_m, unary_union(
        [LineString(f["geometry"]["coordinates"]) for f in peri["features"]]
    )).buffer(55)

    print(f"{ROUTE_ID} {DIRECTION} ({KIND}): {len(coords)} pts, {lm.length:.0f}m")

    # Retrocesos fuertes (>120°)
    reversals = []
    for i in range(1, len(coords) - 1):
        ap = transform(to_m, Point(coords[i - 1]))
        bp = transform(to_m, Point(coords[i]))
        cp = transform(to_m, Point(coords[i + 1]))
        b1 = bearing((ap.x, ap.y), (bp.x, bp.y))
        b2 = bearing((bp.x, bp.y), (cp.x, cp.y))
        if angle_diff(b1, b2) > 120:
            on_peri = peri_m.contains(bp)
            reversals.append((i, angle_diff(b1, b2), on_peri, coords[i]))

    print(f"  retrocesos >120°: {len(reversals)}")
    for item in reversals[:15]:
        print(f"    idx={item[0]} turn={item[1]:.0f}° peri={item[2]} {item[3]}")

    # Lazos (vuelve cerca de punto anterior)
    loops = []
    for i in range(10, len(coords)):
        p = transform(to_m, Point(coords[i]))
        for j in range(0, i - 30):
            q = transform(to_m, Point(coords[j]))
            if p.distance(q) < 25 and i - j > 40:
                mid = transform(to_m, LineString(coords[j:i + 1]))
                if mid.length > 200:
                    loops.append((j, i, mid.length, peri_m.contains(p)))
                    break
    print(f"  lazos probables: {len(loops)}")
    for item in loops[:10]:
        print(f"    {item[0]}-{item[1]} len={item[2]:.0f}m peri={item[3]}")


if __name__ == "__main__":
    main()