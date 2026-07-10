"""
Gris 1 Circuito (y similares): las 2 líneas del KML son el anillo ida y vuelta
(paralelas ~calles opuestas), como en el PDF oficial.

Proceso:
  1) Import KML → 2 LineStrings reales (ida y vuelta)
  2) Valhalla map-match de CADA una (eje vial)
  3) Guarda ambas (NO reverse de una sola)
  4) directionMode=dual_ring  → el mapa dibuja las DOS con el mismo color
     (aspecto idéntico al PDF: anillo completo) y etiqueta Ida / Vuelta

Uso:
  python scripts/build_dual_to_display_corridor.py ruta-gris-1-circuito
  python scripts/build_dual_to_display_corridor.py ruta-gris-1-circuito --publish
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(".env-valhalla")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from strict_map_match_valhalla_osrm import (  # noqa: E402
    valhalla_trace_route,
    estimate_metrics,
    qa_status,
)

ROOT = Path(__file__).resolve().parents[1]
GEOJSON_DIR = ROOT / "data" / "processed" / "geojson"
MATCHED_DIR = ROOT / "data" / "processed" / "matched"
PUBLIC_DIR = ROOT / "public" / "routes"
QA_DIR = ROOT / "data" / "qa-reports"


def direction_of(f: dict) -> str:
    p = f.get("properties") or {}
    return str(p.get("direction") or p.get("name") or "").lower()


def coords2d(f: dict) -> list:
    g = f.get("geometry") or {}
    if g.get("type") != "LineString":
        return []
    return [[float(c[0]), float(c[1])] for c in (g.get("coordinates") or []) if len(c) >= 2]


def densify(coords: list, max_pts: int = 450) -> list:
    if len(coords) <= max_pts:
        return coords
    step = max(1, len(coords) // max_pts)
    out = coords[::step]
    if out[-1] != coords[-1]:
        out.append(coords[-1])
    return out


def match_one(label: str, coords: list) -> tuple[list, dict, str, str]:
    print(f"  Valhalla match {label}: {len(coords)} pts…")
    sample = densify(coords, 450)
    try:
        matched, meta = valhalla_trace_route(sample)
        print(f"    OK {len(matched)} pts meta={meta}")
        metrics = estimate_metrics(sample, matched)
        status = qa_status(metrics)
        return matched, metrics, status, "valhalla+osrm-dual"
    except Exception as e:
        print(f"    FAIL {e}")
        return coords, {"avg_snap_m": 999, "max_snap_m": 999, "confidence": 0, "error": str(e)}, "needs_review", "raw-kml"


def worse_status(a: str, b: str) -> str:
    order = {"approved": 0, "needs_review": 1, "rejected": 2}
    return a if order.get(a, 9) >= order.get(b, 9) else b


def process(route_id: str, publish: bool) -> int:
    # Preferir import fresco desde KML (2 líneas)
    print(f"=== {route_id}: dual KML → Valhalla ambas → dibujo conjunto ===")
    src = GEOJSON_DIR / f"{route_id}.geojson"
    if not src.is_file():
        print("Falta geojson; corre import_rutastransporte_routes.py")
        return 1

    data = json.loads(src.read_text(encoding="utf-8"))
    feats = data.get("features") or []
    ida_f = next((f for f in feats if direction_of(f) == "ida"), None)
    vue_f = next((f for f in feats if direction_of(f) == "vuelta"), None)
    if not ida_f or not vue_f:
        print("ERROR: el GeoJSON debe traer ida y vuelta del KML (2 líneas reales).")
        return 1

    ida_raw = coords2d(ida_f)
    vue_raw = coords2d(vue_f)
    print(f"KML ida={len(ida_raw)} pts  vuelta={len(vue_raw)} pts")

    ida_m, met_i, st_i, val_i = match_one("ida", ida_raw)
    vue_m, met_v, st_v, val_v = match_one("vuelta", vue_raw)

    status = worse_status(st_i, st_v)
    # promedio de métricas para reporte
    metrics = {
        "avg_snap_m": round((float(met_i.get("avg_snap_m", 999)) + float(met_v.get("avg_snap_m", 999))) / 2, 2),
        "max_snap_m": max(float(met_i.get("max_snap_m", 999)), float(met_v.get("max_snap_m", 999))),
        "confidence": round(
            min(float(met_i.get("confidence", 0)), float(met_v.get("confidence", 0))), 3
        ),
        "ida_metrics": met_i,
        "vuelta_metrics": met_v,
    }

    props0 = dict(ida_f.get("properties") or {})
    for k in ("direction", "name", "directionMode", "qa_status", "validator", "corridor"):
        props0.pop(k, None)
    props0.update(
        {
            "routeId": route_id,
            "routeName": props0.get("routeName") or "Gris 1 Circuito",
            "color": props0.get("color") or "#6b7280",
            "casingColor": props0.get("casingColor") or "#222222",
            "transportType": props0.get("transportType") or "combi",
            "directionMode": "dual_ring",
            "corridor": "both_kml_lines",
            "note": "Ambas líneas del KML (como PDF). Ida y Vuelta reales, no reverse.",
        }
    )

    def feat(direction: str, name: str, coords: list, met: dict, st: str, val: str) -> dict:
        return {
            "type": "Feature",
            "properties": {
                **props0,
                "direction": direction,
                "name": name,
                "directionMode": "dual_ring",
                "corridor": "both_kml_lines",
                "qa_status": st,
                "matched_to_osm": True,
                "validator": val,
                "avg_snap_m": met.get("avg_snap_m"),
                "max_snap_m": met.get("max_snap_m"),
                "confidence": met.get("confidence"),
            },
            "geometry": {"type": "LineString", "coordinates": coords},
        }

    out = {
        "type": "FeatureCollection",
        "properties": {
            "directionMode": "dual_ring",
            "corridor": "both_kml_lines",
            "routeId": route_id,
            "display": "draw_both_same_style",
        },
        "features": [
            feat("ida", "Ida", ida_m, met_i, st_i, val_i),
            feat("vuelta", "Vuelta", vue_m, met_v, st_v, val_v),
        ],
    }

    text = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    MATCHED_DIR.mkdir(parents=True, exist_ok=True)
    GEOJSON_DIR.mkdir(parents=True, exist_ok=True)
    (MATCHED_DIR / f"{route_id}.geojson").write_text(text, encoding="utf-8")
    (GEOJSON_DIR / f"{route_id}.geojson").write_text(text, encoding="utf-8")

    if publish or status == "approved":
        PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
        (PUBLIC_DIR / f"{route_id}.geojson").write_text(text, encoding="utf-8")
        try:
            from qa_validate_routes import update_routes_index

            update_routes_index(
                route_id, props0["routeName"], props0["color"], props0["transportType"]
            )
        except Exception as e:
            print("index warn", e)

    QA_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "file": f"data/processed/matched/{route_id}.geojson",
        "route_id": route_id,
        "route_name": props0["routeName"],
        "status": status,
        "publishable": status == "approved",
        "issues": [],
        "directions": [
            {
                "direction": "ida",
                "qa_status": st_i,
                "validator": val_i,
                "avg_snap_m": met_i.get("avg_snap_m"),
                "max_snap_m": met_i.get("max_snap_m"),
                "confidence": met_i.get("confidence"),
            },
            {
                "direction": "vuelta",
                "qa_status": st_v,
                "validator": val_v,
                "avg_snap_m": met_v.get("avg_snap_m"),
                "max_snap_m": met_v.get("max_snap_m"),
                "confidence": met_v.get("confidence"),
            },
        ],
        "pass": status == "approved",
        "corridor": "both_kml_lines",
        "note": "PDF Gris 1: anillo dual. Se dibujan ambas líneas del KML (ida+vuelta reales).",
    }
    if status != "approved":
        report["issues"].append(
            {"severity": "review", "issue": f"status={status} metrics={metrics}"}
        )
    (QA_DIR / f"{route_id}.final_qa.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(
        f"OK {route_id}: status={status} ida_pts={len(ida_m)} vuelta_pts={len(vue_m)} "
        f"snap≈{metrics['avg_snap_m']} conf≈{metrics['confidence']}"
    )
    print("  Ambas líneas KML matcheadas y listas para dibujar juntas (como el PDF).")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("route_id", nargs="?", default="ruta-gris-1-circuito")
    ap.add_argument("--publish", action="store_true")
    args = ap.parse_args()
    return process(args.route_id, publish=args.publish)


if __name__ == "__main__":
    raise SystemExit(main())
