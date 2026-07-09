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

source = [
    (c[0], c[1])
    for c in json.loads(
        Path("data/processed/geojson/ruta-arco-san-pedro.geojson").read_text(encoding="utf-8")
    )["features"][0]["geometry"]["coordinates"]
]

for cs in (15, 18, 20, 22, 25, 30):
    for ov in (0, 4, 8):
        geom = trace_along_source_dense(source, chunk_size=cs, overlap=ov)
        healed = heal_large_gaps(geom, source, threshold_m=480)
        repaired = repair_gaps(healed, source, max_gap_m=300, max_passes=4)
        gap = max_gap_in_line(repaired)
        snap = estimate_metrics(source, repaired)["avg_snap_m"]
        mark = "OK" if gap <= 500 else ""
        print(f"chunk={cs:2d} ov={ov} pts={len(repaired):5d} gap={gap:6.1f} snap={snap:.2f} {mark}")