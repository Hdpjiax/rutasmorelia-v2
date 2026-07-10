/**
 * Historial local: rutas recientes, lugares recientes, casa/trabajo.
 * Solo client-side (localStorage).
 */

export type RecentPlace = {
  id: string;
  name: string;
  description?: string;
  coordinates: [number, number];
  at: number;
};

export type RecentRoute = {
  id: string;
  name: string;
  color?: string;
  at: number;
};

export type SavedPlaceSlot = {
  name: string;
  coordinates: [number, number];
  description?: string;
} | null;

const RECENT_PLACES_KEY = 'viamorelia_recent_places';
const RECENT_ROUTES_KEY = 'viamorelia_recent_routes';
const HOME_KEY = 'viamorelia_home_place';
const WORK_KEY = 'viamorelia_work_place';
const MAX_RECENT = 8;

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

export function loadRecentPlaces(): RecentPlace[] {
  return readJson<RecentPlace[]>(RECENT_PLACES_KEY, []).slice(0, MAX_RECENT);
}

export function pushRecentPlace(place: Omit<RecentPlace, 'at'>): RecentPlace[] {
  const prev = loadRecentPlaces().filter((p) => p.id !== place.id);
  const next = [{ ...place, at: Date.now() }, ...prev].slice(0, MAX_RECENT);
  writeJson(RECENT_PLACES_KEY, next);
  return next;
}

export function loadRecentRoutes(): RecentRoute[] {
  return readJson<RecentRoute[]>(RECENT_ROUTES_KEY, []).slice(0, MAX_RECENT);
}

export function pushRecentRoute(route: Omit<RecentRoute, 'at'>): RecentRoute[] {
  const prev = loadRecentRoutes().filter((r) => r.id !== route.id);
  const next = [{ ...route, at: Date.now() }, ...prev].slice(0, MAX_RECENT);
  writeJson(RECENT_ROUTES_KEY, next);
  return next;
}

export function loadHomePlace(): SavedPlaceSlot {
  return readJson<SavedPlaceSlot>(HOME_KEY, null);
}

export function loadWorkPlace(): SavedPlaceSlot {
  return readJson<SavedPlaceSlot>(WORK_KEY, null);
}

export function saveHomePlace(place: NonNullable<SavedPlaceSlot> | null): void {
  writeJson(HOME_KEY, place);
}

export function saveWorkPlace(place: NonNullable<SavedPlaceSlot> | null): void {
  writeJson(WORK_KEY, place);
}
