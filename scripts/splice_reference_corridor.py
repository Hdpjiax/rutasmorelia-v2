"""
En zonas compartidas (periférico + centro), alinea una ruta con la geometría
aprobada de una ruta referencia (p. ej. Alberca Gertrudis).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point, box
from shapely.ops import transform, unary_union

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform
to_wgs = pyproj.Transformer.from_crs("EPSG:6372", "EPSG:4326", always_xy=True).transform

CENTRO = box(-101.205, 19.688, -101.175, 19.715)
PERI_BUFFER_M = 55.0
REF_PATH = Path("public/routes")
OUT_DIR = Path("data/processed/geojson")


def load_route(path: Path) -> dict[str, LineString]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        f["properties"]["direction"]: LineString([(c[0], c[1]) for c in f["geometry"]["coordinates"]])
        for f in data["features"]
    }


def shared_zone() -> object:
    peri = json.loads(Path("public/data/periferico-republica.geojson").read_text(encoding="utf-8"))
    lines = [LineString(f["geometry"]["coordinates"]) for f in peri["features"]]
    peri_m = transform(to_m, unary_union(lines)).buffer(PERI_BUFFER_M)
    centro_m = transform(to_m, CENTRO)
    return peri_m.union(centro_m)


def in_zone(lon: float, lat: float, zone_m) -> bool:
    return zone_m.contains(transform(to_m, Point(lon, lat)))


def dist_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    return transform(to_m, Point(a)).distance(transform(to_m, Point(b)))


def line_to_coords(line: LineString) -> list[tuple[float, float]]:
    return [(c[0], c[1]) for c in line.coords]


def append_coords(base: list[tuple[float, float]], extra: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not extra:
        return base
    if base and extra[0] == base[-1]:
        extra = extra[1:]
    base.extend(extra)
    return base


def dedupe_coords(coords: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for c in coords:
        if not out or c != out[-1]:
            out.append(c)
    return out


def orientations(line: LineString) -> list[tuple[str, LineString]]:
    coords = line_to_coords(line)
    opts: list[tuple[str, LineString]] = [( "as_is", line)]
    rev = LineString(list(reversed(coords)))
    if line_to_coords(rev)[0] != coords[0]:
        opts.append(("reversed", rev))
    return opts


def avg_zone_distance(target_coords: list[tuple[float, float]], ref: LineString, zone_m) -> float:
    rm = transform(to_m, ref)
    zone_pts = [c for c in target_coords if in_zone(c[0], c[1], zone_m)]
    if len(zone_pts) < 2:
        return 1e18
    return sum(transform(to_m, Point(c)).distance(rm) for c in zone_pts) / len(zone_pts)


def pick_reference(
    target: LineString,
    refs: dict[str, LineString],
    zone_m,
    direction: str,
) -> tuple[str, LineString]:
    tcoords = line_to_coords(target)
    anchor = tcoords[0] if direction == "ida" else tcoords[-1]
    best_label = "ida:as_is"
    best_line = refs["ida"]
    best_score = 1e18
    for rd, rline in refs.items():
        for label, oriented in orientations(rline):
            rcoords = line_to_coords(oriented)
            anchor_ref = rcoords[0] if direction == "ida" else rcoords[-1]
            anchor_penalty = dist_m(anchor, anchor_ref)
            zone_dist = avg_zone_distance(tcoords, oriented, zone_m)
            score = anchor_penalty * 3.0 + zone_dist
            tag = f"{rd}:{label}"
            if score < best_score:
                best_score, best_label, best_line = score, tag, oriented
    return best_label, best_line


def project_pos(line_m: LineString, point: tuple[float, float]) -> float:
    return line_m.project(transform(to_m, Point(point)))


def extract_between(line: LineString, entry: tuple[float, float], exit_: tuple[float, float]) -> list[tuple[float, float]]:
    lm = transform(to_m, line)
    p0 = project_pos(line, entry)
    p1 = project_pos(line, exit_)
    if p0 > p1:
        p0, p1 = p1, p0
        rev_slice = True
    else:
        rev_slice = False
    if abs(p1 - p0) < 1.0:
        return [entry, exit_]
    sub_m = _substring(lm, p0, p1)
    sub_wgs = transform(to_wgs, sub_m)
    coords = line_to_coords(sub_wgs)
    if rev_slice:
        coords = list(reversed(coords))
    return coords


def _substring(line_m: LineString, start: float, end: float) -> LineString:
    coords = list(line_m.coords)
    if len(coords) < 2:
        return line_m
    acc = [0.0]
    for i in range(1, len(coords)):
        a = Point(coords[i - 1])
        b = Point(coords[i])
        acc.append(acc[-1] + a.distance(b))
    total = acc[-1]
    start = max(0.0, min(start, total))
    end = max(start, min(end, total))

    def interp(pos: float) -> tuple[float, float]:
        if pos <= 0:
            return coords[0]
        if pos >= total:
            return coords[-1]
        for i in range(1, len(acc)):
            if acc[i] >= pos:
                t = (pos - acc[i - 1]) / max(acc[i] - acc[i - 1], 1e-9)
                x0, y0 = coords[i - 1]
                x1, y1 = coords[i]
                return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
        return coords[-1]

    pts = [interp(start)]
    for i, d in enumerate(acc):
        if start < d < end:
            pts.append(coords[i])
    pts.append(interp(end))
    out: list[tuple[float, float]] = []
    for p in pts:
        if not out or (abs(p[0] - out[-1][0]) > 1e-9 or abs(p[1] - out[-1][1]) > 1e-9):
            out.append(p)
    return LineString(out)


def splice_direction(
    target: LineString,
    reference: LineString,
    zone_m,
) -> tuple[list[tuple[float, float]], int]:
    coords = line_to_coords(target)
    out: list[tuple[float, float]] = []
    replacements = 0
    i = 0
    while i < len(coords):
        c = coords[i]
        if not in_zone(c[0], c[1], zone_m):
            out.append(c)
            i += 1
            continue
        start = i
        while i < len(coords) and in_zone(coords[i][0], coords[i][1], zone_m):
            i += 1
        end = i - 1
        entry = out[-1] if out else coords[start]
        exit_ = coords[i] if i < len(coords) else coords[end]
        ref_seg = extract_between(reference, entry, exit_)
        if len(ref_seg) >= 2 and dist_m(ref_seg[0], entry) < 500 and dist_m(ref_seg[-1], exit_) < 500:
            replacements += 1
            out = append_coords(out, ref_seg)
        else:
            out = append_coords(out, coords[start : end + 1])
    return dedupe_coords(out), replacements


def main() -> None:
    target_id = sys.argv[1] if len(sys.argv) > 1 else os.getenv("ONLY_ROUTES", "ruta-alberca-metropolis")
    ref_id = sys.argv[2] if len(sys.argv) > 2 else "ruta-alberca-gertrudis"
    target_path = OUT_DIR / f"{target_id}.geojson"
    ref_path = REF_PATH / f"{ref_id}.geojson"
    if not target_path.exists() or not ref_path.exists():
        raise SystemExit(f"Faltan archivos: {target_path} / {ref_path}")

    zone_m = shared_zone()
    target = load_route(target_path)
    refs = load_route(ref_path)
    data = json.loads(target_path.read_text(encoding="utf-8"))
    total = 0

    for feat in data["features"]:
        direction = feat["properties"]["direction"]
        ref_label, ref_line = pick_reference(target[direction], refs, zone_m, direction)
        print(f"{target_id} {direction}: referencia {ref_id} ({ref_label})")
        fixed, n = splice_direction(target[direction], ref_line, zone_m)
        total += n
        feat["geometry"]["coordinates"] = [[c[0], c[1]] for c in fixed]
        feat["properties"]["splicedFrom"] = ref_id
        feat["properties"]["spliceRef"] = ref_label

    target_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado {target_path} ({total} tramos empalmados)")


if __name__ == "__main__":
    main()