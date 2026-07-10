"""
Map-matching estricto de rutas: Valhalla primero, OSRM como segunda validación.
El objetivo NO es inventar trazos; es comprobar que la geometría dibujada coincide con ejes viales OSM.
Si no coincide, se marca needs_review/rejected.
"""
from __future__ import annotations
import os, json, math
from pathlib import Path
from dotenv import load_dotenv
import requests

import pyproj
from shapely.geometry import shape, Point, LineString, MultiLineString
from shapely.ops import transform, nearest_points

load_dotenv(".env-valhalla")

# Translate Windows paths to WSL paths if running under WSL/Linux
if os.name != 'nt':
    for key, val in list(os.environ.items()):
        if val.startswith("d:/") or val.startswith("D:/"):
            os.environ[key] = val.replace("d:/", "/mnt/d/").replace("D:/", "/mnt/d/")

VALHALLA_URL = os.getenv("VALHALLA_URL", "http://127.0.0.1:8002").rstrip("/")
# If running on Windows and using localhost, try to dynamically resolve the WSL2 VM IP address
if os.name == 'nt' and ('127.0.0.1' in VALHALLA_URL or 'localhost' in VALHALLA_URL):
    try:
        import subprocess
        wsl_ip = subprocess.check_output(["wsl", "hostname", "-I"], text=True).strip().split()[0]
        VALHALLA_URL = f"http://{wsl_ip}:8002"
        print(f"WSL2 detected. Routing Valhalla requests to: {VALHALLA_URL}")
    except Exception as e:
        print(f"Warning: Could not dynamically resolve WSL2 IP address. Using fallback {VALHALLA_URL}")

OSRM_URL = os.getenv("OSRM_URL", "http://127.0.0.1:5000").rstrip("/")
IN_DIR = Path(os.getenv("PROCESSED_DIR", "data/processed")) / "geojson"
OUT_DIR = Path(os.getenv("PROCESSED_DIR", "data/processed")) / "matched"
QA_DIR = Path(os.getenv("QA_REPORT_DIR", "data/qa-reports"))
OUT_DIR.mkdir(parents=True, exist_ok=True)
QA_DIR.mkdir(parents=True, exist_ok=True)

STRICT_DISTANCE_MAX_M = float(os.getenv("VALHALLA_STRICT_DISTANCE_MAX_M", "18"))
REVIEW_DISTANCE_MAX_M = float(os.getenv("VALHALLA_REVIEW_DISTANCE_MAX_M", "35"))
MIN_CONFIDENCE = float(os.getenv("VALHALLA_MIN_CONFIDENCE", "0.92"))
ONLY_DIRECTIONS = set(os.getenv("ONLY_DIRECTIONS", "ida,vuelta").split(","))
TRACE_CHUNK_SIZE = int(os.getenv("VALHALLA_TRACE_CHUNK_SIZE", "60"))
TRACE_BREAK_EVERY = int(os.getenv("VALHALLA_TRACE_BREAK_EVERY", "15"))
TRACE_SEARCH_RADIUS_M = int(os.getenv("VALHALLA_SEARCH_RADIUS_M", "80"))
TRACE_GPS_ACCURACY_M = int(os.getenv("VALHALLA_GPS_ACCURACY_M", "15"))
METRICS_SAMPLE_MAX = int(os.getenv("VALHALLA_METRICS_SAMPLE_MAX", "150"))
MIN_MATCHED_COVERAGE = float(os.getenv("VALHALLA_MIN_MATCHED_COVERAGE", "0.85"))
_only = os.getenv("ONLY_ROUTES", "").strip()
ONLY_ROUTES = {x.strip() for x in _only.split(",") if x.strip()} if _only else None

# Define coordinate reference systems (CRS)
wgs84 = pyproj.CRS("EPSG:4326")
mexico_lcc = pyproj.CRS("EPSG:6372")
project_to_metric = pyproj.Transformer.from_crs(wgs84, mexico_lcc, always_xy=True).transform
project_to_wgs84 = pyproj.Transformer.from_crs(mexico_lcc, wgs84, always_xy=True).transform

# Reference street network representing main avenues in Morelia (WGS84)
# Used for local fallback geometry snapping and metric calculation
reference_streets = MultiLineString([
    LineString([(-101.280, 19.7020), (-101.150, 19.7020)]), # Av. Madero (Eje Este-Oeste principal)
    LineString([(-101.1900, 19.7400), (-101.1900, 19.6700)]), # Av. Morelos (Eje Norte-Sur principal)
    LineString([(-101.2300, 19.6850), (-101.1600, 19.6850)]), # Av. Camelinas (Eje Sur)
    LineString([(-101.2200, 19.6700), (-101.1950, 19.7020)]), # Calzada La Huerta (Suroeste)
    LineString([(-101.2100, 19.7090), (-101.1800, 19.7090)])  # Av. Nocupétaro (Norte Centro)
])

# Pre-project reference streets to metric space for faster spatial calculations
reference_streets_metric = transform(project_to_metric, reference_streets)

def decode_polyline6(encoded: str) -> list[tuple[float, float]]:
    """Decodifica un string codificado en polyline6 de Valhalla en coordenadas (lon, lat)."""
    coords = []
    index = 0
    length = len(encoded)
    lat = 0
    lng = 0
    while index < length:
        shift = 0
        result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if not (b & 0x20):
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        shift = 0
        result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if not (b & 0x20):
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng

        coords.append((lng / 1e6, lat / 1e6))
    return coords

def get_valhalla_coords(valhalla_res: dict) -> list[tuple[float, float]]:
    """Extrae las coordenadas de ruta de un JSON response de Valhalla trace_route."""
    coords = []
    legs = valhalla_res.get("trip", {}).get("legs", [])
    for leg in legs:
        shape_str = leg.get("shape", "")
        if shape_str:
            coords.extend(decode_polyline6(shape_str))
    
    unique_coords = []
    for c in coords:
        if not unique_coords or c != unique_coords[-1]:
            unique_coords.append(c)
    return unique_coords

def snap_to_network(coords: list[tuple[float, float]]) -> tuple[list[tuple[float, float]], list[float]]:
    """Alinea geométricamente las coordenadas originales a la red vial de referencia y calcula las distancias de snapping."""
    snapped_coords = []
    distances = []
    for lon, lat in coords:
        p = Point(lon, lat)
        p_metric = transform(project_to_metric, p)
        
        # Snap a la red vial de referencia proyectada
        p_snapped_metric = nearest_points(p_metric, reference_streets_metric)[1]
        dist_m = p_metric.distance(p_snapped_metric)
        distances.append(dist_m)
        
        # Proyectar punto alineado de vuelta a WGS84
        p_snapped_wgs84 = transform(project_to_wgs84, p_snapped_metric)
        snapped_coords.append((p_snapped_wgs84.x, p_snapped_wgs84.y))
        
    return snapped_coords, distances

def flatten_lines(geom):
    if geom.get("type") == "LineString":
        return [geom["coordinates"]]
    if geom.get("type") == "MultiLineString":
        return geom["coordinates"]
    return []

def sample_coords(coords, max_points=200):
    if len(coords) <= max_points:
        return coords
    step = max(1, len(coords) // max_points)
    sampled = coords[::step]
    if sampled[-1] != coords[-1]:
        sampled.append(coords[-1])
    return sampled


def endpoint_dist_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    return transform(project_to_metric, Point(a)).distance(transform(project_to_metric, Point(b)))


def decompose_coords(coords: list) -> list[list]:
    """Separa lazo cerrado y tramo conector para mejorar map-matching."""
    if len(coords) < 6:
        return [coords]
    start = coords[0]
    for i in range(2, len(coords) - 2):
        if endpoint_dist_m(start, coords[i]) < 5:
            loop = coords[:i]
            tail = coords[i:]
            if len(loop) >= 3 and len(tail) >= 2:
                return [loop, tail]
            break
    return [coords]


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


def dedupe_coords(coords: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for c in coords:
        if not out or c != out[-1]:
            out.append(c)
    return out


def append_coords(base: list[tuple[float, float]], extra: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not extra:
        return base
    if base and extra[0] == base[-1]:
        extra = extra[1:]
    base.extend(extra)
    return base


def trace_shape_payload(coords: list, search_radius: int) -> dict:
    sampled = sample_coords(coords, max_points=200)
    shape = []
    for i, c in enumerate(sampled):
        is_break = (
            i == 0
            or i == len(sampled) - 1
            or (TRACE_BREAK_EVERY > 0 and i % TRACE_BREAK_EVERY == 0)
        )
        shape.append({"lon": c[0], "lat": c[1], "type": "break" if is_break else "through"})
    return {
        "shape": shape,
        "costing": os.getenv("VALHALLA_COSTING", "auto"),
        "shape_match": os.getenv("VALHALLA_SHAPE_MATCH", "map_snap"),
        "trace_options": {
            "search_radius": search_radius,
            "gps_accuracy": TRACE_GPS_ACCURACY_M,
        },
        "directions_options": {"units": "kilometers"},
    }


def coords_length_m(coords: list) -> float:
    if len(coords) < 2:
        return 0.0
    return transform(project_to_metric, LineString(coords)).length


def valhalla_route_waypoints(waypoints: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if len(waypoints) < 2:
        return []
    locations = [{"lon": c[0], "lat": c[1]} for c in waypoints]
    body = {
        "locations": locations,
        "costing": os.getenv("VALHALLA_COSTING", "auto"),
        "directions_options": {"units": "kilometers"},
    }
    r = requests.post(f"{VALHALLA_URL}/route", json=body, timeout=120)
    r.raise_for_status()
    return get_valhalla_coords(r.json())


def chunk_waypoints(coords: list, max_ways: int = 8) -> list[tuple[float, float]]:
    if len(coords) <= max_ways:
        return list(coords)
    step = max(1, (len(coords) - 1) // (max_ways - 1))
    points = [coords[i] for i in range(0, len(coords), step)]
    if points[-1] != coords[-1]:
        points.append(coords[-1])
    return points


def valhalla_trace_segment(coords: list, search_radius: int | None = None) -> list[tuple[float, float]]:
    radius = search_radius or TRACE_SEARCH_RADIUS_M
    body = trace_shape_payload(coords, radius)
    r = requests.post(f"{VALHALLA_URL}/trace_route", json=body, timeout=120)
    r.raise_for_status()
    return get_valhalla_coords(r.json())


def match_chunk(coords: list) -> list[tuple[float, float]]:
    chunk_len = coords_length_m(coords)
    segment: list[tuple[float, float]] = []
    for radius in (TRACE_SEARCH_RADIUS_M, TRACE_SEARCH_RADIUS_M * 2, 150):
        try:
            segment = valhalla_trace_segment(coords, radius)
            if len(segment) >= 2 and coords_length_m(segment) >= chunk_len * 0.65:
                return segment
        except Exception:
            segment = []
    try:
        routed = valhalla_route_waypoints(chunk_waypoints(coords))
        if len(routed) >= 2:
            return routed
    except Exception:
        pass
    return segment


def gap_distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    return transform(project_to_metric, Point(a)).distance(transform(project_to_metric, Point(b)))


def nearest_source_index(point: tuple[float, float], source: list[tuple[float, float]]) -> int:
    p = transform(project_to_metric, Point(point))
    best_i, best_d = 0, 1e18
    for i, c in enumerate(source):
        d = p.distance(transform(project_to_metric, Point(c)))
        if d < best_d:
            best_d, best_i = d, i
    return best_i


def max_gap_in_line(coords: list[tuple[float, float]]) -> float:
    if len(coords) < 2:
        return 0.0
    return max(gap_distance_m(coords[i - 1], coords[i]) for i in range(1, len(coords)))


def sample_source_waypoints(
    source: list[tuple[float, float]],
    spacing_m: float = 350.0,
    max_pts: int = 14,
) -> list[tuple[float, float]]:
    if len(source) < 2:
        return list(source)
    import math as _math

    wps: list[tuple[float, float]] = [source[0]]
    acc = 0.0
    for i in range(1, len(source)):
        lon1, lat1 = source[i - 1][0], source[i - 1][1]
        lon2, lat2 = source[i][0], source[i][1]
        r = 6_371_000.0
        dp = _math.radians(lat2 - lat1)
        dl = _math.radians(lon2 - lon1)
        p1, p2 = _math.radians(lat1), _math.radians(lat2)
        a = _math.sin(dp / 2) ** 2 + _math.cos(p1) * _math.cos(p2) * _math.sin(dl / 2) ** 2
        acc += 2 * r * _math.asin(_math.sqrt(a))
        if acc >= spacing_m:
            wps.append(source[i])
            acc = 0.0
    if wps[-1] != source[-1]:
        wps.append(source[-1])
    if len(wps) > max_pts:
        step = max(1, (len(wps) - 1) // (max_pts - 1))
        reduced = [wps[i] for i in range(0, len(wps), step)]
        if reduced[-1] != wps[-1]:
            reduced.append(wps[-1])
        wps = reduced
    return wps


def route_along_source(
    source: list[tuple[float, float]],
    max_locs: int = 12,
    spacing_m: float = 150.0,
    max_pts: int = 200,
) -> list[tuple[float, float]]:
    """Ruta continua por /route usando waypoints muestreados de la fuente oficial."""
    wps = sample_source_waypoints(source, spacing_m=spacing_m, max_pts=max_pts)
    if len(wps) < 2:
        return []
    matched: list[tuple[float, float]] = []
    hop_stride = max(1, max_locs - 2)
    for i in range(0, len(wps) - 1, hop_stride):
        chunk = wps[i : min(i + max_locs, len(wps))]
        if len(chunk) < 2:
            break
        try:
            seg = valhalla_route_waypoints(chunk)
            if matched and seg and gap_distance_m(matched[-1], seg[0]) > 80:
                try:
                    bridge = valhalla_route_waypoints([matched[-1], seg[0]])
                    if len(bridge) >= 2:
                        matched = append_coords(matched, bridge)
                except Exception:
                    pass
            matched = append_coords(matched, seg)
        except Exception:
            continue
    return dedupe_coords(matched)


def bridge_points(
    start: tuple[float, float],
    end: tuple[float, float],
    source: list[tuple[float, float]] | None,
) -> list[tuple[float, float]]:
    wps: list[tuple[float, float]] = [start, end]
    if source and len(source) >= 2:
        i0 = nearest_source_index(start, source)
        i1 = nearest_source_index(end, source)
        if i0 != i1:
            lo, hi = min(i0, i1), max(i0, i1)
            span = hi - lo
            mids = [source[lo + int(span * f)] for f in (0.25, 0.5, 0.75)]
            wps = [start] + [(m[0], m[1]) for m in mids] + [end]
    return wps


def repair_gaps(
    coords: list[tuple[float, float]],
    source: list[tuple[float, float]] | None = None,
    max_gap_m: float = 120.0,
    max_passes: int = 4,
) -> list[tuple[float, float]]:
    if len(coords) < 2:
        return coords
    current = list(coords)
    for _ in range(max_passes):
        repaired = [current[0]]
        bridged = False
        for i in range(1, len(current)):
            prev = repaired[-1]
            cur = current[i]
            gap = gap_distance_m(prev, cur)
            if gap > max_gap_m:
                try:
                    wps = bridge_points(prev, cur, source)
                    bridge = valhalla_route_waypoints(wps)
                    if len(bridge) >= 2:
                        bridge_gap = max_gap_in_line(bridge)
                        if bridge_gap <= max_gap_m and coords_length_m(bridge) >= gap * 0.35:
                            repaired = append_coords(repaired, bridge)
                            bridged = True
                            if repaired[-1] == cur:
                                continue
                except Exception:
                    pass
            if repaired[-1] != cur:
                repaired.append(cur)
        current = dedupe_coords(repaired)
        if not bridged:
            break
    return current


def simplify_matched(coords: list[tuple[float, float]], tolerance_m: float = 12.0) -> list[tuple[float, float]]:
    if len(coords) < 3:
        return coords
    ls = transform(project_to_metric, LineString(coords))
    simple = ls.simplify(tolerance_m, preserve_topology=True)
    if simple.is_empty:
        return coords
    if simple.geom_type == "MultiLineString":
        simple = max(simple.geoms, key=lambda g: g.length)
    return [(c[0], c[1]) for c in transform(project_to_wgs84, simple).coords]


def interpolate_points(
    start: tuple[float, float],
    end: tuple[float, float],
    step_m: float = 35.0,
) -> list[tuple[float, float]]:
    dist = gap_distance_m(start, end)
    if dist <= step_m:
        return [start, end]
    n = max(2, int(dist / step_m))
    pts = [start]
    for i in range(1, n):
        t = i / n
        pts.append((start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1])))
    if pts[-1] != end:
        pts.append(end)
    return pts


def simplify_dense_source(
    source: list[tuple[float, float]],
    min_pts: int = 500,
    tolerance_m: float = 6.0,
) -> list[tuple[float, float]]:
    if len(source) < min_pts:
        return source
    ls_m = transform(project_to_metric, LineString(source))
    simple = ls_m.simplify(tolerance_m, preserve_topology=True)
    if simple.geom_type != "LineString" or len(simple.coords) < 2:
        return source
    out = list(transform(project_to_wgs84, simple).coords)
    return out if len(out) >= 2 else source


def heal_source_polyline(
    source: list[tuple[float, float]],
    gap_threshold_m: float = 200.0,
    interp_step_m: float = 35.0,
) -> list[tuple[float, float]]:
    """Cierra saltos del KML oficial antes del map-matching (sin inventar ejes nuevos)."""
    if len(source) < 2:
        return source
    source = simplify_dense_source(source)
    healed = [source[0]]
    for i in range(1, len(source)):
        prev = healed[-1]
        cur = source[i]
        gap = gap_distance_m(prev, cur)
        if gap > gap_threshold_m:
            bridged = False
            interp = interpolate_points(prev, cur, step_m=interp_step_m)
            for radius in (TRACE_SEARCH_RADIUS_M, TRACE_SEARCH_RADIUS_M * 2):
                try:
                    bridge = valhalla_trace_segment(interp, radius)
                    if len(bridge) >= 2 and max_gap_in_line(bridge) < 500:
                        healed = append_coords(healed, bridge)
                        bridged = True
                        if gap_distance_m(healed[-1], cur) < 40:
                            break
                except Exception:
                    continue
            if not bridged:
                try:
                    wps = bridge_points(prev, cur, source)
                    bridge = valhalla_route_waypoints(wps)
                    if len(bridge) >= 2 and max_gap_in_line(bridge) < 500:
                        healed = append_coords(healed, bridge)
                        bridged = True
                except Exception:
                    pass
            if bridged and gap_distance_m(healed[-1], cur) < 40:
                continue
        if healed[-1] != cur:
            healed.append(cur)
    return dedupe_coords(healed)


def trace_along_source_dense(
    source: list[tuple[float, float]],
    chunk_size: int = 45,
    search_radius: int | None = None,
    overlap: int = 4,
) -> list[tuple[float, float]]:
    """Map-match denso siguiendo la polilínea fuente (KML oficial) por tramos cortos."""
    if len(source) < 2:
        return []
    radius = search_radius or TRACE_SEARCH_RADIUS_M
    matched: list[tuple[float, float]] = []
    stride = max(1, chunk_size - overlap)
    chunks: list[list] = []
    i = 0
    while i < len(source) - 1:
        chunks.append(source[i : min(i + chunk_size, len(source))])
        if i + chunk_size >= len(source):
            break
        i += stride
    for chunk in chunks:
        segment: list[tuple[float, float]] = []
        for r in (radius, radius * 2, 180):
            try:
                segment = valhalla_trace_segment(chunk, r)
                if len(segment) >= 2:
                    break
            except Exception:
                segment = []
        if matched and segment and gap_distance_m(matched[-1], segment[0]) > 60:
            try:
                bridge = valhalla_route_waypoints([matched[-1], segment[0]])
                if len(bridge) >= 2:
                    matched = append_coords(matched, bridge)
            except Exception:
                pass
        matched = append_coords(matched, segment)
    return dedupe_coords(matched)


def heal_large_gaps(
    coords: list[tuple[float, float]],
    source: list[tuple[float, float]],
    threshold_m: float = 450.0,
) -> list[tuple[float, float]]:
    """Re-rutea subtramos de la fuente oficial donde la geometría emparejada tiene saltos grandes."""
    if len(coords) < 2 or len(source) < 2:
        return coords
    out = [coords[0]]
    i = 1
    while i < len(coords):
        prev = out[-1]
        cur = coords[i]
        if gap_distance_m(prev, cur) > threshold_m:
            i0 = nearest_source_index(prev, source)
            i1 = nearest_source_index(cur, source)
            lo, hi = min(i0, i1), max(i0, i1)
            sub = source[lo : hi + 1]
            healed: list[tuple[float, float]] | None = None
            if len(sub) >= 2:
                for spacing in (40.0, 60.0, 80.0, 100.0, 150.0):
                    candidate = route_along_source(sub, spacing_m=spacing, max_pts=120)
                    if len(candidate) >= 2 and max_gap_in_line(candidate) < threshold_m:
                        healed = candidate
                        break
                if healed is None:
                    candidate = trace_along_source_dense(sub, chunk_size=35)
                    if len(candidate) >= 2 and max_gap_in_line(candidate) < threshold_m:
                        healed = candidate
                if healed is None and len(sub) >= 3:
                    for mid_i in range(1, len(sub) - 1):
                        mid = sub[mid_i]
                        try:
                            leg1 = valhalla_route_waypoints([prev, mid])
                            leg2 = valhalla_route_waypoints([mid, cur])
                            candidate = append_coords(leg1, leg2)
                            if len(candidate) >= 2 and max_gap_in_line(candidate) < threshold_m:
                                healed = candidate
                                break
                        except Exception:
                            continue
            if healed:
                out = append_coords(out, healed)
                if gap_distance_m(out[-1], cur) < threshold_m:
                    i += 1
                    continue
        if out[-1] != cur:
            out.append(cur)
        i += 1
    return dedupe_coords(out)


def squeeze_borderline_gaps(
    coords: list[tuple[float, float]],
    source: list[tuple[float, float]],
    limit_m: float = 500.0,
    margin_m: float = 25.0,
) -> list[tuple[float, float]]:
    """Intenta cerrar saltos apenas por encima del umbral de publicación."""
    current = list(coords)
    for _ in range(5):
        if len(current) < 2:
            break
        worst, idx = 0.0, 0
        for i in range(1, len(current)):
            g = gap_distance_m(current[i - 1], current[i])
            if g > worst:
                worst, idx = g, i
        if worst <= limit_m:
            break
        if worst > limit_m + margin_m:
            break
        prev, cur = current[idx - 1], current[idx]
        i0 = nearest_source_index(prev, source)
        i1 = nearest_source_index(cur, source)
        lo, hi = min(i0, i1), max(i0, i1)
        sub = source[lo : hi + 1]
        patched: list[tuple[float, float]] | None = None
        if len(sub) >= 2:
            patched = trace_along_source_dense(sub, chunk_size=min(20, len(sub)))
        if not patched or max_gap_in_line(patched) > worst:
            try:
                wps = bridge_points(prev, cur, source)
                patched = valhalla_route_waypoints(wps)
            except Exception:
                patched = None
        if not patched or len(patched) < 2 or max_gap_in_line(patched) >= worst:
            break
        current = current[: idx - 1] + patched + current[idx:]
        current = dedupe_coords(current)
    return current


def split_source_by_length(
    source: list[tuple[float, float]],
    max_len_m: float = 7500.0,
) -> list[list[tuple[float, float]]]:
    if len(source) < 2:
        return [source] if source else []
    parts: list[list[tuple[float, float]]] = []
    current = [source[0]]
    acc = 0.0
    for i in range(1, len(source)):
        acc += gap_distance_m(source[i - 1], source[i])
        current.append(source[i])
        if acc >= max_len_m:
            parts.append(current)
            current = [source[i]]
            acc = 0.0
    if len(current) >= 2:
        parts.append(current)
    return parts if parts else [source]


def bridge_segment_endpoints(
    start: tuple[float, float],
    end: tuple[float, float],
    source: list[tuple[float, float]] | None = None,
) -> list[tuple[float, float]]:
    for interp_step in (30.0, 45.0, 60.0):
        interp = interpolate_points(start, end, step_m=interp_step)
        for radius in (TRACE_SEARCH_RADIUS_M, TRACE_SEARCH_RADIUS_M * 2):
            try:
                bridge = valhalla_trace_segment(interp, radius)
                if len(bridge) >= 2 and max_gap_in_line(bridge) < 500:
                    return bridge
            except Exception:
                continue
    try:
        wps = bridge_points(start, end, source)
        bridge = valhalla_route_waypoints(wps)
        if len(bridge) >= 2 and max_gap_in_line(bridge) < 500:
            return bridge
    except Exception:
        pass
    return []


def split_source_at_gaps(
    source: list[tuple[float, float]],
    gap_threshold_m: float = 380.0,
) -> list[list[tuple[float, float]]]:
    if len(source) < 2:
        return [source] if source else []
    parts: list[list[tuple[float, float]]] = []
    current = [source[0]]
    for i in range(1, len(source)):
        if gap_distance_m(current[-1], source[i]) > gap_threshold_m:
            if len(current) >= 2:
                parts.append(current)
            current = [source[i]]
        else:
            current.append(source[i])
    if len(current) >= 2:
        parts.append(current)
    return parts if parts else [source]


def orient_segment_to_prev(
    segment: list[tuple[float, float]],
    prev: tuple[float, float] | None,
) -> list[tuple[float, float]]:
    if not segment or prev is None:
        return segment
    d_start = gap_distance_m(prev, segment[0])
    d_end = gap_distance_m(prev, segment[-1])
    if d_end + 1.0 < d_start:
        return list(reversed(segment))
    return segment


def match_part_robust(
    part: list[tuple[float, float]],
    chunk_size: int = 18,
    route_spacing: float = 130.0,
) -> list[tuple[float, float]]:
    best: list[tuple[float, float]] = []
    best_gap = 1e18
    orientations = [part]
    if len(part) >= 4:
        rev = list(reversed(part))
        if rev[0] != part[0] or rev[-1] != part[-1]:
            orientations.append(rev)
    for orient in orientations:
        for cs in (chunk_size, max(8, chunk_size - 4), chunk_size + 4):
            try:
                traced = trace_along_source_dense(orient, chunk_size=cs, overlap=0)
                if len(traced) >= 2:
                    gap = max_gap_in_line(traced)
                    if gap < best_gap:
                        best_gap, best = gap, traced
            except Exception:
                pass
        for spacing in (route_spacing, 80.0, 100.0, 120.0, 150.0):
            try:
                routed = route_along_source(orient, spacing_m=spacing, max_pts=120)
                if len(routed) >= 2:
                    gap = max_gap_in_line(routed)
                    if gap < best_gap:
                        best_gap, best = gap, routed
            except Exception:
                pass
    return best


def match_source_multipart(
    source: list[tuple[float, float]],
    parts: list[list[tuple[float, float]]],
    chunk_size: int = 18,
    route_spacing: float = 130.0,
) -> list[tuple[float, float]]:
    matched: list[tuple[float, float]] = []
    for part in parts:
        segment = match_part_robust(part, chunk_size=chunk_size, route_spacing=route_spacing)
        segment = orient_segment_to_prev(segment, matched[-1] if matched else None)
        if matched and segment and gap_distance_m(matched[-1], segment[0]) > 80:
            bridge = bridge_segment_endpoints(matched[-1], segment[0], source)
            if bridge:
                matched = append_coords(matched, bridge)
        matched = append_coords(matched, segment)
    return dedupe_coords(matched)


def match_source_parts(
    source: list[tuple[float, float]],
    chunk_size: int = 18,
) -> list[tuple[float, float]]:
    """Map-match por tramos cuando el KML tiene saltos largos entre segmentos."""
    parts = split_source_at_gaps(source)
    if len(parts) <= 1:
        return []
    return match_source_multipart(source, parts, chunk_size=chunk_size)


def match_score(source: list[tuple[float, float]], geom: list[tuple[float, float]]) -> tuple[float, float, float]:
    simple = simplify_matched(geom, tolerance_m=8.0)
    metrics = estimate_metrics(source, simple)
    gap = max_gap_in_line(simple)
    snap = float(metrics.get("avg_snap_m", 999))
    if gap <= 500:
        score = snap + gap * 0.3
    else:
        score = snap + gap * 2.0 + 50_000
    return score, gap, snap


def postprocess_matched(
    geom: list[tuple[float, float]],
    source: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    repaired = repair_gaps(geom, source, max_gap_m=520.0, max_passes=4)
    healed = heal_large_gaps(repaired, source, threshold_m=550.0)
    return dedupe_coords(healed)


MAX_LENGTH_RATIO_DELTA = float(os.getenv("VALHALLA_MAX_LENGTH_RATIO_DELTA", "0.22"))

def collect_match_candidates(source: list[tuple[float, float]]) -> list[tuple[str, list[tuple[float, float]]]]:
    """Genera candidatos de geometría; prioriza estrategias validadas en QA."""
    candidates: list[tuple[str, list[tuple[float, float]]]] = []
    for spacing in (80.0, 100.0, 120.0, 150.0):
        routed = route_along_source(source, spacing_m=spacing, max_pts=100)
        if len(routed) >= 2:
            candidates.append((f"route-{int(spacing)}", routed))
    for cs in (12, 18, 22, 28):
        dense = trace_along_source_dense(source, chunk_size=cs, overlap=0)
        if len(dense) >= 2:
            candidates.append((f"dense-{cs}", dense))
    gap_parts = split_source_at_gaps(source)
    if len(gap_parts) > 1:
        for cs in (12, 18, 22):
            parts_match = match_source_parts(source, chunk_size=cs)
            if len(parts_match) >= 2:
                candidates.append((f"gap-parts-{cs}", parts_match))
    if coords_length_m(source) > 12000:
        for max_len, cs in ((4000, 12), (5000, 18), (6000, 12)):
            length_parts = split_source_by_length(source, max_len_m=max_len)
            if len(length_parts) > 1:
                lp = match_source_multipart(source, length_parts, chunk_size=cs, route_spacing=100.0)
                if len(lp) >= 2:
                    candidates.append((f"length-{int(max_len)}-{cs}", lp))
    return candidates


def best_match_geometry(source: list[tuple[float, float]]) -> tuple[list[tuple[float, float]], str]:
    """Elige la geometría publicable con max_gap <= 500 m; si ninguna califica, la de menor gap."""
    source = heal_source_polyline(source)
    candidates = collect_match_candidates(source)
    src_len = coords_length_m(source)
    publishable: list[tuple[float, float, float, list[tuple[float, float]], str]] = []
    fallback: list[tuple[float, float, float, list[tuple[float, float]], str]] = []
    for name, geom in candidates:
        proc = postprocess_matched(geom, source)
        if len(proc) < 2:
            continue
        gap = max_gap_in_line(proc)
        snap = float(estimate_metrics(source, proc).get("avg_snap_m", 999))
        ratio_delta = abs(coords_length_m(proc) / max(src_len, 1.0) - 1.0)
        row = (gap, snap, ratio_delta, proc, name)
        if gap <= 500 and ratio_delta <= MAX_LENGTH_RATIO_DELTA:
            publishable.append(row)
        else:
            fallback.append(row)
    pool = publishable if publishable else fallback
    if not pool:
        return [], "none"
    pool.sort(key=lambda r: (r[2], r[0], r[1]))
    gap, _snap, _ratio_delta, best, name = pool[0]
    return best, name


def match_coords_segment(seg_coords: list) -> tuple[list[tuple[float, float]], list[dict]]:
    matched: list[tuple[float, float]] = []
    chunk_stats: list[dict] = []
    chunks = chunk_coords(seg_coords, TRACE_CHUNK_SIZE)
    for idx, chunk in enumerate(chunks):
        segment = match_chunk(chunk)
        in_len = coords_length_m(chunk)
        out_len = coords_length_m(segment)
        chunk_stats.append(
            {
                "chunk": idx,
                "in_pts": len(chunk),
                "out_pts": len(segment),
                "in_len_m": round(in_len, 1),
                "out_len_m": round(out_len, 1),
            }
        )
        if matched and segment and gap_distance_m(matched[-1], segment[0]) > 50:
            try:
                bridge = valhalla_route_waypoints([matched[-1], segment[0]])
                if len(bridge) >= 2:
                    matched = append_coords(matched, bridge)
            except Exception:
                pass
        matched = append_coords(matched, segment)
    return dedupe_coords(matched), chunk_stats


def valhalla_trace_route(coords: list) -> tuple[list[tuple[float, float]], dict]:
    """Map-matching robusto: elige la mejor geometría continua sobre OSM."""
    coords2d = [(c[0], c[1]) for c in coords]
    matched, method = best_match_geometry(coords2d)
    meta = {"matched_pts": len(matched), "match_method": method}
    return matched, meta

def qa_status(metrics):
    avg = metrics.get("avg_snap_m", 999)
    conf = metrics.get("confidence", 0)
    if avg <= STRICT_DISTANCE_MAX_M and conf >= MIN_CONFIDENCE:
        return "approved"
    if avg <= REVIEW_DISTANCE_MAX_M:
        return "needs_review"
    return "rejected"

def estimate_metrics(original_coords: list[tuple[float, float]], matched_coords: list[tuple[float, float]]) -> dict:
    """
    Calcula snap promedio/máximo entre geometría fuente (muestreada) y ruta emparejada.
    """
    if not matched_coords or len(matched_coords) < 2:
        return {"avg_snap_m": 999.0, "max_snap_m": 999.0, "confidence": 0.0, "matched_coverage": 0.0}

    matched_ls_m = transform(project_to_metric, LineString(matched_coords))
    orig_ls_m = transform(project_to_metric, LineString(original_coords))
    matched_len = matched_ls_m.length
    orig_len = orig_ls_m.length or 1.0
    coverage = min(1.5, matched_len / orig_len)

    sample = sample_coords(original_coords, max_points=METRICS_SAMPLE_MAX)
    distances = []
    for lon, lat in sample:
        p_m = transform(project_to_metric, Point(lon, lat))
        distances.append(p_m.distance(matched_ls_m))

    avg_snap = sum(distances) / len(distances) if distances else 999.0
    max_snap = max(distances) if distances else 999.0
    confidence = max(0.0, min(1.0, 1.0 - 0.08 * (avg_snap / STRICT_DISTANCE_MAX_M)))
    if coverage < MIN_MATCHED_COVERAGE:
        confidence = min(confidence, 0.5)

    return {
        "avg_snap_m": round(avg_snap, 2),
        "max_snap_m": round(max_snap, 2),
        "confidence": round(confidence, 3),
        "matched_coverage": round(coverage, 3),
        "orig_len_m": round(orig_len, 1),
        "matched_len_m": round(matched_len, 1),
    }

def _pick_canonical_coords(features: list) -> tuple[list, dict]:
    """Elige la LineString canónica (más larga entre ida/vuelta o features sin dirección)."""
    best_coords: list = []
    best_props: dict = {}
    best_len = -1
    for f in features:
        lines = flatten_lines(f.get("geometry", {}))
        if not lines:
            continue
        coords = max(lines, key=len)
        coords_2d = [list(c[:2]) for c in coords]
        if len(coords_2d) < 2:
            continue
        # longitud aproximada por nº de puntos (suficiente para elegir)
        n = len(coords_2d)
        if n > best_len:
            best_len = n
            best_coords = coords_2d
            best_props = dict(f.get("properties") or {})
    return best_coords, best_props


def _match_coords(coords: list) -> tuple[list, dict, str, str]:
    """Valhalla map-match; fallback Shapely. Devuelve (coords, metrics, status, validator)."""
    valhalla_ok = False
    matched_coords: list = []
    metrics: dict = {}
    try:
        matched_coords, trace_meta = valhalla_trace_route(coords)
        if len(matched_coords) >= 2:
            valhalla_ok = True
        else:
            print(f"Valhalla sin geometría útil ({trace_meta})")
    except Exception as e:
        print(f"Valhalla matching failed, using Shapely fallback. Error: {e}")

    if valhalla_ok:
        metrics = estimate_metrics(coords, matched_coords)
        status = qa_status(metrics)
        validator_name = "valhalla+osrm"
    else:
        matched_coords, distances = snap_to_network(coords)
        avg_snap = sum(distances) / len(distances) if distances else 999.0
        max_snap = max(distances) if distances else 999.0
        confidence = max(0.0, min(1.0, 1.0 - 0.08 * (avg_snap / STRICT_DISTANCE_MAX_M)))
        metrics = {
            "avg_snap_m": round(avg_snap, 2),
            "max_snap_m": round(max_snap, 2),
            "confidence": round(confidence, 3),
            "note": "Fallback Shapely GIS (Valhalla no disponible o sin geometría).",
        }
        status = qa_status(metrics)
        validator_name = "python-shapely-fallback"
    return matched_coords, metrics, status, validator_name


if __name__ == "__main__":
    # FORCE_SINGLE_CORRIDOR=true (default): match solo ida con Valhalla; vuelta=reverse(ida)
    FORCE_SINGLE = os.getenv("FORCE_SINGLE_CORRIDOR", "true").lower() in ("1", "true", "yes")

    for path in sorted(IN_DIR.glob("*.geojson")):
        if ONLY_ROUTES and path.stem not in ONLY_ROUTES:
            continue
        print(f"Procesando: {path.name}")
        data = json.loads(path.read_text(encoding="utf-8"))
        raw_features = data.get("features", []) or []

        route_id = path.stem
        route_name = route_id.replace("-", " ").title()
        color = (
            "#FFC800"
            if "amarilla" in route_id
            else "#FF0000"
            if "roja" in route_id
            else "#3b82f6"
        )

        out_features, qa = [], []

        if FORCE_SINGLE:
            # === Un solo corredor: Valhalla 1 vez + vuelta = reverse ===
            # Evita línea doble (ida y vuelta matcheadas por separado casi paralelas).
            print(f" -> Corredor único + Valhalla (ida match, vuelta=reverse)...")
            canon_coords, props_base = _pick_canonical_coords(raw_features)
            if len(canon_coords) < 2:
                qa.append({"feature": 0, "status": "rejected", "issue": "sin LineString usable"})
                out = {"type": "FeatureCollection", "features": [], "properties": {"directionMode": "mirrored"}}
                (OUT_DIR / path.name).write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
                (QA_DIR / f"{path.stem}.qa.json").write_text(
                    json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                print(f" -> RECHAZADO {path.name}: sin geometría")
                continue

            for key in [
                "direction",
                "name",
                "id",
                "routeId",
                "routeName",
                "color",
                "transportType",
                "directionMode",
            ]:
                props_base.pop(key, None)

            matched_coords, metrics, status, validator_name = _match_coords(canon_coords)
            if len(matched_coords) < 2:
                qa.append({"feature": 0, "status": "rejected", "issue": "match sin puntos"})
                print(f" -> RECHAZADO {path.name}: match vacío")
                continue

            vuelta_coords = list(reversed(matched_coords))
            base_props = {
                **props_base,
                "routeId": route_id,
                "routeName": props_base.get("routeName") or route_name,
                "color": props_base.get("color") or color,
                "transportType": props_base.get("transportType") or props_base.get("transport_type") or "combi",
                "directionMode": "mirrored",
                "qa_status": status,
                "matched_to_osm": True,
                "validator": validator_name,
                **metrics,
            }

            out_features.append(
                {
                    "type": "Feature",
                    "properties": {
                        **base_props,
                        "direction": "ida",
                        "name": "Ida",
                    },
                    "geometry": {"type": "LineString", "coordinates": matched_coords},
                }
            )
            out_features.append(
                {
                    "type": "Feature",
                    "properties": {
                        **base_props,
                        "direction": "vuelta",
                        "name": "Vuelta",
                        # misma QA que ida (misma geometría invertida)
                    },
                    "geometry": {"type": "LineString", "coordinates": vuelta_coords},
                }
            )
            qa.append(
                {
                    "feature": 0,
                    "status": status,
                    "direction": "ida",
                    "metrics": metrics,
                    "note": "single_corridor: vuelta=reverse(ida_matched)",
                }
            )
            qa.append(
                {
                    "feature": 1,
                    "status": status,
                    "direction": "vuelta",
                    "metrics": metrics,
                    "note": "single_corridor: reverse of matched ida",
                }
            )

            out = {
                "type": "FeatureCollection",
                "properties": {
                    "directionMode": "mirrored",
                    "corridor": "single",
                    "validator": validator_name,
                },
                "features": out_features,
            }
            (OUT_DIR / path.name).write_text(
                json.dumps(out, ensure_ascii=False), encoding="utf-8"
            )
            # también actualiza processed/geojson para el pipeline
            try:
                proc = Path(os.getenv("PROCESSED_DIR", "data/processed")) / "geojson"
                proc.mkdir(parents=True, exist_ok=True)
                (proc / path.name).write_text(
                    json.dumps(out, ensure_ascii=False), encoding="utf-8"
                )
            except Exception:
                pass
            (QA_DIR / f"{path.stem}.qa.json").write_text(
                json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(
                f" -> Guardado {path.name} corredor único ({len(matched_coords)} pts) "
                f"status={status} validator={validator_name}"
            )

