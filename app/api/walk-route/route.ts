import { NextResponse } from 'next/server';
import { clientIpFromHeaders, rateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

type Coordinate = [number, number];

// Fallback de línea recta si hay fallos o desconexión
function getStraightLine(from: Coordinate, to: Coordinate) {
  return {
    type: 'Feature' as const,
    properties: { type: 'walk', source: 'fallback_straight_line' },
    geometry: {
      type: 'LineString',
      coordinates: [from, to],
    },
  };
}

// Consultar OSRM público de peatones
async function queryPublicOSRM(from: Coordinate, to: Coordinate): Promise<GeoJSON.Feature | null> {
  const url = `https://router.project-osrm.org/route/v1/foot/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5 segundos max

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ViaMorelia/1.0 (https://viamorelia.org; peatonal routing)',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route?.geometry) return null;

    return {
      type: 'Feature',
      properties: {
        type: 'walk',
        source: 'public_osrm_foot',
        distance: route.distance,
        duration: route.duration,
      },
      geometry: route.geometry,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[walk-route] Public OSRM failed:', err);
    return null;
  }
}

// Consultar Valhalla local (si está levantado en dev)
async function queryLocalValhalla(from: Coordinate, to: Coordinate): Promise<GeoJSON.Feature | null> {
  const valhallaUrl = process.env.VALHALLA_URL || 'http://127.0.0.1:8002';
  const url = `${valhallaUrl}/route`;

  const body = {
    locations: [
      { lon: from[0], lat: from[1], type: 'break' },
      { lon: to[0], lat: to[1], type: 'break' },
    ],
    costing: 'pedestrian',
    directions_options: { units: 'kilometers', language: 'es-MX' },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500); // Rápido en local

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    const leg = data.trip?.legs?.[0];
    if (!leg?.shape) return null;

    // Decodificar polilínea de Valhalla (6 decimales por defecto)
    const { decodePolyline6 } = await import('@/lib/gis/valhalla');
    const coords = decodePolyline6(leg.shape); // [lat, lon]
    const geojsonCoords: Coordinate[] = coords.map(([lat, lon]) => [lon, lat]);

    return {
      type: 'Feature',
      properties: {
        type: 'walk',
        source: 'local_valhalla_pedestrian',
        distance: data.trip.summary?.length * 1000 || 0,
        duration: data.trip.summary?.time || 0,
      },
      geometry: {
        type: 'LineString',
        coordinates: geojsonCoords,
      },
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[walk-route] Local Valhalla failed:', err);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromLng = parseFloat(searchParams.get('fromLng') || '');
  const fromLat = parseFloat(searchParams.get('fromLat') || '');
  const toLng = parseFloat(searchParams.get('toLng') || '');
  const toLat = parseFloat(searchParams.get('toLat') || '');

  if (isNaN(fromLng) || isNaN(fromLat) || isNaN(toLng) || isNaN(toLat)) {
    return NextResponse.json({ error: 'Coordenadas inválidas' }, { status: 400 });
  }

  const from: Coordinate = [fromLng, fromLat];
  const to: Coordinate = [toLng, toLat];

  // Rate Limit por IP
  const ip = clientIpFromHeaders(request.headers);
  const rl = rateLimit(`walk:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    // Si excede rate limit, responder inmediatamente con línea recta
    return NextResponse.json({
      feature: getStraightLine(from, to),
      rateLimited: true,
    });
  }

  // 1. Intentar local en desarrollo
  if (process.env.NODE_ENV === 'development') {
    const localValhalla = await queryLocalValhalla(from, to);
    if (localValhalla) {
      return NextResponse.json({ feature: localValhalla });
    }
  }

  // 2. Intentar OSRM público
  const publicOsrm = await queryPublicOSRM(from, to);
  if (publicOsrm) {
    return NextResponse.json({ feature: publicOsrm });
  }

  // 3. Fallback absoluto
  return NextResponse.json({
    feature: getStraightLine(from, to),
    degraded: true,
  });
}
