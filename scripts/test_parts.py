import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    coords_length_m,
    estimate_metrics,
    heal_large_gaps,
    heal_source_polyline,
    match_source_multipart,
    match_source_parts,
    max_gap_in_line,
    repair_gaps,
    split_source_at_gaps,
    split_source_by_length,
)

for rid, direction in [("ruta-charo", "vuelta"), ("ruta-chucandiro", "ida")]:
    feat = next(
        f
        for f in json.loads(
            (Path("data/processed/geojson") / f"{rid}.geojson").read_text(encoding="utf-8")
        )["features"]
        if f["properties"]["direction"] == direction
    )
    source = heal_source_polyline([(c[0], c[1]) for c in feat["geometry"]["coordinates"]])
    print(f"\n{rid} {direction} len={coords_length_m(source)/1000:.1f}km")
    print(f"  gap_parts={len(split_source_at_gaps(source))} length_parts_7500={len(split_source_by_length(source,7500))}")
    for label, fn in [
        ("parts-18", lambda: match_source_parts(source, 18)),
        ("length-7500-18", lambda: match_source_multipart(source, split_source_by_length(source, 7500), 18, 140)),
        ("length-6000-12", lambda: match_source_multipart(source, split_source_by_length(source, 6000), 12, 140)),
    ]:
        geom = fn()
        geom = heal_large_gaps(geom, source, 480)
        geom = repair_gaps(geom, source, 350, 3)
        gap = max_gap_in_line(geom)
        snap = estimate_metrics(source, geom)["avg_snap_m"]
        ok = "OK" if gap <= 500 and snap <= 35 else ""
        print(f"  {label}: gap={gap:.1f} snap={snap:.1f} pts={len(geom)} {ok}")