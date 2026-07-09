"""Detecta tramos de ruta sobre Periférico y si van contra oneway OSM."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point
from shapely.ops import transform

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform

ROUTE_ID = sys.argv[1] if len(sys.argv) > 1 else "ruta-alberca-metropolis"
BUFFER_M = 55.0


def to_line(coords) -> LineString:
    return LineString([(c[0], c[1]) for c in coords])


def bearing_deg(a: tuple[float, float], b: tuple[float, float]) -> float:
    import math

    ap = transform(to_m, Point(a))
    bp = transform(to_m, Point(b))
    return bearing_deg_metric((ap.x, ap.y), (bp.x, bp.y))


def bearing_deg_metric(a: tuple[float, float], b: tuple[float, float]) -> float:
    import math

    ax, ay = a
    bx, by = b
    return math.degrees(math.atan2(bx - ax, by - ay)) % 360


def angle_diff(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


def analyze_direction(route: LineString, peri: LineString, oneway: str | None) -> dict | None:
    rm = transform(to_m, route)
    pm = transform(to_m, peri)
    buf = pm.buffer(BUFFER_M)
    if not rm.intersects(buf):
        return None
    clipped = rm.intersection(buf)
    if clipped.is_empty:
        return None
    if clipped.geom_type == "MultiLineString":
        parts = list(clipped.geoms)
        clipped = max(parts, key=lambda g: g.length)
    if clipped.geom_type != "LineString" or len(clipped.coords) < 2:
        return None

    rc = list(clipped.coords)
    pc = list(pm.coords)
    route_bearing = bearing_deg_metric(rc[0], rc[-1])
    peri_bearing = bearing_deg_metric(pc[0], pc[-1])
    peri_bearing_rev = (peri_bearing + 180) % 360
    diff_fwd = angle_diff(route_bearing, peri_bearing)
    diff_rev = angle_diff(route_bearing, peri_bearing_rev)
    aligned_fwd = diff_fwd < diff_rev
    wrong_way = oneway == "yes" and not aligned_fwd

    return {
        "route_bearing": round(route_bearing, 1),
        "peri_bearing": round(peri_bearing, 1),
        "diff_fwd": round(diff_fwd, 1),
        "diff_rev": round(diff_rev, 1),
        "oneway": oneway,
        "aligned_with_osm": aligned_fwd,
        "wrong_way": wrong_way,
        "overlap_m": round(clipped.length, 1),
    }


def main() -> None:
    kind = sys.argv[2] if len(sys.argv) > 2 else "matched"
    route_path = Path(f"data/processed/{kind}/{ROUTE_ID}.geojson")
    peri_path = Path("public/data/periferico-republica.geojson")
    data = json.loads(route_path.read_text(encoding="utf-8"))
    peri = json.loads(peri_path.read_text(encoding="utf-8"))

    for feat in data["features"]:
        direction = feat["properties"]["direction"]
        route = to_line(feat["geometry"]["coordinates"])
        print(f"\n=== {ROUTE_ID} {kind} {direction} (len {transform(to_m, route).length:.0f}m) ===")
        hits = []
        for i, pf in enumerate(peri["features"]):
            props = pf.get("properties", {})
            pls = to_line(pf["geometry"]["coordinates"])
            res = analyze_direction(route, pls, props.get("oneway"))
            if res and res["overlap_m"] >= 80:
                hits.append((res["overlap_m"], i, props.get("name"), props.get("oneway"), res))
        hits.sort(reverse=True)
        if not hits:
            print("  (sin tramo significativo sobre Periférico)")
            continue
        for overlap, idx, name, ow, res in hits[:8]:
            status = "CONTRA SENTIDO" if res["wrong_way"] else "ok"
            print(
                f"  [{status}] peri#{idx} {name!r} oneway={ow} overlap={overlap:.0f}m "
                f"route_br={res['route_bearing']} peri_br={res['peri_bearing']} "
                f"diff_fwd={res['diff_fwd']} diff_rev={res['diff_rev']}"
            )


if __name__ == "__main__":
    main()