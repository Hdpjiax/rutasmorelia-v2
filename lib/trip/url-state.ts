import type { Coordinate, TripPlan } from '@/lib/routing/planner';

export type TripUrlState = {
  origin: Coordinate | null;
  destination: Coordinate | null;
  originLabel?: string;
  destinationLabel?: string;
  routeId?: string | null;
  /** Huella de rides: `id:ida|id2:vuelta` (paridad app Flutter) */
  routesFingerprint?: string | null;
  planIndex?: number;
};

const COORD_RE = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/;

/** Parse "lng,lat" */
export function parseCoordParam(raw: string | null | undefined): Coordinate | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!COORD_RE.test(s)) return null;
  const [a, b] = s.split(',').map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  // Accept lng,lat (Morelia lng ~ -101) or lat,lng if swapped
  if (a >= -102.5 && a <= -100 && b >= 19 && b <= 20.5) return [a, b];
  if (b >= -102.5 && b <= -100 && a >= 19 && a <= 20.5) return [b, a];
  // fallback as lng,lat
  if (Math.abs(a) <= 180 && Math.abs(b) <= 90) return [a, b];
  return null;
}

export function formatCoordParam(c: Coordinate, decimals = 5): string {
  return `${c[0].toFixed(decimals)},${c[1].toFixed(decimals)}`;
}

/** Huella estable de rides del plan: `ruta-id:ida|otra:vuelta` */
export function fingerprintForPlan(plan: TripPlan): string {
  const parts: string[] = [];
  for (const s of plan.segments) {
    if (s.type !== 'ride' || !s.routeId) continue;
    const dir = s.direction ?? 'ida';
    parts.push(`${s.routeId}:${dir}`);
  }
  return parts.join('|');
}

export function primaryRouteIdFromPlan(plan: TripPlan): string | null {
  for (const s of plan.segments) {
    if (s.type === 'ride' && s.routeId) return s.routeId;
  }
  return null;
}

/**
 * Elige el plan que mejor coincide con la huella compartida (app/web).
 * Prioridad: fingerprint exacto → ids de ruta → routeId suelto → planIndex → 0.
 */
export function matchPlanIndex(
  plans: TripPlan[],
  opts: {
    fingerprint?: string | null;
    routeId?: string | null;
    fallbackIndex?: number | null;
  } = {}
): number {
  if (!plans.length) return 0;
  const { fingerprint, routeId, fallbackIndex } = opts;

  if (fingerprint && fingerprint.trim()) {
    const target = fingerprint.trim().toLowerCase();
    for (let i = 0; i < plans.length; i++) {
      if (fingerprintForPlan(plans[i]).toLowerCase() === target) return i;
    }
    const want = new Set(
      target
        .split('|')
        .map((e) => e.split(':')[0])
        .filter(Boolean)
    );
    for (let i = 0; i < plans.length; i++) {
      const got = new Set(
        plans[i].segments
          .filter((s) => s.type === 'ride' && s.routeId)
          .map((s) => String(s.routeId).toLowerCase())
      );
      if (want.size > 0 && [...want].every((id) => got.has(id))) return i;
    }
  }

  if (routeId && routeId.trim()) {
    const id = routeId.trim().toLowerCase();
    for (let i = 0; i < plans.length; i++) {
      if (plans[i].segments.some((s) => s.routeId?.toLowerCase() === id)) return i;
    }
  }

  if (
    fallbackIndex != null &&
    Number.isFinite(fallbackIndex) &&
    fallbackIndex >= 0 &&
    fallbackIndex < plans.length
  ) {
    return Math.floor(fallbackIndex);
  }
  return 0;
}

export function readTripUrlState(search?: string): TripUrlState {
  const sp = new URLSearchParams(
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  );
  const from = parseCoordParam(sp.get('from'));
  const to = parseCoordParam(sp.get('to'));
  const originLabel = sp.get('fromLabel') || sp.get('ol') || undefined;
  const destinationLabel = sp.get('toLabel') || sp.get('dl') || undefined;
  const routeId = sp.get('route');
  const routesFp = sp.get('routes')?.trim() || null;
  const planRaw = sp.get('plan');
  const planIndex =
    planRaw != null && planRaw !== '' && Number.isFinite(Number(planRaw))
      ? Math.max(0, Math.floor(Number(planRaw)))
      : undefined;

  return {
    origin: from,
    destination: to,
    originLabel: originLabel ? decodeURIComponent(originLabel) : undefined,
    destinationLabel: destinationLabel ? decodeURIComponent(destinationLabel) : undefined,
    routeId: routeId || null,
    routesFingerprint: routesFp || null,
    planIndex,
  };
}

export type BuildTripUrlOpts = {
  origin?: Coordinate | null;
  destination?: Coordinate | null;
  originLabel?: string | null;
  destinationLabel?: string | null;
  routeId?: string | null;
  /** Huella `id:ida|id2:vuelta` del plan elegido */
  routesFingerprint?: string | null;
  planIndex?: number | null;
  base?: string;
};

/** Query keys usadas solo en enlaces de compartir (no se escriben en la barra al navegar). */
export const TRIP_SHARE_PARAM_KEYS = [
  'from',
  'to',
  'fromLabel',
  'toLabel',
  'ol',
  'dl',
  'route',
  'routes',
  'plan',
] as const;

/** True si la URL trae un viaje o ruta compartida. */
export function hasTripShareParams(search?: string): boolean {
  const sp = new URLSearchParams(
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  );
  return TRIP_SHARE_PARAM_KEYS.some((k) => {
    const v = sp.get(k);
    return v != null && v !== '';
  });
}

/** Quita params de viaje de un query string; conserva el resto (p. ej. admin). */
export function stripTripShareSearchParams(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const sp = new URLSearchParams(raw);
  for (const k of TRIP_SHARE_PARAM_KEYS) sp.delete(k);
  const next = sp.toString();
  return next ? `?${next}` : '';
}

/**
 * Quita params de viaje de la barra de direcciones sin recargar.
 * No toca otros params (p. ej. admin).
 */
export function clearTripShareParamsFromLocation(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const before = url.search;
    url.search = stripTripShareSearchParams(url.search);
    if (url.search !== before) {
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  } catch {
    /* ignore */
  }
}

/** Construye URL compartible del viaje (solo para botones Compartir / Copiar enlace). */
export function buildTripShareUrl(opts: BuildTripUrlOpts): string {
  const base =
    opts.base ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '/');
  const url = new URL(base, typeof window !== 'undefined' ? window.location.origin : 'http://local');
  // limpia params de viaje previos (no admin: no se incluye en enlaces de viaje)
  TRIP_SHARE_PARAM_KEYS.forEach((k) => url.searchParams.delete(k));

  if (opts.origin) url.searchParams.set('from', formatCoordParam(opts.origin));
  if (opts.destination) url.searchParams.set('to', formatCoordParam(opts.destination));
  if (opts.originLabel?.trim()) {
    url.searchParams.set('fromLabel', opts.originLabel.trim().slice(0, 80));
  }
  if (opts.destinationLabel?.trim()) {
    url.searchParams.set('toLabel', opts.destinationLabel.trim().slice(0, 80));
  }
  if (opts.routeId) url.searchParams.set('route', opts.routeId);
  if (opts.routesFingerprint?.trim()) {
    url.searchParams.set('routes', opts.routesFingerprint.trim());
  }
  // Siempre incluir plan (incluido 0) si se pasa, para paridad con la app
  if (opts.planIndex != null && Number.isFinite(opts.planIndex)) {
    url.searchParams.set('plan', String(Math.max(0, Math.floor(opts.planIndex))));
  }

  return url.pathname + url.search + url.hash;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function shareOrCopyTripUrl(url: string, title = 'ViaMorelia — mi viaje'): Promise<'shared' | 'copied' | 'failed'> {
  const absolute =
    url.startsWith('http') || typeof window === 'undefined'
      ? url
      : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;

  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, url: absolute, text: 'Mira este viaje en ViaMorelia' });
      return 'shared';
    }
  } catch (e) {
    // user cancelled share → not failure if AbortError
    if (e instanceof Error && e.name === 'AbortError') return 'failed';
  }

  const ok = await copyTextToClipboard(absolute);
  return ok ? 'copied' : 'failed';
}
