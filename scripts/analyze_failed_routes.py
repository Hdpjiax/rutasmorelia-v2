"""Resume incidencias de rutas rechazadas / needs_review."""
from __future__ import annotations

import json
from pathlib import Path

QA = Path("data/qa-reports")
summary = json.loads((QA / "qa-summary.json").read_text(encoding="utf-8"))
targets = [r for r in summary["routes"] if r["status"] in ("rejected", "needs_review")]

for r in targets:
    rid = r["route_id"]
    rep_path = QA / f"{rid}.final_qa.json"
    if not rep_path.exists():
        print(f"{rid}: sin reporte")
        continue
    rep = json.loads(rep_path.read_text(encoding="utf-8"))
    issues = [i["issue"] for i in rep.get("issues", [])[:4]]
    dirs = rep.get("directions", [])
    metrics = ", ".join(
        f"{d['direction']}:avg={d.get('avg_snap_m')} conf={d.get('confidence')} qa={d.get('qa_status')}"
        for d in dirs
    )
    print(f"\n{rid} [{r['status']}]")
    print(f"  {metrics}")
    for issue in issues:
        print(f"  - {issue}")