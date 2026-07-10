/** Carto Positron — basemap gris claro (siempre; el tema UI oscuro no cambia el mapa) */
export const CARTO_POSITRON_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export type MapBasemapTheme = 'light' | 'dark';

export function basemapStyleUrl(_theme?: MapBasemapTheme): string {
  return CARTO_POSITRON_STYLE;
}

export const MORELIA_CENTER: [number, number] = [-101.194, 19.702];
export const MORELIA_ZOOM = 13.3;

/** Circuito Periférico Paseo de la República — segmentos OSM reales */
export const PERIFERICO_GEOJSON_URL = '/data/periferico-republica.geojson';
