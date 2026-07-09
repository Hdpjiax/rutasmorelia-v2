"""Diagnose persistent 837m gap in arco-san-pedro."""
from __future__ import annotations

import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    gap_distance_m,
    finalize_matched,
    heal_large_gaps,
    max_gap_in_line,
    nearest_source_index,
    route_along_source,
    trace_along_source_dense,
    valhalla_trace_route,
)

p = Path("data/processed/geojson/ruta-arco-san-pedro.geojson")
data = json.loads(p.read_text(encoding="utf-8"))
feat = data["features"][0]
source = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]

traced, _ = valhalla_trace_route(source)
max_g, idx = 0.0, 0
for i in range(1, len(traced)):
    g = gap_distance_m(traced[i - 1], traced[i])
    if g > max_g:
        max_g, idx = g, i
a, b = traced[idx - 1], traced[idx]
print(f"Worst gap {max_g:.1f}m at idx {idx}")
print(f"  A: {a}")
print(f"  B: {b}")

i0 = nearest_source_index(a, source)
i1 = nearest_source_index(b, source)
lo, hi = min(i0, i1), max(i0, i1)
sub = source[lo : hi + 1]
print(f"Source indices {lo}-{hi} ({len(sub)} pts)")

for spacing in (30, 40, 60, 80):
    r = route_along_source(sub, spacing_m=spacing, max_pts=120)
    print(f"  route spacing={spacing}: pts={len(r)} max_gap={max_gap_in_line(r):.1f}")

td = trace_along_source_dense(sub, chunk_size=14)
print(f"  trace_dense sub: pts={len(td)} max_gap={max_gap_in_line(td):.1f}")
tf = trace_along_source_dense(source, chunk_size=50)
print(f"  trace_dense full: pts={len(tf)} max_gap={max_gap_in_line(tf):.1f}")

healed = heal_large_gaps(traced, source)
print(f"heal_large_gaps: pts={len(healed)} max_gap={max_gap_in_line(healed):.1f}")
final = finalize_matched(traced, source)
print(f"finalize: pts={len(final)} max_gap={max_gap_in_line(final):.1f}")