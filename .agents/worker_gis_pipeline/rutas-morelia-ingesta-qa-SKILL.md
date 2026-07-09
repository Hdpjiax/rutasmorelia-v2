---
name: rutas-morelia-ingesta-qa
description: Pipeline Python local para extraer rutas desde carpetas de KML, PDF, PNG, GeoPackage o SHP, convertir a GeoJSON, validar con Valhalla/OSRM y generar reportes QA.
---

# Skill: Ingesta y QA de Rutas Morelia

Actúa como ingeniero de datos GIS. Tu tarea es automatizar lo automatizable sin inventar coordenadas.

## Carpeta de entrada

Usa `RAW_INPUT_DIR` de `.env-valhalla`. Debe contener subcarpetas opcionales:

```txt
raw-routes/
  kml/
  kmz/
  pdf/
  png/
  gpkg/
  shp/
  geojson/
```

## Herramientas

- Python 3.12+
- python-dotenv
- geopandas
- shapely
- pyproj
- fiona
- rasterio
- opencv-python
- scikit-image
- requests
- GDAL/OGR
- QGIS para revisión y georreferenciación
- Valhalla local
- OSRM local
- OSM PBF local

## Pipeline

1. Detectar archivos.
2. Vector: convertir con `ogr2ogr`.
3. PDF geoespacial/vectorial: intentar `ogrinfo` y `ogr2ogr`; si falla, marcar revisión.
4. PDF/PNG raster: generar reporte `needs_georeferencing`.
5. Abrir raster en QGIS Georeferencer y asignar GCPs.
6. Digitalizar o extraer máscara si la imagen tiene rutas limpias.
7. Toda extracción por visión computacional debe terminar en revisión QGIS.
8. Separar en `ida` y `vuelta`.
9. Ejecutar Valhalla estricto.
10. Ejecutar OSRM match.
11. QA final.
12. Exportar a `/public/routes/index.json` y `/public/routes/{id}.geojson`.

## Visión computacional permitida, con límites

Puedes usar OpenCV/scikit-image para detectar líneas en PNG únicamente como ayuda de digitalización:

- segmentación por color de la ruta
- skeletonize para centroline preliminar
- simplificación suave
- snapping estricto contra OSM

Pero el resultado no es confiable hasta que:

- esté georreferenciado
- esté revisado contra QGIS/OSM
- pase Valhalla/OSRM
- tenga QA aprobado

## Entrega esperada

- Scripts reproducibles.
- Reportes QA legibles.
- Nada de geometría inventada.
- Exactamente dos sentidos por ruta.
