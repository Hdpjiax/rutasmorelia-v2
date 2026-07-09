import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    bridge_points,
    estimate_metrics,
    gap_distance_m,
    heal_large_gaps,
    max_gap_in_line,
    nearest_source_index,
    repair_gaps,
    trace_along_source_dense,
    valhalla_route_waypoints,
)

source = [
    (c[0], c[1])
    for c in json.loads(
        Path("data/processed/geojson/ruta-arco-san-pedro.geojson").read_text(encoding="utf-8")
    )["features"][0]["geometry"]["coordinates"]
]
g = trace_along_source_dense(source, 20)
g = heal_large_gaps(g, source, 480)
g = repair_gaps(g, source, 350, 3)

worst, idx = 0.0, 0
for i in range(1, len(g)):
    d = gap_distance_m(g[i - 1], g[i])
    if d > worst:
        worst, idx = d, i
prev, cur = g[idx - 1], g[idx]
print(f"gap={worst:.1f} at {idx}")
wps = bridge_points(prev, cur, source)
for n, label in [(3, "bridge"), (5, "bridge5")]:
    try:
        patched = valhalla_route_waypoints(wps)
        print(label, "pts", len(patched), "max_gap", max_gap_in_line(patched))
    except Exception as e:
        print(label, "err", e)

i0 = nearest_source_index(prev, source)
i1 = nearest_source_index(cur, source)
lo, hi = min(i0, i1), max(i0, i1)
sub = source[lo : hi + 1]
for k in (1, 2, 3):
    if len(sub) > k:
        mid = sub[len(sub) * k // 4]
        try:
            p = valhalla_route_waypoints([prev, mid, cur])
            print(f"via mid{k}", "max_gap", max_gap_in_line(p))
        except Exception as e:
            print(f"via mid{k} err", e)