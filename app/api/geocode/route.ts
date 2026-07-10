import { NextResponse } from 'next/server';
import { MORELIA_BBOX } from '@/lib/search/morelia-places';
import { clientIpFromHeaders, rateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

type NominatimRow = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  importance?: number;
};

function mapResults(raw: NominatimRow[]) {
  return raw.map((r) => {
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
      importance: r.importance ?? 0,
    };
  });
}

async function nominatimSearch(q: string, opts: { bounded: boolean; limit: number }) {
  const viewbox = `${MORELIA_BBOX.west},${MORELIA_BBOX.north},${MORELIA_BBOX.east},${MORELIA_BBOX.south}`;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${q}, Morelia, Michoacán, México`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(opts.limit));
  url.searchParams.set('countrycodes', 'mx');
  url.searchParams.set('viewbox', viewbox);
  if (opts.bounded) url.searchParams.set('bounded', '1');

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'ViaMorelia/1.0 (https://viamorelia.org; rutas transporte morelia)',
      Accept: 'application/json',
      'Accept-Language': 'es-MX,es;q=0.9',
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return (await res.json()) as NominatimRow[];
}

/**
 * Geocoding OSM Nominatim acotado a Morelia.
 * - Más resultados (limit alto)
 * - Si bounded devuelve poco, reintenta sin bounded (sigue en MX + viewbox)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const ip = clientIpFromHeaders(request.headers);
  const rl = rateLimit(`geocode:${ip}`, { limit: 40, windowMs: 60_000 });
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

  try {
    let raw = await nominatimSearch(q, { bounded: true, limit: 15 });
    // Ampliar cobertura si hay pocas coincidencias en el bbox estricto
    if (raw.length < 5) {
      try {
        const wider = await nominatimSearch(q, { bounded: false, limit: 15 });
        const seen = new Set(raw.map((r) => r.place_id));
        for (const row of wider) {
          if (seen.has(row.place_id)) continue;
          // Filtrar a bbox suave de Morelia
          const lng = parseFloat(row.lon);
          const lat = parseFloat(row.lat);
          if (
            lng >= MORELIA_BBOX.west - 0.08 &&
            lng <= MORELIA_BBOX.east + 0.08 &&
            lat >= MORELIA_BBOX.south - 0.08 &&
            lat <= MORELIA_BBOX.north + 0.08
          ) {
            raw.push(row);
            seen.add(row.place_id);
          }
        }
      } catch {
        /* keep first batch */
      }
    }

    // Ordenar por importance de Nominatim (luego el cliente re-rankea por query)
    raw.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));

    const results = mapResults(raw).slice(0, 20);
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
