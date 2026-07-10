import type { TripPlan } from '@/lib/routing/planner';

/** Velocidad peatonal ~4.5 km/h con pausas de esquina */
export const WALK_SPEED_MPS = 1.2;
/** Combi urbana en Morelia (incluye semáforos) ~22 km/h promedio */
export const TRANSIT_SPEED_MPS = 6.1;

export function formatDurationSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—';
  const m = Math.round(sec / 60);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} h ${rm} min` : `${h} h`;
}

export function formatWalkMeters(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m < 1000) return `${Math.round(m)} m a pie`;
  return `${(m / 1000).toFixed(1)} km a pie`;
}

export function formatDistanceKm(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function transferCount(plan: TripPlan): number {
  return Math.max(0, plan.segments.filter((s) => s.type === 'ride').length - 1);
}

export function rideCount(plan: TripPlan): number {
  return plan.segments.filter((s) => s.type === 'ride').length;
}

export type PlanSortMode = 'time' | 'walk' | 'transfers';

export function sortTripPlans(plans: TripPlan[], mode: PlanSortMode): TripPlan[] {
  const copy = [...plans];
  copy.sort((a, b) => {
    if (mode === 'walk') {
      if (Math.abs(a.walkDistanceTotal - b.walkDistanceTotal) > 25) {
        return a.walkDistanceTotal - b.walkDistanceTotal;
      }
      return a.totalDuration - b.totalDuration;
    }
    if (mode === 'transfers') {
      const ta = transferCount(a);
      const tb = transferCount(b);
      if (ta !== tb) return ta - tb;
      if (Math.abs(a.walkDistanceTotal - b.walkDistanceTotal) > 40) {
        return a.walkDistanceTotal - b.walkDistanceTotal;
      }
      return a.totalDuration - b.totalDuration;
    }
    // time (default)
    if (Math.abs(a.totalDuration - b.totalDuration) > 45) {
      return a.totalDuration - b.totalDuration;
    }
    if (transferCount(a) !== transferCount(b)) {
      return transferCount(a) - transferCount(b);
    }
    return a.walkDistanceTotal - b.walkDistanceTotal;
  });
  return copy;
}

export function planSummaryLabel(plan: TripPlan): string {
  const walks = formatWalkMeters(plan.walkDistanceTotal);
  const time = formatDurationSec(plan.totalDuration);
  const xfer = transferCount(plan);
  if (plan.type === 'direct') return `${time} · ${walks} · directo`;
  return `${time} · ${walks} · ${xfer} transbordo${xfer === 1 ? '' : 's'}`;
}
