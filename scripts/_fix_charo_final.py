#!/usr/bin/env python3
"""Charo final: best_match + fill residual gaps with source-corridor routing."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from strict_map_match_valhalla_osrm import (
    best_match_geometry,
    dedupe_coords,
    estimate_metrics,
    gap_distance_m,
    max_gap_in_line,
    nearest_source_index,
    valhalla_route_waypoints,
)

ROOT = Path(__file__).resolve().parents[1]
RID = "ruta-charo"


def fill_gaps_with_source(geom: list, source: list, max_gap: float = 480.0) -> list:
    if len(geom) < 2:
        return geom
    out = [geom[0]]
    for i in range(1, len(geom)):
        a, b = out[-1], geom[i]
        dist = gap_distance_m(a, b)
        if dist <= max_gap:
            if out[-1] != b:
                out.append(b)
            continue

        ia = nearest_source_index(a, source)
        ib = nearest_source_index(b, source)
        if ia > ib:
            ia, ib = ib, ia
        # expand a bit
        ia = max(0, ia - 1)
        ib = min(len(source) - 1, ib + 1)
        segment = source[ia : ib + 1]
        if len(segment) < 2:
            segment = [a, b]

        # sample waypoints along segment
        step = max(1, len(segment) // 8)
        ways = [a]
        for j in range(0, len(segment), step):
            ways.append(segment[j])
        ways.append(b)
        # unique
        uw = []
        for w in ways:
            if not uw or uw[-1] != w:
                uw.append(w)

        bridge = valhalla_route_waypoints(uw)
        if bridge and len(bridge) >= 2 and max_gap_in_line(bridge) <= max_gap * 1.1:
            for p in bridge[1:]:
                if out[-1] != p:
                    out.append(p)
            continue

        # fallback: insert source points themselves (then will be re-snapped less cleanly but continuous)
        for p in segment:
            if out[-1] != p:
                out.append(p)
        if out[-1] != b:
            out.append(b)

    return dedupe_coords(out)


def main() -> None:
    src = json.loads((ROOT / "data/processed/geojson" / f"{RID}.geojson").read_text(encoding="utf-8"))
    out_feats = []
    for feat in src["features"]:
        d = feat["properties"]["direction"]
        source = [(float(c[0]), float(c[1])) for c in feat["geometry"]["coordinates"]]
        geom, method = best_match_geometry(source)
        print(f"{d}: best={method} gap0={max_gap_in_line(geom):.1f} snap0={estimate_metrics(source, geom)['avg_snap_m']}")
        geom2 = fill_gaps_with_source(geom, source, max_gap=480.0)
        # second pass
        geom2 = fill_gaps_with_source(geom2, source, max_gap=480.0)
        m = estimate_metrics(source, geom2)
        gap = max_gap_in_line(geom2)
        ok = gap <= 500 and m["avg_snap_m"] <= 18 and m["confidence"] >= 0.92
        print(f"{d}: final gap={gap:.1f} snap={m['avg_snap_m']} conf={m['confidence']} ok={ok} pts={len(geom2)}")
        out_feats.append(
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
                    "match_method": method,
                },
                "geometry": {"type": "LineString", "coordinates": [[c[0], c[1]] for c in geom2]},
            }
        )

    path = ROOT / "data/processed/matched" / f"{RID}.geojson"
    path.write_text(
        json.dumps({"type": "FeatureCollection", "features": out_feats}, ensure_ascii=False),
        encoding="utf-8",
    )
    print("wrote", path)


if __name__ == "__main__":
    main()
