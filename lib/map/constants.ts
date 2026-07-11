/** Carto Positron — basemap gris claro (siempre; el tema UI oscuro no cambia el mapa) */
export const CARTO_POSITRON_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export type MapBasemapTheme = 'light' | 'dark';

/**
 * PMTiles basemap opcional (no confundir con rutas).
 * Producción normal: Carto Positron + GeoJSON bajo demanda + IndexedDB.
 * NEXT_PUBLIC_PMTILES_URL / NEXT_PUBLIC_ROUTES_PMTILES_URL son opt-in local/avanzado.
 * tippecanoe nunca corre en Vercel.
 */
export function getOptionalPmtilesUrl(): string | null {
  const v = process.env.NEXT_PUBLIC_PMTILES_URL?.trim();
  return v || null;
}

export function basemapStyleUrl(): string {
  // PMTiles se inyecta en init-map si está configurado; el style base sigue Positron
  return CARTO_POSITRON_STYLE;
}

export const MORELIA_CENTER: [number, number] = [-101.194, 19.702];
export const MORELIA_ZOOM = 13.3;

/** Circuito Periférico Paseo de la República — segmentos OSM reales */
export const PERIFERICO_GEOJSON_URL = '/data/periferico-republica.geojson';
