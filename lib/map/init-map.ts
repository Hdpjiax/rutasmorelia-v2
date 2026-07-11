import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  basemapStyleUrl,
  getOptionalPmtilesUrl,
  MORELIA_CENTER,
  MORELIA_ZOOM,
  type MapBasemapTheme,
} from './constants';
import { enhanceBasemap, mapPixelRatio } from './enhance-basemap';
import { addRouteLayers, ensureRouteArrowIcon } from './route-layers';

export type InitMapOptions = {
  container: HTMLElement;
  includeWalkLayers?: boolean;
  /** Ignorado: el mapa siempre usa Positron claro */
  basemapTheme?: MapBasemapTheme;
  onReady?: (map: MapLibreMap) => void;
};

export function initMoreliaMap({
  container,
  includeWalkLayers = true,
  basemapTheme: _basemapTheme = 'light',
  onReady,
}: InitMapOptions): MapLibreMap {
  void _basemapTheme;
  const pmtiles = getOptionalPmtilesUrl();
  if (pmtiles && typeof console !== 'undefined') {
    // PMTiles opcional: requiere protocol registrado (maplibre-gl-pmtiles) en deploys avanzados.
    // Mientras no esté el protocol, se usa Carto Positron y se deja el hint en consola.
    console.info(
      '[ViaMorelia] NEXT_PUBLIC_PMTILES_URL definido; basemap sigue en Positron hasta registrar protocol PMTiles.',
      pmtiles
    );
  }
  const map = new maplibregl.Map({
    container,
    style: basemapStyleUrl(),
    center: MORELIA_CENTER,
    zoom: MORELIA_ZOOM,
    minZoom: 10,
    maxZoom: 19,
    pixelRatio: mapPixelRatio(),
    attributionControl: false,
  });

  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

  const resize = () => requestAnimationFrame(() => map.resize());
  const observer = new ResizeObserver(() => resize());
  observer.observe(container);
  window.addEventListener('resize', resize);

  map.once('load', async () => {
    try {
      await enhanceBasemap(map, 'light');
      await ensureRouteArrowIcon(map);
      addRouteLayers(map, { includeWalk: includeWalkLayers });
      // Producción: GeoJSON bajo demanda + IndexedDB.
      // PMTiles es opcional y SOLO se carga si defines NEXT_PUBLIC_ROUTES_PMTILES_URL
      // (tippecanoe NUNCA va a Vercel; solo genera el archivo en tu PC/WSL si quieres).
      if (process.env.NEXT_PUBLIC_ROUTES_PMTILES_URL?.trim()) {
        try {
          const { addRoutesPmtilesLayer } = await import('./routes-pmtiles');
          await addRoutesPmtilesLayer(map);
        } catch {
          /* no bloquear el mapa si falla el tile set opcional */
        }
      }
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
