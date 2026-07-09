import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    estimate_metrics,
    heal_large_gaps,
    heal_source_polyline,
    max_gap_in_line,
    repair_gaps,
    trace_along_source_dense,
)

for rid, direction in [("ruta-charo", "vuelta"), ("ruta-chucandiro", "ida")]:
    feat = next(
        f
        for f in json.loads(
            (Path("data/processed/geojson") / f"{rid}.geojson").read_text(encoding="utf-8")
        )["features"]
        if f["properties"]["direction"] == direction
    )
    source = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]
    source = heal_source_polyline(source)
    print(f"\n{rid} {direction} healed_src_pts={len(source)}")
    for cs in (12, 18, 22, 28, 35, 40, 50):
        geom = trace_along_source_dense(source, chunk_size=cs, overlap=0)
        geom = heal_large_gaps(geom, source, 480)
        geom = repair_gaps(geom, source, 350, 3)
        gap = max_gap_in_line(geom)
        snap = estimate_metrics(source, geom)["avg_snap_m"]
        ok = "OK" if gap <= 500 and snap <= 35 else ""
        print(f"  cs={cs:2d} gap={gap:6.1f} snap={snap:.1f} {ok}")