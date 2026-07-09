"""Compara tramo periférico ida vs vuelta."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pyproj
from shapely.geometry import LineString, Point
from shapely.ops import transform, unary_union

to_m = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True).transform

ROUTE_ID = sys.argv[1]
KIND = sys.argv[2] if len(sys.argv) > 2 else "matched"


def load(d: str) -> LineString:
    p = Path(f"data/processed/{KIND}/{ROUTE_ID}.geojson") if KIND != "public" else Path(f"public/routes/{ROUTE_ID}.geojson")
    data = json.loads(p.read_text(encoding="utf-8"))
    f = next(x for x in data["features"] if x["properties"]["direction"] == d)
    return LineString([(c[0], c[1]) for c in f["geometry"]["coordinates"]])


def peri_buf():
    peri = json.loads(Path("public/data/periferico-republica.geojson").read_text(encoding="utf-8"))
    return transform(to_m, unary_union([LineString(f["geometry"]["coordinates"]) for f in peri["features"]])).buffer(55)


def peri_indices(line: LineString, buf) -> list[int]:
    out = []
    for i, c in enumerate(line.coords):
        if buf.contains(transform(to_m, Point(c))):
            out.append(i)
    return out


def main() -> None:
    buf = peri_buf()
    ida, vuelta = load("ida"), load("vuelta")
    ii, vi = peri_indices(ida, buf), peri_indices(vuelta, buf)
    print(f"{ROUTE_ID} ({KIND})")
    print(f"  ida peri: idx {ii[0]}-{ii[-1]} ({len(ii)} pts) len={_seg_len(ida, ii):.0f}m")
    print(f"  vuelta peri: idx {vi[0]}-{vi[-1]} ({len(vi)} pts) len={_seg_len(vuelta, vi):.0f}m")
    if ii and vi:
        sub_i = LineString([ida.coords[i] for i in range(ii[0], ii[-1] + 1)])
        sub_v = LineString([vuelta.coords[i] for i in range(vi[0], vi[-1] + 1)])
        hd = transform(to_m, sub_i).hausdorff_distance(transform(to_m, sub_v))
        print(f"  hausdorff ida/vuelta peri: {hd:.0f}m")


def _seg_len(line: LineString, idx: list[int]) -> float:
    if not idx:
        return 0.0
    return transform(to_m, LineString([line.coords[i] for i in range(idx[0], idx[-1] + 1)])).length


if __name__ == "__main__":
    main()