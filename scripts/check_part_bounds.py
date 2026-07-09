import json
from pathlib import Path

from strict_map_match_valhalla_osrm import gap_distance_m, heal_source_polyline, split_source_by_length

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
parts = split_source_by_length(source, 6000)
for i in range(1, len(parts)):
    g = gap_distance_m(parts[i - 1][-1], parts[i][0])
    print(f"boundary {i-1}->{i}: src_gap={g:.1f}m")