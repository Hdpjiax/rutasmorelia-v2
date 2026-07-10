/**
 * Caché offline mínima: última búsqueda, favoritos ya viven en favorites store.
 */

export type LastTripSearch = {
  originLabel: string;
  destinationLabel: string;
  origin: [number, number] | null;
  destination: [number, number] | null;
  at: number;
};

const LAST_TRIP_KEY = 'vm_last_trip_search';
const CACHED_ROUTE_META_KEY = 'vm_cached_route_meta';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function saveLastTripSearch(trip: Omit<LastTripSearch, 'at'>): void {
  writeJson(LAST_TRIP_KEY, { ...trip, at: Date.now() });
}

export function loadLastTripSearch(): LastTripSearch | null {
  return readJson<LastTripSearch | null>(LAST_TRIP_KEY, null);
}

export type CachedRouteMeta = {
  id: string;
  name: string;
  color: string;
  transportType?: string;
};

export function cacheRouteMetaList(routes: CachedRouteMeta[]): void {
  writeJson(CACHED_ROUTE_META_KEY, { at: Date.now(), routes: routes.slice(0, 200) });
}

export function loadCachedRouteMetaList(): CachedRouteMeta[] {
  const data = readJson<{ routes?: CachedRouteMeta[] } | null>(CACHED_ROUTE_META_KEY, null);
  return data?.routes ?? [];
}
