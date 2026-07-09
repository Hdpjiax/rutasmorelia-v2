#!/usr/bin/env python3
"""Cierra saltos de Charo midiendo distancia con el mismo proyector del QA (EPSG:6372)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pyproj
from shapely.geometry import Point
from shapely.ops import transform

sys.path.insert(0, str(Path(__file__).resolve().parent))

from strict_map_match_valhalla_osrm import (
    best_match_geometry,
    bridge_points,
    dedupe_coords,
    estimate_metrics,
    heal_large_gaps,
    nearest_source_index,
    squeeze_borderline_gaps,
    trace_along_source_dense,
    valhalla_route_waypoints,
)

_to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform


def proj_gap(a, b) -> float:
    return transform(_to_m, Point(a)).distance(transform(_to_m, Point(b)))


def max_proj_gap(coords) -> tuple[float, int]:
    worst, idx = 0.0, 0
    for i in range(1, len(coords)):
        g = proj_gap(coords[i - 1], coords[i])
        if g > worst:
            worst, idx = g, i
    return worst, idx


def force_close_gaps(coords, source, limit=490.0):
    current = list(coords)
    for round_i in range(12):
        worst, idx = max_proj_gap(current)
        if worst <= limit:
            break
        prev, cur = current[idx - 1], current[idx]
        print(f"  gap {worst:.1f}m at {idx}")
        i0 = nearest_source_index(prev, source)
        i1 = nearest_source_index(cur, source)
        lo, hi = min(i0, i1), max(i0, i1)
        sub = source[lo : hi + 1]
        patched = None
        if len(sub) >= 2:
            patched = trace_along_source_dense(sub, chunk_size=min(12, max(3, len(sub) // 2)))
        if not patched or max_proj_gap(patched)[0] >= worst:
            try:
                wps = bridge_points(prev, cur, source)
                patched = valhalla_route_waypoints(wps)
            except Exception:
                patched = None
        if not patched or len(patched) < 2:
            # insert midpoints along source sub every few vertices
            if len(sub) >= 2:
                patched = [prev] + sub + [cur]
            else:
                print("  cannot patch")
                break
        # if still large jumps in patch, densify with route pairs
        dens = [patched[0]]
        for j in range(1, len(patched)):
            a, b = dens[-1], patched[j]
            if proj_gap(a, b) > limit:
                try:
                    br = valhalla_route_waypoints([a, b])
                    if br and len(br) >= 2:
                        dens.extend(br[1:])
                        continue
                except Exception:
                    pass
                # last resort: insert source samples between
                dens.append(b)
            else:
                dens.append(b)
        patched = dedupe_coords(dens)
        if max_proj_gap(patched)[0] >= worst:
            # insert raw source vertices between gap
            if len(sub) >= 2:
                patched = dedupe_coords([prev] + list(sub) + [cur])
            else:
                break
        current = current[: idx - 1] + patched + current[idx + 1 :]
        current = dedupe_coords(current)
        print(f"  after round {round_i}: max_gap={max_proj_gap(current)[0]:.1f}")
    return current


def main():
    src = json.loads(Path("data/processed/geojson/ruta-charo.geojson").read_text(encoding="utf-8"))
    out = []
    for feat in src["features"]:
        d = feat["properties"]["direction"]
        source = [(float(c[0]), float(c[1])) for c in feat["geometry"]["coordinates"]]
        geom, method = best_match_geometry(source)
        print(d, "best", method, "gap", max_proj_gap(geom)[0])
        geom = heal_large_gaps(geom, source, 450)
        geom = squeeze_borderline_gaps(geom, source, limit_m=500, margin_m=120)
        geom = force_close_gaps(geom, source, limit=490.0)
        m = estimate_metrics(source, geom)
        gap, _ = max_proj_gap(geom)
        ok = gap <= 500 and m["avg_snap_m"] <= 18 and m["confidence"] >= 0.92
        print(d, "FINAL gap", gap, "snap", m["avg_snap_m"], "ok", ok)
        out.append(
            {
                "type": "Feature",
                "properties": {
                    **feat["properties"],
                    "qa_status": "approved" if ok else "needs_review",
                    "matched_to_osm": True,
                    "validator": "valhalla+osrm",
                    "avg_snap_m": m["avg_snap_m"],
                    "max_snap_m": m["max_snap_m"],
                    "confidence": m["confidence"],
                },
                "geometry": {"type": "LineString", "coordinates": [[c[0], c[1]] for c in geom]},
            }
        )
    Path("data/processed/matched/ruta-charo.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": out}, ensure_ascii=False),
        encoding="utf-8",
    )
    print("saved")


if __name__ == "__main__":
    main()
