"""Find largest gap in matched geometry and nearby source coords."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    gap_distance_m,
    route_along_source,
    sample_source_waypoints,
    valhalla_route_waypoints,
)

rid = sys.argv[1]
direction = sys.argv[2] if len(sys.argv) > 2 else "ida"
p = Path("data/processed/geojson") / f"{rid}.geojson"
data = json.loads(p.read_text(encoding="utf-8"))
feat = next(f for f in data["features"] if f["properties"].get("direction") == direction)
source = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]

for spacing in (80, 100, 150, 200, 300):
    routed = route_along_source(source, spacing_m=spacing)
    max_g, idx = 0.0, 0
    for i in range(1, len(routed)):
        g = gap_distance_m(routed[i - 1], routed[i])
        if g > max_g:
            max_g, idx = g, i
    print(f"spacing={spacing} pts={len(routed)} max_gap={max_g:.1f} at {idx}")

routed = route_along_source(source, spacing_m=150)
max_g, idx = 0.0, 0
for i in range(1, len(routed)):
    g = gap_distance_m(routed[i - 1], routed[i])
    if g > max_g:
        max_g, idx = g, i
a, b = routed[idx - 1], routed[idx]
print(f"\nWorst gap: {max_g:.1f}m between {a} and {b}")

wps = sample_source_waypoints(source, spacing_m=150, max_pts=200)
# find source segment covering gap
for i, w in enumerate(wps):
    da = gap_distance_m(w, a)
    db = gap_distance_m(w, b)
    if da < 500 or db < 500:
        print(f"  wp[{i}] dist_a={da:.0f} dist_b={db:.0f} {w}")

# try routing with dense wps around gap
dense = sample_source_waypoints(source, spacing_m=60, max_pts=300)
seg = valhalla_route_waypoints(dense[:25])
print(f"\ndense route first 25 wps: pts={len(seg)} max_gap={max(gap_distance_m(seg[i-1],seg[i]) for i in range(1,len(seg))):.1f}" if len(seg)>1 else "empty")