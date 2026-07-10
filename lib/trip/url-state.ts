import type { Coordinate } from '@/lib/routing/planner';

export type TripUrlState = {
  origin: Coordinate | null;
  destination: Coordinate | null;
  originLabel?: string;
  destinationLabel?: string;
  routeId?: string | null;
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

export function readTripUrlState(search?: string): TripUrlState {
  const sp = new URLSearchParams(
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  );
  const from = parseCoordParam(sp.get('from'));
  const to = parseCoordParam(sp.get('to'));
  const originLabel = sp.get('fromLabel') || sp.get('ol') || undefined;
  const destinationLabel = sp.get('toLabel') || sp.get('dl') || undefined;
  const routeId = sp.get('route');
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
    planIndex,
  };
}

export type BuildTripUrlOpts = {
  origin?: Coordinate | null;
  destination?: Coordinate | null;
  originLabel?: string | null;
  destinationLabel?: string | null;
  routeId?: string | null;
  planIndex?: number | null;
  base?: string;
};

/** Construye URL compartible del viaje (sin basura en query). */
export function buildTripShareUrl(opts: BuildTripUrlOpts): string {
  const base =
    opts.base ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '/');
  const url = new URL(base, typeof window !== 'undefined' ? window.location.origin : 'http://local');
  // limpia params de viaje previos
  ['from', 'to', 'fromLabel', 'toLabel', 'ol', 'dl', 'route', 'plan', 'admin'].forEach((k) =>
    url.searchParams.delete(k)
  );

  if (opts.origin) url.searchParams.set('from', formatCoordParam(opts.origin));
  if (opts.destination) url.searchParams.set('to', formatCoordParam(opts.destination));
  if (opts.originLabel?.trim()) {
    url.searchParams.set('fromLabel', opts.originLabel.trim().slice(0, 80));
  }
  if (opts.destinationLabel?.trim()) {
    url.searchParams.set('toLabel', opts.destinationLabel.trim().slice(0, 80));
  }
  if (opts.routeId) url.searchParams.set('route', opts.routeId);
  if (opts.planIndex != null && opts.planIndex > 0) {
    url.searchParams.set('plan', String(opts.planIndex));
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
