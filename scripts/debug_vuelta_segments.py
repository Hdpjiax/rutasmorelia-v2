"""Match loop y spur de vuelta por separado."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pyproj
import requests
from dotenv import load_dotenv
from shapely.geometry import LineString, Point
from shapely.ops import transform

# Reuse helpers from main script
sys.path.insert(0, "scripts")
from strict_map_match_valhalla_osrm import (  # noqa: E402
    coords_length_m,
    decompose_coords,
    endpoint_dist_m,
    match_chunk,
    valhalla_trace_route,
    estimate_metrics,
)

load_dotenv(".env-valhalla")
to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform

path = Path("data/processed/geojson/ruta-amarilla-centro.geojson")
coords = list(
    next(f for f in json.loads(path.read_text())["features"] if f["properties"]["direction"] == "vuelta")[
        "geometry"
    ]["coordinates"]
)

segments = decompose_coords(coords)
print(f"vuelta pts={len(coords)} segments={len(segments)}")
for i, seg in enumerate(segments):
    print(f" seg{i}: pts={len(seg)} len={coords_length_m(seg):.0f}m start={seg[0]} end={seg[-1]}")

for i, seg in enumerate(segments):
    matched, meta = valhalla_trace_route(seg)
    m = estimate_metrics(seg, matched)
    print(f" seg{i} matched: pts={len(matched)} len={coords_length_m(matched):.0f}m metrics={m}")

# try reversed loop
loop = segments[0]
rev = list(reversed(loop))
matched, _ = valhalla_trace_route(rev)
print(f" loop reversed: avg={estimate_metrics(rev, matched)}")