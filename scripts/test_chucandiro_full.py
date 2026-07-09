import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    estimate_metrics,
    heal_large_gaps,
    heal_source_polyline,
    match_source_multipart,
    max_gap_in_line,
    repair_gaps,
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
for max_len, cs in ((6000, 12), (6000, 18), (7500, 18)):
    parts = split_source_by_length(source, max_len)
    geom = match_source_multipart(source, parts, chunk_size=cs, route_spacing=100)
    geom = heal_large_gaps(geom, source, 480)
    geom = repair_gaps(geom, source, 350, 3)
    gap = max_gap_in_line(geom)
    snap = estimate_metrics(source, geom)["avg_snap_m"]
    ok = "OK" if gap <= 500 and snap <= 35 else ""
    print(f"len={max_len} cs={cs} parts={len(parts)} gap={gap:.1f} snap={snap:.1f} {ok}")