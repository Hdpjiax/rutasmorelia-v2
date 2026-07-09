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

FAIL = [
    "ruta-arco-san-pedro",
    "ruta-arroyo-colorado",
    "ruta-charo",
    "ruta-chihuerio",
    "ruta-chucandiro",
    "ruta-morada-2a",
]

for rid in FAIL:
    data = json.loads(
        (Path("data/processed/geojson") / f"{rid}.geojson").read_text(encoding="utf-8")
    )
    print(f"\n{rid}")
    for feat in data["features"]:
        d = feat["properties"].get("direction", "?")
        source = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]
        passed = False
        best_gap, best_snap, best_cs = 9999.0, 9999.0, 0
        for cs in (12, 15, 18, 20, 22, 25, 28, 30, 35, 40):
            geom = trace_along_source_dense(source, chunk_size=cs, overlap=0)
            geom = heal_large_gaps(geom, source, 480)
            geom = repair_gaps(geom, source, 350, 3)
            gap = max_gap_in_line(geom)
            snap = estimate_metrics(source, geom)["avg_snap_m"]
            if gap <= 500 and snap <= 35:
                print(f"  {d}: PASS cs={cs} gap={gap:.1f} snap={snap:.1f}")
                passed = True
                break
            if gap < best_gap:
                best_gap, best_snap, best_cs = gap, snap, cs
        if not passed:
            print(f"  {d}: FAIL best cs={best_cs} gap={best_gap:.1f} snap={best_snap:.1f}")