import type { Map as MapLibreMap } from "maplibre-gl";

export const CARTO_POSITRON_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
export const MORELIA_CENTER: [number, number] = [-101.194, 19.702];
export const MORELIA_ZOOM = 13.3;

export const routeArrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="6,7 26,16 6,25" fill="#ffffff" stroke="#000000" stroke-width="3" stroke-linejoin="round"/></svg>`;

export async function addRouteDirectionLayers(map: MapLibreMap, sourceId = "routes-source") {
  const img = new Image(32, 32);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No se pudo cargar route-arrow-icon"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(routeArrowSvg);
  });

  if (!map.hasImage("route-arrow-icon")) map.addImage("route-arrow-icon", img);
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer("route-lines-casing")) {
    map.addLayer({
      id: "route-lines-casing",
      type: "line",
      source: sourceId,
      paint: {
        "line-color": ["get", "casingColor"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 14, 3.5, 18, 5],
        "line-opacity": 0.95,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }

  if (!map.getLayer("route-lines")) {
    map.addLayer({
      id: "route-lines",
      type: "line",
      source: sourceId,
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.2, 14, 2, 18, 3],
        "line-opacity": 1,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }

  if (!map.getLayer("route-arrows")) {
    map.addLayer({
      id: "route-arrows",
      type: "symbol",
      source: sourceId,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": ["interpolate", ["linear"], ["zoom"], 10, 80, 14, 120, 18, 160],
        "icon-image": "route-arrow-icon",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 0.7, 18, 0.9],
        "icon-allow-overlap": false,
        "icon-ignore-placement": false,
        "icon-padding": 10,
      },
    });
  }

  if (!map.getLayer("route-text-labels")) {
    map.addLayer({
      id: "route-text-labels",
      type: "symbol",
      source: sourceId,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": ["interpolate", ["linear"], ["zoom"], 10, 180, 14, 240, 18, 300],
        "text-field": ["get", "name"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 9, 14, 11, 18, 13],
        "text-keep-upright": true,
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": ["get", "color"],
        "text-halo-color": ["get", "casingColor"],
        "text-halo-width": 2,
        "text-opacity": 0.95,
      },
    });
  }
}
