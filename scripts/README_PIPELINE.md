# Pipeline GIS local estricto

1. Copia `templates/.env-valhalla.example` a `.env-valhalla`.
2. Ajusta rutas de carpetas y endpoints.
3. Coloca fuentes en `RAW_INPUT_DIR`.
4. Ejecuta:

```powershell
python scripts/convert_sources_to_geojson.py
```

5. Abre en QGIS cualquier reporte `*.needs_georef.json` y georreferencia las fuentes raster/PDF/PNG con GCPs.
6. Digitaliza o corrige manualmente sobre OSM.
7. Exporta cada ruta con exactamente dos sentidos: `ida` y `vuelta`.
8. Levanta Valhalla y OSRM local.
9. Ejecuta:

```powershell
python scripts/strict_map_match_valhalla_osrm.py
python scripts/qa_validate_routes.py
```

10. Publica solo rutas con QA aprobado.

Advertencia: los scripts son base de trabajo. Gemini debe completarlos, probarlos y endurecerlos antes de producción.
