/**
 * Cliente de búsqueda fuzzy en Web Worker (fallback al hilo principal).
 */

import type { Route } from '@/lib/supabase/client';
import { fuzzySearchRoutes } from './fuzzy';

type OutMsg =
  | { id: number; ok: true; routeIds: string[] }
  | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (ids: string[]) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<OutMsg>) => {
      const data = ev.data;
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      if (data.ok) p.resolve(data.routeIds);
      else p.reject(new Error(data.error));
    };
    worker.onerror = () => {
      try {
        worker?.terminate();
      } catch {
        /* ignore */
      }
      worker = null;
    };
    return worker;
  } catch {
    worker = null;
    return null;
  }
}

/**
 * Busca rutas sin bloquear el hilo principal (Worker).
 * Devuelve las mismas Route[] de entrada, reordenadas/filtradas.
 */
export async function fuzzySearchRoutesAsync(
  routes: Route[],
  query: string
): Promise<Route[]> {
  const q = query.trim();
  if (!q) return routes;
  if (routes.length === 0) return [];

  const w = getWorker();
  if (!w) return fuzzySearchRoutes(routes, q);

  const id = ++seq;
  return new Promise((resolve) => {
    const t = window.setTimeout(() => {
      pending.delete(id);
      resolve(fuzzySearchRoutes(routes, q));
    }, 400);

    pending.set(id, {
      resolve: (ids) => {
        window.clearTimeout(t);
        const map = new Map(routes.map((r) => [r.id, r]));
        resolve(ids.map((i) => map.get(i)).filter(Boolean) as Route[]);
      },
      reject: () => {
        window.clearTimeout(t);
        resolve(fuzzySearchRoutes(routes, q));
      },
    });

    try {
      w.postMessage({ id, kind: 'routes', query: q, routes });
    } catch {
      window.clearTimeout(t);
      pending.delete(id);
      resolve(fuzzySearchRoutes(routes, q));
    }
  });
}
