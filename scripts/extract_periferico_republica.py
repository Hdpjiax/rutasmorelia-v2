#!/usr/bin/env python3
"""Extrae Periférico República de OSM (Overpass) a GeoJSON público."""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "periferico-republica.geojson"

OVERPASS = "https://overpass-api.de/api/interpreter"

QUERY = """
[out:json][timeout:180];
(
  way["name"~"Perif",i]["name"~"Rep",i](19.55,-101.35,19.85,-101.05);
  way["name"~"Periferico",i]["name"~"Republica",i](19.55,-101.35,19.85,-101.05);
  way["name"~"Perif",i]["highway"~"trunk|primary|motorway"](19.55,-101.35,19.85,-101.05);
);
out geom;
"""

NAME_PATTERNS = [
    re.compile(r"perif", re.I),
    re.compile(r"rep[uú]blica", re.I),
]


def matches_periferico(name: str | None) -> bool:
    if not name:
        return False
    n = name.strip()
    if not NAME_PATTERNS[0].search(n):
        return False
    return NAME_PATTERNS[1].search(n) is not None or "republica" in n.lower()


def way_to_feature(el: dict) -> dict:
    coords = [[pt["lon"], pt["lat"]] for pt in el.get("geometry", [])]
    tags = el.get("tags", {})
    return {
        "type": "Feature",
        "properties": {
            "name": tags.get("name", "Periférico República"),
            "highway": tags.get("highway"),
            "osm_id": el.get("id"),
        },
        "geometry": {"type": "LineString", "coordinates": coords},
    }


def main() -> int:
    body = urllib.parse.urlencode({"data": QUERY}).encode("utf-8")
    req = urllib.request.Request(
        OVERPASS,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "rutas-morelia/1.0"},
    )
    with urllib.request.urlopen(req, timeout=200) as resp:
        data = json.load(resp)

    features = []
    for el in data.get("elements", []):
        if el.get("type") != "way":
            continue
        name = el.get("tags", {}).get("name")
        if not matches_periferico(name):
            continue
        if len(el.get("geometry", [])) < 2:
            continue
        features.append(way_to_feature(el))

    if not features:
        print("No se encontraron segmentos de Periférico República en Overpass", file=sys.stderr)
        return 1

    geojson = {"type": "FeatureCollection", "features": features}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(geojson, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado {len(features)} segmentos en {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())