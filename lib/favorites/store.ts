/**
 * Favoritos de rutas y ubicaciones.
 * - LocalStorage siempre (offline / sin login)
 * - Supabase real si hay sesión y env configurado
 * - mockSupabaseClient como fallback de sesión mock
 */

import { mockSupabaseClient } from '@/lib/supabase/client';
import { getBrowserSupabase } from '@/lib/auth/browser-client';

function db() {
  return getBrowserSupabase() ?? mockSupabaseClient;
}

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
  localStorage.setItem(key, JSON.stringify(value));
}

function useReal(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true' &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function loadLocalFavoriteRoutes(): string[] {
  return readJson<string[]>(ROUTES_KEY, []);
}

export function loadLocalFavoriteLocations(): FavoriteLocation[] {
  return readJson<FavoriteLocation[]>(LOCS_KEY, []);
}

export async function loadFavoriteRoutes(userId?: string | null): Promise<string[]> {
  const local = loadLocalFavoriteRoutes();
  if (!userId) return local;

  try {
    const { data, error } = await db()
      .from('favorite_routes')
      .select('*')
      .eq('user_id', userId);
    if (error || !data) return local;
    const remote = (data as { route_id: string }[]).map((r) => r.route_id);
    const merged = Array.from(new Set([...remote, ...local]));
    writeJson(ROUTES_KEY, merged);
    return merged;
  } catch {
    return local;
  }
}

export async function loadFavoriteLocations(
  userId?: string | null
): Promise<FavoriteLocation[]> {
  const local = loadLocalFavoriteLocations();
  if (!userId) return local;

  try {
    // Tabla real o mock: favorite_locations
    const client = db() as any;
    if (typeof client.from !== 'function') return local;

    const { data, error } = await client
      .from('favorite_locations')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return local;

    const remote: FavoriteLocation[] = (data as any[]).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      coordinates: [Number(row.lng), Number(row.lat)] as [number, number],
      created_at: String(row.created_at || new Date().toISOString()),
    }));

    // Merge por nombre+coords
    const key = (l: FavoriteLocation) =>
      `${l.name.toLowerCase()}|${l.coordinates[0].toFixed(5)},${l.coordinates[1].toFixed(5)}`;
    const map = new Map<string, FavoriteLocation>();
    for (const l of [...remote, ...local]) map.set(key(l), l);
    const merged = Array.from(map.values());
    writeJson(LOCS_KEY, merged);
    return merged;
  } catch {
    return local;
  }
}

export async function toggleFavoriteRoute(
  routeId: string,
  current: string[],
  userId?: string | null
): Promise<string[]> {
  const isFav = current.includes(routeId);
  let next: string[];
  if (isFav) {
    next = current.filter((id) => id !== routeId);
    if (userId) {
      await db()
        .from('favorite_routes')
        .delete()
        .eq('user_id', userId)
        .eq('route_id', routeId);
    }
  } else {
    next = [...current, routeId];
    if (userId) {
      await db().from('favorite_routes').insert({
        user_id: userId,
        route_id: routeId,
      });
    }
  }
  writeJson(ROUTES_KEY, next);
  return next;
}

export async function addFavoriteLocation(
  loc: Omit<FavoriteLocation, 'id' | 'created_at'>,
  current: FavoriteLocation[],
  userId?: string | null
): Promise<FavoriteLocation[]> {
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

  if (userId) {
    try {
      const client = db() as any;
      await client.from('favorite_locations').insert({
        id: entry.id,
        user_id: userId,
        name: entry.name,
        description: entry.description ?? null,
        lng: entry.coordinates[0],
        lat: entry.coordinates[1],
        created_at: entry.created_at,
      });
    } catch {
      /* local only */
    }
  }
  return next;
}

export async function removeFavoriteLocation(
  id: string,
  current: FavoriteLocation[],
  userId?: string | null
): Promise<FavoriteLocation[]> {
  const next = current.filter((l) => l.id !== id);
  writeJson(LOCS_KEY, next);
  if (userId) {
    try {
      const client = db() as any;
      await client.from('favorite_locations').delete().eq('id', id).eq('user_id', userId);
    } catch {
      /* ignore */
    }
  }
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
      isFavorite: true,
    }));

  const favKeys = new Set(
    favHits.map(
      (f) =>
        `${f.name.toLowerCase()}|${f.coordinates[0].toFixed(4)},${f.coordinates[1].toFixed(4)}`
    )
  );

  const rest = hits
    .filter((h) => {
      const k = `${h.name.toLowerCase()}|${h.coordinates[0].toFixed(4)},${h.coordinates[1].toFixed(4)}`;
      return !favKeys.has(k);
    })
    .map((h) => ({
      id: h.id,
      name: h.name,
      description: h.description,
      category: h.category || 'place',
      coordinates: h.coordinates,
      source: (h.source as 'catalog' | 'geocode' | 'gps') || 'catalog',
      isFavorite: false,
    }));

  return [...favHits, ...rest];
}

export { useReal as favoritesUseRealSupabase };
