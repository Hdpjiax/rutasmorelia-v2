import json, subprocess, sys, tempfile, os
from pathlib import Path

files = sys.argv[1:] or [
    "rutastransporte/01_RUTAS_DE_COMBI/86_ISSTE_SOLEDAD/KML_issste/ISSSTE_Soledad_kml.kml",
    "rutastransporte/01_RUTAS_DE_COMBI/38_NARANJA_1_ISSSTE/KML_naranja_issste/Naranja1_issste_kml.kml",
    "rutastransporte/01_RUTAS_DE_COMBI/77_RUTA_2/KML_ruta2/Ruta_2_kml.kml",
]
for src in files:
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "x.geojson")
        subprocess.run(["ogr2ogr", "-f", "GeoJSON", out, src, "-t_srs", "EPSG:4326"], check=True)
        raw = json.load(open(out))
    print(src, "features=", len(raw.get("features", [])))
    line_feats = 0
    for i, f in enumerate(raw.get("features", [])):
        g = f.get("geometry", {})
        gtype = g.get("type")
        if gtype in ("LineString", "MultiLineString"):
            line_feats += 1
        if gtype == "MultiLineString":
            print(f"  {i}: MultiLineString parts={len(g.get('coordinates', []))}")
        else:
            print(f"  {i}: {gtype}")
    print(f"  line_features={line_feats}")