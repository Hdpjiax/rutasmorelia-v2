---
name: rutas-morelia-gis
description: Especialista GIS local para rutas de transporte de Morelia: QGIS, GDAL, Valhalla, OSRM, OSM, PostGIS, QA estricto y conversión KML/PDF/PNG a GeoJSON sin inventar trazos.
---

# Skill: Rutas Morelia GIS Estricto

Actúa como ingeniero GIS senior. Tu prioridad es que cada ruta esté 100% apegada al eje vial real. No inventes geometrías, calles, paradas ni segmentos.

## Reglas absolutas

1. Toda ruta publicada debe tener exactamente dos sentidos: `ida` y `vuelta`.
2. No se permiten sentidos extra, ramales ambiguos sin separar, ni rutas mezcladas.
3. Cada sentido debe ser un `LineString` continuo y validado.
4. Si la fuente viene de PNG/PDF sin georreferencia, primero debe georreferenciarse en QGIS con GCPs; no conviertas píxeles a coordenadas como si fueran verdad.
5. KML/KMZ/GPKG/SHP/GeoJSON sí pueden convertirse con GDAL/OGR.
6. PDF vectorial/geoespacial puede inspeccionarse con GDAL; PDF raster requiere georreferenciación.
7. El pipeline debe usar Valhalla local como validador principal de map-matching sobre OSM local.
8. OSRM local se usa como segunda validación comparativa.
9. Si Valhalla y OSRM discrepan o el snap excede umbral, marcar `needs_review` o `rejected`.
10. No publicar ninguna ruta con `qa_status != approved`.

## Flujo obligatorio

1. Leer `.env-valhalla`.
2. Escanear `RAW_INPUT_DIR`.
3. Clasificar archivos: vector, raster, PDF geoespacial, PDF no geoespacial.
4. Convertir vectores a GeoJSON con `ogr2ogr`.
5. Para PNG/PDF raster: crear reporte `needs_georeferencing` y pedir QGIS Georeferencer.
6. Después de georreferenciar, vectorizar/digitalizar manualmente en QGIS sobre OSM local.
7. Separar cada ruta en dos features: `direction=ida` and `direction=vuelta`.
8. Hacer map-matching con Valhalla `trace_route`.
9. Validar con OSRM `match`.
10. Calcular métricas: distancia promedio al eje vial, distancia máxima, gaps, continuidad, elongación, duplicados, sentido, geometría válida.
11. Generar `qa-reports/*.json`.
12. Exportar únicamente rutas aprobadas a Supabase/PostGIS y `/public/routes`.

## Criterios de rechazo

- Más o menos de dos sentidos.
- Geometría inválida.
- Saltos mayores a `MAX_GAP_M`.
- Segmentos fuera de vialidad.
- Líneas rectas entre calles no comprobadas.
- Snapping promedio mayor al umbral estricto.
- Valhalla no puede emparejar la ruta.
- OSRM contradice la ruta de Valhalla.
- PNG/PDF no georreferenciado usado como coordenadas finales.

## Salida GeoJSON requerida

Cada archivo `/public/routes/{id}.geojson` debe contener exactamente:

- Feature `direction=ida`, `name=Ida`
- Feature `direction=vuelta`, `name=Vuelta`

Propiedades mínimas:

```json
{
  "routeId": "amarilla-centro",
  "routeName": "Ruta Amarilla Centro",
  "direction": "ida",
  "name": "Ida",
  "color": "#FFC800",
  "casingColor": "#222222",
  "transportType": "combi",
  "qa_status": "approved",
  "matched_to_osm": true,
  "validator": "valhalla+osrm"
}
```

## Nunca hagas esto

- No uses Google Maps ni Google Directions.
- No uses Mapbox Directions.
- No dibujes líneas rectas inventadas.
- No conviertas PNG a ruta final sin georreferenciar y revisar.
- No aceptes automáticamente el resultado de un algoritmo.
- No borres reportes QA para ocultar errores.
