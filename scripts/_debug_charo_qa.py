#!/usr/bin/env python3
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from qa_validate_routes import assess_feature, decimate_coords, find_gaps, haversine_m

data = json.loads(Path("data/processed/matched/ruta-charo.geojson").read_text(encoding="utf-8"))
for i, f in enumerate(data["features"]):
    props = f["properties"]
    geom = f["geometry"]
    coords = geom["coordinates"]
    print(i, props["direction"], "pts", len(coords), "validator", props.get("validator"))
    maxg = 0.0
    maxi = 0
    for j in range(1, len(coords)):
        d = haversine_m(coords[j - 1][0], coords[j - 1][1], coords[j][0], coords[j][1])
        if d > maxg:
            maxg, maxi = d, j
    print("  raw max gap", round(maxg, 2), "at", maxi)
    if maxg > 400:
        a, b = coords[maxi - 1], coords[maxi]
        print("  points", a, b)
    dec = decimate_coords(coords, 40)
    print("  dec pts", len(dec))
    gaps = find_gaps(dec, 500)
    print("  dec gaps>500", gaps)
    issues = assess_feature(props, geom, i)
    print("  assess", issues)
