"""
Empalma un sentido con el corredor del sentido opuesto de la misma ruta
(p. ej. vuelta en periférico debe seguir el trazo de ida).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point, box
from shapely.ops import transform, unary_union

# Reutilizar utilidades del empalme por ruta referencia
from splice_reference_corridor import (  # type: ignore
    dedupe_coords,
    dist_m,
    extract_between,
    in_zone,
    line_to_coords,
)

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform
to_wgs = pyproj.Transformer.from_crs("EPSG:6372", "EPSG:4326", always_xy=True).transform

OUT_DIR = Path("data/processed/geojson")
LA_HUERTA_BOX = box(-101.245, 19.645, -101.165, 19.725)


def extended_zone():
    peri = json.loads(Path("public/data/periferico-republica.geojson").read_text(encoding="utf-8"))
    peri_m = transform(to_m, unary_union([LineString(f["geometry"]["coordinates"]) for f in peri["features"]])).buffer(
        55
    )
    huerta_m = transform(to_m, LA_HUERTA_BOX)
    return peri_m.union(huerta_m)


def load_route(path: Path) -> dict[str, LineString]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        f["properties"]["direction"]: LineString([(c[0], c[1]) for c in f["geometry"]["coordinates"]])
        for f in data["features"]
    }


def pick_oriented_reference(
    target: LineString,
    ref_line: LineString,
    direction: str,
) -> LineString:
    opts: list[tuple[float, LineString]] = []
    for label, oriented in [("as_is", ref_line), ("reversed", LineString(list(reversed(line_to_coords(ref_line)))))]:
        rcoords = line_to_coords(oriented)
        anchor = line_to_coords(target)[0] if direction == "ida" else line_to_coords(target)[-1]
        ref_anchor = rcoords[0] if direction == "ida" else rcoords[-1]
        opts.append((dist_m(anchor, ref_anchor), oriented))
    opts.sort(key=lambda x: x[0])
    return opts[0][1]


def merge_blocks(blocks: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if not blocks:
        return []
    blocks = sorted(blocks)
    merged = [blocks[0]]
    for s, e in blocks[1:]:
        ps, pe = merged[-1]
        if s <= pe + 2:
            merged[-1] = (ps, max(pe, e))
        else:
            merged.append((s, e))
    return merged


def find_in_zone_blocks(coords: list[tuple[float, float]], zone_m) -> list[tuple[int, int]]:
    blocks: list[tuple[int, int]] = []
    start: int | None = None
    for i, c in enumerate(coords):
        inside = in_zone(c[0], c[1], zone_m)
        if inside and start is None:
            start = i
        elif not inside and start is not None:
            if i - start >= 1:
                blocks.append((start, i - 1))
            start = None
    if start is not None:
        blocks.append((start, len(coords) - 1))
    return merge_blocks(blocks)


def splice_direction(
    target: LineString,
    reference: LineString,
    zone_m,
) -> tuple[list[tuple[float, float]], int]:
    coords = line_to_coords(target)
    blocks = find_in_zone_blocks(coords, zone_m)
    if not blocks:
        return coords, 0
    fixed = list(coords)
    fixes = 0
    for start, end in blocks:
        entry = fixed[start - 1] if start > 0 else fixed[start]
        exit_ = fixed[end + 1] if end + 1 < len(fixed) else fixed[end]
        ref_seg = extract_between(reference, entry, exit_)
        if len(ref_seg) >= 2:
            if dist_m(ref_seg[0], entry) > 2:
                ref_seg[0] = entry
            if dist_m(ref_seg[-1], exit_) > 2:
                ref_seg[-1] = exit_
            fixes += 1
            fixed = fixed[:start] + ref_seg + fixed[end + 1 :]
    return dedupe_coords(fixed), fixes


def main() -> None:
    route_id = sys.argv[1] if len(sys.argv) > 1 else os.getenv("ONLY_ROUTES", "ruta-arco-san-pedro")
    path = OUT_DIR / f"{route_id}.geojson"
    if not path.exists():
        raise SystemExit(f"No existe {path}")

    zone_m = extended_zone()
    lines = load_route(path)
    data = json.loads(path.read_text(encoding="utf-8"))
    total = 0

    only_dirs = {d.strip() for d in os.getenv("ONLY_SPLICE_DIRECTIONS", "vuelta").split(",") if d.strip()}

    for feat in data["features"]:
        direction = feat["properties"]["direction"]
        if direction not in only_dirs:
            continue
        opp = "vuelta" if direction == "ida" else "ida"
        ref = pick_oriented_reference(lines[direction], lines[opp], direction)
        print(f"{route_id} {direction}: empalme desde {opp}")
        fixed, n = splice_direction(lines[direction], ref, zone_m)
        total += n
        feat["geometry"]["coordinates"] = [[c[0], c[1]] for c in fixed]
        feat["properties"]["splicedOpposite"] = opp
        lines[direction] = LineString(fixed)

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado {path} ({total} tramos)")


if __name__ == "__main__":
    main()