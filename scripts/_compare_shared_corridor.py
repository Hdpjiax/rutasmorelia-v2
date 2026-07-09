"""Encuentra tramos compartidos entre dos rutas Alberca."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point
from shapely.ops import transform

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform
to_wgs = pyproj.Transformer.from_crs("EPSG:6372", "EPSG:4326", always_xy=True).transform

ROUTE_A = sys.argv[1] if len(sys.argv) > 1 else "ruta-alberca-metropolis"
ROUTE_B = sys.argv[2] if len(sys.argv) > 2 else "ruta-alberca-gertrudis"
KIND = sys.argv[3] if len(sys.argv) > 3 else "public"
CORRIDOR_M = 80.0


def load_lines(route_id: str) -> dict[str, LineString]:
    p = Path(f"public/routes/{route_id}.geojson") if KIND == "public" else Path(
        f"data/processed/{KIND}/{route_id}.geojson"
    )
    data = json.loads(p.read_text(encoding="utf-8"))
    return {
        f["properties"]["direction"]: LineString([(c[0], c[1]) for c in f["geometry"]["coordinates"]])
        for f in data["features"]
    }


def nearest_dist_m(p: tuple[float, float], line: LineString) -> float:
    return transform(to_m, Point(p)).distance(transform(to_m, line))


def shared_indices(coords: list, other: LineString, max_m: float) -> list[int]:
    return [i for i, c in enumerate(coords) if nearest_dist_m(c, other) <= max_m]


def summarize(direction: str, la: LineString, lb: LineString) -> None:
    ca, cb = list(la.coords), list(lb.coords)
    # probar ambas orientaciones de B
    for label, coords_b in [("direct", cb), ("rev", list(reversed(cb)))]:
        lb2 = LineString(coords_b)
        idx_a = shared_indices(ca, lb2, CORRIDOR_M)
        idx_b = shared_indices(coords_b, la, CORRIDOR_M)
        if not idx_a:
            continue
        dists = [nearest_dist_m(ca[i], lb2) for i in idx_a]
        seg_len = 0.0
        for i in range(1, len(idx_a)):
            if idx_a[i] == idx_a[i - 1] + 1:
                a0 = transform(to_m, Point(ca[idx_a[i - 1]]))
                a1 = transform(to_m, Point(ca[idx_a[i]]))
                seg_len += a0.distance(a1)
        print(
            f"  {direction} [{label}]: shared_pts_a={len(idx_a)}/{len(ca)} "
            f"shared_len~{seg_len:.0f}m avg_dist={sum(dists)/len(dists):.1f}m "
            f"max_dist={max(dists):.1f}m span_a={idx_a[0]}-{idx_a[-1]}"
        )


def main() -> None:
    ra, rb = load_lines(ROUTE_A), load_lines(ROUTE_B)
    print(f"{ROUTE_A} vs {ROUTE_B} ({KIND}) corridor<={CORRIDOR_M}m")
    for d in ("ida", "vuelta"):
        print(f"\n{d}:")
        summarize(d, ra[d], rb[d])
        summarize(d, ra[d], rb["vuelta" if d == "ida" else "ida"])


if __name__ == "__main__":
    main()