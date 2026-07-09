import json
import sys
from pathlib import Path

from strict_map_match_valhalla_osrm import coords_length_m, gap_distance_m

for rid in sys.argv[1:]:
    data = json.loads((Path("data/processed/geojson") / f"{rid}.geojson").read_text(encoding="utf-8"))
    print(rid)
    for f in data["features"]:
        d = f["properties"]["direction"]
        c = [(x[0], x[1]) for x in f["geometry"]["coordinates"]]
        mg = max(gap_distance_m(c[i - 1], c[i]) for i in range(1, len(c)))
        print(
            f"  {d}: pts={len(c)} len={coords_length_m(c)/1000:.1f}km "
            f"src_max_gap={mg:.1f}m type={f['geometry']['type']}"
        )