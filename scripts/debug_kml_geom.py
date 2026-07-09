"""Inspecciona geometrías crudas de un KML."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pyproj
from shapely.geometry import shape
from shapely.ops import linemerge, transform, unary_union

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform


def inspect(source: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "raw.geojson"
        subprocess.run(
            ["ogr2ogr", "-f", "GeoJSON", str(out), source, "-t_srs", "EPSG:4326", "-dim", "2"],
            check=True,
        )
        raw = json.loads(out.read_text(encoding="utf-8"))

    for i, feat in enumerate(raw["features"]):
        g = feat["geometry"]
        print(f"feature {i}: type={g['type']}")
        if g["type"] == "MultiLineString":
            parts = []
            for j, part in enumerate(g["coordinates"]):
                ls = shape({"type": "LineString", "coordinates": part})
                print(f"  part{j}: pts={len(part)} len_m={transform(to_m, ls).length:.0f}")
                parts.append(ls)
            merged = linemerge(unary_union(parts))
            print(f"  linemerge -> {merged.geom_type} len_m={transform(to_m, merged).length:.0f}")
        else:
            ls = shape(g)
            print(f"  pts={len(g['coordinates'])} len_m={transform(to_m, ls).length:.0f}")


if __name__ == "__main__":
    inspect(sys.argv[1])