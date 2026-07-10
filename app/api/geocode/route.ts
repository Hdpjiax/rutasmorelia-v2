import { NextResponse } from 'next/server';
import { MORELIA_BBOX } from '@/lib/search/morelia-places';
import { clientIpFromHeaders, rateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Geocoding OSM Nominatim acotado a Morelia.
 * Rate-limit por IP para no abusar de Nominatim (política de uso).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const ip = clientIpFromHeaders(request.headers);
  // ~1 req/s sostenido + burst: 30 / minuto por IP
  const rl = rateLimit(`geocode:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      {
        results: [],
        error: 'Demasiadas búsquedas. Espera un momento e inténtalo de nuevo.',
        code: 'RATE_LIMIT',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfterSec),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const viewbox = `${MORELIA_BBOX.west},${MORELIA_BBOX.north},${MORELIA_BBOX.east},${MORELIA_BBOX.south}`;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${q}, Morelia, Michoacán, México`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '8');
  url.searchParams.set('countrycodes', 'mx');
  url.searchParams.set('viewbox', viewbox);
  url.searchParams.set('bounded', '1');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'ViaMorelia/1.0 (https://viamorelia.org; rutas transporte morelia)',
        Accept: 'application/json',
        'Accept-Language': 'es-MX,es;q=0.9',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          results: [],
          error: `El mapa de lugares no respondió (${res.status}). Usa el catálogo local o toca el mapa.`,
          code: 'GEOCODE_UPSTREAM',
          degraded: true,
        },
        {
          status: 200,
          headers: { 'X-RateLimit-Remaining': String(rl.remaining) },
        }
      );
    }

    const raw = (await res.json()) as Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      type?: string;
      class?: string;
      importance?: number;
    }>;

    const results = raw.map((r) => {
      const parts = r.display_name.split(',').map((s) => s.trim());
      const name = parts[0] || r.display_name;
      const description = parts.slice(1, 4).join(', ');
      return {
        id: `geo-${r.place_id}`,
        name,
        description,
        category: r.type || r.class || 'place',
        coordinates: [parseFloat(r.lon), parseFloat(r.lat)] as [number, number],
        source: 'geocode' as const,
      };
    });

    return NextResponse.json(
      { results },
      { headers: { 'X-RateLimit-Remaining': String(rl.remaining) } }
    );
  } catch (e) {
    console.error('[geocode]', e);
    return NextResponse.json({
      results: [],
      error: e instanceof Error ? e.message : 'geocode failed',
      code: 'GEOCODE_FAILED',
      degraded: true,
    });
  }
}
