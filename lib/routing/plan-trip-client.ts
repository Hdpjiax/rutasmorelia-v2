/**
 * Cliente del planificador: Web Worker cuando es posible, fallback al hilo principal.
 * Soporta cancelación por requestId (ignora respuestas obsoletas).
 */

import type { Coordinate, PlannerPreferences, TripPlan } from './planner';
import type { PublishedShape } from './load-published-shapes';

export type PlanTripRequest = {
  origin: Coordinate;
  destination: Coordinate;
  shapes: PublishedShape[];
  preferences?: Omit<PlannerPreferences, 'shapes'>;
};

type WorkerMsgIn = { id: number; payload: PlanTripRequest };
type WorkerMsgOut =
  | { id: number; ok: true; plans: TripPlan[]; durationMs: number }
  | { id: number; ok: false; error: string; durationMs: number };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  number,
  {
    resolve: (plans: TripPlan[]) => void;
    reject: (err: Error) => void;
    onProgress?: (ms: number) => void;
  }
>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./plan-trip.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (ev: MessageEvent<WorkerMsgOut>) => {
      const data = ev.data;
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      if (data.ok) p.resolve(data.plans);
      else p.reject(new Error(data.error || 'plan_failed'));
    };
    worker.onerror = () => {
      // Si el worker muere, las siguientes irán al fallback
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

/** Cancela listeners pendientes (las respuestas del worker se ignoran). */
export function cancelPendingPlanJobs() {
  for (const [id, p] of pending) {
    pending.delete(id);
    p.reject(new Error('cancelled'));
  }
  seq += 1;
}

/**
 * Planifica viaje fuera del hilo principal si el Worker está disponible.
 */
export async function planTripAsync(
  origin: Coordinate,
  destination: Coordinate,
  shapes: PublishedShape[],
  preferences: Omit<PlannerPreferences, 'shapes'> = {}
): Promise<{ plans: TripPlan[]; durationMs: number; via: 'worker' | 'main' }> {
  const id = ++seq;
  const w = getWorker();
  const payload: PlanTripRequest = { origin, destination, shapes, preferences };

  if (w) {
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      pending.set(id, {
        resolve: (plans) =>
          resolve({ plans, durationMs: Math.round(performance.now() - t0), via: 'worker' }),
        reject: (err) => {
          if (err.message === 'cancelled') reject(err);
          else {
            // Fallback main thread
            void planOnMain(origin, destination, shapes, preferences)
              .then(resolve)
              .catch(reject);
          }
        },
      });
      const msg: WorkerMsgIn = { id, payload };
      try {
        w.postMessage(msg);
      } catch {
        pending.delete(id);
        void planOnMain(origin, destination, shapes, preferences).then(resolve).catch(reject);
      }
    });
  }

  return planOnMain(origin, destination, shapes, preferences);
}

async function planOnMain(
  origin: Coordinate,
  destination: Coordinate,
  shapes: PublishedShape[],
  preferences: Omit<PlannerPreferences, 'shapes'>
): Promise<{ plans: TripPlan[]; durationMs: number; via: 'worker' | 'main' }> {
  const t0 = performance.now();
  const { planTrip } = await import('./planner');
  const plans = await planTrip(origin, destination, { ...preferences, shapes });
  return {
    plans,
    durationMs: Math.round(performance.now() - t0),
    via: 'main',
  };
}
