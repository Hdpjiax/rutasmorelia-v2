import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    estimate_metrics,
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
part = split_source_by_length(source, 6000)[4]

for rev in (False, True):
    p = list(reversed(part)) if rev else part
    tag = "rev" if rev else "fwd"
    print(f"\n{tag}")
    for cs in (5, 8, 10, 12, 15, 18):
        g = trace_along_source_dense(p, cs, 0)
        print(f"  trace cs={cs}: gap={max_gap_in_line(g):.1f} pts={len(g)}")
    for sp in (40, 60, 80, 100, 120):
        g = route_along_source(p, spacing_m=float(sp), max_pts=80)
        if g:
            print(f"  route sp={sp}: gap={max_gap_in_line(g):.1f} snap={estimate_metrics(p,g)['avg_snap_m']:.1f}")
        else:
            print(f"  route sp={sp}: empty")