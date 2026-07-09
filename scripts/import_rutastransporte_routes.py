"""
Importa rutas oficiales desde rutastransporte (KML/SHP) a GeoJSON con ida/vuelta.
Cada KML oficial trae 2 placemarks = sentido ida (0) y vuelta (1).
"""
from __future__ import annotations

import json
import math
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from shapely.geometry import LineString, MultiLineString, mapping
from shapely.ops import linemerge, transform, unary_union

import pyproj

_wgs84 = pyproj.CRS("EPSG:4326")
_metric = pyproj.CRS("EPSG:6372")
_to_metric = pyproj.Transformer.from_crs(_wgs84, _metric, always_xy=True).transform
_to_wgs84 = pyproj.Transformer.from_crs(_metric, _wgs84, always_xy=True).transform

load_dotenv(".env-valhalla")

if os.name != "nt":
    for key, val in list(os.environ.items()):
        if val.startswith("d:/") or val.startswith("D:/"):
            os.environ[key] = val.replace("d:/", "/mnt/d/").replace("D:/", "/mnt/d/")

ROOT = Path(".")
OUT = Path(os.getenv("PROCESSED_DIR", "data/processed")) / "geojson"
RAW_KML = Path(os.getenv("RAW_INPUT_DIR", "data/raw-routes")) / "kml"
MAP_FILE = ROOT / "data" / "rutastransporte-route-map.json"
OUT.mkdir(parents=True, exist_ok=True)
RAW_KML.mkdir(parents=True, exist_ok=True)

DIRECTIONS = ("ida", "vuelta")
DIRECTION_LABELS = ("Ida", "Vuelta")


def run(cmd: list[str]) -> None:
    print("$", " ".join(cmd))
    subprocess.run(cmd, check=True)


def _endpoint_dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    from shapely.geometry import Point
    from shapely.ops import transform

    return transform(_to_metric, Point(a)).distance(transform(_to_metric, Point(b)))


def chain_line_parts(parts: list[LineString]) -> LineString:
    """Encadena tramos que comparten extremos (p. ej. lazo + conector de 123 m)."""
    parts = [p for p in parts if line_length_m(p) >= 1.0]
    if not parts:
        raise ValueError("sin partes")
    if len(parts) == 1:
        return parts[0]

    remaining = list(parts)
    # Semilla: tramo más largo (eje principal de la ruta)
    seed_idx = max(range(len(remaining)), key=lambda i: remaining[i].length)
    current = remaining.pop(seed_idx)
    changed = True
    while changed and remaining:
        changed = False
        cur_coords = list(current.coords)
        cur_start, cur_end = cur_coords[0], cur_coords[-1]
        best = None
        for i, part in enumerate(remaining):
            p_coords = list(part.coords)
            p_start, p_end = p_coords[0], p_coords[-1]
            options = [
                ( _endpoint_dist(cur_end, p_start), "append", p_coords),
                ( _endpoint_dist(cur_end, p_end), "append", list(reversed(p_coords))),
                ( _endpoint_dist(cur_start, p_end), "prepend", p_coords),
                ( _endpoint_dist(cur_start, p_start), "prepend", list(reversed(p_coords))),
            ]
            for dist, mode, coords in options:
                if dist <= 30 and (best is None or dist < best[0]):
                    best = (dist, i, mode, coords)

        if best is not None:
            _, idx, mode, coords = best
            part = remaining.pop(idx)
            if mode == "append":
                if coords[0] == cur_coords[-1]:
                    coords = coords[1:]
                current = LineString(cur_coords + coords)
            else:
                if coords[-1] == cur_coords[0]:
                    coords = coords[:-1]
                current = LineString(coords + cur_coords)
            changed = True

    if remaining:
        leftover = [p for p in remaining if line_length_m(p) >= 1.0]
        if not leftover:
            return current
        merged = linemerge(unary_union([current, *leftover]))
        if isinstance(merged, LineString):
            return merged
        if isinstance(merged, MultiLineString):
            return max([current, *merged.geoms], key=line_length_m)
    return current


def to_linestring(geom_dict: dict) -> LineString | None:
    gtype = geom_dict.get("type")
    if gtype == "LineString":
        coords = [(c[0], c[1]) for c in geom_dict.get("coordinates", []) if len(c) >= 2]
        return LineString(coords) if len(coords) >= 2 else None
    if gtype == "MultiLineString":
        parts = []
        for part in geom_dict.get("coordinates", []):
            coords = [(c[0], c[1]) for c in part if len(c) >= 2]
            if len(coords) >= 2:
                parts.append(LineString(coords))
        if not parts:
            return None
        if len(parts) == 1:
            return parts[0]
        merged = linemerge(unary_union(parts))
        if isinstance(merged, LineString):
            return merged
        return chain_line_parts(parts)
    return None


def line_length_m(line: LineString) -> float:
    return transform(_to_metric, line).length


def multiline_parts(geom_dict: dict) -> list[LineString]:
    parts = []
    for part in geom_dict.get("coordinates", []):
        coords = [(c[0], c[1]) for c in part if len(c) >= 2]
        if len(coords) >= 2:
            parts.append(LineString(coords))
    return parts


def parallel_offset_directions(base: LineString) -> tuple[LineString, LineString]:
    """Genera ida/vuelta por offset cuando el KML solo trae una línea base abierta."""
    shp_m = transform(_to_metric, base)

    ida_m = shp_m.parallel_offset(5.0, "right", join_style=1)
    if ida_m.geom_type == "MultiLineString":
        ida_m = max(ida_m.geoms, key=lambda p: p.length)

    vuelta_m = shp_m.parallel_offset(5.0, "left", join_style=1)
    if vuelta_m.geom_type == "MultiLineString":
        vuelta_m = max(vuelta_m.geoms, key=lambda p: p.length)

    if len(ida_m.coords) > 0:
        p_start_shp = shp_m.coords[0]
        p_end_shp = shp_m.coords[-1]
        p_start_ida = ida_m.coords[0]
        if math.dist(p_start_ida, p_end_shp) < math.dist(p_start_ida, p_start_shp):
            ida_m = LineString(list(ida_m.coords)[::-1])

    if len(vuelta_m.coords) > 0:
        p_start_shp = shp_m.coords[0]
        p_end_shp = shp_m.coords[-1]
        p_start_v = vuelta_m.coords[0]
        if math.dist(p_start_v, p_start_shp) < math.dist(p_start_v, p_end_shp):
            vuelta_m = LineString(list(vuelta_m.coords)[::-1])

    return transform(_to_wgs84, ida_m), transform(_to_wgs84, vuelta_m)


def split_closed_loop_directions(base: LineString) -> tuple[LineString, LineString] | None:
    """
    Si el KML es un circuito cerrado (ida+vuelta en un solo trazo),
    parte por longitud acumulada ~50% en ida y vuelta sin inventar calles.
    """
    coords = [(float(c[0]), float(c[1])) for c in base.coords]
    if len(coords) < 6:
        return None

    # Cerrado si extremos cerca (<80 m)
    if _endpoint_dist(coords[0], coords[-1]) > 80.0:
        return None

    from shapely.geometry import Point

    mpts = [transform(_to_metric, Point(c)) for c in coords]
    cum = [0.0]
    for i in range(1, len(mpts)):
        cum.append(cum[-1] + mpts[i - 1].distance(mpts[i]))
    total = cum[-1]
    if total < 200.0:
        return None

    half = total / 2.0
    mid_idx = min(range(len(cum)), key=lambda i: abs(cum[i] - half))
    # evitar cortes degenerados
    mid_idx = max(2, min(mid_idx, len(coords) - 3))

    ida_coords = coords[: mid_idx + 1]
    vuelta_coords = coords[mid_idx:]
    # si el anillo no cierra exactamente al inicio de ida, no forzar salto inventado
    if len(ida_coords) < 2 or len(vuelta_coords) < 2:
        return None

    ida = LineString(ida_coords)
    vuelta = LineString(vuelta_coords)
    if line_length_m(ida) < 100 or line_length_m(vuelta) < 100:
        return None
    return ida, vuelta


def collect_line_geoms(features: list[dict]) -> list[LineString]:
    lines: list[LineString] = []
    for feat in features:
        geom = feat.get("geometry", {})
        gtype = geom.get("type")
        if gtype == "LineString":
            ls = to_linestring(geom)
            if ls and not ls.is_empty:
                lines.append(ls)
        elif gtype == "MultiLineString":
            parts = multiline_parts(geom)
            if len(parts) == 2:
                lines.extend(parts)
            else:
                ls = to_linestring(geom)
                if ls and not ls.is_empty:
                    lines.append(ls)
    lines.sort(key=line_length_m, reverse=True)
    return lines


def resolve_ida_vuelta(features: list[dict], route_id: str) -> tuple[LineString, LineString] | None:
    if len(features) == 2:
        g0 = to_linestring(features[0].get("geometry", {}))
        g1 = to_linestring(features[1].get("geometry", {}))
        if g0 and g1 and not g0.is_empty and not g1.is_empty:
            return g0, g1

    lines = collect_line_geoms(features)
    if len(lines) >= 2:
        return lines[0], lines[1]
    if len(lines) == 1:
        split = split_closed_loop_directions(lines[0])
        if split is not None:
            print(
                f"[info] {route_id}: circuito cerrado KML → split ida/vuelta por longitud (sin inventar trazo)",
                file=sys.stderr,
            )
            return split
        print(f"[info] {route_id}: una sola línea abierta en KML, generando ida/vuelta por offset", file=sys.stderr)
        return parallel_offset_directions(lines[0])
    return None


def parse_route_name_from_description(desc: str | None) -> str | None:
    if not desc:
        return None
    m = re.search(r"<td>RUTA</td>\s*<td>([^<]+)</td>", desc, re.I)
    return m.group(1).strip() if m else None


def import_kml_route(entry: dict) -> bool:
    route_id = entry["routeId"]
    source = ROOT / entry["sourceKml"]
    if not source.exists():
        print(f"[skip] No existe fuente: {source}", file=sys.stderr)
        return False

    # Copiar fuente a raw-routes para trazabilidad
    dest_raw = RAW_KML / f"{route_id}.kml"
    dest_raw.write_bytes(source.read_bytes())

    with tempfile.TemporaryDirectory() as tmp:
        tmp_geojson = Path(tmp) / "raw.geojson"
        run(
            [
                "ogr2ogr",
                "-f",
                "GeoJSON",
                str(tmp_geojson),
                str(source),
                "-t_srs",
                "EPSG:4326",
                "-dim",
                "2",
            ]
        )
        raw = json.loads(tmp_geojson.read_text(encoding="utf-8"))

    features = raw.get("features", [])
    if len(features) != 2:
        print(
            f"[warn] {route_id}: se esperaban 2 features (ida/vuelta), hay {len(features)}",
            file=sys.stderr,
        )

    resolved = resolve_ida_vuelta(features, route_id)
    if resolved is None:
        print(f"[fail] {route_id}: no se encontró geometría lineal utilizable", file=sys.stderr)
        return False
    ida_geom, vuelta_geom = resolved

    route_name = entry.get("routeName", route_id)
    color = entry.get("color", "#3b82f6")
    casing = entry.get("casingColor", "#222222")
    transport = entry.get("transportType", "combi")

    for feat in features:
        desc_name = parse_route_name_from_description(feat.get("properties", {}).get("description"))
        if desc_name:
            route_name = desc_name
            break

    out_features = []
    for idx, geom in enumerate((ida_geom, vuelta_geom)):
        out_features.append(
            {
                "type": "Feature",
                "properties": {
                    "routeId": route_id,
                    "routeName": route_name,
                    "direction": DIRECTIONS[idx],
                    "name": DIRECTION_LABELS[idx],
                    "color": color,
                    "casingColor": casing,
                    "transportType": transport,
                    "source": str(source.relative_to(ROOT)).replace("\\", "/"),
                    "sourceFeatureIndex": idx,
                },
                "geometry": mapping(geom),
            }
        )

    if len(out_features) != 2:
        print(f"[fail] {route_id}: no se pudieron generar los dos sentidos", file=sys.stderr)
        return False

    collection = {"type": "FeatureCollection", "features": out_features}
    out_path = OUT / f"{route_id}.geojson"
    out_path.write_text(json.dumps(collection, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] {route_id} -> {out_path} ({len(out_features)} sentidos)")
    return True


if __name__ == "__main__":
    if not MAP_FILE.exists():
        print(f"Falta {MAP_FILE}", file=sys.stderr)
        sys.exit(1)

    entries = json.loads(MAP_FILE.read_text(encoding="utf-8"))
    targets = sys.argv[1:] or [e["routeId"] for e in entries]
    by_id = {e["routeId"]: e for e in entries}

    failures = 0
    for route_id in targets:
        if route_id not in by_id:
            print(f"[skip] ruta desconocida: {route_id}", file=sys.stderr)
            failures += 1
            continue
        if not import_kml_route(by_id[route_id]):
            failures += 1

    print(f"Importación rutastransporte completada. fallos={failures}")
    if failures and len(targets) == 1:
        sys.exit(1)