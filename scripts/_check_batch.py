import json
from pathlib import Path
ids = [
  "ruta-arroyo-colorado","ruta-campestre-mision-del-valle","ruta-campestre-posta-trebol-monarca",
  "ruta-canteras-bachilleres","ruta-capula","ruta-chihuerio","ruta-ciudad-de-hidalgo","ruta-coeneo",
  "ruta-cointzio","ruta-gris-1-circuito","ruta-gris-4","ruta-morada-2a","ruta-paloma-azul-arquito",
  "ruta-por-torreon-nuevo","ruta-roja-4-tinijaro"
]
for rid in ids:
  p = Path(f"data/processed/matched/{rid}.geojson")
  d = json.loads(p.read_text(encoding="utf-8"))
  feats = d.get("features") or []
  dirs = [(f.get("properties") or {}).get("direction") for f in feats]
  mode = (d.get("properties") or {}).get("directionMode")
  ida = next((f for f in feats if (f.get("properties") or {}).get("direction") == "ida"), None)
  vue = next((f for f in feats if (f.get("properties") or {}).get("direction") == "vuelta"), None)
  same = False
  if ida and vue:
    c1 = ida["geometry"]["coordinates"]
    c2 = vue["geometry"]["coordinates"]
    same = c2 == list(reversed(c1))
  pub = Path(f"public/routes/{rid}.geojson").exists()
  qap = Path(f"data/qa-reports/{rid}.final_qa.json")
  qa = json.loads(qap.read_text(encoding="utf-8")) if qap.exists() else {}
  print(f"{rid}: status={qa.get('status')} feats={len(feats)} reverse_ok={same} public={pub} mode={mode}")
  for i in (qa.get("issues") or [])[:3]:
    print("  -", i.get("severity"), str(i.get("issue", ""))[:110])
s = json.loads(Path("data/qa-reports/qa-summary.json").read_text(encoding="utf-8"))
print("SUMMARY", s.get("totals"))
