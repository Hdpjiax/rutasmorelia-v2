"""Prueba matching por segmentos."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pyproj
import requests
from dotenv import load_dotenv
from shapely.geometry import LineString, shape
from shapely.ops import transform

load_dotenv(".env-valhalla")
VALHALLA_URL = os.getenv("VALHALLA_URL", "http://127.0.0.1:8002").rstrip("/")
to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform


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


def trace_segment(coords: list, radius: int = 80) -> list[tuple[float, float]]:
    shape_pts = []
    for i, c in enumerate(coords):
        is_break = i in (0, len(coords) - 1) or (len(coords) > 20 and i % 15 == 0)
        shape_pts.append({"lon": c[0], "lat": c[1], "type": "break" if is_break else "through"})
    body = {
        "shape": shape_pts,
        "costing": "auto",
        "shape_match": "map_snap",
        "trace_options": {"search_radius": radius, "gps_accuracy": 15},
    }
    r = requests.post(f"{VALHALLA_URL}/trace_route", json=body, timeout=120)
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


def chunk_coords(coords: list, chunk_size: int) -> list[list]:
    if len(coords) <= chunk_size:
        return [coords]
    chunks = []
    i = 0
    while i < len(coords) - 1:
        end = min(i + chunk_size, len(coords) - 1)
        chunks.append(coords[i : end + 1])
        i = end
    return chunks


def main() -> None:
    route_id = sys.argv[1]
    direction = sys.argv[2]
    chunk_size = int(sys.argv[3]) if len(sys.argv) > 3 else 60
    path = Path(f"data/processed/geojson/{route_id}.geojson")
    coords = list(
        next(f for f in json.loads(path.read_text())["features"] if f["properties"]["direction"] == direction)["geometry"]["coordinates"]
    )
    orig_len = transform(to_m, LineString(coords)).length
    print(f"{route_id} {direction}: pts={len(coords)} len={orig_len:.0f}m chunks={chunk_size}")

    all_matched = []
    for idx, chunk in enumerate(chunk_coords(coords, chunk_size)):
        try:
            m = trace_segment(chunk)
            if all_matched and m and m[0] == all_matched[-1]:
                m = m[1:]
            all_matched.extend(m)
            clen = transform(to_m, LineString(chunk)).length
            mlen = transform(to_m, LineString(m)).length if len(m) >= 2 else 0
            print(f"  chunk {idx}: in_pts={len(chunk)} in_len={clen:.0f} out_pts={len(m)} out_len={mlen:.0f}")
        except Exception as e:
            print(f"  chunk {idx}: FAIL {e}")

    total = transform(to_m, LineString(all_matched)).length if len(all_matched) >= 2 else 0
    print(f"TOTAL: pts={len(all_matched)} len={total:.0f}m ({100*total/orig_len:.0f}%)")


if __name__ == "__main__":
    main()