#!/usr/bin/env python3
"""Resumen final QA naranjas."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IDS = [
    "ruta-naranja-1-issste",
    "ruta-naranja-1-la-soledad",
    "ruta-naranja-2-3-de-agosto",
    "ruta-naranja-2-santa-fe",
    "ruta-naranja-3-centro-puerta-del-sol",
    "ruta-naranja-3-santa-maria-erandeni",
    "ruta-naranja-3-santa-maria-ita",
    "ruta-naranja-3-trico-metropolis",
]

for rid in IDS:
    qa = json.loads((ROOT / "data/qa-reports" / f"{rid}.final_qa.json").read_text(encoding="utf-8"))
    parts = []
    for d in qa.get("directions", []):
        parts.append(
            f"{d['direction']}:{d.get('qa_status')} snap={d.get('avg_snap_m')} conf={d.get('confidence')} val={d.get('validator')}"
        )
    pub = (ROOT / "public/routes" / f"{rid}.geojson").exists()
    print(f"{rid}\t{qa.get('status')}\tpub={pub}\t" + " | ".join(parts))
