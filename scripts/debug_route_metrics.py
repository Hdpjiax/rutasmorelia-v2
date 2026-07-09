"""Diagnóstico rápido de geometrías importadas vs matched."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point, shape
from shapely.ops import transform

wgs84 = pyproj.CRS("EPSG:4326")
mexico_lcc = pyproj.CRS("EPSG:6372")
to_m = pyproj.Transformer.from_crs(wgs84, mexico_lcc, always_xy=True).transform


def stats(path: Path) -> None:
    d = json.loads(path.read_text(encoding="utf-8"))
    print(f"=== {path} ===")
    for f in d["features"]:
        props = f["properties"]
        g = shape(f["geometry"])
        gm = transform(to_m, g)
        print(
            f"  {props.get('direction')}: pts={len(g.coords)}, len_m={gm.length:.0f}, "
            f"qa={props.get('qa_status')}, avg={props.get('avg_snap_m')}"
        )
        c0, c1 = g.coords[0], g.coords[-1]
        print(f"    start=({c0[0]:.5f},{c0[1]:.5f}) end=({c1[0]:.5f},{c1[1]:.5f})")
    print()


def compare_orig_matched(route_id: str) -> None:
    orig_path = Path(f"data/processed/geojson/{route_id}.geojson")
    match_path = Path(f"data/processed/matched/{route_id}.geojson")
    if not orig_path.exists() or not match_path.exists():
        print(f"Missing files for {route_id}")
        return

    orig = {f["properties"]["direction"]: shape(f["geometry"]) for f in json.loads(orig_path.read_text())["features"]}
    matched = {
        f["properties"]["direction"]: shape(f["geometry"])
        for f in json.loads(match_path.read_text())["features"]
    }

    print(f"--- compare {route_id} ---")
    for direction in ("ida", "vuelta"):
        o = orig[direction]
        m = matched[direction]
        om = transform(to_m, o)
        mm = transform(to_m, m)
        dists = [transform(to_m, Point(c)).distance(mm) for c in o.coords]
        avg = sum(dists) / len(dists)
        print(
            f"  {direction}: orig_pts={len(o.coords)} match_pts={len(m.coords)} "
            f"orig_len={om.length:.0f} match_len={mm.length:.0f} "
            f"avg_dist={avg:.1f} max_dist={max(dists):.1f}"
        )
        # sample every 100th point distance
        for i in range(0, len(o.coords), max(1, len(o.coords) // 5)):
            c = o.coords[i]
            d = transform(to_m, Point(c)).distance(mm)
            print(f"    pt[{i}] dist={d:.1f}m coord=({c[0]:.5f},{c[1]:.5f})")
    print()


if __name__ == "__main__":
    routes = sys.argv[1:] or ["ruta-amarilla-centro", "ruta-roja-1"]
    for route_id in routes:
        for sub in ("geojson", "matched"):
            p = Path(f"data/processed/{sub}/{route_id}.geojson")
            if p.exists():
                stats(p)
        compare_orig_matched(route_id)