"""Reemplaza tramo en matched usando el sentido opuesto ya aprobado."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point, box
from shapely.ops import transform, unary_union

from splice_reference_corridor import (  # type: ignore
    dedupe_coords,
    dist_m,
    extract_between,
    in_zone,
    line_to_coords,
)

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform
LA_HUERTA_BOX = box(-101.245, 19.645, -101.165, 19.725)
MATCHED = Path("data/processed/matched")


def zone_m():
    peri = json.loads(Path("public/data/periferico-republica.geojson").read_text(encoding="utf-8"))
    peri_buf = transform(to_m, unary_union([LineString(f["geometry"]["coordinates"]) for f in peri["features"]])).buffer(55)
    return peri_buf.union(transform(to_m, LA_HUERTA_BOX))


def load_lines(path: Path) -> dict[str, LineString]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        f["properties"]["direction"]: LineString([(c[0], c[1]) for c in f["geometry"]["coordinates"]])
        for f in data["features"]
    }


def find_blocks(coords: list[tuple[float, float]], zm) -> list[tuple[int, int]]:
    blocks: list[tuple[int, int]] = []
    start: int | None = None
    for i, c in enumerate(coords):
        if in_zone(c[0], c[1], zm):
            if start is None:
                start = i
        elif start is not None:
            blocks.append((start, i - 1))
            start = None
    if start is not None:
        blocks.append((start, len(coords) - 1))
    return blocks


def main() -> None:
    route_id = sys.argv[1] if len(sys.argv) > 1 else os.getenv("ONLY_ROUTES", "ruta-arco-san-pedro")
    target_dir = sys.argv[2] if len(sys.argv) > 2 else "vuelta"
    ref_dir = sys.argv[3] if len(sys.argv) > 3 else "ida"
    path = MATCHED / f"{route_id}.geojson"
    lines = load_lines(path)
    ref = LineString(list(reversed(line_to_coords(lines[ref_dir]))))
    zm = zone_m()
    coords = line_to_coords(lines[target_dir])
    blocks = find_blocks(coords, zm)
    if not blocks:
        print(f"{route_id}: sin bloques en zona")
        return
    fixed = list(coords)
    for start, end in blocks:
        entry = fixed[start - 1] if start > 0 else fixed[start]
        exit_ = fixed[end + 1] if end + 1 < len(fixed) else fixed[end]
        seg = extract_between(ref, entry, exit_)
        if len(seg) >= 2:
            if dist_m(seg[0], entry) > 2:
                seg[0] = entry
            if dist_m(seg[-1], exit_) > 2:
                seg[-1] = exit_
            fixed = fixed[:start] + seg + fixed[end + 1 :]
            print(f"  reemplazado {start}-{end} ({end-start+1} pts -> {len(seg)} pts)")
    fixed = dedupe_coords(fixed)
    data = json.loads(path.read_text(encoding="utf-8"))
    for feat in data["features"]:
        if feat["properties"]["direction"] == target_dir:
            feat["geometry"]["coordinates"] = [[c[0], c[1]] for c in fixed]
            feat["properties"]["corridorAlignedFrom"] = ref_dir
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado {path}")


if __name__ == "__main__":
    main()