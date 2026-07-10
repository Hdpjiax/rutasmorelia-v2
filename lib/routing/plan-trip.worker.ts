/// <reference lib="webworker" />
/**
 * Web Worker: ejecuta planTrip sin bloquear el hilo de UI.
 * Solo usa shapes pasadas en el mensaje (no fetch).
 */

import { planTrip, type TripPlan } from './planner';
import type { PlanTripRequest } from './plan-trip-client';

type WorkerMsgIn = { id: number; payload: PlanTripRequest };
type WorkerMsgOut =
  | { id: number; ok: true; plans: TripPlan[]; durationMs: number }
  | { id: number; ok: false; error: string; durationMs: number };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (ev: MessageEvent<WorkerMsgIn>) => {
  const { id, payload } = ev.data;
  const t0 = performance.now();
  try {
    const plans = await planTrip(payload.origin, payload.destination, {
      ...(payload.preferences ?? {}),
      shapes: payload.shapes,
    });
    const out: WorkerMsgOut = {
      id,
      ok: true,
      plans,
      durationMs: Math.round(performance.now() - t0),
    };
    ctx.postMessage(out);
  } catch (e) {
    const out: WorkerMsgOut = {
      id,
      ok: false,
      error: e instanceof Error ? e.message : 'plan_failed',
      durationMs: Math.round(performance.now() - t0),
    };
    ctx.postMessage(out);
  }
};
