"""Quick pass check: trace_dense chunk=18 on all pending routes."""
from __future__ import annotations

import json
from pathlib import Path

from strict_map_match_valhalla_osrm import (
    estimate_metrics,
    heal_large_gaps,
    max_gap_in_line,
    repair_gaps,
    trace_along_source_dense,
)

PENDING = [
    "ruta-arco-san-pedro",
    "ruta-arroyo-colorado",
    "ruta-atecuaro",
    "ruta-campestre-mision-del-valle",
    "ruta-campestre-posta-trebol-monarca",
    "ruta-canteras-bachilleres",
    "ruta-capula",
    "ruta-charo-san-antonio-corrales",
    "ruta-charo",
    "ruta-chihuerio",
    "ruta-chucandiro",
    "ruta-ciudad-de-hidalgo",
    "ruta-coeneo",
    "ruta-cointzio",
    "ruta-coral-1",
    "ruta-el-pedregal",
    "ruta-gris-1-circuito",
    "ruta-gris-4",
    "ruta-morada-2a",
    "ruta-naranja-2-santa-fe",
    "ruta-naranja-3-centro-puerta-del-sol",
    "ruta-naranja-3-santa-maria-erandeni",
    "ruta-naranja-3-santa-maria-ita",
    "ruta-naranja-3-trico-metropolis",
    "ruta-paloma-azul-arquito",
    "ruta-por-torreon-nuevo",
    "ruta-roja-4-tinijaro",
]

pass_routes = []
fail_routes = []

for rid in PENDING:
    p = Path("data/processed/geojson") / f"{rid}.geojson"
    if not p.exists():
        fail_routes.append((rid, "missing"))
        continue
    data = json.loads(p.read_text(encoding="utf-8"))
    ok = True
    details = []
    for feat in data["features"]:
        d = feat["properties"].get("direction", "?")
        source = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]
        geom = trace_along_source_dense(source, chunk_size=18, overlap=0)
        geom = heal_large_gaps(geom, source, 480)
        geom = repair_gaps(geom, source, 350, 3)
        gap = max_gap_in_line(geom)
        snap = estimate_metrics(source, geom)["avg_snap_m"]
        dir_ok = gap <= 500 and snap <= 35
        details.append(f"{d}:g{gap:.0f}/s{snap:.1f}")
        if not dir_ok:
            ok = False
    if ok:
        pass_routes.append(rid)
    else:
        fail_routes.append((rid, ", ".join(details)))

print(f"PASS {len(pass_routes)}/{len(PENDING)}")
for r in pass_routes:
    print(f"  + {r}")
print(f"FAIL {len(fail_routes)}")
for r, d in fail_routes:
    print(f"  - {r}: {d}")