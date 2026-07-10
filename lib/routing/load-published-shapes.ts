import type { Coordinate } from './planner';
import { bboxFromOriginDest, filterShapesByBBox, type BBox } from './bbox';

export type PublishedShape = {
  id: string;
  route_id: string;
  route_name: string;
  color: string;
  direction: 'ida' | 'vuelta';
  coordinates: Coordinate[];
  qa_status: 'approved';
};

export type PublishedRouteMeta = {
  id: string;
  name: string;
  color: string;
  transportType?: string;
  geojsonFile?: string;
};

type CacheState = {
  routes: PublishedRouteMeta[];
  shapes: Map<string, PublishedShape[]>; // route_id -> shapes
  allShapes: PublishedShape[] | null;
  routesAt: number;
};

let cache: CacheState | null = null;
const ROUTES_CACHE_MS = 10 * 60 * 1000;
const SHAPE_CACHE_MS = 30 * 60 * 1000;

function geojsonUrl(id: string, file?: string) {
  // Sin query de busting: permite caché HTTP (CDN/browser)
  if (file?.startsWith('/')) return file;
  if (file) return `/${file.replace(/^\//, '')}`;
  return `/routes/${id}.geojson`;
}

function parseShapesFromGeojson(
  entry: PublishedRouteMeta,
  gj: {
    features?: Array<{
      properties?: Record<string, unknown> | null;
      geometry?: { type?: string; coordinates?: number[][] };
    }>;
  }
): PublishedShape[] {
  const out: PublishedShape[] = [];
  for (const f of gj.features ?? []) {
    const dirRaw = String(f.properties?.direction ?? f.properties?.name ?? '').toLowerCase();
    const dir =
      dirRaw === 'ida' || dirRaw === 'vuelta'
        ? dirRaw
        : dirRaw.includes('ida')
          ? 'ida'
          : dirRaw.includes('vuelta')
            ? 'vuelta'
            : '';
    if (dir !== 'ida' && dir !== 'vuelta') continue;
    if (f.geometry?.type && f.geometry.type !== 'LineString') continue;
    if (f.properties?.type === 'sense-label' || f.properties?.type === 'walk') continue;
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    out.push({
      id: `${entry.id}-${dir}`,
      route_id: entry.id,
      route_name: String(f.properties?.routeName || entry.name),
      color: String(f.properties?.color || entry.color || '#3b82f6'),
      direction: dir as 'ida' | 'vuelta',
      coordinates: coords.map((c) => [Number(c[0]), Number(c[1])] as Coordinate),
      qa_status: 'approved',
    });
  }
  return out;
}

/** Solo índice — listado rápido de rutas (sin bajar geometrías). */
export async function loadPublishedRoutes(force = false): Promise<PublishedRouteMeta[]> {
  if (
    !force &&
    cache?.routes?.length &&
    Date.now() - cache.routesAt < ROUTES_CACHE_MS
  ) {
    return cache.routes;
  }

  const indexRes = await fetch('/routes/index.json', {
    // revalidate-friendly: next/browser pueden cachear
    next: { revalidate: 300 },
  } as RequestInit);

  if (!indexRes.ok) {
    return cache?.routes ?? [];
  }

  const index = await indexRes.json();
  const routes: PublishedRouteMeta[] = (index.routes ?? []).map(
    (r: {
      id: string;
      name: string;
      color?: string;
      transportType?: string;
      geojsonFile?: string;
    }) => ({
      id: r.id,
      name: r.name,
      color: r.color || '#3b82f6',
      transportType: r.transportType,
      geojsonFile: r.geojsonFile,
    })
  );

  cache = {
    routes,
    shapes: cache?.shapes ?? new Map(),
    allShapes: null,
    routesAt: Date.now(),
  };
  return routes;
}

/** Carga geometría de una o varias rutas (bajo demanda). */
export async function loadShapesForRouteIds(
  routeIds: string[]
): Promise<PublishedShape[]> {
  await loadPublishedRoutes();
  if (!cache) return [];

  const missing = routeIds.filter((id) => !cache!.shapes.has(id));
  const batchSize = 8;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (id) => {
        const meta = cache!.routes.find((r) => r.id === id);
        if (!meta) {
          cache!.shapes.set(id, []);
          return;
        }
        try {
          const res = await fetch(geojsonUrl(id, meta.geojsonFile), {
            next: { revalidate: 1800 },
          } as RequestInit);
          if (!res.ok) {
            cache!.shapes.set(id, []);
            return;
          }
          const gj = await res.json();
          cache!.shapes.set(id, parseShapesFromGeojson(meta, gj));
        } catch {
          cache!.shapes.set(id, []);
        }
      })
    );
  }

  const out: PublishedShape[] = [];
  for (const id of routeIds) {
    out.push(...(cache.shapes.get(id) ?? []));
  }
  return out;
}

/**
 * Carga todas las shapes (planificador). Usa caché por ruta; una sola pasada en background.
 */
export async function loadPublishedShapes(force = false): Promise<{
  shapes: PublishedShape[];
  routes: PublishedRouteMeta[];
}> {
  const routes = await loadPublishedRoutes(force);
  if (
    !force &&
    cache?.allShapes &&
    Date.now() - cache.routesAt < SHAPE_CACHE_MS
  ) {
    return { shapes: cache.allShapes, routes };
  }

  const shapes = await loadShapesForRouteIds(routes.map((r) => r.id));
  if (cache) {
    cache.allShapes = shapes;
  }
  return { shapes, routes };
}

/**
 * Carga shapes relevantes al viaje (bbox OD).
 * Si ya hay allShapes en caché, filtra sin re-fetch.
 * Si no, carga por lotes todas y filtra (prefetch puede completar en paralelo).
 */
export async function loadShapesNearTrip(
  origin: Coordinate,
  destination: Coordinate,
  padKm = 2.4
): Promise<{
  shapes: PublishedShape[];
  routes: PublishedRouteMeta[];
  bbox: BBox;
  usedBBoxFilter: boolean;
}> {
  const bbox = bboxFromOriginDest(origin, destination, padKm);
  const routes = await loadPublishedRoutes();

  // Preferir caché completa si existe
  if (cache?.allShapes?.length) {
    const near = filterShapesByBBox(cache.allShapes, bbox);
    // Si el filtro deja muy pocas (OD en borde), ampliar
    if (near.length >= 4) {
      return { shapes: near, routes, bbox, usedBBoxFilter: true };
    }
    const wider = bboxFromOriginDest(origin, destination, padKm + 3);
    const near2 = filterShapesByBBox(cache.allShapes, wider);
    return {
      shapes: near2.length ? near2 : cache.allShapes,
      routes,
      bbox: wider,
      usedBBoxFilter: near2.length > 0,
    };
  }

  // Cargar todo (o lo que falte) y filtrar — el prefetch en idle reduce esto
  const { shapes: all } = await loadPublishedShapes(false);
  const near = filterShapesByBBox(all, bbox);
  if (near.length >= 4) {
    return { shapes: near, routes, bbox, usedBBoxFilter: true };
  }
  const wider = bboxFromOriginDest(origin, destination, padKm + 3);
  const near2 = filterShapesByBBox(all, wider);
  return {
    shapes: near2.length >= 2 ? near2 : all,
    routes,
    bbox: wider,
    usedBBoxFilter: near2.length >= 2,
  };
}

/**
 * Prefetch en idle — conservador en móvil / save-data.
 * Metadatos ya están; no descarga TODAS las geometrías de golpe en redes limitadas.
 */
export function prefetchAllShapesInBackground() {
  if (typeof window === 'undefined') return;
  // No saturar datos móviles: solo si el usuario no pidió ahorro de datos
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (conn?.saveData) return;
  if (conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') return;

  const run = () => {
    // En móvil, el prefetch total es agresivo: se omite salvo desktop amplio
    const isNarrow = window.matchMedia('(max-width: 767px)').matches;
    if (isNarrow) return;
    void loadPublishedShapes(false).catch(() => undefined);
  };
  if ('requestIdleCallback' in window) {
    (window as Window & {
      requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
    }).requestIdleCallback(run, { timeout: 12000 });
  } else {
    setTimeout(run, 5000);
  }
}

/**
 * Prefetch inteligente: primero shapes cerca del usuario / OD,
 * luego el resto en idle. Reduce tiempo al primer plan.
 */
export function prefetchShapesNearCoordinate(
  center: Coordinate,
  radiusKm = 3.5
) {
  if (typeof window === 'undefined') return;
  const dest: Coordinate = [center[0] + 0.01, center[1] + 0.01];
  // Carga progresiva: primero geometrías cerca del viewport/usuario; el resto solo en desktop
  const runNear = () => {
    void loadShapesNearTrip(center, dest, radiusKm).catch(() => undefined);
  };
  const runRest = () => {
    const isNarrow = window.matchMedia('(max-width: 767px)').matches;
    if (isNarrow) return;
    void loadPublishedShapes(false).catch(() => undefined);
  };
  if ('requestIdleCallback' in window) {
    const w = window as Window & {
      requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
    };
    w.requestIdleCallback(runNear, { timeout: 1200 });
    w.requestIdleCallback(runRest, { timeout: 10000 });
  } else {
    setTimeout(runNear, 400);
    setTimeout(runRest, 4500);
  }
}

/** Top rutas por id frecuente en localStorage (favoritos + recientes). */
export function prefetchFrequentRoutes(routeIds: string[]) {
  if (!routeIds.length || typeof window === 'undefined') return;
  const unique = Array.from(new Set(routeIds)).slice(0, 12);
  const run = () => {
    void loadShapesForRouteIds(unique).catch(() => undefined);
  };
  if ('requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(
      run
    );
  } else {
    setTimeout(run, 1500);
  }
}

export function clearPublishedShapesCache() {
  cache = null;
}
