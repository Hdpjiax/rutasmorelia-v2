"""QA geoespacial estricto: exactamente dos sentidos (ida/vuelta), eje vial y reportes."""
from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from shapely.geometry import shape
from shapely.validation import explain_validity

load_dotenv(".env-valhalla")

if os.name != "nt":
    for key, val in list(os.environ.items()):
        if val.startswith("d:/") or val.startswith("D:/"):
            os.environ[key] = val.replace("d:/", "/mnt/d/").replace("D:/", "/mnt/d/")

IN_DIR = Path(os.getenv("PROCESSED_DIR", "data/processed")) / "matched"
QA_DIR = Path(os.getenv("QA_REPORT_DIR", "data/qa-reports"))
PUBLIC_ROUTES_DIR = Path("public/routes")
QA_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_ROUTES_DIR.mkdir(parents=True, exist_ok=True)

REQUIRE_TWO = os.getenv("REQUIRE_TWO_DIRECTIONS", "true").lower() == "true"
ONLY = set(os.getenv("ONLY_DIRECTIONS", "ida,vuelta").split(","))
MAX_GAP_M = float(os.getenv("MAX_GAP_M", "25"))
MAX_GAP_MATCHED_M = float(os.getenv("MAX_GAP_MATCHED_M", "500"))
MAX_SNAP_M = float(os.getenv("MAX_SNAP_DISTANCE_M", "18"))
MIN_ROUTE_LENGTH_M = float(os.getenv("MIN_ROUTE_LENGTH_M", "500"))
STRICT_CONFIDENCE = float(os.getenv("VALHALLA_MIN_CONFIDENCE", "0.92"))
ALLOW_FALLBACK = os.getenv("QA_ALLOW_FALLBACK_PUBLISH", "false").lower() == "true"
_only = os.getenv("ONLY_ROUTES", "").strip()
ONLY_ROUTES = {x.strip() for x in _only.split(",") if x.strip()} if _only else None


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def line_length_m(coords: list) -> float:
    total = 0.0
    for i in range(1, len(coords)):
        lon1, lat1 = coords[i - 1][0], coords[i - 1][1]
        lon2, lat2 = coords[i][0], coords[i][1]
        total += haversine_m(lon1, lat1, lon2, lat2)
    return total


def decimate_coords(coords: list, step_m: float = 35.0) -> list:
    """Muestrea vértices ~cada step_m sin inventar saltos mayores al segmento real."""
    if len(coords) < 2:
        return coords
    out = [coords[0]]
    acc = 0.0
    for i in range(1, len(coords)):
        lon1, lat1 = coords[i - 1][0], coords[i - 1][1]
        lon2, lat2 = coords[i][0], coords[i][1]
        seg = haversine_m(lon1, lat1, lon2, lat2)
        # Si un segmento ya es grande, no acumularlo con el resto (evita gaps fantasma)
        if seg >= step_m:
            if out[-1] != coords[i - 1]:
                out.append(coords[i - 1])
            out.append(coords[i])
            acc = 0.0
            continue
        acc += seg
        if acc >= step_m:
            out.append(coords[i])
            acc = 0.0
    if out[-1] != coords[-1]:
        out.append(coords[-1])
    return out


def find_gaps(coords: list, max_gap_m: float) -> list[dict]:
    gaps = []
    for i in range(1, len(coords)):
        lon1, lat1 = coords[i - 1][0], coords[i - 1][1]
        lon2, lat2 = coords[i][0], coords[i][1]
        dist = haversine_m(lon1, lat1, lon2, lat2)
        if dist > max_gap_m:
            gaps.append({"index": i, "distance_m": round(dist, 2)})
    return gaps


def update_routes_index(route_id: str, route_name: str, color: str, transport_type: str) -> None:
    index_path = PUBLIC_ROUTES_DIR / "index.json"
    if index_path.exists():
        try:
            index_data = json.loads(index_path.read_text(encoding="utf-8"))
        except Exception:
            index_data = {"type": "routes-index", "routes": []}
    else:
        index_data = {"type": "routes-index", "routes": []}

    routes_list = index_data.setdefault("routes", [])
    color_letter = route_name.replace("Ruta", "").strip()[0].upper() if route_name else "R"
    color_name = (
        "Rojo" if "roja" in route_id else "Amarillo" if "amarilla" in route_id else "Azul"
    )
    new_route_entry = {
        "id": route_id,
        "name": route_name,
        "color": color,
        "transportType": transport_type,
        "colorName": color_name,
        "colorLetter": color_letter,
        "geojsonFile": f"/routes/{route_id}.geojson",
    }
    existing_idx = next((i for i, r in enumerate(routes_list) if r["id"] == route_id), None)
    if existing_idx is not None:
        routes_list[existing_idx] = new_route_entry
    else:
        routes_list.append(new_route_entry)
    index_path.write_text(json.dumps(index_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f" -> Actualizado index.json con la ruta: {route_id}")


def assess_feature(props: dict, geom_dict: dict, feature_idx: int) -> list[dict]:
    validator = props.get("validator", "")
    is_valhalla = "valhalla" in str(validator).lower() and "fallback" not in str(validator).lower()
    issues: list[dict] = []
    direction = (props.get("direction") or props.get("name") or f"feature-{feature_idx}").lower()

    if not geom_dict:
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "critical",
                "issue": "Geometría faltante o vacía",
            }
        )
        return issues

    geom = shape(geom_dict)
    if not geom.is_valid:
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "critical",
                "issue": explain_validity(geom),
            }
        )
    if geom.length == 0:
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "critical",
                "issue": "longitud cero",
            }
        )

    coords = list(geom.coords) if geom.geom_type == "LineString" else []
    if len(coords) < 2:
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "critical",
                "issue": "menos de 2 vértices",
            }
        )
        return issues

    length_m = line_length_m(coords)
    if length_m < MIN_ROUTE_LENGTH_M:
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "critical",
                "issue": f"longitud {length_m:.0f}m < mínimo {MIN_ROUTE_LENGTH_M:.0f}m",
            }
        )

    gap_threshold = MAX_GAP_MATCHED_M if is_valhalla else MAX_GAP_M
    gap_coords = decimate_coords(coords, step_m=40.0) if is_valhalla else coords
    gaps = find_gaps(gap_coords, gap_threshold)
    for gap in gaps:
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "critical",
                "issue": f"salto de {gap['distance_m']}m en vértice {gap['index']} (>{gap_threshold}m)",
                "gap": gap,
            }
        )

    qa_status = props.get("qa_status")
    if qa_status == "rejected":
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "critical",
                "issue": "qa_status=rejected (eje vial fuera de umbral)",
            }
        )
    elif qa_status == "needs_review":
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "review",
                "issue": "qa_status=needs_review",
            }
        )
    elif qa_status != "approved":
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "critical",
                "issue": f"qa_status inválido: {qa_status}",
            }
        )

    if "fallback" in validator.lower() or validator == "python-shapely-fallback":
        severity = "review" if ALLOW_FALLBACK else "critical"
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": severity,
                "issue": "validado con fallback Shapely, no con Valhalla",
            }
        )

    avg_snap = float(props.get("avg_snap_m", 999))
    max_snap = float(props.get("max_snap_m", 999))
    confidence = float(props.get("confidence", 0))

    if avg_snap > MAX_SNAP_M:
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "critical" if avg_snap > MAX_SNAP_M * 2 else "review",
                "issue": f"avg_snap_m={avg_snap} > umbral {MAX_SNAP_M}m",
            }
        )
    if confidence < STRICT_CONFIDENCE:
        issues.append(
            {
                "feature": feature_idx,
                "direction": direction,
                "severity": "review",
                "issue": f"confidence={confidence} < {STRICT_CONFIDENCE}",
            }
        )

    return issues


def main() -> None:
    summary_routes: list[dict] = []

    for path in sorted(IN_DIR.glob("*.geojson")):
        if ONLY_ROUTES and path.stem not in ONLY_ROUTES:
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        issues: list[dict] = []
        directions: list[str] = []

        route_id = path.stem
        route_name = route_id.replace("-", " ").title()
        color = "#3b82f6"
        transport_type = "combi"

        features = data.get("features", [])
        if features:
            props0 = features[0].get("properties", {})
            route_id = props0.get("routeId", route_id)
            route_name = props0.get("routeName", route_name)
            color = props0.get("color", color)
            transport_type = props0.get("transportType", transport_type)

        directions_detail: list[dict] = []
        for i, f in enumerate(features):
            props = f.get("properties", {})
            direction = props.get("direction") or props.get("name")
            if direction:
                directions.append(str(direction).lower())
            feature_issues = assess_feature(props, f.get("geometry"), i)
            issues.extend(feature_issues)
            directions_detail.append(
                {
                    "direction": (direction or f"feature-{i}").lower(),
                    "qa_status": props.get("qa_status"),
                    "validator": props.get("validator"),
                    "avg_snap_m": props.get("avg_snap_m"),
                    "max_snap_m": props.get("max_snap_m"),
                    "confidence": props.get("confidence"),
                    "issues": [x for x in feature_issues],
                }
            )

        if REQUIRE_TWO:
            dset = set(directions)
            if not {"ida", "vuelta"}.issubset(dset):
                issues.append(
                    {
                        "severity": "critical",
                        "issue": f"faltan sentidos ida/vuelta. Encontrado={sorted(dset)}",
                    }
                )
            extra = dset - ONLY
            if extra:
                issues.append(
                    {
                        "severity": "critical",
                        "issue": f"sentidos extra no permitidos: {sorted(extra)}",
                    }
                )

        has_critical = any(x.get("severity") == "critical" for x in issues)
        has_review = any(x.get("severity") == "review" for x in issues)
        is_passed = not has_critical and not has_review

        route_status = (
            "approved" if is_passed else "needs_review" if not has_critical else "rejected"
        )
        publishable = is_passed

        out = {
            "file": str(path),
            "route_id": route_id,
            "route_name": route_name,
            "status": route_status,
            "publishable": publishable,
            "issues": issues,
            "directions": directions_detail,
            "pass": is_passed,
            "validated_at": datetime.now(timezone.utc).isoformat(),
        }
        (QA_DIR / f"{path.stem}.final_qa.json").write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(path.name, "PASS" if is_passed else route_status.upper(), f"issues={len(issues)}")

        summary_routes.append(
            {
                "route_id": route_id,
                "route_name": route_name,
                "status": route_status,
                "publishable": publishable,
                "issue_count": len(issues),
                "directions": [d["direction"] for d in directions_detail],
            }
        )

        if publishable:
            dest_geojson = PUBLIC_ROUTES_DIR / f"{route_id}.geojson"
            dest_geojson.write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f" -> Exportado GeoJSON aprobado a: {dest_geojson}")
            update_routes_index(route_id, route_name, color, transport_type)
        else:
            print(f" -> NO publicado ({route_status}): {route_id}")

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": {
            "routes": len(summary_routes),
            "approved": sum(1 for r in summary_routes if r["status"] == "approved"),
            "needs_review": sum(1 for r in summary_routes if r["status"] == "needs_review"),
            "rejected": sum(1 for r in summary_routes if r["status"] == "rejected"),
        },
        "routes": summary_routes,
    }
    (QA_DIR / "qa-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Resumen QA: {QA_DIR / 'qa-summary.json'}")


if __name__ == "__main__":
    main()