import type { Coordinate } from './planner';

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
};

let cache: { shapes: PublishedShape[]; routes: PublishedRouteMeta[]; at: number } | null =
  null;
const CACHE_MS = 5 * 60 * 1000;

/**
 * Carga geometrías publicadas desde /public/routes (index + geojson).
 * Todas las entradas del índice se listan al usuario; las shapes se usan en el planner.
 */
export async function loadPublishedShapes(force = false): Promise<{
  shapes: PublishedShape[];
  routes: PublishedRouteMeta[];
}> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return { shapes: cache.shapes, routes: cache.routes };
  }

  const indexRes = await fetch(`/routes/index.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!indexRes.ok) {
    return { shapes: cache?.shapes ?? [], routes: cache?.routes ?? [] };
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
    })
  );

  const shapes: PublishedShape[] = [];
  const geojsonPath = (id: string, file?: string) => {
    if (file && file.startsWith('/')) return `${file}?t=${Date.now()}`;
    if (file) return `/${file.replace(/^\//, '')}?t=${Date.now()}`;
    return `/routes/${id}.geojson?t=${Date.now()}`;
  };

  // Cargar en paralelo con límite (no-store: siempre la versión publicada actual)
  const batchSize = 10;
  const indexEntries: Array<{
    id: string;
    name: string;
    color?: string;
    transportType?: string;
    geojsonFile?: string;
  }> = index.routes ?? [];

  for (let i = 0; i < indexEntries.length; i += batchSize) {
    const batch = indexEntries.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (entry) => {
        try {
          const res = await fetch(geojsonPath(entry.id, entry.geojsonFile), {
            cache: 'no-store',
          });
          if (!res.ok) return;
          const gj = await res.json();
          for (const f of gj.features ?? []) {
            const dirRaw = String(
              f.properties?.direction ?? f.properties?.name ?? ''
            ).toLowerCase();
            const dir =
              dirRaw === 'ida' || dirRaw === 'vuelta'
                ? dirRaw
                : dirRaw.includes('ida')
                  ? 'ida'
                  : dirRaw.includes('vuelta')
                    ? 'vuelta'
                    : '';
            if (dir !== 'ida' && dir !== 'vuelta') continue;
            const coords = f.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) continue;
            // Solo LineString de recorrido (no sense-label)
            if (f.geometry?.type && f.geometry.type !== 'LineString') continue;
            if (f.properties?.type === 'sense-label' || f.properties?.type === 'walk') {
              continue;
            }
            shapes.push({
              id: `${entry.id}-${dir}`,
              route_id: entry.id,
              route_name: String(f.properties?.routeName || entry.name),
              color: String(f.properties?.color || entry.color || '#3b82f6'),
              direction: dir as 'ida' | 'vuelta',
              coordinates: coords.map((c: number[]) => [c[0], c[1]] as Coordinate),
              qa_status: 'approved',
            });
          }
        } catch {
          /* skip route */
        }
      })
    );
  }

  cache = { shapes, routes, at: Date.now() };
  return { shapes, routes };
}

/** Invalida caché (p. ej. tras limpiar mapa o refrescar). */
export function clearPublishedShapesCache() {
  cache = null;
}
