/// <reference lib="webworker" />
/**
 * Web Worker: fuzzy search de rutas (Fuse + Levenshtein) fuera del hilo UI.
 */

import { fuzzySearchRoutes } from './fuzzy';
import type { Route } from '../supabase/client';

type InMsg = {
  id: number;
  kind: 'routes';
  query: string;
  routes: Route[];
};

type OutMsg =
  | { id: number; ok: true; routeIds: string[] }
  | { id: number; ok: false; error: string };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  try {
    if (msg.kind === 'routes') {
      const hits = fuzzySearchRoutes(msg.routes, msg.query);
      const out: OutMsg = { id: msg.id, ok: true, routeIds: hits.map((r) => r.id) };
      ctx.postMessage(out);
      return;
    }
    ctx.postMessage({ id: msg.id, ok: false, error: 'unknown_kind' } satisfies OutMsg);
  } catch (e) {
    ctx.postMessage({
      id: msg.id,
      ok: false,
      error: e instanceof Error ? e.message : 'search_failed',
    } satisfies OutMsg);
  }
};
