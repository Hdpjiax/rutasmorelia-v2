"""Compara dos rutas en zonas periférico y centro."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point, box
from shapely.ops import transform

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform

ROUTE_A = sys.argv[1] if len(sys.argv) > 1 else "ruta-alberca-metropolis"
ROUTE_B = sys.argv[2] if len(sys.argv) > 2 else "ruta-alberca-gertrudis"
KIND = sys.argv[3] if len(sys.argv) > 3 else "matched"

# Centro histórico Morelia (aprox.)
CENTRO = box(-101.205, 19.688, -101.175, 19.715)
PERI_BUFFER_M = 55.0


def load_route(route_id: str) -> dict[str, LineString]:
    path = Path(f"data/processed/{KIND}/{route_id}.geojson")
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, LineString] = {}
    for f in data["features"]:
        d = f["properties"]["direction"]
        out[d] = LineString([(c[0], c[1]) for c in f["geometry"]["coordinates"]])
    return out


def load_peri_union() -> LineString:
    peri = json.loads(Path("public/data/periferico-republica.geojson").read_text(encoding="utf-8"))
    lines = [LineString(f["geometry"]["coordinates"]) for f in peri["features"]]
    from shapely.ops import unary_union

    u = unary_union(lines)
    if u.geom_type == "MultiLineString":
        return max(u.geoms, key=lambda g: g.length)
    return u


def clip_zone(line: LineString, zone_wgs) -> list[LineString]:
    lm = transform(to_m, line)
    zm = transform(to_m, zone_wgs)
    buf = zm if zm.geom_type != "Polygon" else zm
    if hasattr(buf, "buffer") and buf.geom_type == "LineString":
        buf = buf.buffer(PERI_BUFFER_M)
    clipped = lm.intersection(buf)
    if clipped.is_empty:
        return []
    if clipped.geom_type == "LineString":
        return [transform(pyproj.Transformer.from_crs("EPSG:6372", "EPSG:4326", always_xy=True).transform, clipped)]
    if clipped.geom_type == "MultiLineString":
        tw = pyproj.Transformer.from_crs("EPSG:6372", "EPSG:4326", always_xy=True).transform
        return [transform(tw, g) for g in clipped.geoms if g.length > 30]
    return []


def hausdorff_m(a: LineString, b: LineString) -> float:
    return transform(to_m, a).hausdorff_distance(transform(to_m, b))


def compare_zone(name: str, zone, routes_a: dict, routes_b: dict) -> None:
    print(f"\n=== Zona: {name} ===")
    peri = load_peri_union() if name == "periferico" else None
    zone_geom = transform(to_m, peri).buffer(PERI_BUFFER_M) if peri is not None else CENTRO
    if name == "centro":
        zone_geom = CENTRO

    for direction in ("ida", "vuelta"):
        la = routes_a[direction]
        lb = routes_b[direction]
        if name == "periferico":
            ca = clip_zone(la, peri)
            cb = clip_zone(lb, peri)
        else:
            ca = clip_zone(la, CENTRO)
            cb = clip_zone(lb, CENTRO)
        if not ca or not cb:
            print(f"  {direction}: sin tramo en zona (a={len(ca)} b={len(cb)})")
            continue
        a_main = max(ca, key=lambda g: transform(to_m, g).length)
        b_main = max(cb, key=lambda g: transform(to_m, g).length)
        hd = hausdorff_m(a_main, b_main)
        la_m = transform(to_m, a_main).length
        lb_m = transform(to_m, b_main).length
        print(
            f"  {direction}: metropolis={la_m:.0f}m gertrudis={lb_m:.0f}m "
            f"hausdorff={hd:.0f}m ratio_len={la_m/lb_m:.2f}"
        )


def main() -> None:
    ra = load_route(ROUTE_A)
    rb = load_route(ROUTE_B)
    print(f"Comparando {ROUTE_A} vs {ROUTE_B} ({KIND})")
    compare_zone("periferico", None, ra, rb)
    compare_zone("centro", CENTRO, ra, rb)


if __name__ == "__main__":
    main()