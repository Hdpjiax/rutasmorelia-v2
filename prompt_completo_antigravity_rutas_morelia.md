# Prompt maestro para Google Antigravity — Rutas Morelia con GIS local estricto

Actúa como un equipo completo senior de producto, frontend, backend, GIS, datos espaciales, UX/UI, QA, seguridad y performance. Debes construir desde cero o continuar una web llamada **Rutas Morelia** para visualizar rutas del transporte público de Morelia y planificar viajes por origen-destino.

Debes trabajar en Windows local, usando Supabase Cloud para backend/Auth/PostGIS y Vercel para despliegue. Para GIS local debes instalar/configurar QGIS, GDAL/OGR, Python, Valhalla, OSRM y datos OSM locales si aún no existen.

## Objetivo

Crear una web profesional, rápida, inmersiva y funcional para:

- buscar origen y destino;
- seleccionar origen/destino en mapa;
- buscar rutas por nombre/color/zona;
- visualizar rutas sobre mapa blanco Carto Positron;
- distinguir sentidos con flechas sobre línea;
- mostrar exactamente dos sentidos por ruta: `ida` y `vuelta`;
- guardar favoritos con login Google vía Supabase;
- validar rutas con GIS local antes de publicarlas;
- evitar cualquier trazo inventado.

## Reglas absolutas

1. No usar Google Maps, Google Directions, Mapbox Directions, HERE, TomTom ni APIs propietarias de mapas/routing.
2. El mapa debe usar MapLibre GL JS.
3. El estilo visual base será blanco/limpio tipo Carto Positron.
4. Las rutas deben mostrarse como en la referencia: línea de color con contorno/casing oscuro, flechas triangulares sobre la línea y etiquetas `Ida`/`Vuelta`.
5. Cada ruta publicada debe tener únicamente dos sentidos: `ida` y `vuelta`.
6. No usar paradas oficiales como base. Solo origen, destino, rutas/corredores, puntos virtuales de abordaje/descenso y transbordos virtuales.
7. Nunca llamar “parada oficial” a un punto virtual.
8. Todo trazo debe apegarse 100% al eje vial real.
9. No inventar líneas rectas, saltos, calles ni conexiones.
10. Toda geometría debe venir de KML/layer/GeoJSON/PDF geoespacial, QGIS, digitalización manual validada, OSM local, Valhalla/OSRM o revisión QA.
11. PNG/PDF raster no georreferenciado jamás puede convertirse directamente a ruta final.
12. Si una ruta no pasa QA, debe quedar `needs_review` o `rejected`.
13. No publicar rutas dudosas.
14. No ocultar errores.

## Stack obligatorio

Frontend:

- Next.js App Router
- TypeScript strict
- Tailwind CSS
- shadcn/ui
- Radix UI
- Motion
- Lucide React
- React Hook Form
- Zod
- TanStack Query
- Zustand
- MapLibre GL JS
- PMTiles opcional/local
- Turf.js
- Fuse.js o MiniSearch

Backend:

- Supabase Cloud
- Supabase Auth con Google
- Supabase Postgres + PostGIS
- Supabase Storage
- RLS estricta
- RPC SQL para consultas geoespaciales críticas

GIS local:

- QGIS LTR en Windows
- GDAL/OGR en Windows/OSGeo4W
- Python 3.12+
- WSL2 Ubuntu para Valhalla/OSRM si se requiere
- Valhalla local para `trace_route` / map-matching
- OSRM local para `match` como segunda validación
- OpenStreetMap `.osm.pbf` local recortado a Morelia
- osmium-tool
- PostGIS local opcional para QA pesado; producción en Supabase Cloud

Testing:

- Vitest
- Testing Library
- Playwright
- ESLint
- TypeScript check

## Estructura de proyecto requerida

```txt
rutas-morelia/
  app/
  components/
    ui/
    map/
    search/
    layout/
  features/
    auth/
    favorites/
    gis/
    map/
    planner/
    routes/
    search/
  lib/
    supabase/
    gis/
    routing/
    search/
    validation/
  scripts/
    gis/
    import/
    qa/
    valhalla/
    osrm/
  supabase/
    migrations/
    policies/
  data/
    raw-routes/
      kml/
      pdf/
      png/
      gpkg/
      shp/
      geojson/
    osm/
    processed/
      geojson/
      matched/
    qa-reports/
    valhalla/
    osrm/
  public/
    routes/
      index.json
      {routeId}.geojson
  docs/
  .env.local
  .env-valhalla
```

## Instalación en Windows

Primero detecta si existen:

```powershell
git --version
node -v
pnpm -v
python --version
ogr2ogr --version
qgis --version
wsl --status
```

Si falta algo, guía la instalación:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Python.Python.3.12 -e
winget install --id Microsoft.VisualStudioCode -e
winget install --id QGIS.QGIS.LTR -e
corepack enable
corepack prepare pnpm@latest --activate
wsl --install -d Ubuntu
```

En WSL2:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential cmake ninja-build git curl wget unzip pkg-config gdal-bin libgdal-dev osmium-tool jq python3 python3-pip python3-venv osrm-backend
python3 -m venv .venv-gis
source .venv-gis/bin/activate
pip install --upgrade pip
pip install geopandas shapely pyproj fiona rasterio opencv-python scikit-image python-dotenv requests rich pandas numpy networkx rtree
```

## `.env-valhalla`

Debes crear `.env-valhalla` a partir de `templates/.env-valhalla.example`. Todo script Python GIS debe cargarlo con `python-dotenv`.

Variables críticas:

- `RAW_INPUT_DIR`
- `PROCESSED_DIR`
- `QA_REPORT_DIR`
- `OSM_PBF`
- `VALHALLA_URL`
- `OSRM_URL`
- `VALHALLA_STRICT_DISTANCE_MAX_M`
- `VALHALLA_MIN_CONFIDENCE`
- `REQUIRE_TWO_DIRECTIONS=true`
- `ONLY_DIRECTIONS=ida,vuelta`

## Supabase Cloud

Usa Supabase en la nube, no local.

Configurar:

- proyecto Supabase Cloud;
- Google OAuth;
- URL y anon key en `.env.local`;
- PostGIS habilitado;
- tablas y RLS;
- Storage si se alojan tiles/datasets.

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_MAP_STYLE_URL=https://basemaps.cartocdn.com/gl/positron-gl-style/style.json
```

Nunca exponer service role en cliente.

## Base de datos

Crear migraciones para:

- `profiles`
- `routes`
- `route_variants`
- `route_shapes`
- `route_segments`
- `route_transfer_points`
- `places`
- `favorite_places`
- `favorite_routes`
- `recent_searches`
- `dataset_versions`
- `gis_quality_reports`

No usar `stops` ni `route_stops` como base principal.

Extensiones:

```sql
create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
```

Toda columna geométrica debe tener índice GiST.

## Modelo de rutas

Una ruta publicada debe tener:

- un registro en `routes`;
- dos variantes o dos features: `ida` y `vuelta`;
- shapes aprobados con `qa_status='approved'`;
- `matched_to_osm=true`;
- color y casing;
- archivo `/public/routes/{id}.geojson` con exactamente dos features.

Formato `/public/routes/{id}.geojson`:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "amarilla-centro_ida",
        "routeId": "amarilla-centro",
        "routeName": "Amarilla Centro",
        "direction": "ida",
        "name": "Ida",
        "color": "#FFC800",
        "casingColor": "#222222",
        "transportType": "combi",
        "qa_status": "approved",
        "matched_to_osm": true
      },
      "geometry": { "type": "LineString", "coordinates": [] }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "amarilla-centro_vuelta",
        "routeId": "amarilla-centro",
        "routeName": "Amarilla Centro",
        "direction": "vuelta",
        "name": "Vuelta",
        "color": "#FFC800",
        "casingColor": "#222222",
        "transportType": "combi",
        "qa_status": "approved",
        "matched_to_osm": true
      },
      "geometry": { "type": "LineString", "coordinates": [] }
    }
  ]
}
```

## Mapa MapLibre obligatorio

Usa:

```ts
style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
center: [-101.194, 19.702]
zoom: 13.3
```

Capas:

1. `route-lines-casing`
2. `route-lines`
3. `route-arrows`
4. `route-text-labels`

Flechas:

- SVG triangular blanco con borde negro.
- `symbol-placement: line`.
- `symbol-spacing` progresivo por zoom.
- `icon-allow-overlap=false`.

Etiquetas:

- `text-field` desde `name`.
- `name` solo puede ser `Ida` o `Vuelta`.
- halo para legibilidad.

## Pipeline de extracción desde carpeta

La carpeta configurada en `RAW_INPUT_DIR` puede contener KML, KMZ, PDF, PNG, GeoPackage, SHP o GeoJSON.

Proceso:

1. Escanear carpeta.
2. Convertir vectores con GDAL/OGR.
3. Intentar leer PDF geoespacial/vectorial con GDAL.
4. Si PDF/PNG es raster no georreferenciado, generar reporte `needs_georeferencing`.
5. Georreferenciar en QGIS con GCPs.
6. Si imagen tiene líneas claras, usar OpenCV/scikit-image solo como ayuda preliminar.
7. Digitalizar/revisar manualmente en QGIS sobre OSM.
8. Separar `ida` y `vuelta`.
9. Exportar a GeoJSON EPSG:4326.
10. Map-match con Valhalla.
11. Validar con OSRM.
12. QA final.
13. Publicar solo `approved`.

Comandos GDAL esperados:

```bash
ogrinfo archivo.kml
ogr2ogr -f GeoJSON salida.geojson entrada.kml -t_srs EPSG:4326
ogr2ogr -f GPKG salida.gpkg entrada.geojson
```

## Valhalla estricto

Usar Valhalla local con endpoint:

- `POST /trace_route`

Reglas:

- `shape_match=map_snap`.
- radios bajos.
- confianza mínima alta.
- comparar geometría original vs snapped.
- si el snap mueve demasiado la ruta, `needs_review` o `rejected`.
- no aceptar automáticamente.

## OSRM como segunda validación

Usar OSRM local:

- `/match/v1/driving/...`

OSRM no reemplaza Valhalla. Sirve para comparar. Si OSRM y Valhalla contradicen, marcar revisión.

## Planner sin paradas

Entrada:

- origen como punto;
- destino como punto;
- preferencias de caminar/transbordos/confianza.

Proceso:

1. Buscar rutas aprobadas cercanas al origen.
2. Proyectar origen al punto más cercano sobre cada shape.
3. Crear `boarding_point` virtual.
4. Buscar rutas aprobadas cercanas al destino.
5. Crear `alighting_point` virtual.
6. Si una misma ruta/sentido conecta ambos puntos, ofrecer viaje directo.
7. Si no, buscar transferencias virtuales entre shapes cercanos.
8. Calcular score.
9. Mostrar máximo 3-5 alternativas.

UI debe decir:

- “Camina hacia el punto sugerido sobre Ruta X”.
- “Toma Ruta X sentido Ida/Vuelta”.
- “Baja en punto sugerido cerca de tu destino”.
- “Este punto es sugerido; no es parada oficial”.

## Fases de trabajo

### Fase 1: Setup

- Inspeccionar repo.
- Instalar herramientas faltantes.
- Crear Next.js.
- Configurar TypeScript, Tailwind, shadcn/ui, ESLint, Prettier, tests.

### Fase 2: Supabase Cloud

- Crear migraciones.
- RLS.
- Auth Google.
- Cliente SSR/browser.

### Fase 3: Mapa UI

- MapLibre.
- Carto Positron.
- Capas de rutas, casing, flechas y etiquetas.
- Diseño premium mobile-first.

### Fase 4: Pipeline GIS

- `.env-valhalla`.
- Scripts Python.
- Conversión fuentes.
- QGIS/GDAL.
- OSM local.
- Valhalla/OSRM.

### Fase 5: QA

- Validar dos sentidos.
- Validar eje vial.
- Reportes.
- Panel admin QA.

### Fase 6: Planner

- Origen/destino.
- Puntos virtuales.
- Ruta directa.
- Transbordos virtuales.

### Fase 7: Búsqueda/favoritos

- Autocompletado.
- Rutas.
- Lugares.
- Favoritos.

### Fase 8: Testing/deploy

- Typecheck.
- Lint.
- Unit tests.
- Playwright.
- Vercel.

## Criterios de aceptación

No termines hasta que:

- `pnpm typecheck` pase.
- `pnpm lint` pase.
- `pnpm test` pase.
- Playwright pase.
- MapLibre cargue con Carto Positron.
- Rutas tengan casing, flechas y etiquetas `Ida`/`Vuelta`.
- Cada ruta publicada tenga exactamente dos sentidos.
- No existan trazos inventados.
- Todo trazo aprobado esté validado con Valhalla/OSRM/QA.
- Supabase Auth Google funcione.
- Favoritos tengan RLS.
- Deploy Vercel esté documentado.

## Forma de trabajo

En cada fase reporta:

1. Qué hiciste.
2. Archivos modificados.
3. Comandos ejecutados.
4. Pruebas realizadas.
5. Errores encontrados.
6. Correcciones.
7. Siguiente paso.

Si falla algo, no avances hasta corregirlo.
