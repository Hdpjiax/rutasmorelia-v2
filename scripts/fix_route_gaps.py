"""Repara saltos en geometría matched usando Valhalla /route con waypoints de la fuente."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pyproj
import requests
from dotenv import load_dotenv
from shapely.geometry import LineString, Point, mapping, shape
from shapely.ops import transform

load_dotenv(".env-valhalla")
if os.name != "nt":
    for key, val in list(os.environ.items()):
        if val.startswith("d:/") or val.startswith("D:/"):
            os.environ[key] = val.replace("d:/", "/mnt/d/").replace("D:/", "/mnt/d/")

VALHALLA_URL = os.getenv("VALHALLA_URL", "http://127.0.0.1:8002").rstrip("/")
GEOJSON_DIR = Path(os.getenv("PROCESSED_DIR", "data/processed")) / "geojson"
MATCHED_DIR = Path(os.getenv("PROCESSED_DIR", "data/processed")) / "matched"
_to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform


def decode_polyline6(encoded: str) -> list[tuple[float, float]]:
    coords, index, lat, lng = [], 0, 0, 0
    while index < len(encoded):
        for is_lng in (False, True):
            shift = result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if not (b & 0x20):
                    break
            delta = ~(result >> 1) if (result & 1) else (result >> 1)
            if is_lng:
                lng += delta
            else:
                lat += delta
        coords.append((lng / 1e6, lat / 1e6))
    return coords


def valhalla_route(waypoints: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if len(waypoints) < 2:
        return waypoints
    body = {
        "locations": [{"lon": c[0], "lat": c[1]} for c in waypoints],
        "costing": "auto",
        "directions_options": {"units": "kilometers"},
    }
    r = requests.post(f"{VALHALLA_URL}/route", json=body, timeout=120)
    r.raise_for_status()
    out = []
    for leg in r.json().get("trip", {}).get("legs", []):
        if leg.get("shape"):
            out.extend(decode_polyline6(leg["shape"]))
    dedup = []
    for c in out:
        if not dedup or c != dedup[-1]:
            dedup.append(c)
    return dedup


def gap_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    return transform(_to_m, Point(a)).distance(transform(_to_m, Point(b)))


def nearest_index(point: tuple[float, float], coords: list) -> int:
    p = transform(_to_m, Point(point))
    best_i, best_d = 0, 1e18
    for i, c in enumerate(coords):
        d = p.distance(transform(_to_m, Point(c)))
        if d < best_d:
            best_d, best_i = d, i
    return best_i


def sample_between(coords: list, i0: int, i1: int, max_pts: int = 8) -> list[tuple[float, float]]:
    if i0 > i1:
        i0, i1 = i1, i0
    seg = coords[i0 : i1 + 1]
    if len(seg) <= max_pts:
        return [(c[0], c[1]) for c in seg]
    step = max(1, len(seg) // (max_pts - 1))
    pts = [(seg[i][0], seg[i][1]) for i in range(0, len(seg), step)]
    if pts[-1] != (seg[-1][0], seg[-1][1]):
        pts.append((seg[-1][0], seg[-1][1]))
    return pts


def repair_line(
    matched: list[tuple[float, float]],
    source: list[tuple[float, float]],
    max_gap: float = 80.0,
) -> list[tuple[float, float]]:
    if len(matched) < 2:
        return matched
    repaired = [matched[0]]
    for i in range(1, len(matched)):
        prev = repaired[-1]
        cur = matched[i]
        g = gap_m(prev, cur)
        if g > max_gap:
            i0 = nearest_index(prev, source)
            i1 = nearest_index(cur, source)
            wps = sample_between(source, i0, i1, max_pts=10)
            if wps[0] != prev:
                wps = [prev, *wps]
            if wps[-1] != cur:
                wps.append(cur)
            try:
                bridge = valhalla_route(wps)
                if len(bridge) >= 2:
                    if bridge[0] == repaired[-1]:
                        bridge = bridge[1:]
                    repaired.extend(bridge)
                    if repaired[-1] == cur:
                        continue
            except Exception:
                pass
        if repaired[-1] != cur:
            repaired.append(cur)
    return repaired


def fix_route(route_id: str) -> None:
    src_path = GEOJSON_DIR / f"{route_id}.geojson"
    match_path = MATCHED_DIR / f"{route_id}.geojson"
    if not match_path.exists():
        print(f"[skip] {route_id}: sin matched")
        return
    src = json.loads(src_path.read_text(encoding="utf-8"))
    matched = json.loads(match_path.read_text(encoding="utf-8"))
    src_by_dir = {
        f["properties"]["direction"]: list(shape(f["geometry"]).coords) for f in src["features"]
    }
    for feat in matched["features"]:
        direction = feat["properties"]["direction"]
        coords = list(shape(feat["geometry"]).coords)
        source = src_by_dir.get(direction, [])
        fixed = repair_line([(c[0], c[1]) for c in coords], [(c[0], c[1]) for c in source])
        feat["geometry"] = {"type": "LineString", "coordinates": fixed}
    match_path.write_text(json.dumps(matched, ensure_ascii=False), encoding="utf-8")
    print(f"[ok] gaps repaired: {route_id}")


if __name__ == "__main__":
    ids = sys.argv[1:] or []
    for rid in ids:
        fix_route(rid)