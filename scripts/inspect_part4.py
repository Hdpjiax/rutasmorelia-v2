import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    coords_length_m,
    gap_distance_m,
    heal_source_polyline,
    split_source_by_length,
)

feat = next(
    f
    for f in json.loads(
        Path("data/processed/geojson/ruta-chucandiro.geojson").read_text(encoding="utf-8")
    )["features"]
    if f["properties"]["direction"] == "ida"
)
source = heal_source_polyline([(c[0], c[1]) for c in feat["geometry"]["coordinates"]])
part = split_source_by_length(source, 6000)[4]
print(f"part4 pts={len(part)} len={coords_length_m(part)/1000:.1f}km")
gaps = [(i, gap_distance_m(part[i-1], part[i])) for i in range(1, len(part))]
gaps.sort(key=lambda x: -x[1])
for i, g in gaps[:8]:
    print(f"  src idx={i} gap={g:.1f}m {part[i-1]} -> {part[i]}")