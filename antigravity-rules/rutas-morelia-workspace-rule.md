# Rule de Workspace — Rutas Morelia

Aplica esta regla en Antigravity como Workspace Rule si tu versión lo permite.

Trabaja fase por fase siguiendo `AGENTS.md` y `prompt_completo_antigravity_rutas_morelia.md`.

Reglas obligatorias:
- Supabase Cloud, no Supabase local.
- Deploy en Vercel.
- Windows local para desarrollo.
- Instalar QGIS/GDAL/Valhalla/OSRM/OSM si no existen.
- No usar Google Maps, Google Directions, Mapbox ni routing propietario.
- No usar paradas oficiales.
- Solo origen, destino, corredores y puntos virtuales.
- Cada ruta publicada debe tener exactamente dos sentidos: `ida` y `vuelta`.
- El mapa debe replicar el estilo de referencia: Carto Positron blanco, línea de color con casing oscuro, flechas de sentido y etiquetas Ida/Vuelta.
- Todo trazo debe apegarse 100% al eje vial real.
- Validar todo con QGIS/GDAL + Valhalla estricto + OSRM + QA GIS.
- Si una geometría no pasa validación, marcarla `needs_review` o `rejected`.
- Nunca exponer service_role en frontend, GitHub ni variables `NEXT_PUBLIC`.
