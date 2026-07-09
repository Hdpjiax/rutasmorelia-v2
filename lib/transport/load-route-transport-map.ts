import fs from 'fs/promises';
import path from 'path';
import { normalizeTransportType, toStoredTransportType } from './classify';

/**
 * Mapa route_id → transportType canónico (combi | foraneo)
 * Fuentes: rutastransporte-route-map.json + public/routes/index.json
 */
export async function loadRouteTransportMap(): Promise<Map<string, 'combi' | 'foraneo'>> {
  const map = new Map<string, 'combi' | 'foraneo'>();
  const root = process.cwd();

  // 1) Mapa de ingesta (fuente de verdad del pipeline)
  try {
    const raw = await fs.readFile(
      path.join(root, 'data', 'rutastransporte-route-map.json'),
      'utf-8'
    );
    const arr = JSON.parse(raw) as Array<{
      routeId?: string;
      routeName?: string;
      transportType?: string;
    }>;
    for (const row of arr) {
      if (!row.routeId) continue;
      const kind = normalizeTransportType(row.transportType, row.routeId, row.routeName);
      map.set(row.routeId, toStoredTransportType(kind));
    }
  } catch {
    // opcional
  }

  // 2) index público (rellena huecos)
  try {
    const raw = await fs.readFile(path.join(root, 'public', 'routes', 'index.json'), 'utf-8');
    const data = JSON.parse(raw) as {
      routes?: Array<{ id?: string; name?: string; transportType?: string }>;
    };
    for (const r of data.routes ?? []) {
      if (!r.id || map.has(r.id)) continue;
      const kind = normalizeTransportType(r.transportType, r.id, r.name);
      map.set(r.id, toStoredTransportType(kind));
    }
  } catch {
    // opcional
  }

  return map;
}
