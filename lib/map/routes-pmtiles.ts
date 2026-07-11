/**
 * Capa vectorial de rutas desde un único archivo PMTiles (por cuadrantes).
 *
 * ⚠️ NO es el path de producción por defecto.
 * Producción usa GeoJSON + IndexedDB (load-published-shapes / route-geojson-idb).
 *
 * tippecanoe solo se usa en tu PC/WSL para GENERAR el archivo; no se instala en Vercel.
 * Esta capa solo se activa si defines NEXT_PUBLIC_ROUTES_PMTILES_URL (opt-in).
 *
 * Generar en local (opcional): bash scripts/build_routes_pmtiles.sh
 */

import type { Map as MapLibreMap } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';

const SOURCE_ID = 'vm-routes-pmtiles';
const LAYER_CASING = 'vm-routes-pmtiles-casing';
const LAYER_LINE = 'vm-routes-pmtiles-line';

let protocolRegistered = false;

export function getRoutesPmtilesUrl(): string | null {
  const v =
    process.env.NEXT_PUBLIC_ROUTES_PMTILES_URL?.trim() ||
    process.env.NEXT_PUBLIC_PMTILES_URL?.trim();
  if (!v) return null;
  // Acepta /tiles/routes.pmtiles o https://… o pmtiles://…
  if (v.startsWith('pmtiles://')) return v;
  if (v.startsWith('http://') || v.startsWith('https://')) return `pmtiles://${v}`;
  // path relativo
  if (typeof window !== 'undefined') {
    const abs = new URL(v.startsWith('/') ? v : `/${v}`, window.location.origin).href;
    return `pmtiles://${abs}`;
  }
  return `pmtiles://${v}`;
}

/**
 * Registra el protocolo pmtiles:// una sola vez (cliente).
 */
export async function ensurePmtilesProtocol(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (protocolRegistered) return true;
  try {
    const { Protocol } = await import('pmtiles');
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    protocolRegistered = true;
    return true;
  } catch (e) {
    console.warn('[ViaMorelia] No se pudo registrar protocol PMTiles', e);
    return false;
  }
}

/**
 * Añade capa vectorial de corredores (minzoom 10). No reemplaza la selección puntual
 * en ROUTES_SOURCE_ID (GeoJSON de la ruta activa), solo el contexto de red.
 */
export async function addRoutesPmtilesLayer(map: MapLibreMap): Promise<boolean> {
  const url = getRoutesPmtilesUrl();
  if (!url) return false;
  const ok = await ensurePmtilesProtocol();
  if (!ok) return false;

  try {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'vector',
        url,
        minzoom: 10,
        maxzoom: 16,
      } as maplibregl.VectorSourceSpecification);
    }

    if (!map.getLayer(LAYER_CASING)) {
      map.addLayer({
        id: LAYER_CASING,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'routes',
        minzoom: 11,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1a1a1a',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.2, 15, 4.5],
          'line-opacity': 0.55,
        },
      });
    }

    if (!map.getLayer(LAYER_LINE)) {
      map.addLayer({
        id: LAYER_LINE,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'routes',
        minzoom: 11,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 15, 2.8],
          'line-opacity': 0.75,
        },
      });
    }

    // Mantener capas de selección/plan por encima
    const topIds = ['route-lines-casing', 'route-lines', 'route-arrows', 'route-text-labels'];
    for (const id of topIds) {
      if (map.getLayer(id) && map.getLayer(LAYER_LINE)) {
        try {
          map.moveLayer(LAYER_CASING, id);
          map.moveLayer(LAYER_LINE, id);
        } catch {
          /* order best-effort */
        }
      }
    }

    console.info('[ViaMorelia] Capa PMTiles de rutas activa (tiles por viewport)');
    return true;
  } catch (e) {
    console.warn('[ViaMorelia] PMTiles rutas no disponible', e);
    return false;
  }
}
