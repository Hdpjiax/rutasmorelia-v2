import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    estimate_metrics,
    heal_large_gaps,
    heal_source_polyline,
    max_gap_in_line,
    repair_gaps,
    route_along_source,
)

feat = next(
    f
    for f in json.loads(
        Path("data/processed/geojson/ruta-chucandiro.geojson").read_text(encoding="utf-8")
    )["features"]
    if f["properties"]["direction"] == "ida"
)
source = heal_source_polyline([(c[0], c[1]) for c in feat["geometry"]["coordinates"]])

for spacing in range(130, 201, 5):
    geom = route_along_source(source, spacing_m=float(spacing), max_pts=400)
    geom = heal_large_gaps(geom, source, 480)
    geom = repair_gaps(geom, source, 350, 3)
    gap = max_gap_in_line(geom)
    snap = estimate_metrics(source, geom)["avg_snap_m"]
    ok = "OK" if gap <= 500 and snap <= 35 else ""
    print(f"spacing={spacing} gap={gap:.1f} snap={snap:.1f} pts={len(geom)} {ok}")