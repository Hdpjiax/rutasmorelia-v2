#!/usr/bin/env python3
"""Extrae Circuito Periférico Paseo de la República desde PBF local."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PBF = ROOT / "data" / "osm" / "morelia-region.osm.pbf"
OUT = ROOT / "public" / "data" / "periferico-republica.geojson"

SECTOR_RE = re.compile(r"^perif[eé]rico\b", re.I)
RING_RE = re.compile(
    r"perif[eé]rico.*(rep[uú]blica|paseo\s+de\s+la\s+rep)|"
    r"circuito\s+perif[eé]rico.*rep|"
    r"paseo\s+de\s+la\s+rep[uú]blica",
    re.I,
)


def is_periferico_republica(name: str, alt_name: str) -> bool:
    combined = f"{name} {alt_name}".strip()
    if not combined:
        return False
    if RING_RE.search(combined):
        return True
    if "circuito perif" in alt_name.lower() and "rep" in alt_name.lower():
        return True
    if SECTOR_RE.match(name.strip()) and "circuito perif" in alt_name.lower():
        return True
    if name.strip().lower() == "circuito periférico paseo de la república":
        return True
    if name.strip().lower() == "circuito periferico paseo de la republica":
        return True
    return False


def export_geojsonseq(pbf: Path) -> str:
    proc = subprocess.run(
        [
            "osmium",
            "export",
            str(pbf),
            "-f",
            "geojsonseq",
            "--geometry-types=linestring",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout or "osmium export failed")
    return proc.stdout


def main() -> int:
    if not PBF.exists():
        print(f"Falta {PBF}. Ejecuta expand_osm_michoacan_wsl.sh", file=sys.stderr)
        return 1

    try:
        raw = export_geojsonseq(PBF)
    except RuntimeError as e:
        print(e, file=sys.stderr)
        return 1

    features: list[dict] = []
    seen: set[tuple] = set()

    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        feat = json.loads(line)
        geom = feat.get("geometry") or {}
        if geom.get("type") != "LineString":
            continue
        props = feat.get("properties") or {}
        name = str(props.get("name") or "")
        alt_name = str(props.get("alt_name") or "")
        if not is_periferico_republica(name, alt_name):
            continue
        coords = tuple(tuple(c) for c in geom.get("coordinates", []))
        if len(coords) < 2:
            continue
        key = (name, alt_name, coords[0], coords[-1])
        if key in seen:
            continue
        seen.add(key)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": name or "Periférico República",
                    "alt_name": alt_name,
                    "highway": props.get("highway"),
                    "oneway": props.get("oneway"),
                },
                "geometry": {"type": "LineString", "coordinates": [list(c) for c in coords]},
            }
        )

    if not features:
        print("No se encontraron segmentos del periférico en el PBF", file=sys.stderr)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Guardado {len(features)} segmentos en {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())