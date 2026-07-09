## 2026-07-07T23:49:51-06:00
You are a worker assigned to Milestone 4: GIS Pipeline.
Your working directory is d:\rutasmorelia\.agents\worker_gis_pipeline.
You MUST load and follow the domain skills rutas-morelia-ingesta-qa and rutas-morelia-gis:
- d:\rutasmorelia\.agents\skills\rutas-morelia-ingesta-qa\SKILL.md
- d:\rutasmorelia\.agents\skills\rutas-morelia-gis\SKILL.md

Your objective is to:
1. Setup/verify the Python environment. Read `.env-valhalla`.
2. Inspect the local environment to check for WSL2, Valhalla, OSRM, GDAL (`ogr2ogr`), and Python libraries (`shapely`, `geopandas`, `pyproj`).
3. Check if local Valhalla/OSRM servers are running. If they are not running or cannot be started:
   - For `scripts/strict_map_match_valhalla_osrm.py`, implement a robust fallback in Python using `shapely` and `networkx` (or mathematical distance calculations) to calculate the actual snapping distance and alignment metrics for the input coordinates (the distance between original vertices and the street coordinates), so that the pipeline can run and produce approved/rejected statuses without depending on a running Valhalla/OSRM HTTP server.
4. Implement the `estimate_metrics` function in `scripts/strict_map_match_valhalla_osrm.py` using `shapely` and `pyproj` to calculate average/max snapping distances (in meters) and confidence scores accurately.
5. Setup the pipeline to read from `data/raw-routes/kml/`, `data/raw-routes/gpkg/`, etc., process the raw vectors, separate each route into two offset directions (`ida` and `vuelta`), run map-matching validation, generate QA reports in `data/qa-reports/`, and export approved routes to `/public/routes/` with exactly two features.
6. Create mock raw transit route data (e.g., `data/raw-routes/kml/ruta-amarilla-centro.kml` and `data/raw-routes/gpkg/ruta-roja-1.gpkg`) representing valid routes in Morelia.
7. Run the full pipeline:
   - `python scripts/convert_sources_to_geojson.py`
   - `python scripts/strict_map_match_valhalla_osrm.py`
   - `python scripts/qa_validate_routes.py`
8. Verify that the output files `/public/routes/ruta-amarilla-centro.geojson` and `/public/routes/ruta-roja-1.geojson` are correctly created, contain exactly two features (ida and vuelta), and meet all criteria.
9. Deliver your handoff.md report with script outputs, command logs, and pipeline verification details back to Project Orchestrator (conversation ID: d301522e-7f97-4367-96f0-5ce8124014fa).

DO NOT CHEAT. All implementations must be genuine. Do not bypass geometry validation or hardcode fake metrics. The distance estimation and snapping logic must be mathematically real.
