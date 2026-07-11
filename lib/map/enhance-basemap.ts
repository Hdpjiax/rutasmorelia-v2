import type {
  ExpressionSpecification,
  Map as MapLibreMap,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import { PERIFERICO_GEOJSON_URL } from './constants';

const GREEN_LAYERS = [
  'landcover',
  'park_national_park',
  'park_nature_reserve',
  'landuse',
];

/** Gris suave visible (Positron base ~#fff); evitar blanco plano */
const ROAD_FILL_COLOR = '#e0ded9';
const ROAD_CASE_COLOR = '#d4d2cd';
const MAP_BACKGROUND_TINT = '#f6f5f2';

const ROAD_FILL_LAYERS = [
  'road_service_fill',
  'road_minor_fill',
  'road_sec_fill_noramp',
  'road_pri_fill_noramp',
  'road_trunk_fill_noramp',
  'road_mot_fill_noramp',
  'road_pri_fill_ramp',
  'road_trunk_fill_ramp',
  'road_mot_fill_ramp',
  'bridge_service_fill',
  'bridge_minor_fill',
  'bridge_sec_fill',
  'bridge_pri_fill',
  'bridge_trunk_fill',
  'bridge_mot_fill',
];

const ROAD_LABEL_LAYERS = [
  'road_label',
  'road_label_minor',
  'road_label_major',
];

/** Vías férreas secundarias — casi invisibles */
const RAIL_SECONDARY_LAYERS = [
  'rail_dash',
  'tunnel_rail',
  'tunnel_rail_dash',
  'rail_tunnel',
  'transit_rail',
  'rail_service',
];

function setPaintIfExists(map: MapLibreMap, layerId: string, prop: string, value: unknown) {
  if (map.getLayer(layerId)) {
    try {
      map.setPaintProperty(layerId, prop, value);
    } catch {
      /* layer may not support property */
    }
  }
}

function setLayoutIfExists(map: MapLibreMap, layerId: string, prop: string, value: unknown) {
  if (map.getLayer(layerId)) {
    try {
      map.setLayoutProperty(layerId, prop, value);
    } catch {
      /* ignore */
    }
  }
}

function findInsertBeforeId(map: MapLibreMap): string | undefined {
  const style = map.getStyle();
  const layers = style?.layers ?? [];
  const routeLayer = layers.find((l) => l.id.startsWith('route-') || l.id.startsWith('rm-'));
  return routeLayer?.id;
}

/**
 * Encima de todo el pavimento Carto (rellenos + puentes), debajo de nombres de calle.
 * Positron usa `roadname_*`, no `road_label`.
 */
function findStreetArrowInsertBeforeId(map: MapLibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  const roadNameIdx = layers.findIndex(
    (l) => l.id.startsWith('roadname_') || l.id.startsWith('road_label')
  );
  if (roadNameIdx >= 0) return layers[roadNameIdx].id;

  const afterPavementIdx = layers.findIndex((l) => l.id === 'building' || l.id === 'building-top');
  if (afterPavementIdx >= 0) return layers[afterPavementIdx].id;

  return findInsertBeforeId(map);
}

const STREET_ARROW_ICON = 'street-arrow-chevron';
/** Detalle de calle: zoom 16–19 */
const STREET_ARROW_MIN_ZOOM = 16;

/** Chevron vectorial; se rasteriza a 96px + pixelRatio 2 (nítido al acercar). */
const STREET_ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 22 22"><path d="M6 5L16 11L6 17Z" fill="#75726d" stroke="#f4f3f0" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const STREET_ARROW_BITMAP = 96;
const STREET_ARROW_PIXEL_RATIO = 2;

/** Calles transitables: mismas clases que Carto Positron (superficie, puente y túnel). */
const STREET_ARROW_LAYERS: Array<{
  id: string;
  filter: ExpressionSpecification;
  /** Más separación en calles cortas para evitar amontonamiento */
  spacingScale: number;
}> = [
  { id: 'rm-street-arrows-mot', filter: ['==', ['get', 'class'], 'motorway'], spacingScale: 1 },
  { id: 'rm-street-arrows-trunk', filter: ['==', ['get', 'class'], 'trunk'], spacingScale: 1 },
  { id: 'rm-street-arrows-pri', filter: ['==', ['get', 'class'], 'primary'], spacingScale: 1.05 },
  {
    id: 'rm-street-arrows-sec',
    filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
    spacingScale: 1.2,
  },
  { id: 'rm-street-arrows-minor', filter: ['==', ['get', 'class'], 'minor'], spacingScale: 1.45 },
  { id: 'rm-street-arrows-service', filter: ['==', ['get', 'class'], 'service'], spacingScale: 1.55 },
];

function streetArrowSpacing(scale: number): ExpressionSpecification {
  // Más separación al acercar para no llenar el mapa de chevrones
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    16,
    480 * scale,
    17,
    520 * scale,
    18,
    580 * scale,
    19,
    640 * scale,
  ];
}

/**
 * Tamaño estable (~14–16 px en pantalla).
 * Bitmap 96 + pixelRatio 2 → base 48; 0.32 × 48 ≈ 15 px.
 */
const STREET_ARROW_ICON_SIZE: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  16,
  0.3,
  17,
  0.31,
  18,
  0.32,
  19,
  0.33,
];

const STREET_ARROW_ICON_OPACITY: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  16,
  0.64,
  17,
  0.68,
  18,
  0.74,
  19,
  0.78,
];

async function ensureStreetArrowIcon(map: MapLibreMap): Promise<void> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(STREET_ARROW_ICON));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(STREET_ARROW_SVG);
  });
  const canvas = document.createElement('canvas');
  canvas.width = STREET_ARROW_BITMAP;
  canvas.height = STREET_ARROW_BITMAP;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, STREET_ARROW_BITMAP, STREET_ARROW_BITMAP);
  ctx.drawImage(img, 0, 0, STREET_ARROW_BITMAP, STREET_ARROW_BITMAP);
  const imageData = ctx.getImageData(0, 0, STREET_ARROW_BITMAP, STREET_ARROW_BITMAP);
  const opts = { pixelRatio: STREET_ARROW_PIXEL_RATIO };

  if (map.hasImage(STREET_ARROW_ICON)) {
    try {
      map.updateImage(STREET_ARROW_ICON, imageData);
      return;
    } catch {
      try {
        map.removeImage(STREET_ARROW_ICON);
      } catch {
        /* ignore */
      }
    }
  }
  for (const legacyId of ['street-arrow-icon', 'street-arrow-long']) {
    if (map.hasImage(legacyId)) {
      try {
        map.removeImage(legacyId);
      } catch {
        /* ignore */
      }
    }
  }
  if (!map.hasImage(STREET_ARROW_ICON)) {
    map.addImage(STREET_ARROW_ICON, imageData, opts);
  }
}

function findStreetArrowInsertAfterRoads(map: MapLibreMap): string | undefined {
  return findStreetArrowInsertBeforeId(map);
}

type FeatureCollectionData = {
  type: 'FeatureCollection';
  features: Array<{ type: string; properties?: Record<string, unknown>; geometry: unknown }>;
};

function addPerifericoLayers(map: MapLibreMap, beforeId: string | undefined, data: FeatureCollectionData) {
  if (map.getSource('rm-periferico')) return;

  map.addSource('rm-periferico', {
    type: 'geojson',
    data: data as unknown as GeoJSON.FeatureCollection,
  });

  // Amarillo bajo y translúcido sobre el eje vial real
  map.addLayer(
    {
      id: 'rm-periferico-casing',
      type: 'line',
      source: 'rm-periferico',
      paint: {
        'line-color': '#f3e8b8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 5, 14, 9, 16, 13, 18, 17],
        'line-opacity': 0.14,
        'line-blur': 0.8,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    },
    beforeId
  );

  map.addLayer(
    {
      id: 'rm-periferico-line',
      type: 'line',
      source: 'rm-periferico',
      paint: {
        'line-color': '#f5e9b0',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 14, 4.5, 16, 7, 18, 10],
        'line-opacity': 0.3,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    },
    beforeId
  );

  map.addLayer(
    {
      id: 'rm-periferico-label',
      type: 'symbol',
      source: 'rm-periferico',
      minzoom: 13,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 280,
        'text-field': 'Periférico República',
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 10.5],
        'text-font': ['Open Sans Regular'],
        'text-keep-upright': true,
      },
      paint: {
        'text-color': '#9a8f5c',
        'text-halo-color': '#fffef8',
        'text-halo-width': 2,
        'text-opacity': 0.82,
      },
    },
    beforeId
  );
}

function addBuildingLayers(map: MapLibreMap, beforeId: string | undefined) {
  if (!map.getLayer('rm-buildings-footprint')) {
    map.addLayer(
      {
        id: 'rm-buildings-footprint',
        type: 'fill',
        source: 'carto',
        'source-layer': 'building',
        minzoom: 13,
        maxzoom: 15,
        paint: {
          'fill-color': '#e8e6e2',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.28, 15, 0.12],
          'fill-outline-color': '#d8d5d0',
        },
      },
      beforeId
    );
  }

  if (!map.getLayer('rm-buildings-3d')) {
    map.addLayer(
      {
        id: 'rm-buildings-3d',
        type: 'fill-extrusion',
        source: 'carto',
        'source-layer': 'building',
        minzoom: 14.5,
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'render_height'], 12],
            0,
            '#ebe9e5',
            8,
            '#e4e1dc',
            20,
            '#dbd7d1',
            40,
            '#d2cdc6',
          ],
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14.5,
            0,
            15,
            ['coalesce', ['get', 'render_height'], ['get', 'height'], 10],
          ],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.58,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      beforeId
    );
  }
}

function addRailLayers(map: MapLibreMap, beforeId: string | undefined) {
  for (const id of ['rm-rail-highlight', 'rm-rail-dash']) {
    if (map.getLayer(id)) map.removeLayer(id);
  }

  for (const id of RAIL_SECONDARY_LAYERS) {
    setPaintIfExists(map, id, 'line-color', '#d8d2cc');
    setPaintIfExists(map, id, 'line-opacity', 0.04);
  }

  // Línea principal: tono bajo, apenas perceptible
  setPaintIfExists(map, 'rail', 'line-color', '#c2b8b0');
  setPaintIfExists(map, 'rail', 'line-opacity', 0.26);

  if (map.getLayer('rm-rail-main')) map.removeLayer('rm-rail-main');
}

function streetArrowIconLayout(spacingScale: number): SymbolLayerSpecification['layout'] {
  return {
    'symbol-placement': 'line',
    'symbol-spacing': streetArrowSpacing(spacingScale),
    'icon-image': STREET_ARROW_ICON,
    'icon-size': STREET_ARROW_ICON_SIZE,
    'icon-anchor': 'center',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'icon-keep-upright': true,
    'icon-rotation-alignment': 'map',
    'icon-pitch-alignment': 'map',
    'icon-rotate': ['case', ['==', ['get', 'oneway'], -1], 180, 0] as ExpressionSpecification,
  };
}

function addStreetDirectionArrows(map: MapLibreMap, beforeId: string | undefined) {
  for (const id of [
    'rm-street-oneway-arrows',
    'rm-street-arrows-major',
    'rm-street-arrows-local',
    'rm-street-arrows',
    'rm-street-arrows-z10',
    'rm-street-arrows-z12',
    'rm-street-arrows-z14',
    'rm-street-arrows-z16',
    'rm-street-arrows-z18',
    'rm-street-arrows-z11',
    'rm-street-arrows-z13',
    ...STREET_ARROW_LAYERS.map((l) => l.id),
  ]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }

  for (const spec of STREET_ARROW_LAYERS) {
    map.addLayer(
      {
        id: spec.id,
        type: 'symbol',
        source: 'carto',
        'source-layer': 'transportation',
        minzoom: STREET_ARROW_MIN_ZOOM,
        filter: spec.filter,
        layout: streetArrowIconLayout(spec.spacingScale),
        paint: {
          'icon-opacity': STREET_ARROW_ICON_OPACITY,
        },
      },
      beforeId
    );
  }
}

/** Basemap siempre Positron claro (el tema UI oscuro no cambia el mapa). */
export async function enhanceBasemap(
  map: MapLibreMap,
  _theme: 'light' | 'dark' = 'light'
): Promise<void> {
  void _theme;

  // Comportamiento original para Light
  setPaintIfExists(map, 'background', 'background-color', MAP_BACKGROUND_TINT);

  for (const id of GREEN_LAYERS) {
    setPaintIfExists(map, id, 'fill-color', '#cfe8c8');
    setPaintIfExists(map, id, 'fill-opacity', 0.72);
  }

  setPaintIfExists(map, 'water', 'fill-color', '#b8d8e8');
  setPaintIfExists(map, 'water', 'fill-opacity', 0.92);
  setPaintIfExists(map, 'waterway', 'line-color', '#8eb8cc');
  setPaintIfExists(map, 'waterway', 'line-opacity', 0.9);

  for (const id of ROAD_FILL_LAYERS) {
    setPaintIfExists(map, id, 'line-color', ROAD_FILL_COLOR);
    setPaintIfExists(map, id, 'line-opacity', 1);
  }

  const style = map.getStyle();
  for (const layer of style?.layers ?? []) {
    if (
      (layer.id.includes('road') || layer.id.includes('bridge')) &&
      layer.id.includes('fill')
    ) {
      setPaintIfExists(map, layer.id, 'line-color', ROAD_FILL_COLOR);
    }
    if (
      (layer.id.includes('road') || layer.id.includes('bridge')) &&
      layer.id.includes('case')
    ) {
      setPaintIfExists(map, layer.id, 'line-color', ROAD_CASE_COLOR);
    }
    if (layer.type === 'symbol' && layer.id.includes('place')) {
      setLayoutIfExists(map, layer.id, 'text-size', [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        11,
        14,
        13,
        18,
        15,
      ]);
      setPaintIfExists(map, layer.id, 'text-color', '#4b5563');
    }
  }

  for (const id of ROAD_LABEL_LAYERS) {
    setLayoutIfExists(map, id, 'text-size', [
      'interpolate',
      ['linear'],
      ['zoom'],
      12,
      10,
      14,
      11,
      16,
      12,
      18,
      13,
    ]);
    setPaintIfExists(map, id, 'text-color', '#6b7280');
    setPaintIfExists(map, id, 'text-halo-color', MAP_BACKGROUND_TINT);
    setPaintIfExists(map, id, 'text-halo-width', 2.4);
    setLayoutIfExists(map, id, 'text-allow-overlap', false);
    setLayoutIfExists(map, id, 'symbol-placement', 'line');
  }

  setLayoutIfExists(map, 'waterway_label', 'text-size', 10);
  setPaintIfExists(map, 'waterway_label', 'text-color', '#5a8a9a');

  const beforeId = findInsertBeforeId(map);

  addBuildingLayers(map, beforeId);
  addRailLayers(map, beforeId);

  try {
    const res = await fetch(PERIFERICO_GEOJSON_URL);
    if (res.ok) {
      const data = (await res.json()) as FeatureCollectionData;
      addPerifericoLayers(map, beforeId, data);
    }
  } catch (e) {
    console.warn('No se pudo cargar Periférico República:', e);
  }

  await ensureStreetArrowIcon(map);
  addStreetDirectionArrows(map, findStreetArrowInsertAfterRoads(map));
  moveStreetArrowLayersAboveLocalOverlays(map);
}

/** Mantiene flechas sobre edificios 3D/periférico propios, bajo etiquetas viales */
function moveStreetArrowLayersAboveLocalOverlays(map: MapLibreMap): void {
  const beforeId = findStreetArrowInsertBeforeId(map);
  if (!beforeId) return;
  for (const spec of STREET_ARROW_LAYERS) {
    if (map.getLayer(spec.id)) {
      try {
        map.moveLayer(spec.id, beforeId);
      } catch {
        /* layer order may already be correct */
      }
    }
  }
}

export function mapPixelRatio(): number {
  return typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
}