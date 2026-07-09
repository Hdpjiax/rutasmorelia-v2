import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { CARTO_POSITRON_STYLE, MORELIA_CENTER, MORELIA_ZOOM } from './constants';
import { enhanceBasemap, mapPixelRatio } from './enhance-basemap';
import { addRouteLayers, ensureRouteArrowIcon } from './route-layers';

export type InitMapOptions = {
  container: HTMLElement;
  includeWalkLayers?: boolean;
  onReady?: (map: MapLibreMap) => void;
};

export function initMoreliaMap({
  container,
  includeWalkLayers = true,
  onReady,
}: InitMapOptions): MapLibreMap {
  const map = new maplibregl.Map({
    container,
    style: CARTO_POSITRON_STYLE,
    center: MORELIA_CENTER,
    zoom: MORELIA_ZOOM,
    minZoom: 10,
    maxZoom: 19,
    pixelRatio: mapPixelRatio(),
    attributionControl: false,
  });

  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  const resize = () => requestAnimationFrame(() => map.resize());
  const observer = new ResizeObserver(() => resize());
  observer.observe(container);
  window.addEventListener('resize', resize);

  map.once('load', async () => {
    try {
      await enhanceBasemap(map);
      await ensureRouteArrowIcon(map);
      addRouteLayers(map, { includeWalk: includeWalkLayers });
      onReady?.(map);
    } catch (e) {
      console.error('Error mejorando basemap:', e);
      onReady?.(map);
    }
    resize();
  });

  (map as MapLibreMap & { _rmCleanup?: () => void })._rmCleanup = () => {
    observer.disconnect();
    window.removeEventListener('resize', resize);
  };

  return map;
}

export function destroyMoreliaMap(map: MapLibreMap | null) {
  if (!map) return;
  const m = map as MapLibreMap & { _rmCleanup?: () => void };
  m._rmCleanup?.();
  map.remove();
}