import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapBasemapTheme } from './constants';

export type SetBasemapThemeOptions = {
  theme: MapBasemapTheme;
  includeWalkLayers?: boolean;
  onRestored?: (map: MapLibreMap) => void;
};

/**
 * Compat: el basemap no cambia con el tema UI (siempre Positron claro).
 */
export async function setBasemapTheme(
  map: MapLibreMap,
  options: SetBasemapThemeOptions
): Promise<void> {
  void map;
  void options.theme;
  options.onRestored?.(map);
}
