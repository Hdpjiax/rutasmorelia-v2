import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    heal_source_polyline,
    max_gap_in_line,
    route_along_source,
    split_source_by_length,
    trace_along_source_dense,
)

feat = next(
    f
    for f in json.loads(
        Path("data/processed/geojson/ruta-chucandiro.geojson").read_text(encoding="utf-8")
    )["features"]
    if f["properties"]["direction"] == "ida"
)
source = heal_source_polyline([(c[0], c[1]) for c in feat["geometry"]["coordinates"]])
parts = split_source_by_length(source, 6000)
print(f"{len(parts)} parts")
for i, part in enumerate(parts):
    for label, geom_fn in [
        ("trace12", lambda p=part: trace_along_source_dense(p, 12, 0)),
        ("trace18", lambda p=part: trace_along_source_dense(p, 18, 0)),
        ("route130", lambda p=part: route_along_source(p, 130, 200)),
        ("route150", lambda p=part: route_along_source(p, 150, 200)),
    ]:
        geom = geom_fn()
        print(f"  part{i} {label}: pts={len(geom)} gap={max_gap_in_line(geom):.1f}")