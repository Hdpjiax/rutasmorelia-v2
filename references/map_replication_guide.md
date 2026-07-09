# Guía Completa de Replicación del Mapa

Para replicar el mapa interactivo de rutas de transporte en otro proyecto (como para Grok), puedes utilizar cualquiera de las siguientes soluciones listas para usar. 

---

## 1. Solución Autónoma (HTML/JS en un solo archivo)
Esta es la solución más portátil y recomendada. Es un archivo `index.html` único que contiene la estructura, los estilos modernos (usando Tailwind y Google Fonts) y la lógica de MapLibre GL. 

Puedes copiar este código directamente, guardarlo como `map.html` y servirlo junto con tu carpeta `/routes`.

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mapa de Rutas de Transporte</title>
  
  <!-- MapLibre GL CSS -->
  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
  <!-- Tailwind CSS para diseño moderno -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    body {
      font-family: 'Outfit', sans-serif;
    }
    .map-container {
      height: 100vh;
      width: 100vw;
    }
    /* Estilos personalizados para scrollbar de la barra lateral */
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(156, 163, 175, 0.3);
      border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(156, 163, 175, 0.5);
    }
  </style>
</head>
<body class="bg-slate-900 overflow-hidden">

  <!-- Interfaz de la Aplicación -->
  <div class="relative w-full h-screen">
    
    <!-- Mapa Canvas -->
    <div id="map" class="map-container absolute inset-0"></div>

    <!-- Buscador y Lista de Rutas Flotante -->
    <div class="absolute top-4 left-4 z-10 w-96 max-h-[calc(100vh-2rem)] flex flex-col bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-800/50 transition-all duration-300">
      
      <!-- Encabezado y Barra de Búsqueda -->
      <div class="p-5 border-b border-slate-100 dark:border-slate-800">
        <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span>🚍</span> Rutas de Transporte
        </h1>
        <p class="text-xs text-slate-500 mt-1">Selecciona una ruta para ver su trazado en el mapa</p>
        
        <div class="mt-4 relative">
          <input 
            type="text" 
            id="search-input" 
            placeholder="Buscar ruta por nombre o código..." 
            class="w-full pl-10 pr-4 py-2 bg-slate-100/80 dark:bg-slate-800/80 border border-transparent rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200 placeholder-slate-400"
          />
          <span class="absolute left-3 top-2.5 text-slate-400">🔍</span>
        </div>
      </div>

      <!-- Lista de Rutas -->
      <div id="routes-list" class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 max-h-[60vh]">
        <div class="text-center py-8 text-slate-400 text-sm">
          Cargando rutas...
        </div>
      </div>
      
      <!-- Footer de Estado -->
      <div class="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl flex justify-between items-center text-xxs text-slate-400">
        <span id="routes-count">0 rutas cargadas</span>
        <span>OpenStreetMap Morelia</span>
      </div>
    </div>
    
  </div>

  <!-- MapLibre GL JS -->
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>

  <script>
    // Configuración Inicial
    const MAP_CENTER = [-101.194, 19.702];
    const MAP_ZOOM = 13.3;
    const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"; // Basemap claro
    // Para modo oscuro puedes usar: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

    let map;
    let allRoutes = [];
    let activeRouteId = null;

    // Inicializar el Mapa
    document.addEventListener("DOMContentLoaded", () => {
      map = new maplibregl.Map({
        container: 'map',
        style: MAP_STYLE,
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        minZoom: 10,
        maxZoom: 19,
        attributionControl: false
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      map.on('load', () => {
        setupLayers();
        loadRoutesIndex();
      });
    });

    // Registrar icono de flecha e iniciar capas
    function setupLayers() {
      // SVG para las flechas de dirección sobre la línea de ruta
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="6,7 26,16 6,25" fill="#ffffff" stroke="#000000" stroke-width="3" stroke-linejoin="round"/></svg>`;
      const img = new Image(32, 32);
      img.onload = () => {
        if (!map.hasImage("route-arrow-icon")) {
          map.addImage("route-arrow-icon", img);
        }
        
        // Registrar Source GeoJSON vacío
        map.addSource("routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] }
        });

        // 1. Capa de Contorno (Casing) para legibilidad
        map.addLayer({
          id: "route-lines-casing",
          type: "line",
          source: "routes",
          paint: {
            "line-color": ["get", "casingColor"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 14, 4.5, 18, 6.0],
            "line-opacity": 0.9
          },
          layout: { "line-cap": "round", "line-join": "round" }
        });

        // 2. Capa Principal de la Ruta
        map.addLayer({
          id: "route-lines",
          type: "line",
          source: "routes",
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 14, 2.5, 18, 4.0],
            "line-opacity": 1.0
          },
          layout: { "line-cap": "round", "line-join": "round" }
        });

        // 3. Capa de Flechas de Dirección
        map.addLayer({
          id: "route-arrows",
          type: "symbol",
          source: "routes",
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": ["interpolate", ["linear"], ["zoom"], 10, 80, 14, 120, 18, 160],
            "icon-image": "route-arrow-icon",
            "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 0.7, 18, 0.9],
            "icon-allow-overlap": false,
            "icon-ignore-placement": false,
            "icon-padding": 10
          }
        });

        // 4. Capa de Nombres/Etiquetas flotantes de la dirección
        map.addLayer({
          id: "route-text-labels",
          type: "symbol",
          source: "routes",
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": ["interpolate", ["linear"], ["zoom"], 10, 180, 14, 240, 18, 300],
            "text-field": ["get", "name"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 10, 9.0, 14, 11.0, 18, 13.0],
            "text-keep-upright": true,
            "text-allow-overlap": false
          },
          paint: {
            "text-color": ["get", "color"],
            "text-halo-color": ["get", "casingColor"],
            "text-halo-width": 2.0,
            "text-opacity": 0.95
          }
        });
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    // Cargar el Índice de las rutas (index.json)
    async function loadRoutesIndex() {
      try {
        const res = await fetch("/routes/index.json");
        if (!res.ok) throw new Error("No se pudo cargar index.json");
        const data = await res.json();
        
        allRoutes = data.routes || [];
        document.getElementById("routes-count").innerText = `${allRoutes.length} rutas cargadas`;
        
        renderRoutesList(allRoutes);
        setupSearch();
      } catch (err) {
        console.error(err);
        document.getElementById("routes-list").innerHTML = `
          <div class="text-center py-8 text-red-500 text-sm">
            Error al cargar el índice de rutas. Asegúrate de servir la carpeta de rutas en la raíz.
          </div>
        `;
      }
    }

    // Renderizar listado de la barra lateral
    function renderRoutesList(routes) {
      const container = document.getElementById("routes-list");
      if (routes.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">No se encontraron rutas</div>`;
        return;
      }

      container.innerHTML = routes.map(route => {
        const isActive = route.id === activeRouteId;
        const color = route.color || "#3b82f6";
        const contrastTextColor = getContrastTextColor(color);

        return `
          <button 
            onclick="selectRoute('${route.id}')"
            class="w-full text-left p-3 rounded-xl flex items-center justify-between gap-3 transition-all duration-200 group ${
              isActive 
                ? "bg-slate-100 dark:bg-slate-800 shadow-sm border-l-4" 
                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
            }"
            style="${isActive ? `border-left-color: ${color}` : ''}"
          >
            <div class="flex items-center gap-3 overflow-hidden">
              <div 
                class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-sm"
                style="background-color: ${color}; color: ${contrastTextColor}"
              >
                ${route.colorLetter || route.id.charAt(0)}
              </div>
              <div class="overflow-hidden">
                <div class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 transition-colors">
                  ${route.name}
                </div>
                <div class="text-xxs text-slate-400 capitalize">
                  ${route.transportType} • ID: ${route.id}
                </div>
              </div>
            </div>
            <span class="text-slate-300 group-hover:text-slate-400 transition-colors text-sm shrink-0">→</span>
          </button>
        `;
      }).join('');
    }

    // Buscador interactivo
    function setupSearch() {
      const input = document.getElementById("search-input");
      input.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = allRoutes.filter(route => 
          route.name.toLowerCase().includes(query) || 
          route.id.toLowerCase().includes(query)
        );
        renderRoutesList(filtered);
      });
    }

    // Cargar y mostrar la ruta GeoJSON seleccionada
    async function selectRoute(routeId) {
      activeRouteId = routeId;
      renderRoutesList(allRoutes); // Actualiza estado visual en sidebar

      try {
        const res = await fetch(`/routes/${routeId}.geojson`);
        if (!res.ok) throw new Error("No se pudo cargar la geometría de la ruta");
        const data = await res.json();
        
        if (!data.features || data.features.length === 0) return;

        // Añadir color de contraste dinámico para bordes de las rutas
        const coloredFeatures = {
          ...data,
          features: data.features.map(f => ({
            ...f,
            properties: {
              ...f.properties,
              casingColor: getContrastCasingColor(f.properties.color || "#3b82f6")
            }
          }))
        };

        // Actualizar Source del mapa
        const source = map.getSource("routes");
        if (source) {
          source.setData(coloredFeatures);
        }

        // Ajustar la cámara para enmarcar la ruta
        const allCoords = [];
        for (const feature of coloredFeatures.features) {
          if (feature.geometry.type === "LineString") {
            allCoords.push(...feature.geometry.coordinates);
          }
        }

        if (allCoords.length > 0) {
          const bounds = allCoords.reduce(
            (acc, coord) => acc.extend(coord),
            new maplibregl.LngLatBounds(allCoords[0], allCoords[0])
          );
          map.fitBounds(bounds, { padding: 45, maxZoom: 15 });
        }
      } catch (err) {
        alert("Error al cargar los datos del mapa: " + err.message);
      }
    }

    // Utilidades de color
    function getContrastTextColor(hexColor) {
      const cleanHex = hexColor.replace("#", "");
      if (cleanHex.length !== 6) return "#ffffff";
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 155 ? "#111111" : "#ffffff";
    }

    function getContrastCasingColor(hexColor) {
      const cleanHex = hexColor.replace("#", "");
      if (cleanHex.length !== 6) return "#ffffff";
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 155 ? "#222222" : "#ffffff";
    }
  </script>
</body>
</html>
```

---

## 2. Solución en React (`MapComponent.jsx`)
Si tu otro proyecto utiliza React (con Next.js, Vite o Create React App), puedes usar este componente autocontenido. Utiliza la librería nativa de `maplibre-gl`.

```jsx
import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export function MapComponent({ activeRouteId, routesDirectory = "/routes" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  // Inicializar mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [-101.194, 19.702],
      zoom: 13.3,
      minZoom: 10,
      maxZoom: 19,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      setupLayers(map);
      setStyleLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Registrar capas y recursos
  const setupLayers = (map) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="6,7 26,16 6,25" fill="#ffffff" stroke="#000000" stroke-width="3" stroke-linejoin="round"/></svg>`;
    const img = new Image(32, 32);
    img.onload = () => {
      if (!map.hasImage("route-arrow-icon")) {
        map.addImage("route-arrow-icon", img);
      }

      map.addSource("routes-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Casing
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "routes-source",
        paint: {
          "line-color": ["get", "casingColor"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 14, 4.5, 18, 6.0],
          "line-opacity": 0.9,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      // Línea principal
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "routes-source",
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 14, 2.5, 18, 4.0],
          "line-opacity": 1.0,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      // Flechas
      map.addLayer({
        id: "route-arrows",
        type: "symbol",
        source: "routes-source",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": ["interpolate", ["linear"], ["zoom"], 10, 80, 14, 120, 18, 160],
          "icon-image": "route-arrow-icon",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 0.7, 18, 0.9],
          "icon-allow-overlap": false,
          "icon-ignore-placement": false,
        },
      });

      // Texto de dirección (Ida / Vuelta)
      map.addLayer({
        id: "route-labels",
        type: "symbol",
        source: "routes-source",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 200,
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 9.0, 14, 11.0, 18, 13.0],
          "text-keep-upright": true,
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": ["get", "casingColor"],
          "text-halo-width": 2.0,
        },
      });
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };

  // Cargar geometría de la ruta activa
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    if (!activeRouteId) {
      const source = map.getSource("routes-source");
      if (source) source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    async function fetchRoute() {
      try {
        const res = await fetch(`${routesDirectory}/${activeRouteId}.geojson`);
        if (!res.ok) throw new Error("Error cargando el archivo GeoJSON");
        const data = await res.json();

        const colored = {
          ...data,
          features: data.features.map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              casingColor: getContrastColor(f.properties.color || "#3b82f6"),
            },
          })),
        };

        const source = map.getSource("routes-source");
        if (source) source.setData(colored);

        // Enmarcar ruta
        const allCoords = [];
        for (const f of colored.features) {
          if (f.geometry.type === "LineString") {
            allCoords.push(...f.geometry.coordinates);
          }
        }

        if (allCoords.length > 0) {
          const bounds = allCoords.reduce(
            (acc, coord) => acc.extend(coord),
            new maplibregl.LngLatBounds(allCoords[0], allCoords[0])
          );
          map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
        }
      } catch (err) {
        console.error(err);
      }
    }

    fetchRoute();
  }, [activeRouteId, styleLoaded, routesDirectory]);

  function getContrastColor(hexColor) {
    const cleanHex = hexColor.replace("#", "");
    if (cleanHex.length !== 6) return "#ffffff";
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 155 ? "#222222" : "#ffffff";
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
```

---

## 3. Estructura de Datos Necesaria
Para que cualquiera de las dos soluciones funcione, necesitas organizar los archivos de datos de rutas en una carpeta pública de tu servidor (por ejemplo, en el directorio `/public/routes/` de Next.js o Vite) con el siguiente formato:

### A) El índice (`routes/index.json`)
```json
{
  "type": "routes-index",
  "routes": [
    {
      "id": "2",
      "name": "Amarilla Tenencia Morelos",
      "color": "#FFC800",
      "transportType": "combi",
      "colorName": "Amarillo",
      "colorLetter": "A",
      "geojsonFile": "/routes/2.geojson"
    },
    {
      "id": "3",
      "name": "Amarilla 1 Centro",
      "color": "#FFC800",
      "transportType": "combi",
      "colorName": "Amarillo",
      "colorLetter": "A",
      "geojsonFile": "/routes/3.geojson"
    }
  ]
}
```

### B) Los archivos de ruta (`routes/{id}.geojson`)
Cada ruta debe tener su archivo GeoJSON correspondiente (ej. `2.geojson`) con las líneas y metadatos de dirección:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "2_0",
        "routeId": "2",
        "routeName": "Amarilla Tenencia Morelos",
        "direction": "ida",
        "color": "#FFC800",
        "casingColor": "#222222",
        "longKm": 9.1915,
        "transportType": "combi",
        "name": "Ida"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-101.21855, 19.64532],
          [-101.21812, 19.64571]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "2_1",
        "routeId": "2",
        "routeName": "Amarilla Tenencia Morelos",
        "direction": "vuelta",
        "color": "#FFC800",
        "casingColor": "#222222",
        "longKm": 9.2543,
        "transportType": "combi",
        "name": "Vuelta"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-101.21812, 19.64571],
          [-101.21855, 19.64532]
        ]
      }
    }
  ]
}
```
