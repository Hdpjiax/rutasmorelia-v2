import json
import sys
from pathlib import Path

from strict_map_match_valhalla_osrm import gap_distance_m

rid = sys.argv[1]
direction = sys.argv[2] if len(sys.argv) > 2 else "ida"
data = json.loads((Path("data/processed/geojson") / f"{rid}.geojson").read_text(encoding="utf-8"))
feat = next(f for f in data["features"] if f["properties"]["direction"] == direction)
c = [(x[0], x[1]) for x in feat["geometry"]["coordinates"]]
gaps = []
for i in range(1, len(c)):
    g = gap_distance_m(c[i - 1], c[i])
    if g > 400:
        gaps.append((i, g, c[i - 1], c[i]))
gaps.sort(key=lambda x: -x[1])
print(f"{rid} {direction}: {len(gaps)} gaps >400m")
for i, g, a, b in gaps[:8]:
    print(f"  idx={i} gap={g:.1f}m")
    print(f"    A={a}")
    print(f"    B={b}")