#!/usr/bin/env python3
"""
Procesa las 10 notas de revisión:
- BORRA: ruta-naranja-3-centro, ruta-isste-soledad
- REHACE (KML + PDF raíz): 8 rutas restantes
"""
from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DELETE_IDS = [
    "ruta-naranja-3-centro",
    "ruta-isste-soledad",
]

# route_id -> pdf keys for root matching (optional)
REBUILD = [
    {
        "route_id": "ruta-charo",
        "pdf_keys": ["charo"],
        "note": "ida/vuelta + PDF raíz charo.pdf",
    },
    {
        "route_id": "ruta-charo-indaparapeo-atapaneo-issste-soledad",
        "pdf_keys": ["charo"],  # mismo PDF de familia Charo si no hay uno dedicado
        "note": "ida/vuelta; PDF raíz charo.pdf como referencia de familia",
    },
    {
        "route_id": "ruta-charo-san-antonio-corrales",
        "pdf_keys": ["charo"],
        "note": "limpiar trazos amontonados desde KML limpio",
    },
    {
        "route_id": "ruta-coral-1",
        "pdf_keys": ["coral", "1"],
        "note": "PDF Coral 1.pdf + KML rutastransporte",
    },
    {
        "route_id": "ruta-durazo-santa-maria",
        "pdf_keys": ["durazno"],
        "note": "PDF Durazno - Sta. María [Trincheras].pdf",
    },
    {
        "route_id": "ruta-jesus-del-monte",
        "pdf_keys": ["jesus", "monte"],
        "note": "PDF Jesús Del Monte.pdf",
    },
    {
        "route_id": "ruta-morada-1-aldea",
        "pdf_keys": ["morada", "aldea"],
        "note": "PDF Morada 1 [Aldea].pdf",
    },
    {
        "route_id": "ruta-alberca-metropolis",
        "pdf_keys": ["alberca", "metrop"],
        "note": "PDF Alberca [Metrópolis].pdf; sin forzar oneway periférico",
    },
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def haversine(a, b) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def line_len(coords) -> float:
    return sum(haversine(coords[i - 1], coords[i]) for i in range(1, len(coords)))


def delete_route(route_id: str) -> list[str]:
    removed = []
    patterns = [
        ROOT / "data/processed/geojson" / f"{route_id}.geojson",
        ROOT / "data/processed/matched" / f"{route_id}.geojson",
        ROOT / "public/routes" / f"{route_id}.geojson",
        ROOT / "data/raw-routes/kml" / f"{route_id}.kml",
        ROOT / "data/qa-reports" / f"{route_id}.qa.json",
        ROOT / "data/qa-reports" / f"{route_id}.final_qa.json",
    ]
    for p in patterns:
        if p.exists():
            p.unlink()
            removed.append(str(p.relative_to(ROOT)))

    # index.json
    index_path = ROOT / "public/routes/index.json"
    if index_path.exists():
        data = json.loads(index_path.read_text(encoding="utf-8"))
        # may be list or {routes:[]}
        if isinstance(data, list):
            before = len(data)
            data = [r for r in data if r.get("id") != route_id and r.get("routeId") != route_id]
            if len(data) != before:
                index_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
                removed.append("public/routes/index.json (entry)")
        elif isinstance(data, dict) and "routes" in data:
            before = len(data["routes"])
            data["routes"] = [
                r
                for r in data["routes"]
                if r.get("id") != route_id and r.get("routeId") != route_id
            ]
            if len(data["routes"]) != before:
                index_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
                removed.append("public/routes/index.json (entry)")

    # route map
    map_path = ROOT / "data/rutastransporte-route-map.json"
    if map_path.exists():
        entries = json.loads(map_path.read_text(encoding="utf-8"))
        before = len(entries)
        entries = [e for e in entries if e.get("routeId") != route_id]
        if len(entries) != before:
            map_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
            removed.append("data/rutastransporte-route-map.json (entry)")

    return removed


def summarize_geojson(path: Path) -> dict:
    d = json.loads(path.read_text(encoding="utf-8"))
    dirs = {}
    for f in d.get("features", []):
        direction = f.get("properties", {}).get("direction", "?")
        coords = f["geometry"]["coordinates"]
        if f["geometry"]["type"] == "MultiLineString":
            coords = [c for part in coords for c in part]
        dirs[direction] = {
            "pts": len(coords),
            "len_m": round(line_len(coords)),
            "start": [round(coords[0][0], 5), round(coords[0][1], 5)] if coords else None,
            "end": [round(coords[-1][0], 5), round(coords[-1][1], 5)] if coords else None,
        }
    return dirs


def inspect_kml_lines(kml_path: Path) -> list[dict]:
    text = kml_path.read_text(encoding="utf-8", errors="replace")
    blocks = re.findall(r"<coordinates>(.*?)</coordinates>", text, re.S)
    lines = []
    for b in blocks:
        pts = []
        for tok in b.replace("\n", " ").split():
            if "," not in tok:
                continue
            parts = tok.split(",")
            try:
                lon, lat = float(parts[0]), float(parts[1])
            except ValueError:
                continue
            pts.append([lon, lat])
        if len(pts) >= 2:
            lines.append({"n": len(pts), "len_m": round(line_len(pts))})
    lines.sort(key=lambda x: -x["len_m"])
    return lines


def find_root_pdf(keys: list[str]) -> str | None:
    import unicodedata

    def norm(s: str) -> str:
        s = unicodedata.normalize("NFKD", s)
        s = "".join(c for c in s if not unicodedata.combining(c))
        return " ".join(s.lower().replace("}", " ").replace("[", " ").replace("]", " ").split())

    pdfs = [p for p in ROOT.iterdir() if p.is_file() and p.suffix.lower() == ".pdf"]
    cands = []
    for p in pdfs:
        n = norm(p.name)
        if all(k in n for k in keys):
            # avoid matching all charo-* with only 'charo' too greedily for non-charo
            cands.append(p)
    if not cands:
        return None
    # prefer shortest name
    return sorted(cands, key=lambda p: len(p.name))[0].name


def update_review_notes(deleted: list[str], rebuilt: list[dict]) -> None:
    notes_path = ROOT / "data/qa-reports/review-notes.json"
    data = {"notes": []}
    if notes_path.exists():
        data = json.loads(notes_path.read_text(encoding="utf-8"))

    notes = data.get("notes", [])
    # remove deleted routes notes entirely
    notes = [n for n in notes if n.get("route_id") not in deleted]

    by_id = {n["route_id"]: n for n in notes}
    now = utc_now()
    for r in rebuilt:
        rid = r["route_id"]
        status = r.get("status", "note")
        msg = r.get("resolution", "Reprocesada desde KML + validación Valhalla/OSRM.")
        if rid in by_id:
            by_id[rid]["note"] = msg
            by_id[rid]["status"] = status
            by_id[rid]["updated_at"] = now
        else:
            by_id[rid] = {
                "route_id": rid,
                "route_name": rid,
                "note": msg,
                "status": status,
                "created_at": now,
                "updated_at": now,
            }
    data["notes"] = list(by_id.values())
    notes_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    report = {
        "generated_at": utc_now(),
        "deleted": {},
        "rebuild": {},
        "pdf_map": {},
    }

    print("=== DELETE ===")
    for rid in DELETE_IDS:
        removed = delete_route(rid)
        report["deleted"][rid] = removed
        print(f"[deleted] {rid}: {len(removed)} artifacts")
        for r in removed:
            print("  -", r)

    print("\n=== PRE-INSPECT KML / PDF ===")
    map_entries = {
        e["routeId"]: e
        for e in json.loads((ROOT / "data/rutastransporte-route-map.json").read_text(encoding="utf-8"))
    }
    for item in REBUILD:
        rid = item["route_id"]
        entry = map_entries.get(rid)
        pdf = find_root_pdf(item["pdf_keys"])
        report["pdf_map"][rid] = pdf
        print(f"\n{rid}")
        print("  root_pdf:", pdf)
        if not entry:
            print("  [ERROR] no en route-map")
            report["rebuild"][rid] = {"error": "missing route-map"}
            continue
        kml = ROOT / entry["sourceKml"]
        print("  kml:", kml.relative_to(ROOT) if kml.exists() else "MISSING", "exists=", kml.exists())
        if kml.exists():
            lines = inspect_kml_lines(kml)
            print("  kml line blocks:", len(lines), "top:", lines[:3])
            report["rebuild"][rid] = {
                "pdf": pdf,
                "kml": str(entry["sourceKml"]),
                "kml_lines": lines[:5],
            }

    # Import all rebuild routes
    print("\n=== IMPORT ===")
    ids = [i["route_id"] for i in REBUILD if i["route_id"] in map_entries]
    cmd = [
        "bash",
        "-lc",
        f"cd /mnt/d/rutasmorelia && source ~/.venv-gis-wsl/bin/activate && python scripts/import_rutastransporte_routes.py {' '.join(ids)}",
    ]
    # Prefer WSL
    try:
        r = subprocess.run(["wsl"] + cmd, cwd=str(ROOT), check=False, capture_output=True, text=True)
        print(r.stdout)
        print(r.stderr, file=sys.stderr)
        if r.returncode != 0:
            print("[warn] import exit", r.returncode)
    except FileNotFoundError:
        print("WSL no disponible, intentando python local")
        subprocess.run([sys.executable, "scripts/import_rutastransporte_routes.py", *ids], cwd=str(ROOT))

    print("\n=== POST-IMPORT DIRECTIONS ===")
    for rid in ids:
        p = ROOT / "data/processed/geojson" / f"{rid}.geojson"
        if p.exists():
            dirs = summarize_geojson(p)
            print(rid, dirs)
            report["rebuild"].setdefault(rid, {})["src_dirs"] = dirs
            if set(dirs.keys()) != {"ida", "vuelta"}:
                print("  [WARN] no tiene exactamente ida+vuelta")

    print("\n=== MATCH + QA ===")
    only = ",".join(ids)
    match_cmd = (
        f"cd /mnt/d/rutasmorelia && source ~/.venv-gis-wsl/bin/activate && "
        f"bash scripts/start_valhalla_wsl.sh && "
        f"ONLY_ROUTES={only} python scripts/strict_map_match_valhalla_osrm.py && "
        f"ONLY_ROUTES={only} python scripts/qa_validate_routes.py"
    )
    r = subprocess.run(["wsl", "bash", "-lc", match_cmd], cwd=str(ROOT), check=False, capture_output=True, text=True)
    print(r.stdout[-4000:] if r.stdout else "")
    print(r.stderr[-2000:] if r.stderr else "", file=sys.stderr)

    print("\n=== FINAL QA STATUS ===")
    rebuilt_notes = []
    for rid in ids:
        qa_path = ROOT / "data/qa-reports" / f"{rid}.final_qa.json"
        pub = (ROOT / "public/routes" / f"{rid}.geojson").exists()
        status = "unknown"
        issues = []
        if qa_path.exists():
            qa = json.loads(qa_path.read_text(encoding="utf-8"))
            status = qa.get("status")
            issues = [i.get("issue") for i in qa.get("issues", [])[:5]]
            print(f"{rid}: {status} pub={pub} issues={len(qa.get('issues', []))}")
            for i in issues:
                print("  -", i)
            report["rebuild"].setdefault(rid, {})["final_qa"] = status
            report["rebuild"][rid]["published"] = pub
            report["rebuild"][rid]["issues"] = issues
            if (ROOT / "data/processed/matched" / f"{rid}.geojson").exists():
                report["rebuild"][rid]["matched_dirs"] = summarize_geojson(
                    ROOT / "data/processed/matched" / f"{rid}.geojson"
                )
        msg = (
            f"[auto] Reprocesada {utc_now()}: KML→ida/vuelta, Valhalla+OSRM status={status}, "
            f"publicado={pub}. PDF raíz: {report['pdf_map'].get(rid)}. "
            f"Nota original atendida."
        )
        rebuilt_notes.append(
            {
                "route_id": rid,
                "status": "note" if status == "approved" else "needs_review",
                "resolution": msg,
            }
        )

    update_review_notes(DELETE_IDS, rebuilt_notes)

    out = ROOT / "data/qa-reports/review-batch-2026-07-09.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nWrote", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
