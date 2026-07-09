"""Calcula bbox de todas las rutas fuente para ampliar OSM."""
from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import unary_union

coords = []
for p in Path("data/processed/geojson").glob("*.geojson"):
    d = json.loads(p.read_text(encoding="utf-8"))
    for f in d.get("features", []):
        g = shape(f.get("geometry", {}))
        if not g.is_empty:
            coords.append(g)

u = unary_union(coords)
minx, miny, maxx, maxy = u.bounds
pad = 0.15
print(f"BBOX={minx-pad},{miny-pad},{maxx+pad},{maxy+pad}")
print(f"width={maxx-minx:.3f} height={maxy-miny:.3f}")