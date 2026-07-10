# AGENTS.md — Rutas Morelia para Google Antigravity

Usa este archivo como instrucciones raíz del proyecto para Antigravity.

Proyecto: Rutas Morelia, web para consultar y planificar rutas de transporte público en Morelia por origen-destino, sin paradas oficiales.

Stack obligatorio: Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, Supabase Cloud, Vercel, MapLibre GL JS, PMTiles/Carto Positron, PostGIS, Python GIS, QGIS, GDAL, Valhalla local, OSRM local y OSM local.

Reglas absolutas:

- Supabase se usa en la nube.
- Deploy en Vercel.
- Desarrollo local en Windows.
- Instalar QGIS/GDAL en Windows y Valhalla/OSRM/OSM preferentemente vía WSL2 Ubuntu si no existen.
- Producción (Vercel): el usuario ve solo `public/routes/*.geojson` + `index.json`. No requiere Valhalla en el servidor.
- Valhalla/OSRM son opcionales y solo locales (en tu PC/WSL) si quieres re-alinear trazos; los cambios de producción se hacen en local y se suben al repo.
- Subir rutas a Supabase Cloud: `npx tsx scripts/seed_supabase_from_geojson.ts` (usa service role de `.env.local`).
- No usar Google Maps, Google Directions, Mapbox ni APIs propietarias de routing.
- No usar paradas oficiales como base del sistema.
- Usar solo origen/destino, rutas/corredores y puntos virtuales.
- Nunca llamar “parada oficial” a un punto virtual.
- Toda ruta publicada debe tener exactamente dos sentidos: `ida` y `vuelta`.
- Todo trazo debe apegarse 100% al eje vial real.
- No inventar líneas rectas, saltos ni segmentos.
- Validar con Valhalla estricto + OSRM + QA GIS.
- Rutas con dudas deben quedar `needs_review`, no publicadas.
- Usar estilo de mapa blanco tipo Carto Positron, líneas con casing oscuro, flechas sobre línea y etiquetas Ida/Vuelta.
- Antes de modificar archivos, inspecciona el repo y di qué harás.
- Trabaja fase por fase, ejecuta pruebas y no ocultes errores.

Archivos importantes:

- `prompt_completo_antigravity_rutas_morelia.md`: plan completo del proyecto.
- `.agents/skills/rutas-morelia-gis/SKILL.md`: skill GIS/routing.
- `.agents/skills/rutas-morelia-map-ui/SKILL.md`: skill de mapa/UI.
- `.agents/skills/rutas-morelia-ingesta-qa/SKILL.md`: skill de ingesta y QA.
- `references/map_replication_guide.md`: guía visual MapLibre.
- `references/rutamarilla_reference.png`: referencia visual de ruta con ida/vuelta.
- `templates/.env-valhalla.example`: plantilla de configuración local GIS.
