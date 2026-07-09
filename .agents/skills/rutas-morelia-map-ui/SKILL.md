---
name: rutas-morelia-map-ui
description: Especialista UI/UX y mapa MapLibre para Rutas Morelia con estilo blanco Carto Positron, casing, flechas de sentido ida/vuelta y diseño premium.
---

# Skill: Rutas Morelia Map UI

Actúa como especialista frontend GIS, MapLibre, UX mobile-first y diseño premium. Debes implementar un mapa parecido a la referencia visual del proyecto: mapa blanco/limpio tipo Carto Positron, líneas amarillas con contorno oscuro, flechas triangulares sobre la línea y etiquetas `Ida` / `Vuelta` siguiendo el sentido.

## Estilo obligatorio

- Basemap claro: Carto Positron.
- Centro inicial Morelia: `[-101.194, 19.702]`.
- Zoom inicial: `13.3`.
- Rutas con casing/contorno oscuro para legibilidad.
- Línea principal del color de la ruta.
- Flechas SVG blancas con borde negro sobre la línea.
- `symbol-placement: line` para flechas.
- Etiquetas sobre línea con `text-field = name`, donde `name` solo puede ser `Ida` o `Vuelta`.
- Cada ruta visible debe tener exactamente dos sentidos.
- No mostrar paradas oficiales.
- Mostrar solo puntos virtuales como “punto sugerido”, no “parada”.

## Capas MapLibre obligatorias

1. `route-lines-casing`
2. `route-lines`
3. `route-arrows`
4. `route-text-labels`
5. `origin-marker`
6. `destination-marker`
7. `virtual-boarding-point`
8. `virtual-alighting-point`
9. `transfer-point` si aplica

## UI obligatoria

- Mapa pantalla completa.
- Panel flotante en desktop.
- Sheet inferior en móvil.
- Buscador origen/destino con autocompletado.
- Explorador de rutas.
- Resultado con timeline: caminar → tomar ruta → bajar → caminar.
- Mensaje claro: “punto sugerido, no parada oficial”.
- Animaciones suaves con Motion.
- Accesibilidad, contraste, foco visible y reduced motion.

## Integración con ui-ux-pro-max

Si existe el repositorio/skill `ui-ux-pro-max`, consulta sus reglas para diseño, jerarquía visual, accesibilidad, tokens, spacing y componentes. No sacrifiques precisión GIS por estética.

## Nunca hagas esto

- No uses estilos de mapa con token propietario.
- No uses Google Maps/Mapbox.
- No ocultes errores QA en UI.
- No uses más de dos sentidos para una ruta publicada.
