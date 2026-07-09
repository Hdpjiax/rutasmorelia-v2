#!/usr/bin/env python3
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from strict_map_match_valhalla_osrm import (
    best_match_geometry,
    estimate_metrics,
    heal_large_gaps,
    max_gap_in_line,
    squeeze_borderline_gaps,
)

src = json.loads(Path("data/processed/geojson/ruta-charo.geojson").read_text(encoding="utf-8"))
out = []
for feat in src["features"]:
    d = feat["properties"]["direction"]
    source = [(float(c[0]), float(c[1])) for c in feat["geometry"]["coordinates"]]
    geom, method = best_match_geometry(source)
    print(d, "start", method, max_gap_in_line(geom), estimate_metrics(source, geom)["avg_snap_m"])
    geom = heal_large_gaps(geom, source, 450)
    for _ in range(3):
        geom = squeeze_borderline_gaps(geom, source, limit_m=500, margin_m=120)
    m = estimate_metrics(source, geom)
    gap = max_gap_in_line(geom)
    ok = gap <= 500 and m["avg_snap_m"] <= 18 and m["confidence"] >= 0.92
    print(d, "final gap", gap, "snap", m["avg_snap_m"], "conf", m["confidence"], "ok", ok)
    out.append(
        {
            "type": "Feature",
            "properties": {
                **feat["properties"],
                "qa_status": "approved" if ok else "needs_review",
                "matched_to_osm": True,
                "validator": "valhalla+osrm",
                "avg_snap_m": m["avg_snap_m"],
                "max_snap_m": m["max_snap_m"],
                "confidence": m["confidence"],
            },
            "geometry": {"type": "LineString", "coordinates": [[c[0], c[1]] for c in geom]},
        }
    )
Path("data/processed/matched/ruta-charo.geojson").write_text(
    json.dumps({"type": "FeatureCollection", "features": out}, ensure_ascii=False),
    encoding="utf-8",
)
print("saved")
