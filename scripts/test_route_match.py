"""Quick test of route_along_source vs trace gaps."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    estimate_metrics,
    finalize_matched,
    max_gap_in_line,
    valhalla_trace_route,
)

rid = sys.argv[1] if len(sys.argv) > 1 else "ruta-arco-san-pedro"
p = Path("data/processed/geojson") / f"{rid}.geojson"
data = json.loads(p.read_text(encoding="utf-8"))

for feat in data["features"]:
    direction = feat["properties"].get("direction", "?")
    coords2d = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]
    traced, _meta = valhalla_trace_route(coords2d)
    final = finalize_matched(traced, coords2d)
    print(f"\n=== {rid} {direction} ===")
    print(f"source pts={len(coords2d)}")
    print(f"trace pts={len(traced)} max_gap={max_gap_in_line(traced):.1f} snap={estimate_metrics(coords2d, traced)['avg_snap_m']}")
    print(f"final pts={len(final)} max_gap={max_gap_in_line(final):.1f} snap={estimate_metrics(coords2d, final)['avg_snap_m']}")