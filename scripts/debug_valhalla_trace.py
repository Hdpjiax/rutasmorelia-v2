"""Prueba trace_route con distintas estrategias de shape."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pyproj
import requests
from dotenv import load_dotenv
from shapely.geometry import shape
from shapely.ops import transform

load_dotenv(".env-valhalla")

VALHALLA_URL = os.getenv("VALHALLA_URL", "http://127.0.0.1:8002").rstrip("/")
wgs84 = pyproj.CRS("EPSG:4326")
mexico_lcc = pyproj.CRS("EPSG:6372")
to_m = pyproj.Transformer.from_crs(wgs84, mexico_lcc, always_xy=True).transform


def decode_polyline6(encoded: str) -> list[tuple[float, float]]:
    coords = []
    index = 0
    lat = lng = 0
    while index < len(encoded):
        for _ in range(2):
            shift = result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if not (b & 0x20):
                    break
            delta = ~(result >> 1) if (result & 1) else (result >> 1)
            if _ == 0:
                lat += delta
            else:
                lng += delta
        coords.append((lng / 1e6, lat / 1e6))
    return coords


def get_coords(res: dict) -> list[tuple[float, float]]:
    coords = []
    for leg in res.get("trip", {}).get("legs", []):
        shape_str = leg.get("shape", "")
        if shape_str:
            coords.extend(decode_polyline6(shape_str))
    out = []
    for c in coords:
        if not out or c != out[-1]:
            out.append(c)
    return out


def sample(coords: list, max_pts: int = 200) -> list:
    if len(coords) <= max_pts:
        return coords
    step = max(1, len(coords) // max_pts)
    s = coords[::step]
    if s[-1] != coords[-1]:
        s.append(coords[-1])
    return s


def trace(coords: list, break_every: int, search_radius: int) -> dict:
    sampled = sample(coords)
    shape = []
    for i, c in enumerate(sampled):
        is_break = i == 0 or i == len(sampled) - 1 or (break_every > 0 and i % break_every == 0)
        shape.append({"lon": c[0], "lat": c[1], "type": "break" if is_break else "through"})
    body = {
        "shape": shape,
        "costing": "auto",
        "shape_match": "map_snap",
        "trace_options": {"search_radius": search_radius, "gps_accuracy": 8},
    }
    r = requests.post(f"{VALHALLA_URL}/trace_route", json=body, timeout=120)
    r.raise_for_status()
    return r.json()


def main() -> None:
    route_id = sys.argv[1] if len(sys.argv) > 1 else "ruta-amarilla-centro"
    direction = sys.argv[2] if len(sys.argv) > 2 else "ida"
    path = Path(f"data/processed/geojson/{route_id}.geojson")
    feats = json.loads(path.read_text())["features"]
    geom = next(f for f in feats if f["properties"]["direction"] == direction)["geometry"]
    coords = shape(geom).coords
    orig_len = transform(to_m, shape(geom)).length
    print(f"{route_id} {direction}: orig_pts={len(coords)} orig_len={orig_len:.0f}m")

    for break_every, radius in [(0, 40), (10, 40), (20, 80), (30, 100), (15, 150)]:
        try:
            res = trace(list(coords), break_every, radius)
            matched = get_coords(res)
            mlen = transform(to_m, shape({"type": "LineString", "coordinates": matched})).length if len(matched) >= 2 else 0
            pct = 100 * mlen / orig_len if orig_len else 0
            print(f"  break_every={break_every} radius={radius}: pts={len(matched)} len={mlen:.0f}m ({pct:.0f}%)")
        except Exception as e:
            print(f"  break_every={break_every} radius={radius}: ERROR {e}")


if __name__ == "__main__":
    main()