"""Tune trace_dense chunk=20 across failing routes."""
from __future__ import annotations

import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    estimate_metrics,
    heal_large_gaps,
    max_gap_in_line,
    repair_gaps,
    trace_along_source_dense,
)

ROUTES = [
    "ruta-arco-san-pedro",
    "ruta-arroyo-colorado",
    "ruta-chucandiro",
    "ruta-coeneo",
    "ruta-gris-1-circuito",
    "ruta-naranja-2-santa-fe",
]

for rid in ROUTES:
    p = Path("data/processed/geojson") / f"{rid}.geojson"
    data = json.loads(p.read_text(encoding="utf-8"))
    print(f"\n{rid}")
    for feat in data["features"]:
        d = feat["properties"].get("direction", "?")
        source = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]
        geom = trace_along_source_dense(source, chunk_size=20)
        geom = heal_large_gaps(geom, source, threshold_m=480)
        geom = repair_gaps(geom, source, max_gap_m=350, max_passes=3)
        gap = max_gap_in_line(geom)
        snap = estimate_metrics(source, geom)["avg_snap_m"]
        ok = "PASS" if gap <= 500 else "FAIL"
        print(f"  {d}: gap={gap:.1f} snap={snap:.2f} pts={len(geom)} {ok}")