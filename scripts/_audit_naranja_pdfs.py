#!/usr/bin/env python3
"""Audit 8 Naranja routes vs root PDFs + rutastransporte KML/PDF (skip naranja 3 centro/directo)."""
from __future__ import annotations

import hashlib
import json
import math
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

MAPPING = [
    {
        "pdf_keys": ["naranja", "issste"],
        "route_id": "ruta-naranja-1-issste",
        "folder": "01_RUTAS_DE_COMBI/38_NARANJA_1_ISSSTE",
        "label": "Naranja 1 ISSSTE",
    },
    {
        "pdf_keys": ["naranja", "soledad"],
        "route_id": "ruta-naranja-1-la-soledad",
        "folder": "01_RUTAS_DE_COMBI/39_NARANJA_1_LA_SOLEDAD",
        "label": "Naranja 1 La Soledad",
    },
    {
        "pdf_keys": ["naranja", "agosto"],
        "route_id": "ruta-naranja-2-3-de-agosto",
        "folder": "01_RUTAS_DE_COMBI/40_NARANJA_2-3_DE_AGOSTO",
        "label": "Naranja 2 3 de Agosto",
    },
    {
        "pdf_keys": ["naranja", "santa", "fe"],
        "route_id": "ruta-naranja-2-santa-fe",
        "folder": "01_RUTAS_DE_COMBI/41_NARANJA_2_SANTA_FE",
        "label": "Naranja 2 Santa Fe",
    },
    {
        "pdf_keys": ["naranja", "puerta", "sol"],
        "route_id": "ruta-naranja-3-centro-puerta-del-sol",
        "folder": "01_RUTAS_DE_COMBI/42_NARANJA_3_CENTRO-PUERTA_DEL_SOL",
        "label": "Naranja 3 Centro-Puerta del Sol",
    },
    # SKIP 43_NARANJA_3_CENTRO = naranja directo
    {
        "pdf_keys": ["naranja", "erandeni"],
        "route_id": "ruta-naranja-3-santa-maria-erandeni",
        "folder": "01_RUTAS_DE_COMBI/44_NARANJA_3_SANTA_MARIA-ERANDENI",
        "label": "Naranja 3 Sta Maria Erandeni",
    },
    {
        "pdf_keys": ["naranja", "ita"],
        "route_id": "ruta-naranja-3-santa-maria-ita",
        "folder": "01_RUTAS_DE_COMBI/45_NARANJA_3_SANTA_MARIA-ITA",
        "label": "Naranja 3 Sta Maria Ita",
    },
    {
        "pdf_keys": ["naranja", "trico"],
        "route_id": "ruta-naranja-3-trico-metropolis",
        "folder": "01_RUTAS_DE_COMBI/46_NARANJA_3_TRICO-METROPOLIS",
        "label": "Naranja 3 Trico-Metropolis",
    },
]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    for ch in "[](){}_-.":
        s = s.replace(ch, " ")
    return " ".join(s.lower().split())


def md5(p: Path) -> str:
    h = hashlib.md5()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def haversine(a, b) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def line_len(coords) -> float:
    return sum(haversine(coords[i - 1], coords[i]) for i in range(1, len(coords)))


def flatten_coords(geom) -> list:
    t = geom["type"]
    c = geom["coordinates"]
    if t == "LineString":
        return [[float(x[0]), float(x[1])] for x in c]
    if t == "MultiLineString":
        out = []
        for part in c:
            out.extend([[float(x[0]), float(x[1])] for x in part])
        return out
    raise ValueError(t)


def densify_sample(coords, step_m=40):
    if len(coords) < 2:
        return coords
    out = [coords[0]]
    acc = 0.0
    for i in range(1, len(coords)):
        d = haversine(coords[i - 1], coords[i])
        acc += d
        if acc >= step_m:
            out.append(coords[i])
            acc = 0.0
    if out[-1] != coords[-1]:
        out.append(coords[-1])
    return out


def nearest_dist(pt, line_coords) -> float:
    return min(haversine(pt, c) for c in line_coords)


def compare(a_coords, b_coords) -> dict:
    sa = densify_sample(a_coords, 40)
    sb = densify_sample(b_coords, 40)
    step = max(1, len(sa) // 100)
    samples = sa[::step]
    dists = [nearest_dist(p, sb) for p in samples]
    la, lb = line_len(a_coords), line_len(b_coords)
    return {
        "len_src_m": round(la),
        "len_other_m": round(lb),
        "len_ratio": round(lb / max(la, 1), 3),
        "avg_dev_m": round(sum(dists) / len(dists), 1) if dists else None,
        "p95_dev_m": round(sorted(dists)[int(0.95 * (len(dists) - 1))], 1) if dists else None,
        "max_dev_m": round(max(dists), 1) if dists else None,
        "pct_le_25m": round(100 * sum(1 for d in dists if d <= 25) / len(dists), 1) if dists else None,
        "pct_le_50m": round(100 * sum(1 for d in dists if d <= 50) / len(dists), 1) if dists else None,
        "pct_le_100m": round(100 * sum(1 for d in dists if d <= 100) / len(dists), 1) if dists else None,
        "pts_src": len(a_coords),
        "pts_other": len(b_coords),
    }


def load_dirs(path: Path) -> dict[str, list]:
    d = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for f in d["features"]:
        direction = f["properties"].get("direction", "?")
        out[direction] = flatten_coords(f["geometry"])
    return out


def find_root_pdf(keys: list[str], root_pdfs: list[Path]) -> Path | None:
    cands = []
    for p in root_pdfs:
        n = norm(p.name)
        if all(k in n for k in keys):
            # special: "ita" should not match "issste" alone wrongly; "fe" not match all
            cands.append(p)
    if not cands:
        return None
    # prefer tightest name length
    return sorted(cands, key=lambda p: len(norm(p.name)))[0]


def main() -> None:
    root_pdfs = [p for p in ROOT.iterdir() if p.is_file() and p.suffix.lower() == ".pdf"]
    print("ROOT PDFs:")
    for p in sorted(root_pdfs, key=lambda x: x.name.lower()):
        print(f"  - {p.name} ({p.stat().st_size})")

    report = {"skipped": "ruta-naranja-3-centro (naranja directo)", "routes": []}

    for m in MAPPING:
        print("\n" + "=" * 70)
        print(m["label"], "->", m["route_id"])
        folder = ROOT / "rutastransporte" / m["folder"]
        root_pdf = find_root_pdf(m["pdf_keys"], root_pdfs)
        map_pdfs = sorted(folder.rglob("*.pdf"))
        kmls = sorted(folder.rglob("*.kml"))
        jpgs = sorted(list(folder.rglob("*.jpg")) + list(folder.rglob("*.png")))

        entry = {
            "route_id": m["route_id"],
            "label": m["label"],
            "root_pdf": root_pdf.name if root_pdf else None,
            "map_pdfs": [str(p.relative_to(ROOT)) for p in map_pdfs],
            "kmls": [str(p.relative_to(ROOT)) for p in kmls],
            "map_images": [str(p.relative_to(ROOT)) for p in jpgs],
            "pdf_md5_match": None,
            "files": {},
            "compare_src_matched": {},
            "compare_src_public": {},
            "final_qa": None,
            "verdict": "unknown",
            "issues": [],
        }

        print("  root_pdf:", root_pdf.name if root_pdf else "MISSING")
        print("  map_pdfs:", entry["map_pdfs"])
        print("  kmls:", entry["kmls"])
        print("  images:", entry["map_images"])

        if root_pdf and map_pdfs:
            same = md5(root_pdf) == md5(map_pdfs[0])
            entry["pdf_md5_match"] = same
            print("  PDF root == MAPAS PDF:", same)
            if not same:
                entry["issues"].append("PDF raíz difiere de PDF en rutastransporte/MAPAS")

        if not kmls:
            entry["issues"].append("Sin KML en carpeta rutastransporte")

        for sub in ["data/processed/geojson", "data/processed/matched", "public/routes"]:
            p = ROOT / sub / f"{m['route_id']}.geojson"
            entry["files"][sub] = p.exists()
            if p.exists():
                dirs = load_dirs(p)
                for direction, coords in dirs.items():
                    print(f"  {sub}/{direction}: pts={len(coords)} len={round(line_len(coords))}m")
            else:
                print(f"  {sub}: MISSING")
                if sub != "public/routes":
                    entry["issues"].append(f"Falta {sub}/{m['route_id']}.geojson")

        src_p = ROOT / "data/processed/geojson" / f"{m['route_id']}.geojson"
        mat_p = ROOT / "data/processed/matched" / f"{m['route_id']}.geojson"
        pub_p = ROOT / "public/routes" / f"{m['route_id']}.geojson"

        if src_p.exists():
            src = load_dirs(src_p)
            for other_p, key in [(mat_p, "compare_src_matched"), (pub_p, "compare_src_public")]:
                if not other_p.exists():
                    continue
                other = load_dirs(other_p)
                for direction in ["ida", "vuelta"]:
                    if direction in src and direction in other:
                        c = compare(src[direction], other[direction])
                        entry[key][direction] = c
                        print(f"  COMP {key} {direction}: {c}")
                        # hard flags for corridor fidelity to KML source
                        if c["pct_le_50m"] is not None and c["pct_le_50m"] < 95:
                            entry["issues"].append(
                                f"{key}/{direction}: solo {c['pct_le_50m']}% de puntos fuente a <=50m del trazo actual"
                            )
                        if c["len_ratio"] is not None and (c["len_ratio"] < 0.85 or c["len_ratio"] > 1.25):
                            entry["issues"].append(
                                f"{key}/{direction}: ratio longitud {c['len_ratio']} fuera de 0.85-1.25"
                            )
                        if c["max_dev_m"] is not None and c["max_dev_m"] > 200:
                            entry["issues"].append(
                                f"{key}/{direction}: max desvío {c['max_dev_m']}m (>200m)"
                            )

        qa_p = ROOT / "data/qa-reports" / f"{m['route_id']}.final_qa.json"
        if qa_p.exists():
            qa = json.loads(qa_p.read_text(encoding="utf-8"))
            entry["final_qa"] = {
                "status": qa.get("status"),
                "publishable": qa.get("publishable"),
                "issue_count": len(qa.get("issues", [])),
                "issues": [i.get("issue") for i in qa.get("issues", [])[:8]],
            }
            print("  final_qa:", entry["final_qa"])
            if qa.get("status") != "approved":
                entry["issues"].append(f"final_qa status={qa.get('status')}")

        # Verdict
        if not entry["issues"] and entry["files"].get("public/routes"):
            entry["verdict"] = "OK_COINCIDE"
        elif entry["issues"]:
            entry["verdict"] = "NEEDS_FIX"
        else:
            entry["verdict"] = "NEEDS_REVIEW"

        print("  VERDICT:", entry["verdict"])
        if entry["issues"]:
            for iss in entry["issues"]:
                print("   -", iss)

        report["routes"].append(entry)

    out = ROOT / "data/qa-reports" / "naranja-pdf-audit.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n\nWrote", out)

    print("\n===== RESUMEN =====")
    for e in report["routes"]:
        print(f"{e['verdict']:12}  {e['route_id']}  issues={len(e['issues'])}")


if __name__ == "__main__":
    main()
