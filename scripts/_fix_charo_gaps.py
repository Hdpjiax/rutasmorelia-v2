#!/usr/bin/env python3
"""Fix ruta-charo large gaps by bridging with Valhalla /route."""
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
    heal_large_gaps,
    max_gap_in_line,
    repair_gaps,
    route_along_source,
    trace_along_source_dense,
    valhalla_route_waypoints,
)

ROOT = Path(__file__).resolve().parents[1]
RID = "ruta-charo"


def bridge_gaps(geom: list, threshold: float = 400.0) -> list:
    if not geom:
        return geom
    fixed = [geom[0]]
    for i in range(1, len(geom)):
        a, b = fixed[-1], geom[i]
        dist = gap_distance_m(a, b)
        if dist > threshold:
            bridge = valhalla_route_waypoints([a, b])
            if bridge and len(bridge) >= 2:
                for p in bridge[1:]:
                    if fixed[-1] != p:
                        fixed.append(p)
                continue
        if fixed[-1] != b:
            fixed.append(b)
    return dedupe_coords(fixed)


def score(source, geom):
    if not geom or len(geom) < 2:
        return 1e18, 999.0, 0.0, False
    gap = max_gap_in_line(geom)
    m = estimate_metrics(source, geom)
    snap = float(m.get("avg_snap_m", 999))
    conf = float(m.get("confidence", 0))
    ok = gap <= 500 and snap <= 18 and conf >= 0.92
    return gap, snap, conf, ok


def main() -> None:
    src = json.loads((ROOT / "data/processed/geojson" / f"{RID}.geojson").read_text(encoding="utf-8"))
    out_feats = []
    for feat in src["features"]:
        d = feat["properties"]["direction"]
        source = [(float(c[0]), float(c[1])) for c in feat["geometry"]["coordinates"]]
        print(f"=== {d} src={len(source)} ===")
        candidates: list[tuple[str, list]] = []

        geom, method = best_match_geometry(source)
        if geom:
            candidates.append((f"best:{method}", geom))

        for dens in (40, 60, 80, 100, 120, 150):
            g = route_along_source(source, dens)
            if g:
                candidates.append((f"route:{dens}", g))

        for cs in (8, 10, 12, 15, 18, 22):
            g = trace_along_source_dense(source, chunk_size=cs, overlap=1)
            if g:
                candidates.append((f"dense:{cs}", g))

        best = None
        for name, g in candidates:
            g2 = heal_large_gaps(g, source, 1000)
            g2 = repair_gaps(g2, source, 500, 5)
            g2 = bridge_gaps(g2, 400)
            gap, snap, conf, ok = score(source, g2)
            print(f"  {name}: gap={gap:.1f} snap={snap:.2f} conf={conf:.3f} ok={ok} pts={len(g2)}")
            key = (0 if ok else 1, gap, snap)
            if best is None or key < best[0]:
                best = (key, g2, name, gap, snap, conf, ok)

        assert best is not None
        _, geom, name, gap, snap, conf, ok = best
        # one more bridge pass
        geom = bridge_gaps(geom, 350)
        gap, snap, conf, ok = score(source, geom)
        print(f"  FINAL {name}: gap={gap:.1f} snap={snap:.2f} conf={conf:.3f} ok={ok}")
        m = estimate_metrics(source, geom)
        out_feats.append(
            {
                "type": "Feature",
                "properties": {
                    **feat["properties"],
                    "qa_status": "approved" if ok else "needs_review",
                    "matched_to_osm": True,
                    "validator": "valhalla+osrm",
                    "avg_snap_m": m.get("avg_snap_m"),
                    "max_snap_m": m.get("max_snap_m"),
                    "confidence": m.get("confidence"),
                    "match_method": name,
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[c[0], c[1]] for c in geom],
                },
            }
        )

    out_path = ROOT / "data/processed/matched" / f"{RID}.geojson"
    out_path.write_text(
        json.dumps({"type": "FeatureCollection", "features": out_feats}, ensure_ascii=False),
        encoding="utf-8",
    )
    print("wrote", out_path)


if __name__ == "__main__":
    main()
