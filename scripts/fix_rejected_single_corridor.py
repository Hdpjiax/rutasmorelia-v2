"""
Arregla rutas rejected: un solo corredor (sin línea doble ida/vuelta).

- Toma ida (o la geometría más larga) como canónica.
- Vuelta = reverse(canónica)  → directionMode=mirrored.
- NO inventa calles nuevas: solo reutiliza el trazo existente.
- Actualiza geojson matched/processed; si había public, también.
- Marca status needs_review (lista para re-QA / re-publicar).

Uso:
  python scripts/fix_rejected_single_corridor.py
  python scripts/fix_rejected_single_corridor.py --dry-run
  python scripts/fix_rejected_single_corridor.py --only ruta-capula
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QA_DIR = ROOT / "data" / "qa-reports"
MATCHED = ROOT / "data" / "processed" / "matched"
PROCESSED = ROOT / "data" / "processed" / "geojson"
PUBLIC = ROOT / "public" / "routes"


def haversine_m(a, b) -> float:
    R = 6371000.0
    lon1, lat1 = math.radians(a[0]), math.radians(a[1])
    lon2, lat2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(h)))


def path_length_m(coords: list) -> float:
    if len(coords) < 2:
        return 0.0
    return sum(haversine_m(coords[i], coords[i + 1]) for i in range(len(coords) - 1))


def direction_of(f: dict) -> str:
    props = f.get("properties") or {}
    return str(props.get("direction") or props.get("name") or "").lower()


def coords_of(f: dict) -> list:
    geom = f.get("geometry") or {}
    if geom.get("type") != "LineString":
        return []
    return [[float(c[0]), float(c[1])] for c in (geom.get("coordinates") or []) if len(c) >= 2]


def load_geojson(route_id: str) -> tuple[Path | None, dict | None]:
    for d in (MATCHED, PROCESSED, PUBLIC):
        p = d / f"{route_id}.geojson"
        if p.is_file():
            try:
                return p, json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                continue
    return None, None


def build_mirrored(data: dict, route_id: str) -> dict:
    features = data.get("features") or []
    ida_f = next((f for f in features if direction_of(f) == "ida"), None)
    vuelta_f = next((f for f in features if direction_of(f) == "vuelta"), None)

    ida_c = coords_of(ida_f) if ida_f else []
    vuelta_c = coords_of(vuelta_f) if vuelta_f else []

    # Canónico: el trazo más largo (mejor cobertura del corredor)
    if len(ida_c) >= 2 and len(vuelta_c) >= 2:
        if path_length_m(ida_c) >= path_length_m(vuelta_c):
            canon, base_f, canon_dir = ida_c, ida_f, "ida"
        else:
            canon, base_f, canon_dir = vuelta_c, vuelta_f, "vuelta"
    elif len(ida_c) >= 2:
        canon, base_f, canon_dir = ida_c, ida_f, "ida"
    elif len(vuelta_c) >= 2:
        canon, base_f, canon_dir = vuelta_c, vuelta_f, "vuelta"
    else:
        # Primera LineString cualquiera
        for f in features:
            c = coords_of(f)
            if len(c) >= 2:
                canon, base_f, canon_dir = c, f, "ida"
                break
        else:
            raise ValueError(f"{route_id}: sin LineString usable")

    # Si el canónico vino de vuelta, reorientamos: ida = reverse(vuelta) o ida = canon si era ida
    if canon_dir == "vuelta":
        ida_coords = list(reversed(canon))
        vuelta_coords = list(canon)
    else:
        ida_coords = list(canon)
        vuelta_coords = list(reversed(canon))

    props_base = dict((base_f or {}).get("properties") or {})
    for k in ("direction", "name", "directionMode"):
        props_base.pop(k, None)

    props_base["directionMode"] = "mirrored"
    props_base["matched_to_osm"] = props_base.get("matched_to_osm", True)
    props_base["qa_status"] = "needs_review"
    props_base["validator"] = props_base.get("validator") or "single-corridor-fix"
    props_base["fix_note"] = (
        "Corredor único: una geometría canónica; vuelta=reverse(ida). "
        "Sin línea doble. Re-validar QA antes de publicar."
    )
    props_base["routeId"] = props_base.get("routeId") or route_id

    color = props_base.get("color") or "#3b82f6"
    props_base["color"] = color
    props_base["casingColor"] = props_base.get("casingColor") or "#222222"

    ida_feat = {
        "type": "Feature",
        "properties": {
            **props_base,
            "direction": "ida",
            "name": "Ida",
            "directionMode": "mirrored",
        },
        "geometry": {"type": "LineString", "coordinates": ida_coords},
    }
    vuelta_feat = {
        "type": "Feature",
        "properties": {
            **props_base,
            "direction": "vuelta",
            "name": "Vuelta",
            "directionMode": "mirrored",
        },
        "geometry": {"type": "LineString", "coordinates": vuelta_coords},
    }

    return {
        "type": "FeatureCollection",
        "properties": {
            **(data.get("properties") or {}),
            "directionMode": "mirrored",
            "fixed_at": datetime.now(timezone.utc).isoformat(),
            "fix": "single_corridor",
        },
        "features": [ida_feat, vuelta_feat],
    }


def write_report(route_id: str, route_name: str, geojson: dict, dry: bool) -> None:
    now = datetime.now(timezone.utc).isoformat()
    report = {
        "file": f"data/processed/matched/{route_id}.geojson",
        "route_id": route_id,
        "route_name": route_name,
        "status": "needs_review",
        "publishable": False,
        "issues": [
            {
                "severity": "review",
                "direction": "both",
                "issue": "Reconstruida como corredor único (ida + vuelta=reverse). Revisar visual y re-publicar.",
            }
        ],
        "directions": [
            {
                "direction": "ida",
                "qa_status": "needs_review",
                "validator": "single-corridor-fix",
                "avg_snap_m": None,
                "max_snap_m": None,
                "confidence": None,
                "issues": [],
            },
            {
                "direction": "vuelta",
                "qa_status": "needs_review",
                "validator": "single-corridor-fix",
                "avg_snap_m": None,
                "max_snap_m": None,
                "confidence": None,
                "issues": [],
            },
        ],
        "pass": False,
        "validated_at": now,
        "transport_type": (geojson["features"][0].get("properties") or {}).get(
            "transportType"
        )
        or (geojson["features"][0].get("properties") or {}).get("transport_type")
        or "combi",
        "fix": "single_corridor",
    }
    if dry:
        return
    QA_DIR.mkdir(parents=True, exist_ok=True)
    (QA_DIR / f"{route_id}.final_qa.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def list_rejected() -> list[str]:
    ids = []
    for f in QA_DIR.glob("*.final_qa.json"):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
            if d.get("status") == "rejected":
                ids.append(d.get("route_id") or f.stem.replace(".final_qa", ""))
        except Exception:
            continue
    return sorted(set(ids))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", type=str, default="")
    ap.add_argument(
        "--all-routes",
        action="store_true",
        help="También colapsa approved/needs_review a mirrored si no lo están",
    )
    args = ap.parse_args()

    if args.only:
        route_ids = [args.only]
    elif args.all_routes:
        route_ids = sorted({p.stem for p in MATCHED.glob("*.geojson")})
    else:
        route_ids = list_rejected()

    print(f"Rutas a arreglar: {len(route_ids)}")
    ok = 0
    fail = 0
    for rid in route_ids:
        src, data = load_geojson(rid)
        if not data:
            print(f"  SKIP {rid}: sin geojson")
            fail += 1
            continue
        try:
            fixed = build_mirrored(data, rid)
            name = (
                (fixed["features"][0].get("properties") or {}).get("routeName")
                or rid
            )
            ida_n = len(fixed["features"][0]["geometry"]["coordinates"])
            print(f"  OK  {rid}: corredor {ida_n} pts (ida) + reverse (vuelta) ← {src}")
            if not args.dry_run:
                text = json.dumps(fixed, ensure_ascii=False, indent=2) + "\n"
                for d in (MATCHED, PROCESSED):
                    d.mkdir(parents=True, exist_ok=True)
                    (d / f"{rid}.geojson").write_text(text, encoding="utf-8")
                # Si estaba en public, actualizar (sigue needs_review en reporte)
                pub = PUBLIC / f"{rid}.geojson"
                if pub.is_file():
                    pub.write_text(text, encoding="utf-8")
                write_report(rid, str(name), fixed, args.dry_run)
            ok += 1
        except Exception as e:
            print(f"  FAIL {rid}: {e}")
            fail += 1

    # Refresh qa-summary lightly
    if not args.dry_run and ok:
        refresh_summary()

    print(f"\nListo: ok={ok} fail={fail} dry_run={args.dry_run}")
    return 0 if fail == 0 else 1


def refresh_summary() -> None:
    totals = {"routes": 0, "approved": 0, "needs_review": 0, "rejected": 0}
    routes = []
    for f in sorted(QA_DIR.glob("*.final_qa.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        st = d.get("status") or "needs_review"
        totals["routes"] += 1
        if st in totals:
            totals[st] += 1
        routes.append(
            {
                "route_id": d.get("route_id"),
                "route_name": d.get("route_name"),
                "status": st,
                "publishable": d.get("publishable", False),
            }
        )
    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": totals,
        "routes": routes,
        "note": "Actualizado tras fix_rejected_single_corridor",
    }
    (QA_DIR / "qa-summary.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"qa-summary: {totals}")


if __name__ == "__main__":
    sys.exit(main())
