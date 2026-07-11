/**
 * Pide al Service Worker precachear GeoJSON de rutas frecuentes
 * (favoritos + primeras del catálogo) para uso offline.
 */

export function requestServiceWorkerPrecache(routeIds: string[]): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const urls = routeIds
    .filter(Boolean)
    .slice(0, 36)
    .map((id) => `/routes/${id}.geojson`);
  if (!urls.length) return;

  void navigator.serviceWorker.ready
    .then((reg) => {
      reg.active?.postMessage({ type: 'PRECACHE_ROUTES', urls });
    })
    .catch(() => undefined);
}

/** Tras cargar el catálogo online: precache favoritos + muestra del listado. */
export function scheduleCatalogPrecache(opts: {
  allRouteIds: string[];
  favoriteIds?: string[];
  recentIds?: string[];
}): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const fav = opts.favoriteIds ?? [];
  const recent = opts.recentIds ?? [];
  const rest = opts.allRouteIds.filter((id) => !fav.includes(id) && !recent.includes(id));
  const ordered = [...new Set([...fav, ...recent, ...rest])].slice(0, 36);

  // Diferir para no competir con el primer paint / plan de viaje
  const run = () => requestServiceWorkerPrecache(ordered);
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (
      window as Window & {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
      }
    ).requestIdleCallback(run, { timeout: 8000 });
  } else {
    setTimeout(run, 2500);
  }
}
