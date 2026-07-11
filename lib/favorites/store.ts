/**
 * Favoritos solo en este dispositivo (localStorage).
 * Sin cuentas / sin Supabase en la app pública.
 */

export type FavoriteLocation = {
  id: string;
  name: string;
  description?: string;
  coordinates: [number, number]; // lng, lat
  created_at: string;
};

const ROUTES_KEY = 'viamorelia_favorite_routes';
const LOCS_KEY = 'viamorelia_favorite_locations';

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

export function loadLocalFavoriteRoutes(): string[] {
  return readJson<string[]>(ROUTES_KEY, []);
}

export function loadLocalFavoriteLocations(): FavoriteLocation[] {
  return readJson<FavoriteLocation[]>(LOCS_KEY, []);
}

/** Compat: ya no sincroniza remoto; solo local. */
export async function loadFavoriteRoutes(_userId?: string | null): Promise<string[]> {
  void _userId;
  return loadLocalFavoriteRoutes();
}

export async function loadFavoriteLocations(
  _userId?: string | null
): Promise<FavoriteLocation[]> {
  void _userId;
  return loadLocalFavoriteLocations();
}

export async function toggleFavoriteRoute(
  routeId: string,
  current: string[],
  _userId?: string | null
): Promise<string[]> {
  void _userId;
  const isFav = current.includes(routeId);
  const next = isFav ? current.filter((id) => id !== routeId) : [...current, routeId];
  writeJson(ROUTES_KEY, next);
  return next;
}

export async function addFavoriteLocation(
  loc: Omit<FavoriteLocation, 'id' | 'created_at'>,
  current: FavoriteLocation[],
  _userId?: string | null
): Promise<FavoriteLocation[]> {
  void _userId;
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `loc-${Date.now()}`;
  const entry: FavoriteLocation = {
    id,
    name: loc.name,
    description: loc.description,
    coordinates: loc.coordinates,
    created_at: new Date().toISOString(),
  };

  const key = (l: FavoriteLocation) =>
    `${l.name.toLowerCase()}|${l.coordinates[0].toFixed(5)},${l.coordinates[1].toFixed(5)}`;
  if (current.some((c) => key(c) === key(entry))) return current;

  const next = [entry, ...current];
  writeJson(LOCS_KEY, next);
  return next;
}

export async function removeFavoriteLocation(
  id: string,
  current: FavoriteLocation[],
  _userId?: string | null
): Promise<FavoriteLocation[]> {
  void _userId;
  const next = current.filter((l) => l.id !== id);
  writeJson(LOCS_KEY, next);
  return next;
}

export function isFavoriteLocation(
  locs: FavoriteLocation[],
  name: string,
  coordinates: [number, number]
): boolean {
  return locs.some(
    (l) =>
      l.name.toLowerCase() === name.toLowerCase() &&
      Math.abs(l.coordinates[0] - coordinates[0]) < 1e-4 &&
      Math.abs(l.coordinates[1] - coordinates[1]) < 1e-4
  );
}

/** Prioriza favoritos en sugerencias de búsqueda */
export function prioritizeFavoriteLocations(
  hits: Array<{
    id: string;
    name: string;
    description?: string;
    category?: string;
    coordinates: [number, number];
    source?: string;
  }>,
  favorites: FavoriteLocation[],
  query: string
): Array<{
  id: string;
  name: string;
  description?: string;
  category: string;
  coordinates: [number, number];
  source: 'catalog' | 'geocode' | 'gps' | 'favorite';
  isFavorite?: boolean;
}> {
  const q = query.trim().toLowerCase();
  const favHits = favorites
    .filter((f) => {
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q)
      );
    })
    .map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description || 'Favorito',
      category: 'favorite',
      coordinates: f.coordinates,
      source: 'favorite' as const,
      isFavorite: true as const,
    }));

  const rest = hits.map((h) => ({
    id: h.id,
    name: h.name,
    description: h.description,
    category: h.category || 'place',
    coordinates: h.coordinates,
    source: (h.source as 'catalog' | 'geocode' | 'gps' | 'favorite') || 'catalog',
    isFavorite: favorites.some(
      (f) =>
        Math.abs(f.coordinates[0] - h.coordinates[0]) < 1e-4 &&
        Math.abs(f.coordinates[1] - h.coordinates[1]) < 1e-4
    ),
  }));

  const seen = new Set<string>();
  const out: typeof rest = [];
  for (const item of [...favHits, ...rest]) {
    const k = `${item.coordinates[0].toFixed(5)},${item.coordinates[1].toFixed(5)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
