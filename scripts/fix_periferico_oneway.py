"""
Corrige tramos de ruta que van contra el sentido legal (oneway) en Periférico República.
Proyecta bloques conflictivos al carril paralelo OSM con sentido compatible.
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point
from shapely.ops import transform, nearest_points

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform
to_wgs = pyproj.Transformer.from_crs("EPSG:6372", "EPSG:4326", always_xy=True).transform

PERI_PATH = Path("public/data/periferico-republica.geojson")
BUFFER_M = 55.0
MIN_BLOCK_EDGES = 3
MAX_BEARING_DIFF_OK = 50.0


def bearing_metric(a: tuple[float, float], b: tuple[float, float]) -> float:
    ax, ay = a
    bx, by = b
    return math.degrees(math.atan2(bx - ax, by - ay)) % 360


def angle_diff(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


def local_bearing(line_m: LineString, point_m: Point) -> float:
    coords = list(line_m.coords)
    if len(coords) < 2:
        return 0.0
    best_i, best_d = 0, 1e18
    for i, c in enumerate(coords):
        d = math.hypot(c[0] - point_m.x, c[1] - point_m.y)
        if d < best_d:
            best_d, best_i = d, i
    i0 = max(0, best_i - 1)
    i1 = min(len(coords) - 1, best_i + 1)
    if i0 == i1 and best_i > 0:
        i0 = best_i - 1
    elif i0 == i1 and best_i < len(coords) - 1:
        i1 = best_i + 1
    return bearing_metric(coords[i0], coords[i1])


class PeriSegment:
    __slots__ = ("idx", "name", "oneway", "line_wgs", "line_m")

    def __init__(self, idx: int, name: str | None, oneway: str | None, line_wgs: LineString):
        self.idx = idx
        self.name = name or ""
        self.oneway = oneway
        self.line_wgs = line_wgs
        self.line_m = transform(to_m, line_wgs)


def load_peri_segments() -> list[PeriSegment]:
    data = json.loads(PERI_PATH.read_text(encoding="utf-8"))
    out: list[PeriSegment] = []
    for i, feat in enumerate(data.get("features", [])):
        geom = feat.get("geometry")
        if not geom or geom.get("type") != "LineString":
            continue
        props = feat.get("properties", {})
        out.append(
            PeriSegment(
                i,
                props.get("name"),
                props.get("oneway"),
                LineString(geom["coordinates"]),
            )
        )
    return out


def nearest_peri(
    point_wgs: tuple[float, float],
    segments: list[PeriSegment],
) -> tuple[PeriSegment | None, float]:
    p_m = transform(to_m, Point(point_wgs))
    best: PeriSegment | None = None
    best_d = 1e18
    for seg in segments:
        d = p_m.distance(seg.line_m)
        if d < best_d:
            best_d, best = d, seg
    return best, best_d


def edge_wrong_way(
    a: tuple[float, float],
    b: tuple[float, float],
    segments: list[PeriSegment],
) -> tuple[bool, PeriSegment | None]:
    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    seg, dist = nearest_peri(mid, segments)
    if seg is None or dist > BUFFER_M:
        return False, None
    ap = transform(to_m, Point(a))
    bp = transform(to_m, Point(b))
    travel = bearing_metric((ap.x, ap.y), (bp.x, bp.y))
    p_mid_m = transform(to_m, Point(mid))
    seg_br = local_bearing(seg.line_m, p_mid_m)
    diff_fwd = angle_diff(travel, seg_br)
    diff_rev = angle_diff(travel, (seg_br + 180) % 360)
    if seg.oneway == "yes":
        return diff_fwd > diff_rev and diff_fwd > MAX_BEARING_DIFF_OK, seg
    return False, seg


def find_aligned_segment(
    point_wgs: tuple[float, float],
    travel_bearing: float,
    segments: list[PeriSegment],
    exclude_idx: int | None = None,
) -> PeriSegment | None:
    p_m = transform(to_m, Point(point_wgs))
    best: PeriSegment | None = None
    best_score = 1e18
    for seg in segments:
        if exclude_idx is not None and seg.idx == exclude_idx:
            continue
        dist = p_m.distance(seg.line_m)
        if dist > BUFFER_M:
            continue
        seg_br = local_bearing(seg.line_m, nearest_points(p_m, seg.line_m)[1])
        diff = angle_diff(travel_bearing, seg_br)
        if seg.oneway == "yes" and diff > MAX_BEARING_DIFF_OK:
            continue
        score = dist + diff * 2.0
        if score < best_score:
            best_score, best = score, seg
    return best


def project_to_segment(
    point_wgs: tuple[float, float],
    seg: PeriSegment,
) -> tuple[float, float]:
    p_wgs = Point(point_wgs)
    p_m = transform(to_m, p_wgs)
    snapped_m = nearest_points(p_m, seg.line_m)[1]
    snapped_wgs = transform(to_wgs, snapped_m)
    return (snapped_wgs.x, snapped_wgs.y)


def line_position(seg_m: LineString, point_m: Point) -> float:
    return seg_m.project(point_m)


def find_wrong_blocks(
    coords: list[tuple[float, float]],
    segments: list[PeriSegment],
) -> list[tuple[int, int, PeriSegment | None]]:
    wrong_edges: list[tuple[bool, PeriSegment | None]] = []
    for i in range(len(coords) - 1):
        bad, seg = edge_wrong_way(coords[i], coords[i + 1], segments)
        wrong_edges.append((bad, seg))
    blocks: list[tuple[int, int, PeriSegment | None]] = []
    start: int | None = None
    bad_seg: PeriSegment | None = None
    for i, (bad, seg) in enumerate(wrong_edges):
        if bad and start is None:
            start = i
            bad_seg = seg
        elif not bad and start is not None:
            if i - start + 1 >= MIN_BLOCK_EDGES:
                blocks.append((start, i + 1, bad_seg))
            start = None
            bad_seg = None
    if start is not None and len(wrong_edges) - start >= MIN_BLOCK_EDGES:
        blocks.append((start, len(coords) - 1, bad_seg))
    return blocks


def merge_overlapping(
    blocks: list[tuple[int, int, PeriSegment | None]],
) -> list[tuple[int, int, PeriSegment | None]]:
    if not blocks:
        return []
    blocks = sorted(blocks)
    merged = [blocks[0]]
    for s, e, seg in blocks[1:]:
        ps, pe, pseg = merged[-1]
        if s <= pe + 2:
            merged[-1] = (ps, max(pe, e), pseg or seg)
        else:
            merged.append((s, e, seg))
    return merged


def snap_block_to_legal_carriageway(
    coords: list[tuple[float, float]],
    start: int,
    end: int,
    bad_seg: PeriSegment | None,
    segments: list[PeriSegment],
) -> list[tuple[float, float]]:
    block = coords[start : end + 1]
    if len(block) < 2:
        return block
    ap = transform(to_m, Point(block[0]))
    bp = transform(to_m, Point(block[-1]))
    travel = bearing_metric((ap.x, ap.y), (bp.x, bp.y))
    mid = block[len(block) // 2]
    aligned = find_aligned_segment(mid, travel, segments, exclude_idx=bad_seg.idx if bad_seg else None)
    if aligned is None:
        aligned = find_aligned_segment(mid, travel, segments)
    if aligned is None:
        print(f"    sin carril alternativo para bloque {start}-{end}")
        return block

    seg_m = aligned.line_m
    projected: list[tuple[float, float, float]] = []
    for pt in block:
        snapped = project_to_segment(pt, aligned)
        pos = line_position(seg_m, transform(to_m, Point(snapped)))
        projected.append((pos, snapped[0], snapped[1]))

    projected.sort(key=lambda x: x[0])
    out = [(lon, lat) for _, lon, lat in projected]
    if out[0] != block[0]:
        out[0] = block[0]
    if out[-1] != block[-1]:
        out[-1] = block[-1]
    return out


def dedupe_coords(coords: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for c in coords:
        if not out or c != out[-1]:
            out.append(c)
    return out


def fix_coords(
    coords: list[tuple[float, float]],
    segments: list[PeriSegment],
    direction: str,
) -> tuple[list[tuple[float, float]], int]:
    blocks = merge_overlapping(find_wrong_blocks(coords, segments))
    if not blocks:
        print(f"  {direction}: sin bloques contra sentido")
        return coords, 0

    print(f"  {direction}: {len(blocks)} bloque(s) contra sentido")
    fixed = list(coords)
    fixes = 0
    for start, end, bad_seg in blocks:
        print(f"    bloque idx {start}-{end} ({end - start + 1} pts)")
        replacement = snap_block_to_legal_carriageway(fixed, start, end, bad_seg, segments)
        if replacement != fixed[start : end + 1]:
            fixes += 1
            fixed = fixed[:start] + replacement + fixed[end + 1 :]

    remaining = sum(
        1 for i in range(len(fixed) - 1) if edge_wrong_way(fixed[i], fixed[i + 1], segments)[0]
    )
    if remaining:
        print(f"  {direction}: quedan {remaining} arista(s) contra sentido (se corrigen en map-match)")
    return dedupe_coords(fixed), fixes


def main() -> None:
    route_id = sys.argv[1] if len(sys.argv) > 1 else os.getenv("ONLY_ROUTES", "ruta-alberca-metropolis")
    path = Path(f"data/processed/geojson/{route_id}.geojson")
    if not path.exists():
        raise SystemExit(f"No existe {path}")

    segments = load_peri_segments()
    data = json.loads(path.read_text(encoding="utf-8"))
    total_fixes = 0

    for feat in data["features"]:
        direction = feat["properties"].get("direction", "?")
        coords = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]
        print(f"\n{route_id} {direction}: {len(coords)} pts")
        fixed, n = fix_coords(coords, segments, direction)
        total_fixes += n
        feat["geometry"]["coordinates"] = [[c[0], c[1]] for c in fixed]
        feat["properties"]["perifericoOnewayFix"] = n

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nGuardado {path} ({total_fixes} bloque(s) corregidos)")


if __name__ == "__main__":
    main()