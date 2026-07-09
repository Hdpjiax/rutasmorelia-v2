import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    gap_distance_m,
    heal_source_polyline,
    interpolate_points,
    max_gap_in_line,
    nearest_source_index,
    trace_along_source_dense,
    valhalla_trace_segment,
)

feat = next(
    f
    for f in json.loads(
        Path("data/processed/geojson/ruta-chucandiro.geojson").read_text(encoding="utf-8")
    )["features"]
    if f["properties"]["direction"] == "ida"
)
raw = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]
source = heal_source_polyline(raw)

a = (-101.155769, 19.94359)
b = (-101.160472, 19.965232)
i0 = nearest_source_index(a, source)
i1 = nearest_source_index(b, source)
lo, hi = min(i0, i1), max(i0, i1)
sub = source[lo : hi + 1]
print(f"nearest indices {lo}-{hi} ({len(sub)} pts)")
for i in range(lo + 1, hi + 1):
    g = gap_distance_m(source[i - 1], source[i])
    if g > 300:
        print(f"  src gap idx={i} {g:.1f}m")

interp = interpolate_points(source[lo], source[hi], step_m=30)
for radius in (80, 120):
    try:
        seg = valhalla_trace_segment(interp, radius)
        print(f"interp trace r={radius} pts={len(seg)} max_gap={max_gap_in_line(seg):.1f}")
    except Exception as e:
        print(f"interp trace r={radius} err {e}")

geom = trace_along_source_dense(source, chunk_size=12, overlap=0)
worst, idx = 0.0, 0
for i in range(1, len(geom)):
    g = gap_distance_m(geom[i - 1], geom[i])
    if g > worst:
        worst, idx = g, i
print(f"trace_dense worst={worst:.1f} at {idx}")