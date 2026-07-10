"""
Construye UN solo corredor continuo a partir de las DOS líneas del KML (ida+vuelta).

No usa reverse(ida) como “vuelta” de dibujo base.
En cambio:
  1) Lee ida y vuelta del GeoJSON importado desde KML
  2) Las orienta y encadena en el orden de menor hueco
  3) Si el hueco > bridge_m, rellena con Valhalla /route (eje vial real, no inventa)
  4) Map-match del corredor unificado con Valhalla trace
  5) Guarda:
       - ida   = corredor unificado matcheado (pasa por AMBAS líneas del KML)
       - vuelta = reverse(ida) solo para sentido / etiquetas
       - directionMode = mirrored + corridor=unified_both_kml

Uso:
  python scripts/build_unified_corridor.py ruta-gris-1-circuito
  python scripts/build_unified_corridor.py ruta-gris-1-circuito --no-valhalla-bridge
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(".env-valhalla")

# Reusar match Valhalla del pipeline estricto
sys.path.insert(0, str(Path(__file__).resolve().parent))
from strict_map_match_valhalla_osrm import (  # noqa: E402
    valhalla_trace_route,
    estimate_metrics,
    qa_status,
    VALHALLA_URL,
)

ROOT = Path(__file__).resolve().parents[1]
GEOJSON_DIR = ROOT / "data" / "processed" / "geojson"
MATCHED_DIR = ROOT / "data" / "processed" / "matched"
PUBLIC_DIR = ROOT / "public" / "routes"
QA_DIR = ROOT / "data" / "qa-reports"


def haversine_m(a, b) -> float:
    R = 6371000.0
    lon1, lat1 = math.radians(a[0]), math.radians(a[1])
    lon2, lat2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(h)))


def path_len(coords: list) -> float:
    if len(coords) < 2:
        return 0.0
    return sum(haversine_m(coords[i], coords[i + 1]) for i in range(len(coords) - 1))


def direction_of(f: dict) -> str:
    p = f.get("properties") or {}
    return str(p.get("direction") or p.get("name") or "").lower()


def coords2d(f: dict) -> list:
    g = f.get("geometry") or {}
    if g.get("type") != "LineString":
        return []
    return [[float(c[0]), float(c[1])] for c in g.get("coordinates") or [] if len(c) >= 2]


def open_ring(coords: list, tol_m: float = 40.0) -> list:
    """Si es anillo cerrado (inicio≈fin), quita el punto final duplicado para encadenar."""
    if len(coords) < 3:
        return coords
    if haversine_m(coords[0], coords[-1]) <= tol_m:
        return coords[:-1]
    return coords


def best_chain(a: list, b: list) -> tuple[list, dict]:
    """
    Prueba orden A-B / B-A y 4 orientaciones; elige el de menor hueco de conexión.
    Devuelve coords unificadas + metadata.
    """
    a0 = open_ring(a)
    b0 = open_ring(b)
    candidates = []
    for order, la, lb in (("a_then_b", a0, b0), ("b_then_a", b0, a0)):
        for rev1 in (False, True):
            for rev2 in (False, True):
                c1 = list(reversed(la)) if rev1 else list(la)
                c2 = list(reversed(lb)) if rev2 else list(lb)
                gap = haversine_m(c1[-1], c2[0])
                candidates.append(
                    {
                        "order": order,
                        "rev1": rev1,
                        "rev2": rev2,
                        "gap_m": gap,
                        "c1": c1,
                        "c2": c2,
                    }
                )
    candidates.sort(key=lambda x: x["gap_m"])
    best = candidates[0]
    return best["c1"], best["c2"], best


def valhalla_bridge(p1: list, p2: list) -> list:
    """Ruta por ejes viales entre dos puntos (sin inventar rectas)."""
    import requests

    url = f"{VALHALLA_URL}/route"
    body = {
        "locations": [
            {"lon": p1[0], "lat": p1[1]},
            {"lon": p2[0], "lat": p2[1]},
        ],
        "costing": "auto",
        "directions_options": {"units": "kilometers"},
        "shape_format": "polyline6",
    }
    r = requests.post(url, json=body, timeout=60)
    r.raise_for_status()
    data = r.json()
    # shape en trip.legs o trip
    shape = None
    trip = data.get("trip") or {}
    if trip.get("legs"):
        # concatenar shapes de legs
        from strict_map_match_valhalla_osrm import decode_polyline6

        pts = []
        for leg in trip["legs"]:
            s = leg.get("shape")
            if s:
                pts.extend(decode_polyline6(s))
        return pts if len(pts) >= 2 else []
    shape = trip.get("shape")
    if shape:
        from strict_map_match_valhalla_osrm import decode_polyline6

        return decode_polyline6(shape)
    return []


def stitch(c1: list, c2: list, gap_m: float, bridge_threshold_m: float, use_bridge: bool) -> tuple[list, str]:
    if gap_m <= 25.0:
        # extremos casi iguales: no duplicar punto
        if haversine_m(c1[-1], c2[0]) < 5:
            return c1 + c2[1:], "adjacent"
        return c1 + c2, "near_concat"

    if use_bridge and gap_m <= bridge_threshold_m:
        try:
            bridge = valhalla_bridge(c1[-1], c2[0])
            if len(bridge) >= 2:
                # evitar duplicar extremos
                mid = bridge[1:-1] if len(bridge) > 2 else []
                return c1 + mid + c2, "valhalla_bridge"
        except Exception as e:
            print(f"  [warn] bridge Valhalla falló ({e}), concatenando directo")
    return c1 + c2, "concat_raw"


def densify_for_match(coords: list, max_pts: int = 400) -> list:
    """Reduce densidad para Valhalla si hay demasiados puntos (mantiene extremos)."""
    if len(coords) <= max_pts:
        return coords
    step = max(1, len(coords) // max_pts)
    out = coords[::step]
    if out[-1] != coords[-1]:
        out.append(coords[-1])
    return out


def build_feature(route_id: str, props: dict, direction: str, name: str, coords: list, metrics: dict, status: str, validator: str) -> dict:
    p = {
        **props,
        "routeId": route_id,
        "direction": direction,
        "name": name,
        "directionMode": "mirrored",
        "corridor": "unified_both_kml",
        "qa_status": status,
        "matched_to_osm": True,
        "validator": validator,
        **metrics,
    }
    return {
        "type": "Feature",
        "properties": p,
        "geometry": {"type": "LineString", "coordinates": coords},
    }


def process_route(route_id: str, use_bridge: bool = True, publish: bool = False) -> int:
    src = GEOJSON_DIR / f"{route_id}.geojson"
    if not src.is_file():
        print(f"ERROR: no existe {src}. Corre import_rutastransporte_routes.py primero.")
        return 1

    data = json.loads(src.read_text(encoding="utf-8"))
    feats = data.get("features") or []
    ida_f = next((f for f in feats if direction_of(f) == "ida"), None)
    vue_f = next((f for f in feats if direction_of(f) == "vuelta"), None)
    if not ida_f or not vue_f:
        print("ERROR: se necesitan exactamente ida y vuelta en el GeoJSON de entrada (desde KML).")
        return 1

    ida_c = coords2d(ida_f)
    vue_c = coords2d(vue_f)
    print(f"KML ida:    {len(ida_c)} pts, {path_len(ida_c)/1000:.1f} km")
    print(f"KML vuelta: {len(vue_c)} pts, {path_len(vue_c)/1000:.1f} km")

    c1, c2, meta = best_chain(ida_c, vue_c)
    print(
        f"Encadenado: order={meta['order']} rev1={meta['rev1']} rev2={meta['rev2']} "
        f"gap={meta['gap_m']:.1f} m"
    )

    unified, stitch_mode = stitch(c1, c2, meta["gap_m"], bridge_threshold_m=400.0, use_bridge=use_bridge)
    print(f"Stitch mode={stitch_mode}, pts unificados={len(unified)}, len={path_len(unified)/1000:.1f} km")

    # Map-match Valhalla del corredor único (ambas líneas KML)
    to_match = densify_for_match(unified, max_pts=500)
    print(f"Valhalla trace sobre {len(to_match)} pts…")
    try:
        matched, trace_meta = valhalla_trace_route(to_match)
        print(f"  Valhalla OK: {len(matched)} pts, meta={trace_meta}")
        metrics = estimate_metrics(to_match, matched)
        status = qa_status(metrics)
        validator = "valhalla+osrm-unified"
    except Exception as e:
        print(f"  Valhalla falló: {e}")
        matched = unified
        metrics = {
            "avg_snap_m": 999,
            "max_snap_m": 999,
            "confidence": 0,
            "note": f"valhalla_failed: {e}",
        }
        status = "needs_review"
        validator = "unified-raw-kml"

    if len(matched) < 2:
        print("ERROR: match vacío")
        return 1

    props0 = dict(ida_f.get("properties") or {})
    for k in ("direction", "name", "directionMode", "qa_status", "validator"):
        props0.pop(k, None)
    props0["routeName"] = props0.get("routeName") or route_id.replace("-", " ").title()
    props0["color"] = props0.get("color") or "#6b7280"
    props0["casingColor"] = props0.get("casingColor") or "#222222"
    props0["transportType"] = props0.get("transportType") or "combi"
    props0["unified_from"] = "kml_ida+kml_vuelta"
    props0["stitch"] = stitch_mode
    props0["chain_gap_m"] = round(meta["gap_m"], 2)

    # ida = corredor unificado completo; vuelta = reverse (sentido contrario por el mismo corredor)
    ida_matched = matched
    vuelta_matched = list(reversed(matched))

    out = {
        "type": "FeatureCollection",
        "properties": {
            "directionMode": "mirrored",
            "corridor": "unified_both_kml",
            "routeId": route_id,
            "stitch": stitch_mode,
            "chain_gap_m": round(meta["gap_m"], 2),
        },
        "features": [
            build_feature(route_id, props0, "ida", "Ida", ida_matched, metrics, status, validator),
            build_feature(
                route_id, props0, "vuelta", "Vuelta", vuelta_matched, metrics, status, validator
            ),
        ],
    }

    MATCHED_DIR.mkdir(parents=True, exist_ok=True)
    GEOJSON_DIR.mkdir(parents=True, exist_ok=True)
    text = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    (MATCHED_DIR / f"{route_id}.geojson").write_text(text, encoding="utf-8")
    (GEOJSON_DIR / f"{route_id}.geojson").write_text(text, encoding="utf-8")

    should_publish = publish or status == "approved"
    if should_publish:
        PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
        (PUBLIC_DIR / f"{route_id}.geojson").write_text(text, encoding="utf-8")
        try:
            from qa_validate_routes import update_routes_index

            update_routes_index(
                route_id,
                props0["routeName"],
                props0["color"],
                props0["transportType"],
            )
        except Exception as e:
            print(f"  [warn] index: {e}")

    # mini QA report
    QA_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "file": f"data/processed/matched/{route_id}.geojson",
        "route_id": route_id,
        "route_name": props0["routeName"],
        "status": status if status in ("approved", "needs_review", "rejected") else "needs_review",
        "publishable": status == "approved",
        "issues": [],
        "directions": [
            {
                "direction": "ida",
                "qa_status": status,
                "validator": validator,
                **{k: metrics.get(k) for k in ("avg_snap_m", "max_snap_m", "confidence")},
            },
            {
                "direction": "vuelta",
                "qa_status": status,
                "validator": validator,
                **{k: metrics.get(k) for k in ("avg_snap_m", "max_snap_m", "confidence")},
            },
        ],
        "pass": status == "approved",
        "corridor": "unified_both_kml",
        "stitch": stitch_mode,
        "chain_gap_m": round(meta["gap_m"], 2),
        "note": "Una sola línea que recorre ambas trayectorias del KML (ida+vuelta unificadas).",
    }
    if status != "approved":
        report["issues"].append(
            {
                "severity": "review" if status == "needs_review" else "critical",
                "issue": f"unified corridor status={status} metrics={metrics}",
            }
        )
    (QA_DIR / f"{route_id}.final_qa.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (QA_DIR / f"{route_id}.qa.json").write_text(
        json.dumps(
            [{"status": status, "metrics": metrics, "corridor": "unified_both_kml"}],
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        f"OK {route_id}: status={status} pts={len(matched)} "
        f"avg_snap={metrics.get('avg_snap_m')} conf={metrics.get('confidence')}"
    )
    print(f"  matched → {MATCHED_DIR / (route_id + '.geojson')}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Unifica ida+vuelta del KML en una sola línea y matchea con Valhalla"
    )
    ap.add_argument("route_id", nargs="?", default="ruta-gris-1-circuito")
    ap.add_argument("--no-valhalla-bridge", action="store_true")
    ap.add_argument("--publish", action="store_true", help="Fuerza copia a public/routes")
    args = ap.parse_args()
    return process_route(
        args.route_id,
        use_bridge=not args.no_valhalla_bridge,
        publish=args.publish,
    )


if __name__ == "__main__":
    raise SystemExit(main())
