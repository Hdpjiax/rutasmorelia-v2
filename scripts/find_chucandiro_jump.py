import json
from pathlib import Path

from strict_map_match_valhalla_osrm import gap_distance_m, heal_source_polyline

source = heal_source_polyline(
    [
        (c[0], c[1])
        for c in next(
            f
            for f in json.loads(
                Path("data/processed/geojson/ruta-chucandiro.geojson").read_text(encoding="utf-8")
            )["features"]
            if f["properties"]["direction"] == "ida"
        )["geometry"]["coordinates"]
    ]
)

# find largest source gaps
gaps = []
for i in range(1, len(source)):
    g = gap_distance_m(source[i - 1], source[i])
    if g > 200:
        gaps.append((i, g, source[i - 1], source[i]))
gaps.sort(key=lambda x: -x[1])
print("top source gaps:")
for i, g, a, b in gaps[:10]:
    print(f"  idx={i} gap={g:.1f}m")

target_a = (-101.155769, 19.94359)
target_b = (-101.160472, 19.965232)

def nearest_idx(pt):
    best, bi = 1e18, 0
    for i, c in enumerate(source):
        d = gap_distance_m(pt, c)
        if d < best:
            best, bi = d, i
    return bi, best

ia, da = nearest_idx(target_a)
ib, db = nearest_idx(target_b)
print(f"\nmatched A near src[{ia}] dist={da:.0f}m")
print(f"matched B near src[{ib}] dist={db:.0f}m")
lo, hi = min(ia, ib), max(ia, ib)
print(f"source segment {lo}-{hi} len={hi-lo} pts")
for i in range(lo + 1, hi + 1):
    g = gap_distance_m(source[i - 1], source[i])
    if g > 150:
        print(f"  internal src gap idx={i} {g:.1f}m")