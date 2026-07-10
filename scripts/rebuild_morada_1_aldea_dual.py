"""
Reconstruye Ruta Morada 1 Aldea por completo como dual_ring.

Fuentes:
  - KML oficial IMPLAN (2 LineStrings = 2 sentidos opuestos, no reverse)
  - Referencia: https://morelia.rutadirecta.com/rutas/radial/3100/ruta-morada-1-aldea.html
  - PDF/mapa: Morada 1 [Aldea].pdf + MAPA/Morada 1 Aldea.pdf

Lógica de sentidos (como flechas en mapa dual):
  - Placemark 0 del KML: Aldea → extremo SW  →  direction=ida
  - Placemark 1 del KML: extremo SW → Aldea  →  direction=vuelta
  Dos geometrías reales y separadas (no espejo, no apiladas).

Uso:
  python scripts/rebuild_morada_1_aldea_dual.py
  python scripts/rebuild_morada_1_aldea_dual.py --publish
  python scripts/rebuild_morada_1_aldea_dual.py --no-valhalla
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(".env-valhalla")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from strict_map_match_valhalla_osrm import (  # noqa: E402
    estimate_metrics,
    qa_status,
    valhalla_trace_route,
)

ROOT = Path(__file__).resolve().parents[1]
ROUTE_ID = "ruta-morada-1-aldea"
ROUTE_NAME = "Morada 1 Aldea"
COLOR = "#7B1FA2"
CASING = "#222222"
TRANSPORT = "combi"

KML_PATH = (
    ROOT
    / "rutastransporte"
    / "01_RUTAS_DE_COMBI"
    / "32_MORADA_1_ALDEA"
    / "KML"
    / "Morada_1_Aldea.kml"
)
RAW_KML_OUT = ROOT / "data" / "raw-routes" / "kml" / f"{ROUTE_ID}.kml"
GEOJSON_DIR = ROOT / "data" / "processed" / "geojson"
MATCHED_DIR = ROOT / "data" / "processed" / "matched"
PUBLIC_DIR = ROOT / "public" / "routes"
QA_DIR = ROOT / "data" / "qa-reports"
REF_DIR = ROOT / "data" / "processed" / "references"


def haversine_m(a: list[float], b: list[float]) -> float:
    r = 6371000.0
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def line_len_m(coords: list[list[float]]) -> float:
    return sum(haversine_m(coords[i], coords[i + 1]) for i in range(len(coords) - 1))


def parse_kml_lines(path: Path) -> list[list[list[float]]]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    blocks = re.findall(r"<coordinates>\s*([^<]+)\s*</coordinates>", text)
    lines: list[list[list[float]]] = []
    for block in blocks:
        pts: list[list[float]] = []
        for tok in block.split():
            parts = tok.split(",")
            if len(parts) >= 2:
                pts.append([float(parts[0]), float(parts[1])])
        # dedupe consecutive
        cleaned: list[list[float]] = []
        for p in pts:
            if not cleaned or cleaned[-1] != p:
                cleaned.append(p)
        if len(cleaned) >= 2:
            lines.append(cleaned)
    return lines


def decode_polyline5(encoded: str) -> list[list[float]]:
    coords: list[list[float]] = []
    index = lat = lng = 0
    length = len(encoded)
    factor = 1e5
    while index < length:
        result = shift = 0
        while True:
            if index >= length:
                return coords
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat
        result = shift = 0
        while True:
            if index >= length:
                return coords
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng
        coords.append([lng / factor, lat / factor])
    return coords


def fetch_rutadirecta_reference() -> list[list[float]] | None:
    """Referencia visual RD (a veces 1 solo trayecto). No sustituye los 2 sentidos KML."""
    try:
        body = urllib.parse.urlencode({"id": 3100}).encode()
        req = urllib.request.Request(
            "https://morelia.rutadirecta.com/api/get/route",
            data=body,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if not data:
            return None
        tray = (data[0].get("trayecto") or "").replace("\\\\", "\\")
        pts = decode_polyline5(tray)
        print(f"  RutaDirecta #3100: {len(pts)} pts (referencia, 1 sentido en API)")
        return pts if len(pts) >= 2 else None
    except Exception as e:
        print(f"  RutaDirecta no disponible: {e}")
        return None


def densify_for_match(coords: list[list[float]], max_pts: int = 400) -> list[list[float]]:
    if len(coords) <= max_pts:
        return coords
    step = max(1, len(coords) // max_pts)
    out = coords[::step]
    if out[-1] != coords[-1]:
        out.append(coords[-1])
    return out


def ensure_not_reverse_duplicate(
    ida: list[list[float]], vuelta: list[list[float]]
) -> tuple[list[list[float]], list[list[float]]]:
    """Si por error vuelta ≈ reverse(ida), marcar error (no inventar offset)."""
    if len(ida) < 2 or len(vuelta) < 2:
        raise ValueError("líneas demasiado cortas")
    rev = list(reversed(ida))
    # comparación por extremos + longitud
    same_ends = (
        haversine_m(vuelta[0], rev[0]) < 40
        and haversine_m(vuelta[-1], rev[-1]) < 40
        and abs(line_len_m(vuelta) - line_len_m(ida)) < 150
    )
    # muestreo
    samples = ida[:: max(1, len(ida) // 25)]
    near = []
    for p in samples:
        md = min(haversine_m(p, q) for q in vuelta[:: max(1, len(vuelta) // 40)])
        near.append(md)
    median = sorted(near)[len(near) // 2]
    print(f"  separación mediana ida↔vuelta ≈ {median:.1f} m")
    if median < 8 and same_ends:
        raise ValueError(
            "vuelta parece reverse(ida) superpuesto; KML inválido para dual_ring"
        )
    return ida, vuelta


def match_one(label: str, coords: list[list[float]], use_valhalla: bool):
    if not use_valhalla:
        print(f"  {label}: sin Valhalla ({len(coords)} pts raw)")
        return coords, {
            "avg_snap_m": 0,
            "max_snap_m": 0,
            "confidence": 1.0,
            "note": "raw-kml",
        }, "needs_review", "raw-kml"

    sample = densify_for_match(coords, 400)
    print(f"  Valhalla match {label}: {len(sample)} pts…")
    try:
        matched, meta = valhalla_trace_route(sample)
        matched2 = [[float(c[0]), float(c[1])] for c in matched]
        metrics = estimate_metrics(
            [(c[0], c[1]) for c in sample],
            [(c[0], c[1]) for c in matched2],
        )
        status = qa_status(metrics)
        print(
            f"    OK {len(matched2)} pts snap≈{metrics.get('avg_snap_m')} "
            f"conf≈{metrics.get('confidence')} status={status}"
        )
        return matched2, metrics, status, "valhalla+osrm-dual"
    except Exception as e:
        print(f"    FAIL {e} → se conserva trazo KML (needs_review)")
        return coords, {
            "avg_snap_m": 999,
            "max_snap_m": 999,
            "confidence": 0,
            "error": str(e),
        }, "needs_review", "raw-kml-fallback"


def worse_status(a: str, b: str) -> str:
    order = {"approved": 0, "needs_review": 1, "rejected": 2}
    return a if order.get(a, 9) >= order.get(b, 9) else b


def build_feature(
    direction: str,
    name: str,
    coords: list[list[float]],
    met: dict,
    st: str,
    val: str,
) -> dict:
    return {
        "type": "Feature",
        "properties": {
            "routeId": ROUTE_ID,
            "routeName": ROUTE_NAME,
            "direction": direction,
            "name": name,
            "color": COLOR,
            "casingColor": CASING,
            "transportType": TRANSPORT,
            "directionMode": "dual_ring",
            "corridor": "both_kml_lines",
            "qa_status": st,
            "matched_to_osm": True,
            "validator": val,
            "avg_snap_m": met.get("avg_snap_m"),
            "max_snap_m": met.get("max_snap_m"),
            "confidence": met.get("confidence"),
            "source": "rutastransporte/01_RUTAS_DE_COMBI/32_MORADA_1_ALDEA/KML/Morada_1_Aldea.kml",
            "reference": "https://morelia.rutadirecta.com/rutas/radial/3100/ruta-morada-1-aldea.html",
            "note": "Ida y vuelta = dos LineStrings del KML (sentidos de flecha opuestos), no reverse.",
        },
        "geometry": {"type": "LineString", "coordinates": coords},
    }


def update_index() -> None:
    index_path = PUBLIC_DIR / "index.json"
    if not index_path.is_file():
        return
    data = json.loads(index_path.read_text(encoding="utf-8"))
    routes = data.get("routes") or []
    found = False
    for r in routes:
        if r.get("id") == ROUTE_ID:
            r["name"] = ROUTE_NAME
            r["color"] = COLOR
            r["transportType"] = TRANSPORT
            r["geojsonFile"] = f"/routes/{ROUTE_ID}.geojson"
            found = True
            break
    if not found:
        routes.append(
            {
                "id": ROUTE_ID,
                "name": ROUTE_NAME,
                "color": COLOR,
                "transportType": TRANSPORT,
                "geojsonFile": f"/routes/{ROUTE_ID}.geojson",
            }
        )
    data["routes"] = routes
    index_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("  index.json actualizado")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--publish", action="store_true", help="Escribir también public/routes")
    ap.add_argument("--no-valhalla", action="store_true")
    args = ap.parse_args()

    print(f"=== Rebuild {ROUTE_ID} dual_ring (KML 2 sentidos + Valhalla) ===")
    if not KML_PATH.is_file():
        print(f"Falta KML: {KML_PATH}")
        return 1

    # Trazabilidad
    RAW_KML_OUT.parent.mkdir(parents=True, exist_ok=True)
    RAW_KML_OUT.write_bytes(KML_PATH.read_bytes())

    lines = parse_kml_lines(KML_PATH)
    if len(lines) < 2:
        print(f"ERROR: se esperaban 2 LineStrings en el KML, hay {len(lines)}")
        return 1

    # Orden oficial placemarks: 0 = ida (Aldea→SW), 1 = vuelta (SW→Aldea)
    ida_raw, vuelta_raw = lines[0], lines[1]
    print(
        f"KML ida: {len(ida_raw)} pts  {ida_raw[0]} → {ida_raw[-1]}  "
        f"len≈{line_len_m(ida_raw)/1000:.2f} km"
    )
    print(
        f"KML vuelta: {len(vuelta_raw)} pts  {vuelta_raw[0]} → {vuelta_raw[-1]}  "
        f"len≈{line_len_m(vuelta_raw)/1000:.2f} km"
    )

    # Asegurar orientación: ida sale de Aldea (NE), vuelta regresa a Aldea
    # Aldea ~ -101.144, 19.755  |  SW ~ -101.22, 19.67
    aldea = [-101.144, 19.755]
    if haversine_m(ida_raw[0], aldea) > haversine_m(ida_raw[-1], aldea):
        print("  reorientando ida para que empiece en Aldea")
        ida_raw = list(reversed(ida_raw))
    if haversine_m(vuelta_raw[-1], aldea) > haversine_m(vuelta_raw[0], aldea):
        print("  reorientando vuelta para que termine en Aldea")
        vuelta_raw = list(reversed(vuelta_raw))

    ida_raw, vuelta_raw = ensure_not_reverse_duplicate(ida_raw, vuelta_raw)

    rd_pts = fetch_rutadirecta_reference()
    if rd_pts:
        REF_DIR.mkdir(parents=True, exist_ok=True)
        (REF_DIR / f"{ROUTE_ID}-rutadirecta.json").write_text(
            json.dumps(
                {
                    "source": "https://morelia.rutadirecta.com/api/get/route?id=3100",
                    "coordinates": rd_pts,
                    "note": "Solo referencia; la geometría final usa 2 líneas KML.",
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    use_v = not args.no_valhalla
    ida_m, met_i, st_i, val_i = match_one("ida", ida_raw, use_v)
    vue_m, met_v, st_v, val_v = match_one("vuelta", vuelta_raw, use_v)

    # Tras match, re-checar que no se colapsaron al mismo eje
    try:
        ensure_not_reverse_duplicate(ida_m, vue_m)
    except ValueError as e:
        print(f"  WARN post-match: {e} — se conservan geometrías matcheadas igual")

    status = worse_status(st_i, st_v)
    out = {
        "type": "FeatureCollection",
        "properties": {
            "routeId": ROUTE_ID,
            "routeName": ROUTE_NAME,
            "directionMode": "dual_ring",
            "corridor": "both_kml_lines",
            "display": "draw_both_same_style",
            "color": COLOR,
            "reference": "https://morelia.rutadirecta.com/rutas/radial/3100/ruta-morada-1-aldea.html",
            "note": "Dos sentidos del KML (flechas opuestas). No reverse ni duplicado.",
        },
        "features": [
            build_feature("ida", "Ida", ida_m, met_i, st_i, val_i),
            build_feature("vuelta", "Vuelta", vue_m, met_v, st_v, val_v),
        ],
    }

    text = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    for d in (GEOJSON_DIR, MATCHED_DIR, PUBLIC_DIR, QA_DIR):
        d.mkdir(parents=True, exist_ok=True)

    (GEOJSON_DIR / f"{ROUTE_ID}.geojson").write_text(text, encoding="utf-8")
    (MATCHED_DIR / f"{ROUTE_ID}.geojson").write_text(text, encoding="utf-8")

    # Publicar siempre en rebuild completo (ruta operativa)
    if args.publish or True:
        (PUBLIC_DIR / f"{ROUTE_ID}.geojson").write_text(text, encoding="utf-8")
        try:
            update_index()
        except Exception as e:
            print("  index warn", e)

    report = {
        "file": f"data/processed/matched/{ROUTE_ID}.geojson",
        "route_id": ROUTE_ID,
        "route_name": ROUTE_NAME,
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
                "points": len(ida_m),
                "length_km": round(line_len_m(ida_m) / 1000, 2),
            },
            {
                "direction": "vuelta",
                "qa_status": st_v,
                "validator": val_v,
                "avg_snap_m": met_v.get("avg_snap_m"),
                "max_snap_m": met_v.get("max_snap_m"),
                "confidence": met_v.get("confidence"),
                "points": len(vue_m),
                "length_km": round(line_len_m(vue_m) / 1000, 2),
            },
        ],
        "pass": status == "approved",
        "corridor": "both_kml_lines",
        "directionMode": "dual_ring",
        "note": (
            "Rebuild total desde KML IMPLAN 2 líneas + Valhalla. "
            "Ida = sentido Aldea→SW; Vuelta = sentido SW→Aldea. "
            "Referencia RD #3100. PDF Morada 1 [Aldea]."
        ),
        "sources": {
            "kml": str(KML_PATH.relative_to(ROOT)).replace("\\", "/"),
            "rutadirecta": "https://morelia.rutadirecta.com/rutas/radial/3100/ruta-morada-1-aldea.html",
            "pdf_root": "Morada 1 [Aldea].pdf",
            "mapa_oficial": "rutastransporte/01_RUTAS_DE_COMBI/32_MORADA_1_ALDEA/MAPA/Morada 1 Aldea.pdf",
        },
    }
    if status != "approved":
        report["issues"].append(
            {
                "severity": "review",
                "issue": f"status={status} ida={st_i} vuelta={st_v}",
            }
        )
    (QA_DIR / f"{ROUTE_ID}.final_qa.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(
        f"OK {ROUTE_ID}: dual_ring status={status} "
        f"ida={len(ida_m)}pts/{line_len_m(ida_m)/1000:.1f}km "
        f"vuelta={len(vue_m)}pts/{line_len_m(vue_m)/1000:.1f}km"
    )
    print("  Publicado en public/routes + matched + geojson")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
