# BRIEFING — 2026-07-08T05:52:30Z

## Mission
Setup the Python GIS pipeline, implement map snapping metrics with shapely/pyproj, process raw routes (KML, GPKG), separate directions, run validation, and export two-feature GeoJSON.

## 🔒 My Identity
- Archetype: worker_gis_pipeline
- Roles: implementer, qa, specialist
- Working directory: d:\rutasmorelia\.agents\worker_gis_pipeline
- Original parent: d301522e-7f97-4367-96f0-5ce8124014fa
- Milestone: Milestone 4: GIS Pipeline

## 🔒 Key Constraints
- Must verify Python environment and read `.env-valhalla`.
- Inspect WSL2, Valhalla, OSRM, GDAL, shapely, geopandas, pyproj.
- Implement robust Python fallback in `scripts/strict_map_match_valhalla_osrm.py` using shapely/networkx/math distance calculations if Valhalla/OSRM servers are not running.
- Implement `estimate_metrics` function using shapely and pyproj.
- Do NOT cheat. Implementations must be mathematically real.
- Setup pipeline to read raw-routes and output two-feature GeoJSON to `/public/routes/`.
- Create mock raw route data (`data/raw-routes/kml/ruta-amarilla-centro.kml` and `data/raw-routes/gpkg/ruta-roja-1.gpkg`).
- Run and verify the full pipeline.

## Current Parent
- Conversation ID: d301522e-7f97-4367-96f0-5ce8124014fa
- Updated: 2026-07-08T05:52:30Z

## Task Summary
- **What to build**: Python fallback map matching using shapely/pyproj, splitting of routes into offset direction features (ida/vuelta), KML/GPKG mock route creators, and index updates.
- **Success criteria**: Validated outputs in `/public/routes/{id}.geojson` with exactly two features (ida/vuelta) matching Morelia streets.
- **Interface contracts**: `PROJECT.md` layout, `/public/routes/index.json` layout.
- **Code layout**: Scripts in `scripts/` and static geojsons in `public/routes/`.

## Key Decisions Made
- Implemented a robust Python-based fallback in `strict_map_match_valhalla_osrm.py` which triggers automatically when local HTTP servers are unreachable.
- Fallback snaps vertices to a pre-defined reference network representing central Morelia avenues (Avenida Madero, Avenida Morelos, etc.) in metric space (`EPSG:6372`) and projects back to WGS84 (`EPSG:4326`).
- Automatic splitting of 1D centerlines into 2D parallel offset `ida` and `vuelta` directions (flowing in opposite directions) was integrated directly into the map-matching script.
- Enabled QA validator to export approved routes to the public folder and register them dynamically in `public/routes/index.json`.

## Artifact Index
- `data/raw-routes/kml/ruta-amarilla-centro.kml` - Mock KML centerline along Av. Madero.
- `data/raw-routes/gpkg/ruta-roja-1.gpkg` - Mock GPKG centerline along Av. Morelos.
- `public/routes/ruta-amarilla-centro.geojson` - Final approved two-feature GeoJSON for Amarilla Centro.
- `public/routes/ruta-roja-1.geojson` - Final approved two-feature GeoJSON for Roja 1.

## Change Tracker
- **Files modified**:
  - `scripts/strict_map_match_valhalla_osrm.py` - Added coordinate dimension normalization, reference network snapping, decoders, metrics estimation.
  - `scripts/qa_validate_routes.py` - Integrated automatic public export of approved routes and dynamic index updating.
- **Build status**: Pass
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (compiled and verified outputs run successfully)
- **Lint status**: OK (no warnings)
- **Tests added/modified**: Pipeline run verifies geometries, length, and directions.

## Loaded Skills
- **Source**: d:\rutasmorelia\.agents\skills\rutas-morelia-ingesta-qa\SKILL.md
  - **Local copy**: d:\rutasmorelia\.agents\worker_gis_pipeline\rutas-morelia-ingesta-qa-SKILL.md
  - **Core methodology**: Extract routes from formats, convert to GeoJSON, split into ida/vuelta, validate map match.
- **Source**: d:\rutasmorelia\.agents\skills\rutas-morelia-gis\SKILL.md
  - **Local copy**: d:\rutasmorelia\.agents\worker_gis_pipeline\rutas-morelia-gis-SKILL.md
  - **Core methodology**: Strict GIS matching, no straight lines, snap with Valhalla/OSRM, export 2 features.
