#!/usr/bin/env python3
"""Tune map-match for the 4 remaining review routes."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from strict_map_match_valhalla_osrm import (
    estimate_metrics,
    heal_large_gaps,
    max_gap_in_line,
    repair_gaps,
    trace_along_source_dense,
)

ROOT = Path(__file__).resolve().parents[1]
GEOJSON = ROOT / "data/processed/geojson"
MATCHED = ROOT / "data/processed/matched"

ROUTES = [
    "ruta-charo",
    "ruta-coral-1",
    "ruta-morada-1-aldea",
    "ruta-alberca-metropolis",
]


def try_tune_feature(source: list[tuple[float, float]], direction: str) -> tuple[list, dict] | None:
    best = None
    for cs in (10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50):
        for heal in (400, 480, 550, 650):
            geom = trace_along_source_dense(source, chunk_size=cs, overlap=0)
            if not geom or len(geom) < 2:
                continue
            geom = heal_large_gaps(geom, source, heal)
            geom = repair_gaps(geom, source, 350, 3)
            gap = max_gap_in_line(geom)
            m = estimate_metrics(source, geom)
            snap = float(m.get("avg_snap_m", 999))
            conf = float(m.get("confidence", 0))
            # score: prefer gap<=500 and snap<=18
            ok = gap <= 500 and snap <= 18.0 and conf >= 0.92
            score = (0 if ok else 1, gap, snap)
            if best is None or score < best[0]:
                best = (score, geom, {"cs": cs, "heal": heal, "gap": gap, "snap": snap, "conf": conf, "ok": ok})
            if ok:
                print(f"    {direction}: PASS cs={cs} heal={heal} gap={gap:.1f} snap={snap:.1f} conf={conf:.3f}")
                return geom, best[2]
    if best:
        print(f"    {direction}: BEST {best[2]}")
        return best[1], best[2]
    return None


def main() -> None:
    for rid in ROUTES:
        print(f"\n=== {rid} ===")
        src_path = GEOJSON / f"{rid}.geojson"
        if not src_path.exists():
            print(" missing src")
            continue
        data = json.loads(src_path.read_text(encoding="utf-8"))
        out_feats = []
        all_ok = True
        for feat in data["features"]:
            d = feat["properties"].get("direction", "?")
            source = [(float(c[0]), float(c[1])) for c in feat["geometry"]["coordinates"]]
            print(f"  {d} src pts={len(source)}")
            res = try_tune_feature(source, d)
            if not res:
                all_ok = False
                out_feats.append(feat)
                continue
            geom, meta = res
            if not meta.get("ok"):
                all_ok = False
            new_feat = {
                "type": "Feature",
                "properties": {
                    **feat["properties"],
                    "qa_status": "approved" if meta.get("ok") else "needs_review",
                    "matched_to_osm": True,
                    "validator": "valhalla+osrm-tune",
                    "avg_snap_m": round(meta["snap"], 2),
                    "max_snap_m": round(meta.get("snap", 0) * 2, 2),
                    "confidence": round(meta["conf"], 3),
                    "tune": meta,
                },
                "geometry": {"type": "LineString", "coordinates": [[c[0], c[1]] for c in geom]},
            }
            # recompute real max snap
            m = estimate_metrics(source, geom)
            new_feat["properties"]["avg_snap_m"] = m.get("avg_snap_m")
            new_feat["properties"]["max_snap_m"] = m.get("max_snap_m")
            new_feat["properties"]["confidence"] = m.get("confidence")
            if m.get("avg_snap_m", 99) <= 18 and max_gap_in_line(geom) <= 500 and m.get("confidence", 0) >= 0.92:
                new_feat["properties"]["qa_status"] = "approved"
            else:
                new_feat["properties"]["qa_status"] = "needs_review"
                all_ok = False
            out_feats.append(new_feat)

        out = {"type": "FeatureCollection", "features": out_feats}
        out_path = MATCHED / f"{rid}.geojson"
        out_path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
        print(f"  wrote {out_path} all_ok={all_ok}")


if __name__ == "__main__":
    main()
