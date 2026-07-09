import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';

export const ROUTE_ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><polygon points="5,6 23,14 5,22" fill="#ffffff" stroke="#1a1a1a" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

export const ROUTES_SOURCE_ID = 'routes-source';

export async function ensureRouteArrowIcon(map: MapLibreMap): Promise<void> {
  if (map.hasImage('route-arrow-icon')) return;
  const img = new Image(28, 28);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('route-arrow-icon'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ROUTE_ARROW_SVG);
  });
  if (!map.hasImage('route-arrow-icon')) {
    map.addImage('route-arrow-icon', img);
  }
}

export function addRouteLayers(map: MapLibreMap, options?: { includeWalk?: boolean }) {
  const includeWalk = options?.includeWalk ?? true;

  if (!map.getSource(ROUTES_SOURCE_ID)) {
    map.addSource(ROUTES_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer('route-lines-casing')) {
    map.addLayer({
      id: 'route-lines-casing',
      type: 'line',
      source: ROUTES_SOURCE_ID,
      filter: ['!=', ['get', 'type'], 'walk'],
      paint: {
        'line-color': ['coalesce', ['get', 'casingColor'], '#222222'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3.5, 18, 5],
        'line-opacity': 0.92,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }

  if (!map.getLayer('route-lines')) {
    map.addLayer({
      id: 'route-lines',
      type: 'line',
      source: ROUTES_SOURCE_ID,
      filter: ['!=', ['get', 'type'], 'walk'],
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#3b82f6'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 14, 2, 18, 3],
        'line-opacity': 1,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }

  if (!map.getLayer('route-arrows')) {
    map.addLayer({
      id: 'route-arrows',
      type: 'symbol',
      source: ROUTES_SOURCE_ID,
      filter: ['!=', ['get', 'type'], 'walk'],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 10, 55, 14, 85, 18, 110],
        'icon-image': 'route-arrow-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.35, 14, 0.5, 18, 0.65],
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
      },
    });
  }

  if (!map.getLayer('route-text-labels')) {
    map.addLayer({
      id: 'route-text-labels',
      type: 'symbol',
      source: ROUTES_SOURCE_ID,
      filter: ['!=', ['get', 'type'], 'walk'],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 10, 160, 14, 200, 18, 240],
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 10.5, 18, 12],
        'text-keep-upright': true,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': ['coalesce', ['get', 'color'], '#3b82f6'],
        'text-halo-color': ['coalesce', ['get', 'casingColor'], '#222222'],
        'text-halo-width': 1.8,
        'text-opacity': 0.95,
      },
    });
  }

  if (includeWalk && !map.getLayer('route-lines-walk')) {
    map.addLayer({
      id: 'route-lines-walk',
      type: 'line',
      source: ROUTES_SOURCE_ID,
      filter: ['==', ['get', 'type'], 'walk'],
      paint: {
        'line-color': '#94a3b8',
        'line-width': 3,
        'line-dasharray': [2, 2],
        'line-opacity': 0.85,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }
}

export const QA_PREVIEW_SOURCE_ID = 'qa-route-preview';

/** Capas QA preview (misma geometría delgada, source propio). */
export function addQaPreviewLayers(map: MapLibreMap, sourceId = QA_PREVIEW_SOURCE_ID) {
  if (!map.getLayer(`${sourceId}-casing`)) {
    map.addLayer({
      id: `${sourceId}-casing`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#222222',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3.5, 18, 5],
        'line-opacity': 0.9,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }
  if (!map.getLayer(`${sourceId}-line`)) {
    map.addLayer({
      id: `${sourceId}-line`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 14, 2, 18, 3],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }
  if (!map.getLayer(`${sourceId}-arrows`)) {
    map.addLayer({
      id: `${sourceId}-arrows`,
      type: 'symbol',
      source: sourceId,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 70,
        'icon-image': 'route-arrow-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 0.55],
      },
    });
  }
  if (!map.getLayer(`${sourceId}-labels`)) {
    map.addLayer({
      id: `${sourceId}-labels`,
      type: 'symbol',
      source: sourceId,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-font': ['Open Sans Regular'],
      },
      paint: {
        'text-color': '#111',
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    });
  }
}

export function ensureQaPreviewLayers(map: MapLibreMap) {
  const sourceId = QA_PREVIEW_SOURCE_ID;
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  addQaPreviewLayers(map, sourceId);
}

type FeatureCollectionData = {
  type: 'FeatureCollection';
  features: Array<{ type: string; properties?: Record<string, unknown>; geometry: unknown }>;
};

export function setQaPreviewData(map: MapLibreMap, data: FeatureCollectionData) {
  const source = map.getSource(QA_PREVIEW_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  source?.setData(data);
}