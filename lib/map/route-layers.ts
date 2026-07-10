import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';

export const ROUTE_ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><polygon points="5,6 23,14 5,22" fill="#ffffff" stroke="#1a1a1a" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

export const ROUTES_SOURCE_ID = 'routes-source';
export const STOPS_SOURCE_ID = 'trip-stops-source';

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

  // Líneas: no dibujar walk ni sense-label (solo corredor / segmento)
  const lineFilter: maplibregl.FilterSpecification = [
    'all',
    ['!=', ['get', 'type'], 'walk'],
    ['!=', ['get', 'type'], 'sense-label'],
  ];

  if (!map.getLayer('route-lines-casing')) {
    map.addLayer({
      id: 'route-lines-casing',
      type: 'line',
      source: ROUTES_SOURCE_ID,
      filter: lineFilter,
      paint: {
        // Casing más grueso en zoom bajo (rutas densas legibles)
        'line-color': ['coalesce', ['get', 'casingColor'], '#1a1a1a'],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          ['case', ['==', ['get', 'role'], 'segment'], 4.2, 3.2],
          12,
          ['case', ['==', ['get', 'role'], 'segment'], 5, 3.8],
          14,
          ['case', ['==', ['get', 'role'], 'segment'], 5.5, 4.2],
          18,
          ['case', ['==', ['get', 'role'], 'segment'], 7, 5.5],
        ],
        'line-opacity': 0.95,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }

  if (!map.getLayer('route-lines')) {
    map.addLayer({
      id: 'route-lines',
      type: 'line',
      source: ROUTES_SOURCE_ID,
      filter: lineFilter,
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#3b82f6'],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          ['case', ['==', ['get', 'role'], 'segment'], 2.6, 1.9],
          12,
          ['case', ['==', ['get', 'role'], 'segment'], 3.2, 2.3],
          14,
          ['case', ['==', ['get', 'role'], 'segment'], 3.8, 2.8],
          18,
          ['case', ['==', ['get', 'role'], 'segment'], 5.2, 3.8],
        ],
        'line-opacity': [
          'case',
          ['==', ['get', 'role'], 'full'],
          0.9,
          ['==', ['get', 'role'], 'segment'],
          1,
          1,
        ],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }

  // Flechas: más densas en zoom bajo, más grandes en móvil/zoom medio
  if (!map.getLayer('route-arrows')) {
    map.addLayer({
      id: 'route-arrows',
      type: 'symbol',
      source: ROUTES_SOURCE_ID,
      filter: [
        'any',
        ['==', ['get', 'type'], 'sense-label'],
        [
          'all',
          ['!=', ['get', 'type'], 'walk'],
          [
            'any',
            ['==', ['get', 'role'], 'segment'],
            ['==', ['get', 'direction'], 'ida'],
            ['==', ['get', 'direction'], 'vuelta'],
          ],
        ],
      ],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 10, 42, 12, 58, 14, 78, 18, 100],
        'icon-image': 'route-arrow-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.42, 12, 0.5, 14, 0.58, 18, 0.72],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-padding': 2,
      },
    });
  }

  // Etiquetas Ida / Vuelta (dual_ring o sense-label)
  if (!map.getLayer('route-text-labels')) {
    map.addLayer({
      id: 'route-text-labels',
      type: 'symbol',
      source: ROUTES_SOURCE_ID,
      filter: [
        'all',
        ['!=', ['get', 'type'], 'walk'],
        ['!=', ['get', 'name'], ''],
        [
          'any',
          ['==', ['get', 'type'], 'sense-label'],
          ['==', ['get', 'name'], 'Ida'],
          ['==', ['get', 'name'], 'Vuelta'],
        ],
      ],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 10, 140, 14, 180, 18, 220],
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 12, 18, 13],
        'text-keep-upright': true,
        'text-allow-overlap': false,
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      },
      paint: {
        'text-color': ['coalesce', ['get', 'color'], '#3b82f6'],
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
        'text-opacity': 0.98,
      },
    });
  }

  // Caminata: casing + dash (legible en móvil)
  if (includeWalk && !map.getLayer('route-lines-walk-casing')) {
    map.addLayer({
      id: 'route-lines-walk-casing',
      type: 'line',
      source: ROUTES_SOURCE_ID,
      filter: ['==', ['get', 'type'], 'walk'],
      paint: {
        'line-color': '#0f172a',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 5.5, 14, 7, 18, 9],
        'line-opacity': 0.35,
        'line-dasharray': [1, 0.2],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }

  if (includeWalk && !map.getLayer('route-lines-walk')) {
    map.addLayer({
      id: 'route-lines-walk',
      type: 'line',
      source: ROUTES_SOURCE_ID,
      filter: ['==', ['get', 'type'], 'walk'],
      paint: {
        'line-color': [
          'match',
          ['get', 'walkKind'],
          'to_board',
          '#0284c7',
          'from_alight',
          '#7c3aed',
          'transfer',
          '#d97706',
          '#475569',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 14, 5, 18, 7],
        'line-dasharray': [0.8, 1.4],
        'line-opacity': 1,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }

  if (includeWalk && !map.getLayer('route-walk-labels')) {
    map.addLayer({
      id: 'route-walk-labels',
      type: 'symbol',
      source: ROUTES_SOURCE_ID,
      minzoom: 12.5,
      filter: ['==', ['get', 'type'], 'walk'],
      layout: {
        'symbol-placement': 'line-center',
        'text-field': [
          'match',
          ['get', 'walkKind'],
          'to_board',
          'A pie → subir',
          'from_alight',
          'A pie → destino',
          'transfer',
          'A pie · transbordo',
          'A pie',
        ],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 15, 12],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': false,
        'text-padding': 4,
      },
      paint: {
        'text-color': '#0f172a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
    });
  }

  // Letreros Sube / Baja / Transbordo (capas nativas, más fiables que DOM)
  if (!map.getSource(STOPS_SOURCE_ID)) {
    map.addSource(STOPS_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer('trip-stops-halo')) {
    map.addLayer({
      id: 'trip-stops-halo',
      type: 'circle',
      source: STOPS_SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 10, 15, 14, 18, 18],
        'circle-color': [
          'match',
          ['get', 'kind'],
          'sube',
          '#2563eb',
          'baja',
          '#7c3aed',
          'transbordo',
          '#d97706',
          '#334155',
        ],
        'circle-opacity': 0.25,
        'circle-blur': 0.4,
      },
    });
  }

  if (!map.getLayer('trip-stops-dot')) {
    map.addLayer({
      id: 'trip-stops-dot',
      type: 'circle',
      source: STOPS_SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 15, 7, 18, 9],
        'circle-color': [
          'match',
          ['get', 'kind'],
          'sube',
          '#2563eb',
          'baja',
          '#7c3aed',
          'transbordo',
          '#d97706',
          '#334155',
        ],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  if (!map.getLayer('trip-stops-labels')) {
    map.addLayer({
      id: 'trip-stops-labels',
      type: 'symbol',
      source: STOPS_SOURCE_ID,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 12.5, 18, 14],
        // stack up/down evita que Baja y Sube se tapen si están cerca
        'text-offset': [
          'match',
          ['get', 'stack'],
          'up',
          ['literal', [0, -1.9]],
          'down',
          ['literal', [0, 1.9]],
          ['literal', [0, -1.55]],
        ],
        'text-anchor': [
          'match',
          ['get', 'stack'],
          'down',
          'top',
          'bottom',
        ],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-optional': false,
        'text-max-width': 10,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': [
          'match',
          ['get', 'kind'],
          'sube',
          '#1d4ed8',
          'baja',
          '#6d28d9',
          'transbordo',
          '#b45309',
          '#0f172a',
        ],
        'text-halo-width': 2.4,
      },
    });
  }
}

export function setTripStopsData(
  map: MapLibreMap,
  features: Array<{
    type: 'Feature';
    properties: {
      label: string;
      kind: 'sube' | 'baja' | 'transbordo';
      stack?: 'up' | 'down' | 'center';
    };
    geometry: { type: 'Point'; coordinates: [number, number] };
  }>
) {
  const source = map.getSource(STOPS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  source?.setData({
    type: 'FeatureCollection',
    features,
  } as unknown as GeoJSON.FeatureCollection);
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

export type FeatureCollectionData = {
  type?: string;
  features?: Array<{
    type?: string;
    properties?: Record<string, unknown> | null;
    geometry?: unknown;
  }>;
  [key: string]: unknown;
};

export function setQaPreviewData(map: MapLibreMap, data: FeatureCollectionData) {
  const source = map.getSource(QA_PREVIEW_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  // MapLibre tipa GeoJSON de forma estricta; nuestro FeatureCollection es compatible en runtime
  source?.setData({
    type: 'FeatureCollection',
    features: data.features ?? [],
  } as unknown as GeoJSON.FeatureCollection);
}