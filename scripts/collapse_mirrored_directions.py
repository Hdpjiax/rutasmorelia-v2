"""
Anota y, opcionalmente, colapsa ida/vuelta casi idénticas a mode=mirrored.

- Detecta si ida ≈ reverse(vuelta) (distancia media m < umbral).
- Escribe directionMode en cada feature y en properties de la collection.
- Con --sync-geometry: fuerza vuelta = reverse(ida) cuando mode=mirrored
  (un corredor canónico; no inventa calles).

Uso:
  python scripts/collapse_mirrored_directions.py
  python scripts/collapse_mirrored_directions.py --threshold 25 --sync-geometry
  python scripts/collapse_mirrored_directions.py --only ruta-coral-1 --dry-run
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRS = [
    ROOT / "data" / "processed" / "geojson",
    ROOT / "data" / "processed" / "matched",
    ROOT / "public" / "routes",
]


def haversine_m(a, b) -> float:
    R = 6371000.0
    lon1, lat1 = math.radians(a[0]), math.radians(a[1])
    lon2, lat2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(h)))


def sample_indices(n: int, max_samples: int = 40) -> list[int]:
    if n <= 0:
        return []
    if n <= max_samples:
        return list(range(n))
    return [round(i * (n - 1) / (max_samples - 1)) for i in range(max_samples)]


def mean_nearest_m(a: list, b: list, max_samples: int = 40) -> float:
    if not a or not b:
        return float("inf")
    idxs = sample_indices(len(a), max_samples)
    step = max(1, len(b) // 80)
    total = 0.0
    for i in idxs:
        pt = a[i]
        best = min(haversine_m(pt, b[j]) for j in range(0, len(b), step))
        best = min(best, haversine_m(pt, b[0]), haversine_m(pt, b[-1]))
        total += best
    return total / len(idxs)


def direction_of(f: dict) -> str:
    props = f.get("properties") or {}
    return str(props.get("direction") or props.get("name") or "").lower()


def coords_of(f: dict) -> list:
    geom = f.get("geometry") or {}
    if geom.get("type") != "LineString":
        return []
    raw = geom.get("coordinates") or []
    return [[float(c[0]), float(c[1])] for c in raw if len(c) >= 2]


def mirror_similarity_m(ida: list, vuelta: list) -> float:
    if len(ida) < 2 or len(vuelta) < 2:
        return float("inf")
    rev = list(reversed(vuelta))
    d1 = mean_nearest_m(ida, rev)
    d2 = mean_nearest_m(rev, ida)
    return (d1 + d2) / 2.0


def stamp_mode(data: dict, mode: str) -> None:
    props = data.setdefault("properties", {})
    if not isinstance(props, dict):
        props = {}
        data["properties"] = props
    props["directionMode"] = mode
    for f in data.get("features") or []:
        fp = f.setdefault("properties", {})
        if not isinstance(fp, dict):
            fp = {}
            f["properties"] = fp
        fp["directionMode"] = mode


def process_file(
    path: Path,
    threshold: float,
    sync_geometry: bool,
    dry_run: bool,
) -> dict | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"  skip {path}: {e}")
        return None

    if data.get("type") != "FeatureCollection":
        return None

    features = data.get("features") or []
    ida_f = next((f for f in features if direction_of(f) == "ida"), None)
    vuelta_f = next((f for f in features if direction_of(f) == "vuelta"), None)
    if not ida_f or not vuelta_f:
        return None

    ida = coords_of(ida_f)
    vuelta = coords_of(vuelta_f)
    sim = mirror_similarity_m(ida, vuelta)
    mode = "mirrored" if sim <= threshold else "independent"

    changed = False
    prev = (ida_f.get("properties") or {}).get("directionMode")
    if prev != mode:
        changed = True
    stamp_mode(data, mode)

    if mode == "mirrored" and sync_geometry and len(ida) >= 2:
        new_vuelta = list(reversed(ida))
        # Only rewrite if meaningfully different (avoid churn)
        if len(vuelta) != len(new_vuelta) or sim > 0.5:
            vuelta_f["geometry"] = {"type": "LineString", "coordinates": new_vuelta}
            changed = True

    if not dry_run and changed:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return {
        "file": str(path.relative_to(ROOT)),
        "mode": mode,
        "similarity_m": round(sim, 2),
        "changed": changed,
        "synced": bool(mode == "mirrored" and sync_geometry),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Anotar directionMode mirrored/independent en GeoJSON de rutas")
    ap.add_argument("--threshold", type=float, default=25.0, help="Umbral metros (default 25)")
    ap.add_argument(
        "--sync-geometry",
        action="store_true",
        help="Si mirrored, fuerza vuelta=reverse(ida)",
    )
    ap.add_argument("--only", type=str, default="", help="Solo este route id (stem)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    results = []
    for d in DIRS:
        if not d.is_dir():
            continue
        for path in sorted(d.glob("*.geojson")):
            if path.name == "index.json":
                continue
            if args.only and path.stem != args.only:
                continue
            r = process_file(path, args.threshold, args.sync_geometry, args.dry_run)
            if r:
                results.append(r)

    mirrored = [r for r in results if r["mode"] == "mirrored"]
    independent = [r for r in results if r["mode"] == "independent"]
    print(f"Procesados: {len(results)}")
    print(f"  mirrored:     {len(mirrored)}")
    print(f"  independent:  {len(independent)}")
    print(f"  modificados:  {sum(1 for r in results if r['changed'])}")
    if args.dry_run:
        print("(dry-run: no se escribió nada)")

    # Resumen corto de independientes (las que sí necesitan 2 trazos)
    if independent:
        print("\nRutas independent (ida≠vuelta, top 15 por divergencia):")
        for r in sorted(independent, key=lambda x: -x["similarity_m"])[:15]:
            print(f"  {r['similarity_m']:7.1f} m  {r['file']}")

    report_path = ROOT / "data" / "qa-reports" / "direction-mode-summary.json"
    if not args.dry_run:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(
                {
                    "threshold_m": args.threshold,
                    "sync_geometry": args.sync_geometry,
                    "totals": {
                        "routes": len(results),
                        "mirrored": len(mirrored),
                        "independent": len(independent),
                    },
                    "routes": results,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"\nReporte: {report_path.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
